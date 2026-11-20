import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { and, eq, isNull } from "drizzle-orm";
import { createTestDb, makeUser, SCHEMA_DDL } from "./helpers";

const { pg, db } = createTestDb();
mock.module("@/lib/db", () => ({ db, pglite: pg }));

const { ordersRouter } = await import("../orders");
const { ticketsRouter } = await import("../tickets");
const { createCallerFactory } = await import("../../init");
const {
	customers,
	products,
	paymentMethods,
	transactions,
	orderItems,
	orders,
	creditCharges,
	productTransformations,
	inventoryTransactions,
} = await import("@/lib/db/schema");

const userCtx = { user: makeUser("user-rp") };
const caller = createCallerFactory(ordersRouter)(userCtx);
const ticketsCaller = createCallerFactory(ticketsRouter)(userCtx);

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
		expect(Number(pieceAfter.stock_pieces)).toBe(4);

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
					unitPrice: 10,
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

describe("orders R4 — bloqueos, crédito, ticket y priceAndCharge", () => {
	it("R4-1: replaceItems rechaza un pedido con líneas COBRADO y no pisa las txs", async () => {
		const order = await createPartialOrder();
		await caller.completeOrderPayment({
			orderId: order.id,
			paymentMethodId,
		});

		const txsBefore = await getTransactions(order.id);
		expect(txsBefore).toHaveLength(1);
		expect(Number(txsBefore[0]?.amount)).toBe(1000);

		await expect(
			caller.replaceItems({
				orderId: order.id,
				items: [
					{
						productId: pieceProductId,
						productName: "Producto pieza RP",
						quantityPieces: 5,
						quantityKg: 0,
						unitPrice: 50,
					},
				],
			}),
		).rejects.toThrow(/ya cobradas|más de un cobro/i);

		const txsAfter = await getTransactions(order.id);
		expect(txsAfter).toHaveLength(1);
		expect(Number(txsAfter[0]?.amount)).toBe(1000);

		const items = await getItems(order.id);
		const charged = items.filter((item) => item.status === "COBRADO");
		expect(charged).toHaveLength(1);
		expect(Number(charged[0]?.quantity_pieces)).toBe(1);
		expect(Number(charged[0]?.subtotal)).toBe(1000);
	});

	it("R4-4: receivePurchase rechaza un pedido cancelado y no lo reabre", async () => {
		const order = await createPartialOrder();
		await db
			.update(orders)
			.set({ status: "cancelled" })
			.where(eq(orders.id, order.id));

		await expect(caller.receivePurchase({ orderId: order.id })).rejects.toThrow(
			/cancelado|completado|en cobro/i,
		);

		const saved = await getOrder(order.id);
		expect(saved?.status).toBe("cancelled");
		const pending = (await getItems(order.id)).filter(
			(item) => item.status === "PENDIENTE_COMPRA",
		);
		expect(pending).toHaveLength(1);
	});

	it("R4-14: cobro parcial a crédito, receivePurchase y cobro del resto a crédito", async () => {
		const order = await createPartialOrder();
		await caller.completeOrderOnCredit({ orderId: order.id });

		let saved = await getOrder(order.id);
		expect(saved?.status).toBe("PARCIAL_DISPONIBLE");
		let charges = await db
			.select()
			.from(creditCharges)
			.where(eq(creditCharges.order_id, order.id));
		expect(charges).toHaveLength(1);
		expect(Number(charges[0]?.amount)).toBe(10);

		const received = await caller.receivePurchase({ orderId: order.id });
		expect(received.status).toBe("LISTA_PARA_COBRO");

		await caller.completeOrderOnCredit({ orderId: order.id });
		saved = await getOrder(order.id);
		expect(saved?.status).toBe("COMPLETADA");
		charges = await db
			.select()
			.from(creditCharges)
			.where(eq(creditCharges.order_id, order.id));
		expect(charges).toHaveLength(2);
		const sum = charges.reduce((s, row) => s + Number(row.amount), 0);
		expect(sum).toBe(110);
	});

	it("R4-14: receivePurchase de una línea por peso exige pesaje antes de cobrar", async () => {
		await updateProductStock(weightProductId, {
			stock_pieces: 0,
			stock_kg: "0",
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
					productId: pieceProductId,
					quantityPieces: 1,
					unitPrice: 1000,
				},
				{
					productId: weightProductId,
					quantityKg: 2000,
					unitPrice: 10000,
					requiresPurchase: true,
				},
			],
		});
		await caller.completeOrderPayment({
			orderId: order.id,
			paymentMethodId,
		});
		const received = await caller.receivePurchase({ orderId: order.id });
		expect(received.status).toBe("PENDIENTE_PESAJE");

		await expect(
			caller.completeOrderPayment({
				orderId: order.id,
				paymentMethodId,
			}),
		).rejects.toThrow();

		const weightItem = (await getItems(order.id)).find(
			(item) => item.status === "PENDIENTE_PESAJE",
		);
		expect(weightItem).toBeDefined();
		await caller.updateOrderItemWeight({
			orderItemId: weightItem!.id,
			actualWeightGrams: 2500,
		});
		await caller.completeOrderPayment({
			orderId: order.id,
			paymentMethodId,
		});
		const saved = await getOrder(order.id);
		expect(saved?.status).toBe("COMPLETADA");
		const txs = await getTransactions(order.id);
		expect(txs).toHaveLength(2);
		expect(txs.map((tx) => Number(tx.amount)).sort((a, b) => a - b)).toEqual([
			1000, 25000,
		]);
	});

	it("R4-5: el ticket usa la suma real de lo cobrado, no el total del pedido", async () => {
		const order = await createPartialOrder();
		await caller.completeOrderPayment({
			orderId: order.id,
			paymentMethodId,
		});
		await caller.receivePurchase({ orderId: order.id });

		const ticket = await ticketsCaller.generateTicket({ orderId: order.id });
		expect(ticket.amountPaid).toBe(10);
		expect(ticket.amountDue).toBe(100);
		expect(ticket.paymentStatus).toBe("PARCIAL");
		expect(Number(ticket.totalAmount)).toBe(11000);

		await caller.completeOrderPayment({
			orderId: order.id,
			paymentMethodId,
		});
		const paid = await ticketsCaller.generateTicket({ orderId: order.id });
		expect(paid.amountPaid).toBe(110);
		expect(paid.amountDue).toBe(0);
		expect(paid.paymentStatus).toBe("PAGADO");
	});

	it("R4-7: priceAndCharge de contado sin método es BAD_REQUEST y no marca COBRADO", async () => {
		const order = await createPartialOrder();
		await expect(
			caller.priceAndCharge({
				orderId: order.id,
				paymentType: "contado",
				items: [],
			}),
		).rejects.toThrow(/método de pago/i);

		const saved = await getOrder(order.id);
		expect(saved?.status).toBe("PARCIAL_DISPONIBLE");
		const items = await getItems(order.id);
		expect(items.some((item) => item.status === "COBRADO")).toBe(false);
		expect(await getTransactions(order.id)).toHaveLength(0);
	});

	it("R4-7: priceAndCharge no deja una línea por pieza en 0", async () => {
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
					unitPrice: 5000,
				},
			],
		});
		const [item] = await getItems(order.id);
		const result = await caller.priceAndCharge({
			orderId: order.id,
			paymentType: "contado",
			paymentMethodId,
			items: [
				{
					orderItemId: item.id,
					productId: pieceProductId,
					pricePerKg: 50,
				},
			],
		});
		expect(result.total).toBe(10000);
		const [after] = await getItems(order.id);
		expect(after.status).toBe("COBRADO");
		expect(Number(after.subtotal)).toBe(10000);
		const txs = await getTransactions(order.id);
		expect(txs).toHaveLength(1);
		expect(Number(txs[0]?.amount)).toBe(10000);
	});

	it("R4-14: getReadyToCharge lista el parcial solo con líneas cobrables", async () => {
		const order = await createPartialOrder();
		const ready = await caller.getReadyToCharge();
		const found = ready.find((row) => row.id === order.id);
		expect(found).toBeDefined();
		expect(found?.items).toHaveLength(1);
		expect(found?.items[0]?.productId).toBe(pieceProductId);
		expect(Number(found?.items[0]?.quantityPieces)).toBe(1);
	});

	it("R4-9: convertToCredit rechaza cobro mixto con un mensaje claro", async () => {
		const order = await createPartialOrder();
		await caller.completeOrderOnCredit({ orderId: order.id });
		await caller.receivePurchase({ orderId: order.id });
		await caller.completeOrderPayment({
			orderId: order.id,
			paymentMethodId,
		});

		await expect(caller.convertToCredit({ orderId: order.id })).rejects.toThrow(
			/cobros mixtos/i,
		);

		const charges = await db
			.select()
			.from(creditCharges)
			.where(eq(creditCharges.order_id, order.id));
		expect(charges).toHaveLength(1);
		expect(await getTransactions(order.id)).toHaveLength(1);
	});

	it("R4-14: convertToCredit tras dos cobros de contado cuadra en un solo crédito", async () => {
		const order = await createPartialOrder();
		await caller.completeOrderPayment({
			orderId: order.id,
			paymentMethodId,
		});
		await caller.receivePurchase({ orderId: order.id });
		await caller.completeOrderPayment({
			orderId: order.id,
			paymentMethodId,
		});

		await caller.convertToCredit({ orderId: order.id });
		expect(await getTransactions(order.id)).toHaveLength(0);
		const charges = await db
			.select()
			.from(creditCharges)
			.where(eq(creditCharges.order_id, order.id));
		expect(charges).toHaveLength(1);
		expect(Number(charges[0]?.amount)).toBe(110);
	});

	it("R4-11: replaceItems no reabre un pedido histórico COMPLETADA", async () => {
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
					quantityPieces: 1,
					unitPrice: 1000,
				},
			],
		});
		await db
			.update(orders)
			.set({ status: "COMPLETADA" })
			.where(eq(orders.id, order.id));
		// Línea histórica COMPLETADO, una sola tx simulada (no COBRADO, un solo cobro).
		await db.insert(transactions).values({
			order_id: order.id,
			payment_method_id: paymentMethodId,
			amount: 1000,
			user_uid: "user-rp",
			status: "completed",
			category: "selling",
			type: "income",
			description: "histórico",
		});

		await caller.replaceItems({
			orderId: order.id,
			items: [
				{
					productId: pieceProductId,
					productName: "Producto pieza RP",
					quantityPieces: 1,
					quantityKg: 0,
					unitPrice: 10,
				},
			],
		});

		const saved = await getOrder(order.id);
		expect(saved?.status).toBe("COMPLETADA");
	});
});

