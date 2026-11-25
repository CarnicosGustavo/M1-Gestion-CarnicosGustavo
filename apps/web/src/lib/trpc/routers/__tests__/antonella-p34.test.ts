import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	mock,
} from "bun:test";
import { eq } from "drizzle-orm";
import { createTestDb, makeUser, SCHEMA_DDL } from "./helpers";

const { pg, db } = createTestDb();
mock.module("@/lib/db", () => ({ db, pglite: pg }));

const { antonicellaRouter } = await import("../antonella");
const { createCallerFactory } = await import("../../init");
const { resetAntonellaRateLimits } = await import("@/lib/ai/antonella-access");
const {
	antonellaMemories,
	antonellaDatasets,
	antonellaDatasetRows,
	customers,
	products,
} = await import("@/lib/db/schema");

const ANTONELLA_DDL = `
CREATE TABLE IF NOT EXISTS antonella_config (
	id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	user_uid VARCHAR(255) NOT NULL UNIQUE,
	system_prompt TEXT NOT NULL DEFAULT '',
	disabled_tools JSONB NOT NULL DEFAULT '[]',
	custom_tools JSONB NOT NULL DEFAULT '[]',
	model VARCHAR(100) NOT NULL DEFAULT 'claude-opus-4-8',
	created_at TIMESTAMP DEFAULT NOW(),
	updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS antonella_memories (
	id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	user_uid VARCHAR(255) NOT NULL,
	category VARCHAR(80) NOT NULL DEFAULT 'general',
	title VARCHAR(200) NOT NULL,
	content TEXT NOT NULL,
	tags JSONB NOT NULL DEFAULT '[]',
	importance INTEGER NOT NULL DEFAULT 1,
	created_at TIMESTAMP DEFAULT NOW(),
	updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS antonella_datasets (
	id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	user_uid VARCHAR(255) NOT NULL,
	name VARCHAR(120) NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	columns JSONB NOT NULL DEFAULT '[]',
	created_at TIMESTAMP DEFAULT NOW(),
	updated_at TIMESTAMP DEFAULT NOW(),
	UNIQUE(user_uid, name)
);
CREATE TABLE IF NOT EXISTS antonella_dataset_rows (
	id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	dataset_id INTEGER NOT NULL REFERENCES antonella_datasets(id) ON DELETE CASCADE,
	data JSONB NOT NULL DEFAULT '{}',
	created_at TIMESTAMP DEFAULT NOW()
);
`;

const callerAs = (uid: string, role: "admin" | "cajero" | "almacen") =>
	createCallerFactory(antonicellaRouter)({
		user: { ...makeUser(uid), role },
	});

const realFetch = globalThis.fetch;
let prevCarnicosKey: string | undefined;
let prevAnthropicKey: string | undefined;
let customerId: number;
let productId: number;

beforeAll(async () => {
	await pg.exec(SCHEMA_DDL);
	await pg.exec(ANTONELLA_DDL);
	const [cust] = await db
		.insert(customers)
		.values({ name: "Mercado San Juan", user_uid: "admin-1" })
		.returning();
	customerId = cust.id;
	const [prod] = await db
		.insert(products)
		.values({ name: "PIERNA", category: "Cortes", user_uid: "admin-1" })
		.returning();
	productId = prod.id;
});

afterAll(async () => {
	await pg.close();
});

beforeEach(() => {
	prevCarnicosKey = process.env.CARNICOS_XAI_API_KEY;
	prevAnthropicKey = process.env.ANTHROPIC_API_KEY;
	process.env.CARNICOS_XAI_API_KEY = "test-carnicos-key";
	delete process.env.ANTHROPIC_API_KEY;
	resetAntonellaRateLimits();
});

