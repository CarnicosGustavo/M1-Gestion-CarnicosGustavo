import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { and, eq } from "drizzle-orm";
import { createTestDb, makeUser, SCHEMA_DDL } from "./helpers";

const { pg, db } = createTestDb();
mock.module("@/lib/db", () => ({ db, pglite: pg }));

const { ordersRouter } = await import("../orders");
const { customerPricesRouter } = await import("../customer-prices");
const { createCallerFactory } = await import("../../init");
const {
	customers,
	products,
	orders,
	orderItems,
	customerPrices,
	paymentMethods,
	transactions,
} = await import("@/lib/db/schema");
const { resolveDefaultPrice } = await import(
	"@/components/weighing-station-v2/pricing"
);

const callerAs = (uid: string) =>
	createCallerFactory(ordersRouter)({ user: makeUser(uid) });
const caller = callerAs("sanity-user");
const customerPricesCaller = createCallerFactory(customerPricesRouter)({
	user: makeUser("sanity-user"),
});

let customerId: number;
let weightProductId: number;
let paymentMethodId: number;

beforeAll(async () => {
	await pg.exec(SCHEMA_DDL);
	const [cust] = await db
		.insert(customers)
		.values({
			name: "Cliente Pesaje",
			email: "weigh@t.com",
			user_uid: "sanity-user",
		})
		.returning();
	customerId = cust.id;

	const [p] = await db
		.insert(products)
		.values({
			name: "PIERNA",
			user_uid: "sanity-user",
			is_sellable_by_weight: true,
			price_per_kg: "86.00",
		})
		.returning();
	weightProductId = p.id;

	const [paymentMethod] = await db
		.insert(paymentMethods)
		.values({ name: "Cash-Sanity" })
		.returning();
	paymentMethodId = paymentMethod.id;
});

afterAll(async () => {
	await pg.close();
});

async function createWeighedOrder(kgGrams: number, unitPriceCents: number) {
	const order = await caller.create({
		customerId,
		paymentMethodId,
		items: [
			{
				productId: weightProductId,
				quantityKg: kgGrams,
				unitPrice: unitPriceCents,
			},
		],
	});

	const [item] = await db
		.select()
		.from(orderItems)
		.where(eq(orderItems.order_id, order.id));

	await caller.updateOrderItemWeight({
		orderItemId: item.id,
		actualWeightGrams: kgGrams,
	});

	return { order, item };
}

async function getCustomerPriceRow() {
	const [row] = await db
		.select()
		.from(customerPrices)
		.where(
			and(
				eq(customerPrices.customer_id, customerId),
				eq(customerPrices.product_id, weightProductId),
			),
		);
	return row;
}

async function getOrder(orderId: number) {
	const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
	return order;
}

async function getTransactions(orderId: number) {
	return db
		.select()
		.from(transactions)
		.where(eq(transactions.order_id, orderId));
}

describe("priceAndCharge — topes de cordura (P33-1)", () => {
	it("cobra 2 kg a $86 desde el precio del pedido en centavos", async () => {
		const { order, item } = await createWeighedOrder(2000, 8600);

		const customerPriceRows = await customerPricesCaller.getByCustomer({
			customerId,
		});
		const row = customerPriceRows.find(
			(customerPrice) => customerPrice.productId === weightProductId,
		);

		expect(row).toBeDefined();
		// Sin lista ni historial: solo existe el precio base en pesos.
		expect(row?.customerPricePerKg).toBeNull();
		expect(row?.listPricePerKg).toBeNull();
		expect(Number(row?.pricePerKg)).toBe(86);

		// unit_price del renglón viene de la BD en centavos (8600), no 86.
		expect(Number(item.unit_price)).toBe(8600);
		const resolved = resolveDefaultPrice(row, item.unit_price);
		expect(resolved).toEqual({ pricePerKg: 86, source: "pedido" });
		if (!resolved) throw new Error("sin precio sugerido");

		const result = await caller.priceAndCharge({
			orderId: order.id,
			paymentType: "contado",
			paymentMethodId,
			items: [
				{
					orderItemId: item.id,
					productId: weightProductId,
					pricePerKg: resolved.pricePerKg,
				},
			],
		});

		expect(result.success).toBe(true);
		expect(result.total).toBe(17200);

		const savedPrice = await getCustomerPriceRow();
		expect(savedPrice).toBeDefined();
		expect(savedPrice?.price_per_kg).toBe("86.00");

		const orderTransactions = await getTransactions(order.id);
		expect(orderTransactions).toHaveLength(1);
		expect(Number(orderTransactions[0]?.amount)).toBe(17200);
	});

	it("la siguiente venta sugiere el último precio correcto", async () => {
		const customerPriceRows = await customerPricesCaller.getByCustomer({
			customerId,
		});
		const row = customerPriceRows.find(
			(customerPrice) => customerPrice.productId === weightProductId,
		);

		expect(row).toBeDefined();
		const resolved = resolveDefaultPrice(row, 8600);
		expect(resolved).toEqual({ pricePerKg: 86, source: "ultimo" });
	});

	it("rechaza un precio unitario absurdo (centavos tomados por pesos)", async () => {
		const previousPrice = await getCustomerPriceRow();
		const { order, item } = await createWeighedOrder(2000, 8600);

		await expect(
			caller.priceAndCharge({
				orderId: order.id,
				paymentType: "contado",
				paymentMethodId,
				items: [
					{
						orderItemId: item.id,
						productId: weightProductId,
						pricePerKg: 8600,
					},
				],
			}),
		).rejects.toThrow(/Precio unitario absurdo/);

		const currentOrder = await getOrder(order.id);
		expect(currentOrder?.status).toBe("LISTA_PARA_COBRO");
		expect(await getTransactions(order.id)).toHaveLength(0);

		const currentPrice = await getCustomerPriceRow();
		expect(currentPrice?.price_per_kg).toBe(previousPrice?.price_per_kg);
	});

	it("acepta el tope exacto de precio unitario", async () => {
		const { order, item } = await createWeighedOrder(1000, 500000);

		const result = await caller.priceAndCharge({
			orderId: order.id,
			paymentType: "contado",
			paymentMethodId,
			items: [
				{
					orderItemId: item.id,
					productId: weightProductId,
					pricePerKg: 5000,
				},
			],
		});

		expect(result.success).toBe(true);
		expect(result.total).toBe(500000);
	});

	it("rechaza un total absurdo aunque cada precio sea razonable", async () => {
		const { order, item } = await createWeighedOrder(2000000, 30000);

		await expect(
			caller.priceAndCharge({
				orderId: order.id,
				paymentType: "contado",
				paymentMethodId,
				items: [
					{
						orderItemId: item.id,
						productId: weightProductId,
						pricePerKg: 300,
					},
				],
			}),
		).rejects.toThrow(/Total absurdo/);

		const currentOrder = await getOrder(order.id);
		expect(currentOrder?.status).toBe("LISTA_PARA_COBRO");
		expect(await getTransactions(order.id)).toHaveLength(0);
	});
});