describe("orders R5 — despiece, legado, ticket y priceAndCharge", () => {
	it("R5-1: un pedido parcial con línea COBRADO no genera despiece", async () => {
		const [lomo] = await db
			.insert(products)
			.values({
				name: "Lomo",
				user_uid: "user-rp",
				is_sellable_by_weight: false,
				is_sellable_by_unit: true,
				stock_pieces: 4,
				stock_kg: "0",
			})
			.returning();
		const [comprado] = await db
			.insert(products)
			.values({
				name: "Comprado B",
				category: "comprado",
				user_uid: "user-rp",
				is_sellable_by_weight: false,
				is_sellable_by_unit: true,
				stock_pieces: 0,
				stock_kg: "0",
			})
			.returning();
		const [canal] = await db
			.insert(products)
			.values({
				name: "Canal Americano",
				user_uid: "user-rp",
				is_parent_product: true,
				is_sellable_by_weight: false,
				is_sellable_by_unit: true,
				stock_pieces: 5,
				stock_kg: "0",
			})
			.returning();
		await db.insert(productTransformations).values({
			parent_product_id: canal.id,
			child_product_id: lomo.id,
			yield_quantity_pieces: "4",
			yield_weight_ratio: "0.5",
			transformation_type: "AMERICANO",
			is_active: true,
		});

		const order = await caller.create({
			customerId,
			paymentMethodId,
			items: [
				{
					productId: lomo.id,
					quantityPieces: 4,
					unitPrice: 5000,
				},
				{
					productId: comprado.id,
					quantityPieces: 3,
					unitPrice: 2000,
					requiresPurchase: true,
				},
			],
		});
		await caller.completeOrderPayment({
			orderId: order.id,
			paymentMethodId,
		});

		const validation = await caller.validateDisassemblyRecipes({
			orderId: order.id,
			transformationType: "AMERICANO",
		});
		expect(validation.ok).toBe(true);
		expect(validation.items.some((item) => item.productId === lomo.id)).toBe(
			false,
		);

		const prepared = await caller.prepareDisassemblyForOrder({
			orderId: order.id,
			transformationType: "AMERICANO",
			canalProductId: canal.id,
		});
		expect(prepared.canalPiecesProcessed).toBe(0);

		const lomoAfter = await db.query.products.findFirst({
			where: eq(products.id, lomo.id),
		});
		const canalAfter = await db.query.products.findFirst({
			where: eq(products.id, canal.id),
		});
		expect(lomoAfter?.stock_pieces).toBe(0);
		expect(canalAfter?.stock_pieces).toBe(5);

		const moves = await db
			.select()
			.from(inventoryTransactions)
			.where(eq(inventoryTransactions.reference_id, order.id));
		expect(
			moves.filter((row) => row.transaction_type === "DESPIECE"),
		).toHaveLength(0);

		const saved = await getOrder(order.id);
		expect(saved?.status).toBe("PARCIAL_DISPONIBLE");
	});

	it("R5-3 / M4b: un pedido legado con dos cobros no se puede editar", async () => {
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
					quantityPieces: 1,
					unitPrice: 1000,
				},
			],
		});
		await db
			.update(orders)
			.set({ status: "COMPLETADA" })
			.where(eq(orders.id, order.id));
		await db
			.update(orderItems)
			.set({ status: "COMPLETADO" })
			.where(eq(orderItems.order_id, order.id));
		await db.insert(transactions).values([
			{
				order_id: order.id,
				payment_method_id: paymentMethodId,
				amount: 10000,
				user_uid: "user-rp",
				status: "completed",
				category: "selling",
				type: "income",
				description: "legado 1",
			},
			{
				order_id: order.id,
				payment_method_id: paymentMethodId,
				amount: 6000,
				user_uid: "user-rp",
				status: "completed",
				category: "selling",
				type: "income",
				description: "legado 2",
			},
		]);

		const detail = await caller.get({ id: order.id });
		expect(detail?.canEdit).toBe(false);
		expect(detail?.chargeCount).toBe(2);

		await expect(
			caller.replaceItems({
				orderId: order.id,
				items: [
					{
						productId: pieceProductId,
						productName: "Producto pieza RP",
						quantityPieces: 1,
						quantityKg: 0,
						unitPrice: 10,
					},
				],
			}),
		).rejects.toThrow(/ya cobradas|más de un cobro/i);

		const txs = await getTransactions(order.id);
		expect(txs.map((tx) => Number(tx.amount)).sort((a, b) => a - b)).toEqual([
			6000, 10000,
		]);
	});

	it("R5-5: replaceItems rechaza un pedido en PROCESANDO_PAGO", async () => {
		const order = await createPartialOrder();
		await db
			.update(orders)
			.set({ status: "PROCESANDO_PAGO" })
			.where(eq(orders.id, order.id));

		await expect(
			caller.replaceItems({
				orderId: order.id,
				items: [
					{
						productId: pieceProductId,
						productName: "Producto pieza RP",
						quantityPieces: 1,
						quantityKg: 0,
						unitPrice: 10,
					},
				],
			}),
		).rejects.toThrow(/en cobro/i);
	});

	it("R5-7: editar o quitar una línea PENDIENTE_COMPRA se rechaza", async () => {
		const order = await createPartialOrder();
		const pending = (await getItems(order.id)).find(
			(item) => item.status === "PENDIENTE_COMPRA",
		);
		expect(pending).toBeDefined();
		const unitPesos = Number(pending?.unit_price ?? 0) / 100;

		await expect(
			caller.replaceItems({
				orderId: order.id,
				items: [
					{
						productId: pieceProductId,
						productName: "Producto pieza RP",
						quantityPieces: 1,
						quantityKg: 0,
						unitPrice: unitPesos,
					},
					{
						productId: pieceProductId,
						productName: "Producto pieza RP",
						quantityPieces: 7,
						quantityKg: 0,
						unitPrice: 30,
					},
				],
			}),
		).rejects.toThrow(/pendiente de compra/i);

		await expect(
			caller.replaceItems({
				orderId: order.id,
				items: [
					{
						productId: pieceProductId,
						productName: "Producto pieza RP",
						quantityPieces: 1,
						quantityKg: 0,
						unitPrice: unitPesos,
					},
				],
			}),
		).rejects.toThrow(/pendiente de compra/i);

		const still = (await getItems(order.id)).find(
			(item) => item.status === "PENDIENTE_COMPRA",
		);
		expect(Number(still?.quantity_pieces)).toBe(10);
	});

	it("R5-9: replaceItems no acepta status COMPLETADA", async () => {
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
					quantityPieces: 1,
					unitPrice: 1000,
				},
			],
		});
		expect((await getOrder(order.id))?.status).toBe("LISTA_PARA_COBRO");

		await expect(
			caller.replaceItems({
				orderId: order.id,
				// @ts-expect-error R5-9: COMPLETADA ya no forma parte del enum
				status: "COMPLETADA",
				items: [
					{
						productId: pieceProductId,
						productName: "Producto pieza RP",
						quantityPieces: 1,
						quantityKg: 0,
						unitPrice: 10,
					},
				],
			}),
		).rejects.toThrow();

		expect((await getOrder(order.id))?.status).toBe("LISTA_PARA_COBRO");
	});

	it("M10: priceAndCharge recalcula una línea por pieza con precio distinto", async () => {
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
					unitPrice: 1000,
				},
			],
		});
		const [item] = await getItems(order.id);
		expect(Number(item.subtotal)).toBe(2000);

		const result = await caller.priceAndCharge({
			orderId: order.id,
			paymentType: "contado",
			paymentMethodId,
			items: [
				{
					orderItemId: item.id,
					productId: pieceProductId,
					pricePerKg: 50,
				},
			],
		});
		expect(result.total).toBe(10000);
		const [after] = await getItems(order.id);
		expect(after.status).toBe("COBRADO");
		expect(Number(after.subtotal)).toBe(10000);
		const txs = await getTransactions(order.id);
		expect(txs).toHaveLength(1);
		expect(Number(txs[0]?.amount)).toBe(10000);
	});

	it("M11: priceAndCharge rechaza un precio 0 en una línea cobrable", async () => {
		const order = await createPartialOrder();
		const chargeable = (await getItems(order.id)).find(
			(item) => item.status === "COMPLETADO",
		);
		expect(chargeable).toBeDefined();

		await expect(
			caller.priceAndCharge({
				orderId: order.id,
				paymentType: "contado",
				paymentMethodId,
				items: [
					{
						orderItemId: chargeable!.id,
						productId: pieceProductId,
						pricePerKg: 0,
					},
				],
			}),
		).rejects.toThrow(/no puede quedar en 0/i);

		const items = await getItems(order.id);
		expect(items.some((item) => item.status === "COBRADO")).toBe(false);
		expect(await getTransactions(order.id)).toHaveLength(0);
	});
});