afterEach(() => {
	globalThis.fetch = realFetch;
	if (prevCarnicosKey === undefined) delete process.env.CARNICOS_XAI_API_KEY;
	else process.env.CARNICOS_XAI_API_KEY = prevCarnicosKey;
	if (prevAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY;
	else process.env.ANTHROPIC_API_KEY = prevAnthropicKey;
});

describe("antonella router (P34-2, P34-3, P34-4, P34-5)", () => {
	it("P34-2: bloquea cajero/almacén (FORBIDDEN) y aplica rate limit a admin", async () => {
		const cajero = callerAs("cajero-1", "cajero");
		const almacen = callerAs("almacen-1", "almacen");
		await expect(cajero.voiceInfo()).rejects.toThrow(/Acceso restringido/);
		await expect(almacen.chat({ message: "hola" })).rejects.toThrow(
			/Acceso restringido/,
		);
		await expect(
			cajero.parseVoiceOrder({ text: "8 piernas para San Juan" }),
		).rejects.toThrow(/Acceso restringido/);

		const admin = callerAs("admin-rl", "admin");
		globalThis.fetch = mock(async () => {
			return new Response(
				JSON.stringify({
					status: "completed",
					output: [
						{
							type: "function_call",
							call_id: "c1",
							name: "not_an_order",
							arguments: "{}",
						},
					],
				}),
			);
		}) as any;
		for (let i = 0; i < 20; i++) {
			const res = await admin.parseVoiceOrder({ text: "¿cuánto stock hay?" });
			expect(res.kind).toBe("question");
		}
		await expect(
			admin.parseVoiceOrder({ text: "¿cuánto stock hay?" }),
		).rejects.toThrow(/Demasiadas notas de voz/);
	});

	it("P34-3: remember, forget, create_dataset y add_data piden confirmación sin tocar la BD hasta executeAction", async () => {
		const admin = callerAs("admin-1", "admin");
		let turn = 0;
		globalThis.fetch = mock(async () => {
			turn += 1;
			if (turn === 1) {
				return new Response(
					JSON.stringify({
						status: "completed",
						output: [
							{
								type: "function_call",
								call_id: "mem1",
								name: "remember",
								arguments: JSON.stringify({
									title: "Entrega La Barca",
									content: "Entrega los martes",
									category: "proveedores",
								}),
							},
						],
					}),
				);
			}
			return new Response(
				JSON.stringify({
					status: "completed",
					output: [
						{
							type: "message",
							content: [
								{ type: "output_text", text: "Confirma para guardar el dato." },
							],
						},
					],
				}),
			);
		}) as any;

		const chatRes = await admin.chat({
			message: "Recuerda que La Barca entrega los martes",
		});
		expect(chatRes.requiresConfirmation).toBe(true);
		expect((chatRes.confirmationData as any)?.toolName).toBe("remember");

		// Antes de confirmar: la tabla sigue vacía
		const before = await db
			.select()
			.from(antonellaMemories)
			.where(eq(antonellaMemories.user_uid, "admin-1"));
		expect(before).toHaveLength(0);

		// Confirmación explícita vía executeAction
		const execRemember = await admin.executeAction({
			actionName: "remember",
			actionInput: (chatRes.confirmationData as any).toolInput,
		});
		expect(execRemember.success).toBe(true);
		const after = await db
			.select()
			.from(antonellaMemories)
			.where(eq(antonellaMemories.user_uid, "admin-1"));
		expect(after).toHaveLength(1);
		expect(after[0]?.title).toBe("Entrega La Barca");

		// create_dataset + add_data + forget también requieren confirmación primero
		for (const tool of [
			{
				name: "create_dataset",
				args: { name: "mermas", columns: ["fecha", "kg"] },
			},
			{
				name: "add_data",
				args: { dataset: "mermas", row: { fecha: "2026-11-25", kg: 2 } },
			},
			{ name: "forget", args: { title: "Entrega La Barca" } },
		] as const) {
			turn = 0;
			globalThis.fetch = mock(async () => {
				turn += 1;
				if (turn === 1) {
					return new Response(
						JSON.stringify({
							status: "completed",
							output: [
								{
									type: "function_call",
									call_id: `call-${tool.name}`,
									name: tool.name,
									arguments: JSON.stringify(tool.args),
								},
							],
						}),
					);
				}
				return new Response(
					JSON.stringify({
						status: "completed",
						output: [
							{
								type: "message",
								content: [{ type: "output_text", text: "Confirma en la UI." }],
							},
						],
					}),
				);
			}) as any;

			const res = await admin.chat({ message: `Ejecuta ${tool.name}` });
			expect(res.requiresConfirmation).toBe(true);
			expect((res.confirmationData as any)?.toolName).toBe(tool.name);
		}

		// Sin executeAction, datasets sigue vacío y la memoria sigue viva
		expect(await db.select().from(antonellaDatasets)).toHaveLength(0);
		expect(await db.select().from(antonellaMemories)).toHaveLength(1);

		// Confirmar create_dataset, add_data y forget
		expect(
			(
				await admin.executeAction({
					actionName: "create_dataset",
					actionInput: { name: "mermas", columns: ["fecha", "kg"] },
				})
			).success,
		).toBe(true);
		expect(
			(
				await admin.executeAction({
					actionName: "add_data",
					actionInput: {
						dataset: "mermas",
						row: { fecha: "2026-11-25", kg: 2 },
					},
				})
			).success,
		).toBe(true);
		expect(await db.select().from(antonellaDatasetRows)).toHaveLength(1);
		expect(
			(
				await admin.executeAction({
					actionName: "forget",
					actionInput: { title: "Entrega La Barca" },
				})
			).success,
		).toBe(true);
		expect(await db.select().from(antonellaMemories)).toHaveLength(0);
	});

	it("P34-4 / P34-5: parseVoiceOrder valida catálogo y oculta cuerpo crudo xAI si falla sin respaldo", async () => {
		const admin = callerAs("admin-1", "admin");
		globalThis.fetch = mock(async () => {
			return new Response(
				JSON.stringify({
					status: "completed",
					output: [
						{
							type: "function_call",
							call_id: "ord-1",
							name: "propose_order",
							arguments: JSON.stringify({
								customer_id: customerId,
								customer_said: "Mercado San Juan",
								lines: [{ product_id: productId, pieces: 8, kg: null }],
								unmatched: [],
							}),
						},
					],
				}),
			);
		}) as any;

		const parsed = await admin.parseVoiceOrder({
			text: "Pedido para Mercado San Juan 8 piernas",
		});
		expect(parsed).toEqual({
			kind: "order",
			customerId,
			customerQuery: "Mercado San Juan",
			lines: [{ productId, pieces: 8, kg: null }],
			unmatched: [],
		});

		// Fallo 500 de xAI (aunque haya ANTHROPIC_API_KEY): error limpio y cero llamadas a Anthropic
		process.env.ANTHROPIC_API_KEY = "no-debe-usarse";
		const urls: string[] = [];
		globalThis.fetch = mock(async (url: any) => {
			urls.push(String(url));
			return new Response(
				'{"error":{"message":"detalle interno proveedor xAI xyz"}}',
				{ status: 500 },
			);
		}) as any;

		let caughtMsg = "";
		try {
			await admin.parseVoiceOrder({ text: "8 piernas" });
		} catch (e) {
			caughtMsg = e instanceof Error ? e.message : String(e);
		}
		expect(caughtMsg).toContain("no pudo procesar");
		expect(caughtMsg).not.toContain("detalle interno proveedor xAI xyz");
		expect(caughtMsg).not.toContain("500");
		expect(urls.some((u) => u.includes("api.x.ai"))).toBe(true);
		expect(urls.some((u) => /anthropic/i.test(u))).toBe(false);
	});
});
