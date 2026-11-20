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

async function getTransactions(orderId: number) {
	return db
		.select()
		.from(transactions)
		.where(eq(transactions.order_id, orderId));
}

async function createPartialOrder() {
	await updateProductStock(pieceProductId, {
		stock_pieces: 5,
		stock_kg: "0",
	});

	return caller.create({
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
				quantityPieces: 10,
				unitPrice: 1000,
				requiresPurchase: true,
			},
		],
	});
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

		expect(await getTransactions(order.id)).toHaveLength(0);
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

		expect(await getTransactions(order.id)).toHaveLength(0);
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

		expect((await db.select().from(orders)).length).toBe(before.length);
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

		expect((await db.select().from(orders)).length).toBe(before.length);
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
		expect(items[0]?.status).toBe("PENDIENTE_COMPRA");
		expect(Number(items[0]?.subtotal)).toBe(0);

		expect(await getTransactions(order.id)).toHaveLength(0);
	});

	it("un producto por peso SIN requiresPurchase sigue PENDIENTE_PESAJE", async () => {
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
		expect(items[0]?.status).toBe("PENDIENTE_PESAJE");
		expect(Number(items[0]?.subtotal)).toBe(0);

		expect(await getTransactions(order.id)).toHaveLength(0);
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
		expect(items.map((item) => item.status).sort()).toEqual([
			"COMPLETADO",
			"PENDIENTE_COMPRA",
		]);

		expect(await getTransactions(order.id)).toHaveLength(0);
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

		expect(await getTransactions(order.id)).toHaveLength(0);
	});
});

