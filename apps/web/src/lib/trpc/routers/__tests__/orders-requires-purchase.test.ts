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
let pieceProductId: number;
let weightProductId: number;
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
			stock_pieces: 0,
			stock_kg: "0",
		})
		.returning();
	pieceProductId = piece.id;

	const [weight] = await db
		.insert(products)
		.values({
			name: "Producto peso RP",
			user_uid: "user-rp",
			is_sellable_by_weight: true,
			stock_pieces: 0,
			stock_kg: "0",
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

async function getItems(orderId: number) {
	return db.select().from(orderItems).where(eq(orderItems.order_id, orderId));
}

async function updateProductStock(
	productId: number,
	values: {
		stock_pieces?: number;
		stock_kg?: string;
	},
) {
	await db.update(products).set(values).where(eq(products.id, productId));
}

describe("orders.create — requiresPurchase", () => {
	it("una pieza realmente faltante queda PENDIENTE_COMPRA y el pedido PARCIAL_DISPONIBLE", async () => {
		await updateProductStock(pieceProductId, {
			stock_pieces: 0,
			stock_kg: "0",
		});

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

		const items = await getItems(order.id);
		expect(items).toHaveLength(1);
		expect(items[0]?.status).toBe("PENDIENTE_COMPRA");
		expect(Number(items[0]?.subtotal)).toBe(0);

		const txs = await db
			.select()
			.from(transactions)
			.where(eq(transactions.order_id, order.id));
		expect(txs).toHaveLength(0);
	});

	it("una pieza SIN requiresPurchase sigue LISTA_PARA_COBRO sin transacción", async () => {
		await updateProductStock(pieceProductId, {
			stock_pieces: 10,
			stock_kg: "0",
		});

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

		const items = await getItems(order.id);
		expect(items).toHaveLength(1);
		expect(items[0]?.status).toBe("COMPLETADO");
		expect(Number(items[0]?.subtotal)).toBe(5000);

		const txs = await db
			.select()
			.from(transactions)
			.where(eq(transactions.order_id, order.id));
		expect(txs).toHaveLength(0);
	});

	it("rechaza quantityPieces negativo y no crea pedido", async () => {
		const before = await db.select().from(orders);

		await expect(
			caller.create({
				customerId,
				items: [
					{
						productId: pieceProductId,
						quantityPieces: -1,
						unitPrice: 1000,
					},
				],
			}),
		).rejects.toThrow();

		const after = await db.select().from(orders);
		expect(after.length).toBe(before.length);
	});

	it("rechaza unitPrice negativo y no crea pedido", async () => {
		const before = await db.select().from(orders);

		await expect(
			caller.create({
				customerId,
				items: [
					{
						productId: pieceProductId,
						quantityPieces: 1,
						unitPrice: -1000,
					},
				],
			}),
		).rejects.toThrow();

		const after = await db.select().from(orders);
		expect(after.length).toBe(before.length);
	});

	it("un producto por peso con stock e requiresPurchase:true va a PENDIENTE_PESAJE", async () => {
		await updateProductStock(weightProductId, {
			stock_pieces: 0,
			stock_kg: "48",
		});

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
		expect(saved?.status).toBe("PENDIENTE_PESAJE");
		expect(saved?.requires_weighing).toBe(true);

		const items = await getItems(order.id);
		expect(items).toHaveLength(1);
		expect(items[0]?.status).toBe("PENDIENTE_PESAJE");
		expect(Number(items[0]?.subtotal)).toBe(0);
	});

	it("una pieza con stock suficiente e requiresPurchase:true queda COMPLETADO", async () => {
		await updateProductStock(pieceProductId, {
			stock_pieces: 5,
			stock_kg: "0",
		});

		const order = await caller.create({
			customerId,
			paymentMethodId,
			items: [
				{
					productId: pieceProductId,
					quantityPieces: 2,
					unitPrice: 2500,
					requiresPurchase: true,
				},
			],
		});

		const saved = await getOrder(order.id);
		expect(saved?.status).toBe("LISTA_PARA_COBRO");

		const items = await getItems(order.id);
		expect(items[0]?.status).toBe("COMPLETADO");
		expect(Number(items[0]?.subtotal)).toBe(5000);
	});

	it("un producto por peso realmente faltante NO va a pesaje", async () => {
		await updateProductStock(weightProductId, {
			stock_pieces: 0,
			stock_kg: "0",
		});

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

		const items = await getItems(order.id);
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
		await updateProductStock(weightProductId, {
			stock_pieces: 0,
			stock_kg: "48",
		});

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

		const items = await getItems(order.id);
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
		await updateProductStock(pieceProductId, {
			stock_pieces: 1,
			stock_kg: "0",
		});

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

		const items = await getItems(order.id);
		expect(items).toHaveLength(2);
		const statuses = items.map((item) => item.status).sort();
		expect(statuses).toEqual(["COMPLETADO", "PENDIENTE_COMPRA"]);

		const txs = await db
			.select()
			.from(transactions)
			.where(eq(transactions.order_id, order.id));
		expect(txs).toHaveLength(0);
	});

	it("caso mixto: peso pesado + pieza pendiente de compra no permite cobrar", async () => {
		await updateProductStock(weightProductId, {
			stock_pieces: 0,
			stock_kg: "48",
		});
		await updateProductStock(pieceProductId, {
			stock_pieces: 5,
			stock_kg: "0",
		});

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
					quantityPieces: 10,
					unitPrice: 1000,
					requiresPurchase: true,
				},
			],
		});

		let saved = await getOrder(order.id);
		expect(saved?.status).toBe("PENDIENTE_PESAJE");
		expect(saved?.requires_weighing).toBe(true);

		let items = await getItems(order.id);
		expect(items.map((item) => item.status).sort()).toEqual([
			"PENDIENTE_COMPRA",
			"PENDIENTE_PESAJE",
		]);

		const weightItem = items.find((item) => item.status === "PENDIENTE_PESAJE");
		expect(weightItem).toBeDefined();

		await caller.updateOrderItemWeight({
			orderItemId: weightItem!.id,
			actualWeightGrams: 2000,
		});

		saved = await getOrder(order.id);
		expect(saved?.status).toBe("PARCIAL_DISPONIBLE");
		expect(saved?.requires_weighing).toBe(false);

		items = await getItems(order.id);
		expect(items.find((item) => item.id === weightItem!.id)?.status).toBe(
			"PESADO",
		);
		expect(
			items.find((item) => item.status === "PENDIENTE_COMPRA"),
		).toBeDefined();

		await expect(
			caller.completeOrderPayment({
				orderId: order.id,
				paymentMethodId,
			}),
		).rejects.toThrow();

		await expect(
			caller.completeOrderOnCredit({ orderId: order.id }),
		).rejects.toThrow();

		const [pieceAfter] = await db
			.select()
			.from(products)
			.where(eq(products.id, pieceProductId));
		expect(Number(pieceAfter.stock_pieces)).toBe(5);

		items = await getItems(order.id);
		expect(items.find((item) => item.id === weightItem!.id)?.status).toBe(
			"PESADO",
		);
		expect(
			items.find((item) => item.status === "PENDIENTE_COMPRA"),
		).toBeDefined();
	});

	it("peso normal + pieza pendiente de compra → el pesaje manda", async () => {
		await updateProductStock(weightProductId, {
			stock_pieces: 0,
			stock_kg: "48",
		});
		await updateProductStock(pieceProductId, {
			stock_pieces: 5,
			stock_kg: "0",
		});

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
					quantityPieces: 10,
					unitPrice: 1000,
					requiresPurchase: true,
				},
			],
		});

		const saved = await getOrder(order.id);
		expect(saved?.status).toBe("PENDIENTE_PESAJE");
		expect(saved?.requires_weighing).toBe(true);

		const items = await getItems(order.id);
		expect(items).toHaveLength(2);
		expect(items.map((item) => item.status).sort()).toEqual([
			"PENDIENTE_COMPRA",
			"PENDIENTE_PESAJE",
		]);

		const txs = await db
			.select()
			.from(transactions)
			.where(eq(transactions.order_id, order.id));
		expect(txs).toHaveLength(0);
	});
});
