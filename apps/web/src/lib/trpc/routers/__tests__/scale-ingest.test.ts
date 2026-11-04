import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createTestDb, SCHEMA_DDL } from "./helpers";

const { pg, db } = createTestDb();
mock.module("@/lib/db", () => ({ db, pglite: pg }));

const { handleScaleIngest, parseDeviceTokenHashes, MAX_BODY_BYTES } =
	await import("@/lib/scale/ingest");
const { scaleReadings } = await import("@/lib/db/schema");
const { proxy } = await import("@/proxy");
const { NextRequest } = await import("next/server");

// Tokens de PRUEBA (no reales): solo existen en este archivo.
const TOKEN = "test-token-rss3-01";
const OTHER_TOKEN = "test-token-rss3-02";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const ENV = {
	SCALE_INGEST_ENABLED: "true",
	SCALE_DEVICE_TOKENS_SHA256: `rss3-01:${sha(TOKEN)}, rss3-02:${sha(OTHER_TOKEN)}`,
};

function reading(over: Record<string, unknown> = {}) {
	return {
		event_id: randomUUID(),
		device_id: "rss3-01",
		seq: 1,
		weight: 12.345,
		unit: "kg",
		weight_g: 12345,
		stable: true,
		net: false,
		raw: "ST,GS,+012.345kg",
		captured_at: null,
		...over,
	};
}

function post(
	body: unknown,
	{
		token = TOKEN,
		deviceId = "rss3-01",
		contentType = "application/json",
	}: { token?: string | null; deviceId?: string; contentType?: string } = {},
) {
	const headers: Record<string, string> = {
		"Content-Type": contentType,
		"X-Device-Id": deviceId,
	};
	if (token !== null) headers.Authorization = `Bearer ${token}`;
	return new Request("https://example.test/api/scale/ingest", {
		method: "POST",
		headers,
		body: typeof body === "string" ? body : JSON.stringify(body),
	});
}

async function count() {
	const rows = await db.select().from(scaleReadings);
	return rows.length;
}

beforeAll(async () => {
	await pg.exec(SCHEMA_DDL);
});

afterAll(async () => {
	await pg.close();
});

describe("scale ingest — apagador y autenticación", () => {
	it("503 si SCALE_INGEST_ENABLED no es 'true' (default apagado)", async () => {
		for (const env of [
			{},
			{ ...ENV, SCALE_INGEST_ENABLED: "false" },
			{ ...ENV, SCALE_INGEST_ENABLED: "1" },
		]) {
			const res = await handleScaleIngest(post(reading()), env);
			expect(res.status).toBe(503);
			expect(await res.json()).toEqual({ error: "ingest_disabled" });
		}
		expect(await count()).toBe(0);
	});

	it("401 sin token o con token incorrecto", async () => {
		expect(
			(await handleScaleIngest(post(reading(), { token: null }), ENV)).status,
		).toBe(401);
		expect(
			(await handleScaleIngest(post(reading(), { token: "otro" }), ENV)).status,
		).toBe(401);
		// Token válido de OTRO dispositivo tampoco sirve.
		expect(
			(await handleScaleIngest(post(reading(), { token: OTHER_TOKEN }), ENV))
				.status,
		).toBe(401);
	});

	it("403 con dispositivo desconocido o X-Device-Id ≠ device_id", async () => {
		expect(
			(await handleScaleIngest(post(reading(), { deviceId: "nadie" }), ENV))
				.status,
		).toBe(403);
		const res = await handleScaleIngest(
			post(reading({ device_id: "rss3-02" })),
			ENV,
		);
		expect(res.status).toBe(403);
		expect(await count()).toBe(0);
	});

	it("415 si no es JSON", async () => {
		const res = await handleScaleIngest(
			post(reading(), { contentType: "text/plain" }),
			ENV,
		);
		expect(res.status).toBe(415);
	});

	it("parseDeviceTokenHashes ignora entradas mal formadas", () => {
		const map = parseDeviceTokenHashes(
			`ok-1:${sha("x")},MAL:${sha("y")},sinhash,dev:zz`,
		);
		expect([...map.keys()]).toEqual(["ok-1"]);
	});
});

