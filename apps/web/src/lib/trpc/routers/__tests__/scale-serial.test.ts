import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createTestDb, makeUser, SCHEMA_DDL } from "./helpers";

const { pg, db } = createTestDb();
mock.module("@/lib/db", () => ({ db, pglite: pg }));

const { scaleSerialRouter } = await import("../scale-serial");
const { createCallerFactory } = await import("../../init");
const { orders, orderItems, scaleReadings } = await import("@/lib/db/schema");
const callerAs = (uid: string) =>
	createCallerFactory(scaleSerialRouter)({ user: makeUser(uid) });

let orderId: number;
let orderItemId: number;

beforeAll(async () => {
	await pg.exec(SCHEMA_DDL);

	const [order] = await db
		.insert(orders)
		.values({
			user_uid: "u1",
			status: "PENDIENTE_PESAJE",
			requires_weighing: true,
			total_amount: "0",
		})
		.returning();

	orderId = order.id;

	const [orderItem] = await db
		.insert(orderItems)
		.values({
			order_id: orderId,
			product_name: "Pierna",
			status: "PENDIENTE_PESAJE",
			quantity_pieces: 3,
			unit_price: "100",
		})
		.returning();

	orderItemId = orderItem.id;
});

afterAll(async () => {
	await pg.close();
});

function captureInput(overrides: Record<string, unknown> = {}) {
	return {
		eventId: randomUUID(),
		orderItemId,
		pieceCount: 3,
		weight: 1.234,
		unit: "kg" as const,
		weightG: 1_234,
		stable: true,
		manual: false,
		raw: "1234",
		capturedAt: new Date().toISOString(),
		seq: 1,
		...overrides,
	};
}

describe("scaleSerialRouter", () => {
	it("guarda una captura de Web Serial", async () => {
		const input = captureInput();
		const result = await callerAs("u1").capture(input);

		expect(result.status).toBe("stored");

		const [reading] = await db
			.select()
			.from(scaleReadings)
			.where(eq(scaleReadings.event_id, input.eventId));

		expect(reading).toMatchObject({
			source: "pc-webserial",
			device_id: "pc-webserial",
			net: false,
			captured_by: "u1",
			order_id: orderId,
			order_item_id: orderItemId,
			piece_count: 3,
			weight_g: 1_234,
		});
	});

	it("hace idempotente el reintento con el mismo eventId", async () => {
		const input = captureInput();

		const first = await callerAs("u1").capture(input);
		const second = await callerAs("u1").capture(input);

		expect(first.status).toBe("stored");
		expect(second.status).toBe("duplicate");
		expect(second.id).toBe(first.id);

		const readings = await db
			.select()
			.from(scaleReadings)
			.where(eq(scaleReadings.event_id, input.eventId));

		expect(readings).toHaveLength(1);
	});

	it("rechaza un eventId utilizado por otro usuario", async () => {
		// Renglón de un pedido del sistema: ambos usuarios pueden capturar en él.
		const [sysOrder] = await db
			.insert(orders)
			.values({
				user_uid: "system",
				status: "PENDIENTE_PESAJE",
				requires_weighing: true,
				total_amount: "0",
			})
			.returning();
		const [sysItem] = await db
			.insert(orderItems)
			.values({
				order_id: sysOrder.id,
				product_name: "Lomo",
				status: "PENDIENTE_PESAJE",
				quantity_pieces: 1,
				unit_price: "100",
			})
			.returning();
		const input = captureInput({ orderItemId: sysItem.id });
		await callerAs("u1").capture(input);

		await expect(callerAs("u2").capture(input)).rejects.toMatchObject({
			code: "CONFLICT",
			message: "event_id ya usado",
		});
	});

	it("no permite capturar un renglón ajeno", async () => {
		await expect(
			callerAs("u2").capture(captureInput({ orderItemId: 999_999 })),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Renglón no encontrado",
		});
	});

	it("rechaza un weightG incoherente", async () => {
		await expect(
			callerAs("u1").capture(captureInput({ weightG: 1_000 })),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
	});

	it("convierte libras a gramos", async () => {
		const input = captureInput({
			weight: 1,
			unit: "lb" as const,
			weightG: 454,
		});

		const result = await callerAs("u1").capture(input);

		expect(result.status).toBe("stored");

		const [reading] = await db
			.select()
			.from(scaleReadings)
			.where(eq(scaleReadings.event_id, input.eventId));

		expect(reading.weight_g).toBe(454);
		expect(reading.unit).toBe("lb");
	});

	it("anula una captura y la excluye de lineCaptures", async () => {
		const input = captureInput();
		const captured = await callerAs("u1").capture(input);

		const voided = await callerAs("u1").void({ eventId: input.eventId });

		expect(voided.status).toBe("voided");

		const readings = await callerAs("u1").lineCaptures({ orderItemId });

		expect(readings.some((reading) => reading.id === captured.id)).toBe(false);
	});

	it("es idempotente al repetir el void", async () => {
		const input = captureInput();
		await callerAs("u1").capture(input);

		expect((await callerAs("u1").void({ eventId: input.eventId })).status).toBe(
			"voided",
		);
		expect((await callerAs("u1").void({ eventId: input.eventId })).status).toBe(
			"already_voided",
		);
	});

	it("devuelve not_found al anular un uuid inexistente", async () => {
		const result = await callerAs("u1").void({ eventId: randomUUID() });

		expect(result.status).toBe("not_found");
	});

	it("no permite que otro usuario anule una captura", async () => {
		const input = captureInput();
		await callerAs("u1").capture(input);

		const result = await callerAs("u2").void({ eventId: input.eventId });

		expect(result.status).toBe("not_found");

		const [reading] = await db
			.select()
			.from(scaleReadings)
			.where(eq(scaleReadings.event_id, input.eventId));

		expect(reading.voided_at).toBeNull();
	});

	it("no permite anular una captura consumida", async () => {
		const input = captureInput();
		await callerAs("u1").capture(input);

		await db
			.update(scaleReadings)
			.set({ consumed_at: new Date() })
			.where(eq(scaleReadings.event_id, input.eventId));

		await expect(
			callerAs("u1").void({ eventId: input.eventId }),
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "La captura ya se usó en un pesaje",
		});
	});

	it("devuelve una lista vacía para un renglón ajeno", async () => {
		const result = await callerAs("u2").lineCaptures({
			orderItemId: 999_999,
		});

		expect(result).toEqual([]);
	});
});