describe("orders R2-4 — cobro parcial", () => {
	it("cobra solo la línea con stock y conserva la pendiente de compra", async () => {
		const order = await createPartialOrder();

		let saved = await getOrder(order.id);
		expect(saved?.status).toBe("PARCIAL_DISPONIBLE");

		let items = await getItems(order.id);
		expect(items.map((item) => item.status).sort()).toEqual([
			"COMPLETADO",
			"PENDIENTE_COMPRA",
		]);
		expect(await getTransactions(order.id)).toHaveLength(0);

		await caller.completeOrderPayment({
			orderId: order.id,
			paymentMethodId,
		});

		saved = await getOrder(order.id);
		expect(saved?.status).toBe("PARCIAL_DISPONIBLE");

		items = await getItems(order.id);
		expect(items.find((item) => item.status === "COBRADO")).toBeDefined();
		expect(
			items.find((item) => item.status === "PENDIENTE_COMPRA"),
		).toBeDefined();

		const [pieceAfter] = await db
			.select()
			.from(products)
			.where(eq(products.id, pieceProductId));
		expect(Number(pieceAfter.stock_pieces)).toBe(4);

		const txs = await getTransactions(order.id);
		expect(txs).toHaveLength(1);
		expect(Number(txs[0]?.amount)).toBe(1000);
	});

	it("recibe la compra, cobra el resto y completa el pedido", async () => {
		const order = await createPartialOrder();

		await caller.completeOrderPayment({
			orderId: order.id,
			paymentMethodId,
		});

		const received = await caller.receivePurchase({
			orderId: order.id,
		});
		expect(received.success).toBe(true);
		expect(received.status).toBe("LISTA_PARA_COBRO");

		let items = await getItems(order.id);
		const receivedItem = items.find((item) => item.status === "COMPLETADO");
		expect(receivedItem).toBeDefined();
		expect(Number(receivedItem?.subtotal)).toBe(10000);

		await caller.completeOrderPayment({
			orderId: order.id,
			paymentMethodId,
		});

		const saved = await getOrder(order.id);
		expect(saved?.status).toBe("COMPLETADA");

		items = await getItems(order.id);
		expect(items.filter((item) => item.status === "COBRADO")).toHaveLength(2);

		const [pieceAfter] = await db
			.select()
			.from(products)
			.where(eq(products.id, pieceProductId));
		expect(Number(pieceAfter.stock_pieces)).toBe(-6);

		const txs = await getTransactions(order.id);
		expect(txs).toHaveLength(2);
		expect(txs.map((tx) => Number(tx.amount)).sort((a, b) => a - b)).toEqual([
			1000, 10000,
		]);
	});

	it("no cobra dos veces la misma línea y receivePurchase es idempotente", async () => {
		const order = await createPartialOrder();

		await caller.completeOrderPayment({
			orderId: order.id,
			paymentMethodId,
		});

		await caller.completeOrderPayment({
			orderId: order.id,
			paymentMethodId,
		});

		expect(await getTransactions(order.id)).toHaveLength(1);

		let [pieceAfter] = await db
			.select()
			.from(products)
			.where(eq(products.id, pieceProductId));
		expect(Number(pieceAfter.stock_pieces)).toBe(4);

		let items = await getItems(order.id);
		expect(
			items.find((item) => item.status === "PENDIENTE_COMPRA"),
		).toBeDefined();

		const firstReceive = await caller.receivePurchase({
			orderId: order.id,
		});
		expect(firstReceive.success).toBe(true);
		expect(firstReceive.status).toBe("LISTA_PARA_COBRO");

		const secondReceive = await caller.receivePurchase({
			orderId: order.id,
		});
		expect(secondReceive.success).toBe(true);
		expect(secondReceive.status).toBe("LISTA_PARA_COBRO");

		items = await getItems(order.id);
		expect(items.filter((item) => item.status === "COMPLETADO")).toHaveLength(
			1,
		);
		expect(
			items.find((item) => item.status === "PENDIENTE_COMPRA"),
		).toBeUndefined();

		await caller.completeOrderPayment({
			orderId: order.id,
			paymentMethodId,
		});

		const txCountBefore = (await getTransactions(order.id)).length;
		const [productBefore] = await db
			.select()
			.from(products)
			.where(eq(products.id, pieceProductId));

		await expect(
			caller.completeOrderPayment({
				orderId: order.id,
				paymentMethodId,
			}),
		).rejects.toThrow();

		expect((await getTransactions(order.id)).length).toBe(txCountBefore);

		[pieceAfter] = await db
			.select()
			.from(products)
			.where(eq(products.id, pieceProductId));
		expect(Number(pieceAfter.stock_pieces)).toBe(
			Number(productBefore.stock_pieces),
		);
	});

	it("replaceItems conserva una línea PENDIENTE_COMPRA", async () => {
		const order = await createPartialOrder();

		const result = await caller.replaceItems({
			orderId: order.id,
			items: [
				{
					productId: pieceProductId,
					productName: "Producto pieza RP",
					quantityPieces: 1,
					quantityKg: 0,
					unitPrice: 1200,
				},
				{
					productId: pieceProductId,
					productName: "Producto pieza RP",
					quantityPieces: 10,
					quantityKg: 0,
					unitPrice: 1000,
				},
			],
		});

		expect(result.success).toBe(true);

		const items = await getItems(order.id);
		const pending = items.filter((item) => item.status === "PENDIENTE_COMPRA");
		expect(pending).toHaveLength(1);
		expect(pending[0]?.product_id).toBe(pieceProductId);

		const saved = await getOrder(order.id);
		expect(saved?.status).not.toBe("LISTA_PARA_COBRO");
		expect(saved?.status).toBe("PARCIAL_DISPONIBLE");
	});
	it("cobra la línea ya pesada y no descuenta la pieza pendiente", async () => {
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

		const weightItem = (await getItems(order.id)).find(
			(item) => item.status === "PENDIENTE_PESAJE",
		);
		expect(weightItem).toBeDefined();

		await caller.updateOrderItemWeight({
			orderItemId: weightItem!.id,
			actualWeightGrams: 2000,
		});

		let saved = await getOrder(order.id);
		expect(saved?.status).toBe("PARCIAL_DISPONIBLE");

		await caller.completeOrderPayment({
			orderId: order.id,
			paymentMethodId,
		});

		saved = await getOrder(order.id);
		expect(saved?.status).toBe("PARCIAL_DISPONIBLE");

		const items = await getItems(order.id);
		expect(items.find((item) => item.id === weightItem!.id)?.status).toBe(
			"COBRADO",
		);
		expect(
			items.find((item) => item.status === "PENDIENTE_COMPRA"),
		).toBeDefined();

		const [pieceAfter] = await db
			.select()
			.from(products)
			.where(eq(products.id, pieceProductId));
		expect(Number(pieceAfter.stock_pieces)).toBe(5);

		const [weightAfter] = await db
			.select()
			.from(products)
			.where(eq(products.id, weightProductId));
		expect(Number(weightAfter.stock_kg)).toBe(46);

		const txs = await getTransactions(order.id);
		expect(txs).toHaveLength(1);
		expect(Number(txs[0]?.amount)).toBe(20000);
	});
});
