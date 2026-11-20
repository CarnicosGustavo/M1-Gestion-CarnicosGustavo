import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { eq } from "drizzle-orm";
import { createTestDb, makeUser, SCHEMA_DDL } from "./helpers";

const { pg, db } = createTestDb();
mock.module("@/lib/db", () => ({ db, pglite: pg }));

const { ordersRouter } = await import("../orders");
const { createCallerFactory } = await import("../../init");
const {
	customers,
	products,
	paymentMethods,
	transactions,
	orderItems,
	orders,
} = await import("@/lib/db/schema");

const caller = createCallerFactory(ordersRouter)({ user: makeUser("user-rp") });

let customerId: number;
let pieceProductId: number; // se vende por pieza (no requiere pesaje)
let weightProductId: number; // se vende por peso (va a pesaje)
let paymentMethodId: number;

beforeAll(async () => {
	await pg.exec(SCHEMA_DDL);

	const [cust] = await db
		.insert(customers)
		.values({
			name: "Cliente Requires Purchase",
			email: "requires-purchase@test.com",
			user_uid: "user-rp",
		})
		.returning();
	customerId = cust.id;

	const [piece] = await db
		.insert(products)
		.values({
			name: "Producto pieza RP",
			user_uid: "user-rp",
			is_sellable_by_weight: false,
			is_sellable_by_unit: true,
			default_sale_unit: "PZ",
		})
		.returning();
	pieceProductId = piece.id;

	const [weight] = await db
		.insert(products)
		.values({
			name: "Producto peso RP",
			user_uid: "user-rp",
			is_sellable_by_weight: true,
		})
		.returning();
	weightProductId = weight.id;

	const [pm] = await db
		.insert(paymentMethods)
		.values({ name: "Cash-RequiresPurchase" })
		.returning();
	paymentMethodId = pm.id;
});

afterAll(async () => {
	await pg.close();
});

async function getOrder(orderId: number) {
	return db.query.orders.findFirst({ where: eq(orders.id, orderId) });
}