describe("orders N6 — update, estados legado e items vacío", () => {
	it("N6-1: orders.update no acepta status COMPLETADA", async () => {
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
					quantityPieces: 1,
					unitPrice: 1000,
				},
			],
		});
		expect((await getOrder(order.id))?.status).toBe("LISTA_PARA_COBRO");

		await expect(
			caller.update({
				id: order.id,
				// @ts-expect-error N6-1: COMPLETADA ya no está en el enum
				status: "COMPLETADA",
			}),
		).rejects.toThrow();

		expect((await getOrder(order.id))?.status).toBe("LISTA_PARA_COBRO");
		expect(await getTransactions(order.id)).toHaveLength(0);
		const product = await db.query.products.findFirst({
			where: eq(products.id, pieceProductId),
		});
		expect(product?.stock_pieces).toBe(5);
	});

	it.each([
		"paid",
		"completed",
		"delivered",
	] as const)("N6-2: replaceItems no reabre un pedido %s", async (status) => {
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
					quantityPieces: 1,
					unitPrice: 1000,
				},
			],
		});
		await db.update(orders).set({ status }).where(eq(orders.id, order.id));
		await db
			.update(orderItems)
			.set({ status: "COMPLETADO" })
			.where(eq(orderItems.order_id, order.id));
		await db.insert(transactions).values({
			order_id: order.id,
			payment_method_id: paymentMethodId,
			amount: 1000,
			user_uid: "user-rp",
			status: "completed",
			category: "selling",
			type: "income",
			description: `legado ${status}`,
		});

		await caller.replaceItems({
			orderId: order.id,
			items: [
				{
					productId: pieceProductId,
					productName: "Producto pieza RP",
					quantityPieces: 1,
					quantityKg: 0,
					unitPrice: 10,
				},
			],
		});

		expect((await getOrder(order.id))?.status).toBe(status);
	});

	it("N6-4: replaceItems rechaza un pedido sin líneas", async () => {
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
					quantityPieces: 1,
					unitPrice: 1000,
				},
			],
		});

		await expect(
			caller.replaceItems({ orderId: order.id, items: [] }),
		).rejects.toThrow(/sin líneas/i);

		expect(await getItems(order.id)).toHaveLength(1);
		expect((await getOrder(order.id))?.status).toBe("LISTA_PARA_COBRO");
	});
});

