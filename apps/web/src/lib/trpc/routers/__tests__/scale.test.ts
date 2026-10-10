import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { createTestDb, makeUser, SCHEMA_DDL } from "./helpers";

const { pg, db } = createTestDb();
mock.module("@/lib/db", () => ({ db, pglite: pg }));

const { scaleRouter } = await import("../scale");
const { ordersRouter } = await import("../orders");
const { createCallerFactory } = await import("../../init");
const { customers, products, orderItems, scaleReadings } = await import(
	"@/lib/db/schema"
);

const user = makeUser("scale-user");
const scale = createCallerFactory(scaleRouter)({ user });
const orders = createCallerFactory(ordersRouter)({ user });

const HASH = "a".repeat(64);
const prevEnv = {
	enabled: process.env.SCALE_INGEST_ENABLED,
	tokens: process.env.SCALE_DEVICE_TOKENS_SHA256,
};

let customerId: number;
let productId: number;
let seq = 0;

async function insertReading(
	over: Partial<typeof scaleReadings.$inferInsert> = {},
) {
	const [row] = await db
		.insert(scaleReadings)
		.values({
			event_id: randomUUID(),
			device_id: "rss3-01",
			seq: ++seq,
			weight: "1.250",
			unit: "kg",
			weight_g: 1250,
			stable: true,
			...over,
		})
		.returning();
	return row;
}

async function pendingItem() {
	const order = await orders.create({
		customerId,
		items: [{ productId, quantityKg: 1000, unitPrice: 100 }],
	});
	const [item] = await db
		.select()
		.from(orderItems)
		.where(eq(orderItems.order_id, order.id));
	return item;
}

beforeAll(async () => {
	await pg.exec(SCHEMA_DDL);
	process.env.SCALE_INGEST_ENABLED = "true";
	process.env.SCALE_DEVICE_TOKENS_SHA256 = `rss3-01:${HASH},rss3-02:${HASH}`;
	const [c] = await db
		.insert(customers)
		.values({ name: "Cliente", email: "scale@t.com", user_uid: "scale-user" })
		.returning();
	customerId = c.id;
	const [p] = await db
		.insert(products)
		.values({
			name: "Lomo",
			user_uid: "scale-user",
			is_sellable_by_weight: true,
		})
		.returning();
	productId = p.id;
});

afterAll(async () => {
	process.env.SCALE_INGEST_ENABLED = prevEnv.enabled;
	process.env.SCALE_DEVICE_TOKENS_SHA256 = prevEnv.tokens;
	if (prevEnv.enabled === undefined) delete process.env.SCALE_INGEST_ENABLED;
	if (prevEnv.tokens === undefined)
		delete process.env.SCALE_DEVICE_TOKENS_SHA256;
	await pg.close();
});

describe("scale.status", () => {
	it("con ingesta activa devuelve solo IDs de dispositivo", async () => {
		const s = await scale.status();
		expect(s).toEqual({ enabled: true, devices: ["rss3-01", "rss3-02"] });
		expect(JSON.stringify(s)).not.toContain(HASH);
	});

	it("apagada: enabled=false y latest=null sin consultar", async () => {
		process.env.SCALE_INGEST_ENABLED = "false";
		try {
			expect(await scale.status()).toEqual({ enabled: false, devices: [] });
			expect(await scale.latest({ deviceId: "rss3-01" })).toBeNull();
		} finally {
			process.env.SCALE_INGEST_ENABLED = "true";
		}
	});
});

describe("scale.latest", () => {
	it("devuelve la última estable sin consumir del dispositivo", async () => {
		await insertReading({ weight_g: 1000, weight: "1.000" });
		const last = await insertReading({ weight_g: 2000, weight: "2.000" });
		await insertReading({ weight_g: 3000, weight: "3.000", stable: false });
		await insertReading({
			device_id: "rss3-02",
			weight_g: 9000,
			weight: "9.000",
		});

		const r = await scale.latest({ deviceId: "rss3-01" });
		expect(r?.id).toBe(last.id);
		expect(r?.weight_g).toBe(2000);
	});

	it("ignora lecturas consumidas o de hace más de 10 minutos", async () => {
		const consumed = await insertReading({ device_id: "dev-a" });
		await db
			.update(scaleReadings)
			.set({ consumed_at: new Date() })
			.where(eq(scaleReadings.id, consumed.id));
		await insertReading({ device_id: "dev-b" });
		await db
			.update(scaleReadings)
			.set({ received_at: sql`now() - interval '11 minutes'` })
			.where(eq(scaleReadings.device_id, "dev-b"));

		expect(await scale.latest({ deviceId: "dev-a" })).toBeNull();
		expect(await scale.latest({ deviceId: "dev-b" })).toBeNull();
	});
});

describe("orders.updateOrderItemWeight con scaleReadingId", () => {
	it("marca la lectura como consumida por el usuario y el renglón", async () => {
		const reading = await insertReading({ device_id: "dev-c" });
		const item = await pendingItem();
		await orders.updateOrderItemWeight({
			orderItemId: item.id,
			actualWeightGrams: 1250,
			scaleReadingId: reading.id,
		});
		const [r] = await db
			.select()
			.from(scaleReadings)
			.where(eq(scaleReadings.id, reading.id));
		expect(r.consumed_at).toBeInstanceOf(Date);
		expect(r.consumed_by).toBe("scale-user");
		expect(r.consumed_order_item_id).toBe(item.id);
		expect(await scale.latest({ deviceId: "dev-c" })).toBeNull();
	});

	it("una lectura ya usada → CONFLICT y el renglón NO se pesa", async () => {
		const reading = await insertReading({ device_id: "dev-d" });
		const first = await pendingItem();
		await orders.updateOrderItemWeight({
			orderItemId: first.id,
			actualWeightGrams: 1250,
			scaleReadingId: reading.id,
		});

		const second = await pendingItem();
		await expect(
			orders.updateOrderItemWeight({
				orderItemId: second.id,
				actualWeightGrams: 1250,
				scaleReadingId: reading.id,
			}),
		).rejects.toMatchObject({ code: "CONFLICT" });
		const [it2] = await db
			.select()
			.from(orderItems)
			.where(eq(orderItems.id, second.id));
		expect(it2.status).toBe("PENDIENTE_PESAJE");
	});

	it("sin scaleReadingId sigue funcionando (peso manual)", async () => {
		const item = await pendingItem();
		const res = await orders.updateOrderItemWeight({
			orderItemId: item.id,
			actualWeightGrams: 800,
		});
		expect(res.success).toBe(true);
	});
});