describe("orders.create — requiresPurchase", () => {
	it("una pieza pendiente de compra queda PENDIENTE_COMPRA y el pedido PARCIAL_DISPONIBLE", async () => {
		const order = await caller.create({
			customerId,
			paymentMethodId,
			items: [
				{
					productId: pieceProductId,
					quantityPieces: 3,
					unitPrice: 5000,
					requiresPurchase: true,
				},
			],
		});

		const saved = await getOrder(order.id);
		expect(saved?.status).toBe("PARCIAL_DISPONIBLE");
		expect(saved?.requires_weighing).toBe(false);

		const items = await db
			.select()
			.from(orderItems)
			.where(eq(orderItems.order_id, order.id));
		expect(items).toHaveLength(1);
		expect(items[0]?.status).toBe("PENDIENTE_COMPRA");
		expect(Number(items[0]?.subtotal)).toBe(0);

		const txs = await db
			.select()
			.from(transactions)
			.where(eq(transactions.order_id, order.id));
		expect(txs).toHaveLength(0);
	});

	it("una pieza SIN requiresPurchase sigue LISTA_PARA_COBRO con transacción (regresión)", async () => {
		const order = await caller.create({
			customerId,
			paymentMethodId,
			items: [
				{
					productId: pieceProductId,
					quantityPieces: 2,
					unitPrice: 2500,
				},
			],
		});

		const saved = await getOrder(order.id);
		expect(saved?.status).toBe("LISTA_PARA_COBRO");
		expect(saved?.requires_weighing).toBe(false);

		const items = await db
			.select()
			.from(orderItems)
			.where(eq(orderItems.order_id, order.id));
		expect(items).toHaveLength(1);
		expect(items[0]?.status).toBe("COMPLETADO");
		expect(Number(items[0]?.subtotal)).toBe(5000);

		const txs = await db
			.select()
			.from(transactions)
			.where(eq(transactions.order_id, order.id));
		expect(txs).toHaveLength(1);
		expect(Number(txs[0]?.amount)).toBe(5000);
	});

	it("un producto por peso pendiente de compra NO va a pesaje", async () => {
		const order = await caller.create({
			customerId,
			paymentMethodId,
			items: [
				{
					productId: weightProductId,
					quantityKg: 2000,
					unitPrice: 10000,
					requiresPurchase: true,
				},
			],
		});

		const saved = await getOrder(order.id);
		expect(saved?.status).toBe("PARCIAL_DISPONIBLE");
		expect(saved?.requires_weighing).toBe(false);

		const items = await db
			.select()
			.from(orderItems)
			.where(eq(orderItems.order_id, order.id));
		expect(items).toHaveLength(1);
		expect(items[0]?.status).toBe("PENDIENTE_COMPRA");
		expect(Number(items[0]?.subtotal)).toBe(0);

		const txs = await db
			.select()
			.from(transactions)
			.where(eq(transactions.order_id, order.id));
		expect(txs).toHaveLength(0);
	});

	it("un producto por peso SIN requiresPurchase sigue PENDIENTE_PESAJE (regresión)", async () => {
		const order = await caller.create({
			customerId,
			paymentMethodId,
			items: [
				{
					productId: weightProductId,
					quantityKg: 2000,
					unitPrice: 10000,
				},
			],
		});

		const saved = await getOrder(order.id);
		expect(saved?.status).toBe("PENDIENTE_PESAJE");
		expect(saved?.requires_weighing).toBe(true);

		const items = await db
			.select()
			.from(orderItems)
			.where(eq(orderItems.order_id, order.id));
		expect(items).toHaveLength(1);
		expect(items[0]?.status).toBe("PENDIENTE_PESAJE");
		expect(Number(items[0]?.subtotal)).toBe(0);

		const txs = await db
			.select()
			.from(transactions)
			.where(eq(transactions.order_id, order.id));
		expect(txs).toHaveLength(0);
	});

	it("mixto: pieza normal + pieza pendiente de compra → PARCIAL_DISPONIBLE sin transacción", async () => {
		const order = await caller.create({
			customerId,
			paymentMethodId,
			items: [
				{
					productId: pieceProductId,
					quantityPieces: 1,
					unitPrice: 1000,
				},
				{
					productId: pieceProductId,
					quantityPieces: 4,
					unitPrice: 1000,
					requiresPurchase: true,
				},
			],
		});

		const saved = await getOrder(order.id);
		expect(saved?.status).toBe("PARCIAL_DISPONIBLE");
		expect(saved?.requires_weighing).toBe(false);

		const items = await db
			.select()
			.from(orderItems)
			.where(eq(orderItems.order_id, order.id));
		expect(items).toHaveLength(2);
		const statuses = items.map((i) => i.status).sort();
		expect(statuses).toEqual(["COMPLETADO", "PENDIENTE_COMPRA"]);

		const txs = await db
			.select()
			.from(transactions)
			.where(eq(transactions.order_id, order.id));
		expect(txs).toHaveLength(0);
	});

	it("peso normal + pieza pendiente de compra → el pesaje manda", async () => {
		const order = await caller.create({
			customerId,
			paymentMethodId,
			items: [
				{
					productId: weightProductId,
					quantityKg: 1500,
					unitPrice: 10000,
				},
				{
					productId: pieceProductId,
					quantityPieces: 2,
					unitPrice: 1000,
					requiresPurchase: true,
				},
			],
		});

		const saved = await getOrder(order.id);
		expect(saved?.status).toBe("PENDIENTE_PESAJE");
		expect(saved?.requires_weighing).toBe(true);

		const items = await db
			.select()
			.from(orderItems)
			.where(eq(orderItems.order_id, order.id));
		expect(items).toHaveLength(2);
		const byStatus = items.map((i) => i.status).sort();
		expect(byStatus).toEqual(["PENDIENTE_COMPRA", "PENDIENTE_PESAJE"]);

		const txs = await db
			.select()
			.from(transactions)
			.where(eq(transactions.order_id, order.id));
		expect(txs).toHaveLength(0);
	});
});