describe("orders N7 — no reabrir cobrados y tests oficiales de N6-5", () => {
	it("N7-1: no se puede reabrir un COMPLETADA legado y recobrar líneas COMPLETADO", async () => {
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
					unitPrice: 5000,
				},
			],
		});
		await caller.completeOrderPayment({
			orderId: order.id,
			paymentMethodId,
		});
		expect((await getOrder(order.id))?.status).toBe("COMPLETADA");
		expect(await getTransactions(order.id)).toHaveLength(1);

		await db
			.update(orderItems)
			.set({ status: "COMPLETADO" })
			.where(eq(orderItems.order_id, order.id));

		await expect(
			caller.update({
				id: order.id,
				status: "LISTA_PARA_COBRO",
			}),
		).rejects.toThrow(/cerrado o en cobro/i);

		expect((await getOrder(order.id))?.status).toBe("COMPLETADA");

		await expect(
			caller.completeOrderPayment({
				orderId: order.id,
				paymentMethodId,
			}),
		).rejects.toThrow();

		expect(await getTransactions(order.id)).toHaveLength(1);
		const product = await db.query.products.findFirst({
			where: eq(products.id, pieceProductId),
		});
		expect(product?.stock_pieces).toBe(8);
	});

	it.each([
		"paid",
		"completed",
		"delivered",
		"cancelled",
		"PROCESANDO_PAGO",
	] as const)("N7-1: orders.update no cambia el estado de un pedido %s", async (status) => {
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
					quantityPieces: 1,
					unitPrice: 1000,
				},
			],
		});
		await db.update(orders).set({ status }).where(eq(orders.id, order.id));

		await expect(
			caller.update({
				id: order.id,
				status: "LISTA_PARA_COBRO",
			}),
		).rejects.toThrow(/cerrado o en cobro/i);

		expect((await getOrder(order.id))?.status).toBe(status);
	});

	it("N7-1: se puede cancelar un pedido abierto", async () => {
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
					quantityPieces: 1,
					unitPrice: 1000,
				},
			],
		});
		expect((await getOrder(order.id))?.status).toBe("LISTA_PARA_COBRO");
		const updated = await caller.update({
			id: order.id,
			status: "cancelled",
		});
		expect(updated.status).toBe("cancelled");
		expect((await getOrder(order.id))?.status).toBe("cancelled");
		expect(await getTransactions(order.id)).toHaveLength(0);
	});

	it("N7-1: se puede cambiar el total de un COMPLETADA sin tocar el estado", async () => {
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
					quantityPieces: 1,
					unitPrice: 1000,
				},
			],
		});
		await caller.completeOrderPayment({
			orderId: order.id,
			paymentMethodId,
		});

		const updated = await caller.update({
			id: order.id,
			total_amount: 12000,
		});
		expect(updated.status).toBe("COMPLETADA");
		expect((await getOrder(order.id))?.status).toBe("COMPLETADA");
		expect(Number((await getOrder(order.id))?.total_amount)).toBe(12000);
		expect(await getTransactions(order.id)).toHaveLength(1);
	});

	it("N6-5: replaceItems de un legado pisa solo el ingreso, no el egreso", async () => {
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
					unitPrice: 5000,
				},
			],
		});
		await caller.completeOrderPayment({
			orderId: order.id,
			paymentMethodId,
		});
		await db
			.update(orderItems)
			.set({ status: "COMPLETADO" })
			.where(eq(orderItems.order_id, order.id));
		await db.insert(transactions).values({
			order_id: order.id,
			amount: 111,
			user_uid: "user-rp",
			type: "expense",
			category: "overhead",
			status: "completed",
			description: "gasto",
		});

		await caller.replaceItems({
			orderId: order.id,
			items: [
				{
					productId: pieceProductId,
					productName: "Producto pieza RP",
					quantityPieces: 2,
					quantityKg: 0,
					unitPrice: 60,
				},
			],
		});

		const txs = await getTransactions(order.id);
		const income = txs.filter((tx) => tx.type === "income");
		const expense = txs.filter((tx) => tx.type === "expense");
		expect(income).toHaveLength(1);
		expect(Number(income[0]?.amount)).toBe(12000);
		expect(expense).toHaveLength(1);
		expect(Number(expense[0]?.amount)).toBe(111);
		expect((await getOrder(order.id))?.status).toBe("COMPLETADA");
	});

	it("N6-5: prepareDisassemblyForOrder rechaza un pedido en cobro y no mueve stock", async () => {
		const [lomo] = await db
			.insert(products)
			.values({
				name: "Lomo N65",
				user_uid: "user-rp",
				is_sellable_by_weight: false,
				is_sellable_by_unit: true,
				stock_pieces: 0,
				stock_kg: "0",
			})
			.returning();
		const [canal] = await db
			.insert(products)
			.values({
				name: "Canal Americano N65",
				user_uid: "user-rp",
				is_parent_product: true,
				is_sellable_by_weight: false,
				is_sellable_by_unit: true,
				stock_pieces: 5,
				stock_kg: "0",
			})
			.returning();
		await db.insert(productTransformations).values({
			parent_product_id: canal.id,
			child_product_id: lomo.id,
			yield_quantity_pieces: "4",
			yield_weight_ratio: "0.5",
			transformation_type: "AMERICANO",
			is_active: true,
		});

		const order = await caller.create({
			customerId,
			paymentMethodId,
			items: [
				{
					productId: lomo.id,
					quantityPieces: 4,
					unitPrice: 5000,
				},
			],
		});
		await db
			.update(orders)
			.set({ status: "PROCESANDO_PAGO" })
			.where(eq(orders.id, order.id));

		await expect(
			caller.prepareDisassemblyForOrder({
				orderId: order.id,
				transformationType: "AMERICANO",
				canalProductId: canal.id,
			}),
		).rejects.toThrow(/en cobro/i);

		expect((await getOrder(order.id))?.status).toBe("PROCESANDO_PAGO");
		const lomoAfter = await db.query.products.findFirst({
			where: eq(products.id, lomo.id),
		});
		const canalAfter = await db.query.products.findFirst({
			where: eq(products.id, canal.id),
		});
		expect(lomoAfter?.stock_pieces).toBe(0);
		expect(canalAfter?.stock_pieces).toBe(5);
	});
});