describe("scale ingest — validación", () => {
	it("400 con JSON inválido o campos faltantes", async () => {
		expect((await handleScaleIngest(post("{no json"), ENV)).status).toBe(400);
		const { weight_g: _omit, ...sinGramos } = reading();
		const res = await handleScaleIngest(post(sinGramos), ENV);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("invalid_body");
	});

	it("400 si weight_g no coincide con weight + unit", async () => {
		const res = await handleScaleIngest(
			post(reading({ weight: 12.345, weight_g: 12000 })),
			ENV,
		);
		expect(res.status).toBe(400);
	});

	it("400 con unidad o rango inválidos", async () => {
		expect(
			(await handleScaleIngest(post(reading({ unit: "oz" })), ENV)).status,
		).toBe(400);
		expect(
			(
				await handleScaleIngest(
					post(reading({ weight: 5000, weight_g: 5_000_000 })),
					ENV,
				)
			).status,
		).toBe(400);
	});

	it("413 si el cuerpo pasa de 2 KB", async () => {
		const res = await handleScaleIngest(
			post(reading({ raw: "x".repeat(MAX_BODY_BYTES) })),
			ENV,
		);
		expect(res.status).toBe(413);
	});
});

describe("scale ingest — guardado e idempotencia", () => {
	it("201 guarda la lectura; captured_at null → received_at del servidor", async () => {
		const r = reading({ seq: 10 });
		const res = await handleScaleIngest(post(r), ENV);
		expect(res.status).toBe(201);
		const body = await res.json();
		expect(body.status).toBe("stored");

		const [row] = await db
			.select()
			.from(scaleReadings)
			.where(eq(scaleReadings.id, body.id));
		expect(row.event_id).toBe(r.event_id);
		expect(row.device_id).toBe("rss3-01");
		expect(row.weight_g).toBe(12345);
		expect(Number(row.weight)).toBeCloseTo(12.345, 3);
		expect(row.stable).toBe(true);
		expect(row.captured_at).toBeNull();
		expect(row.received_at).toBeInstanceOf(Date);
		expect(row.consumed_at).toBeNull();
	});

	it("acepta lb y g, captured_at ISO y pistas de pedido", async () => {
		const lb = await handleScaleIngest(
			post(
				reading({
					weight: 10,
					unit: "lb",
					weight_g: 4536,
					captured_at: "2026-10-10T18:55:00Z",
					order_id: 7,
					order_line_id: 9,
					piece_count: 2,
				}),
			),
			ENV,
		);
		expect(lb.status).toBe(201);
		const { id } = await lb.json();
		const [row] = await db
			.select()
			.from(scaleReadings)
			.where(eq(scaleReadings.id, id));
		expect(row.captured_at?.toISOString()).toBe("2026-10-10T18:55:00.000Z");
		expect(row.order_item_id).toBe(9);
		expect(row.piece_count).toBe(2);

		const g = await handleScaleIngest(
			post(reading({ weight: 850, unit: "g", weight_g: 850 })),
			ENV,
		);
		expect(g.status).toBe(201);
	});

	it("200 'duplicate' al reenviar el mismo event_id (no duplica filas)", async () => {
		const r = reading({ seq: 20 });
		const first = await handleScaleIngest(post(r), ENV);
		expect(first.status).toBe(201);
		const { id } = await first.json();
		const before = await count();

		const again = await handleScaleIngest(post(r), ENV);
		expect(again.status).toBe(200);
		expect(await again.json()).toEqual({ status: "duplicate", id });
		expect(await count()).toBe(before);
	});

	it("409 si el event_id ya existe para otro dispositivo", async () => {
		const r = reading({ seq: 30 });
		expect((await handleScaleIngest(post(r), ENV)).status).toBe(201);
		const res = await handleScaleIngest(
			post(
				{ ...r, device_id: "rss3-02" },
				{ token: OTHER_TOKEN, deviceId: "rss3-02" },
			),
			ENV,
		);
		expect(res.status).toBe(409);
	});
});

describe("proxy", () => {
	it("deja pasar POST /api/scale/ingest sin sesión", async () => {
		const res = await proxy(
			new NextRequest("https://example.test/api/scale/ingest", {
				method: "POST",
			}),
		);
		expect(res.headers.get("location")).toBeNull();
		expect(res.status).toBe(200);
	});

	it("otras rutas /api sin sesión siguen yendo a /login", async () => {
		const res = await proxy(
			new NextRequest("https://example.test/api/scale/otra"),
		);
		expect(res.headers.get("location")).toContain("/login");
	});
});