describe("orders R4-13 — Compra recibida suma stock", () => {
	async function purchaseMoves(orderId: number) {
		const rows = await db
			.select()
			.from(inventoryTransactions)
			.where(eq(inventoryTransactions.reference_id, orderId));
		return rows.filter((row) => row.transaction_type === "COMPRA");
	}

	it("suma las piezas faltantes, registra COMPRA y un segundo clic no vuelve a sumar", async () => {
		const order = await createPartialOrder();
		await caller.completeOrderPayment({
			orderId: order.id,
			paymentMethodId,
		});

		let [piece] = await db
			.select()
			.from(products)
			.where(eq(products.id, pieceProductId));
		expect(Number(piece.stock_pieces)).toBe(4);

		const first = await caller.receivePurchase({ orderId: order.id });
		expect(first.status).toBe("LISTA_PARA_COBRO");

		[piece] = await db
			.select()
			.from(products)
			.where(eq(products.id, pieceProductId));
		expect(Number(piece.stock_pieces)).toBe(14);

		const moves = await purchaseMoves(order.id);
		expect(moves).toHaveLength(1);
		expect(moves[0]?.quantity_change_pieces).toBe(10);
		expect(moves[0]?.quantity_change_kg).toBeNull();
		expect(moves[0]?.reference_id).toBe(order.id);

		const second = await caller.receivePurchase({ orderId: order.id });
		expect(second.success).toBe(true);
		expect(second.status).toBe("LISTA_PARA_COBRO");

		[piece] = await db
			.select()
			.from(products)
			.where(eq(products.id, pieceProductId));
		expect(Number(piece.stock_pieces)).toBe(14);
		expect(await purchaseMoves(order.id)).toHaveLength(1);
	});

	it("tras recibir, el cobro no deja stock negativo por el faltante", async () => {
		const order = await createPartialOrder();
		await caller.completeOrderPayment({
			orderId: order.id,
			paymentMethodId,
		});
		await caller.receivePurchase({ orderId: order.id });
		await caller.completeOrderPayment({
			orderId: order.id,
			paymentMethodId,
		});

		expect((await getOrder(order.id))?.status).toBe("COMPLETADA");
		const [piece] = await db
			.select()
			.from(products)
			.where(eq(products.id, pieceProductId));
		expect(Number(piece.stock_pieces)).toBe(4);
		expect(Number(piece.stock_pieces)).toBeGreaterThanOrEqual(0);

		const txs = await getTransactions(order.id);
		expect(txs).toHaveLength(2);
		const sales = await db
			.select()
			.from(inventoryTransactions)
			.where(eq(inventoryTransactions.reference_id, order.id));
		expect(
			sales.filter((row) => row.transaction_type === "COMPRA"),
		).toHaveLength(1);
		expect(
			sales.filter((row) => row.transaction_type === "VENTA"),
		).toHaveLength(2);
	});

	async function createWeightFaltanteOrder(quantityKg?: number) {
		await updateProductStock(weightProductId, {
			stock_pieces: 0,
			stock_kg: "0",
		});
		await updateProductStock(pieceProductId, {
			stock_pieces: 5,
			stock_kg: "0",
		});
		const weightItem: {
			productId: number;
			unitPrice: number;
			requiresPurchase: boolean;
			quantityKg?: number;
		} = {
			productId: weightProductId,
			unitPrice: 10000,
			requiresPurchase: true,
		};
		if (quantityKg !== undefined) weightItem.quantityKg = quantityKg;
		const order = await caller.create({
			customerId,
			paymentMethodId,
			items: [
				{
					productId: pieceProductId,
					quantityPieces: 1,
					unitPrice: 1000,
				},
				weightItem,
			],
		});
		await caller.completeOrderPayment({
			orderId: order.id,
			paymentMethodId,
		});
		return order;
	}

	async function stockKg() {
		const [weight] = await db
			.select()
			.from(products)
			.where(eq(products.id, weightProductId));
		return Number(weight.stock_kg);
	}

	async function weighAndCharge(orderId: number, actualWeightGrams: number) {
		const weightItem = (await getItems(orderId)).find(
			(item) => item.status === "PENDIENTE_PESAJE",
		);
		expect(weightItem).toBeDefined();
		await caller.updateOrderItemWeight({
			orderItemId: weightItem!.id,
			actualWeightGrams,
		});
		await caller.completeOrderPayment({
			orderId,
			paymentMethodId,
		});
	}

	it("P28-1: al recibir una línea por peso no suma los kg pedidos; suma el real al pesar", async () => {
		const order = await createWeightFaltanteOrder(2000);
		await caller.receivePurchase({ orderId: order.id });
		expect(await stockKg()).toBe(0);

		const firstMoves = await purchaseMoves(order.id);
		expect(firstMoves).toHaveLength(1);
		expect(firstMoves[0]?.quantity_change_kg).toBeNull();
		expect(firstMoves[0]?.quantity_change_pieces).toBeNull();

		await caller.receivePurchase({ orderId: order.id });
		expect(await stockKg()).toBe(0);
		expect(await purchaseMoves(order.id)).toHaveLength(1);

		await weighAndCharge(order.id, 2000);
		expect((await getOrder(order.id))?.status).toBe("COMPLETADA");
		expect(await stockKg()).toBe(0);
		const moves = await purchaseMoves(order.id);
		expect(moves).toHaveLength(1);
		expect(Number(moves[0]?.quantity_change_kg)).toBe(2);
		const [piece] = await db
			.select()
			.from(products)
			.where(eq(products.id, pieceProductId));
		expect(Number(piece.stock_pieces)).toBe(4);
	});

	it("P28-1: si pesan de más, el stock recibe el peso real y el cobro deja neto 0", async () => {
		const order = await createWeightFaltanteOrder(2000);
		await caller.receivePurchase({ orderId: order.id });
		expect(await stockKg()).toBe(0);
		const weightItem = (await getItems(order.id)).find(
			(item) => item.status === "PENDIENTE_PESAJE",
		);
		await caller.updateOrderItemWeight({
			orderItemId: weightItem!.id,
			actualWeightGrams: 2500,
		});
		expect(await stockKg()).toBe(2.5);
		await caller.completeOrderPayment({
			orderId: order.id,
			paymentMethodId,
		});
		expect(await stockKg()).toBe(0);
		expect(Number((await purchaseMoves(order.id))[0]?.quantity_change_kg)).toBe(
			2.5,
		);
	});

	it("P28-1: si pesan de menos, no sobra el kg pedido que no entró", async () => {
		const order = await createWeightFaltanteOrder(2000);
		await caller.receivePurchase({ orderId: order.id });
		const weightItem = (await getItems(order.id)).find(
			(item) => item.status === "PENDIENTE_PESAJE",
		);
		await caller.updateOrderItemWeight({
			orderItemId: weightItem!.id,
			actualWeightGrams: 1500,
		});
		expect(await stockKg()).toBe(1.5);
		await caller.completeOrderPayment({
			orderId: order.id,
			paymentMethodId,
		});
		expect(await stockKg()).toBe(0);
	});

	it("P28-1: un faltante por peso sin kg se suma al pesar y el cobro no deja negativo", async () => {
		const order = await createWeightFaltanteOrder();
		const pending = (await getItems(order.id)).find(
			(item) => item.status === "PENDIENTE_COMPRA",
		);
		expect(pending).toBeDefined();
		expect(Number(pending?.quantity_kg ?? 0)).toBe(0);

		await caller.receivePurchase({ orderId: order.id });
		expect(await stockKg()).toBe(0);
		expect((await purchaseMoves(order.id))[0]?.quantity_change_kg).toBeNull();

		await weighAndCharge(order.id, 2000);
		expect((await getOrder(order.id))?.status).toBe("COMPLETADA");
		expect(await stockKg()).toBe(0);
		expect(Number((await purchaseMoves(order.id))[0]?.quantity_change_kg)).toBe(
			2,
		);
	});

	it("P28-2 y P28-3: la recepción no va al historial de proveedor y sí cuenta como entrada", async () => {
		const order = await createPartialOrder();
		await caller.completeOrderPayment({
			orderId: order.id,
			paymentMethodId,
		});
		await caller.receivePurchase({ orderId: order.id });
		const moves = await purchaseMoves(order.id);
		expect(moves).toHaveLength(1);
		expect(moves[0]?.reference_id).toBe(order.id);
		expect(moves[0]?.quantity_change_pieces).toBe(10);

		const supplierHistory = await db
			.select()
			.from(inventoryTransactions)
			.where(
				and(
					eq(inventoryTransactions.transaction_type, "COMPRA"),
					isNull(inventoryTransactions.reference_id),
					eq(inventoryTransactions.id, moves[0]!.id),
				),
			);
		expect(supplierHistory).toHaveLength(0);
	});
});
