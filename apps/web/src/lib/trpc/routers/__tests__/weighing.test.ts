import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { eq } from "drizzle-orm";
import { createTestDb, makeUser, SCHEMA_DDL } from "./helpers";

const { pg, db } = createTestDb();
mock.module("@/lib/db", () => ({ db, pglite: pg }));

const { ordersRouter } = await import("../orders");
const { createCallerFactory } = await import("../../init");
const { customers, products, orders, orderItems, inventoryTransactions } =
	await import("@/lib/db/schema");

const callerAs = (uid: string) =>
	createCallerFactory(ordersRouter)({ user: makeUser(uid) });
const caller = callerAs("weigh-user");

let customerId: number;
let weightProductId: number;

beforeAll(async () => {
	await pg.exec(SCHEMA_DDL);
	const [cust] = await db
		.insert(customers)
		.values({
			name: "Cliente Pesaje",
			email: "weigh@t.com",
			user_uid: "weigh-user",
		})
		.returning();
	customerId = cust.id;
	const [p] = await db
		.insert(products)
		.values({
			name: "Pierna",
			user_uid: "weigh-user",
			is_sellable_by_weight: true,
		})
		.returning();
	weightProductId = p.id;
});

afterAll(async () => {
	await pg.close();
});

async function createWeightOrder(kgGrams = 2000, unitPrice = 100) {
	const order = await caller.create({
		customerId,
		items: [{ productId: weightProductId, quantityKg: kgGrams, unitPrice }],
	});
	const [item] = await db
		.select()
		.from(orderItems)
		.where(eq(orderItems.order_id, order.id));
	return { order, item };
}

async function stockOf(productId: number) {
	const [p] = await db
		.select()
		.from(products)
		.where(eq(products.id, productId));
	return { kg: Number(p.stock_kg ?? 0), pieces: Number(p.stock_pieces ?? 0) };
}

describe("orders.getPendingWeighingOrders", () => {
	it("lista pedidos del usuario con renglones PENDIENTE_PESAJE", async () => {
		const { order } = await createWeightOrder();
		const pending = await caller.getPendingWeighingOrders();
		const found = pending.find((o) => o.id === order.id);
		expect(found).toBeDefined();
		expect(found?.orderItems.length).toBe(1);
		expect(found?.orderItems[0].status).toBe("PENDIENTE_PESAJE");
	});

	it("otro usuario no ve la cola ajena", async () => {
		const pending = await callerAs("otro-usuario").getPendingWeighingOrders();
		expect(pending.length).toBe(0);
	});
});

describe("orders.updateOrderItemWeight", () => {
	it("pesa en gramos: kg, subtotal y pedido LISTA_PARA_COBRO", async () => {
		const { order, item } = await createWeightOrder(2000, 100);
		const res = await caller.updateOrderItemWeight({
			orderItemId: item.id,
			actualWeightGrams: 2345,
		});
		expect(res.success).toBe(true);

		const [it2] = await db
			.select()
			.from(orderItems)
			.where(eq(orderItems.id, item.id));
		expect(it2.status).toBe("PESADO");
		expect(Number(it2.quantity_kg)).toBeCloseTo(2.345, 3);
		// unit_price se guarda en centavos por kg → subtotal en centavos.
		expect(Number(it2.subtotal)).toBe(
			Math.round((2345 * Number(item.unit_price)) / 1000),
		);

		const [o] = await db.select().from(orders).where(eq(orders.id, order.id));
		expect(o.status).toBe("LISTA_PARA_COBRO");
		expect(o.requires_weighing).toBe(false);
	});

	it("acepta el campo obsoleto actualWeightKg (mismo valor en gramos)", async () => {
		const { item } = await createWeightOrder();
		await caller.updateOrderItemWeight({
			orderItemId: item.id,
			actualWeightKg: 1500,
		});
		const [it2] = await db
			.select()
			.from(orderItems)
			.where(eq(orderItems.id, item.id));
		expect(Number(it2.quantity_kg)).toBeCloseTo(1.5, 3);
	});

	it("rechaza sin peso o con ambos campos (BAD_REQUEST)", async () => {
		const { item } = await createWeightOrder();
		await expect(
			caller.updateOrderItemWeight({ orderItemId: item.id }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			caller.updateOrderItemWeight({
				orderItemId: item.id,
				actualWeightGrams: 1000,
				actualWeightKg: 1000,
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("rechaza volver a pesar un renglón ya PESADO (CONFLICT)", async () => {
		const { item } = await createWeightOrder();
		await caller.updateOrderItemWeight({
			orderItemId: item.id,
			actualWeightGrams: 1000,
		});
		await expect(
			caller.updateOrderItemWeight({
				orderItemId: item.id,
				actualWeightGrams: 3000,
			}),
		).rejects.toMatchObject({ code: "CONFLICT" });
		const [it2] = await db
			.select()
			.from(orderItems)
			.where(eq(orderItems.id, item.id));
		expect(Number(it2.quantity_kg)).toBeCloseTo(1, 3);
	});

	it("no permite pesar renglones de otro usuario (NOT_FOUND)", async () => {
		const { item } = await createWeightOrder();
		await expect(
			callerAs("otro-usuario").updateOrderItemWeight({
				orderItemId: item.id,
				actualWeightGrams: 1000,
			}),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		const [it2] = await db
			.select()
			.from(orderItems)
			.where(eq(orderItems.id, item.id));
		expect(it2.status).toBe("PENDIENTE_PESAJE");
	});

	it("permite pesar pedidos del sistema (user_uid='system')", async () => {
		const [o] = await db
			.insert(orders)
			.values({
				customer_id: customerId,
				total_amount: "0.00",
				user_uid: "system",
				status: "PENDIENTE_PESAJE",
				requires_weighing: true,
			})
			.returning();
		const [item] = await db
			.insert(orderItems)
			.values({
				order_id: o.id,
				product_id: weightProductId,
				product_name: "Pierna",
				unit_price: "10000.00",
				subtotal: "0.00",
				status: "PENDIENTE_PESAJE",
			})
			.returning();
		await caller.updateOrderItemWeight({
			orderItemId: item.id,
			actualWeightGrams: 500,
		});
		const [it2] = await db
			.select()
			.from(orderItems)
			.where(eq(orderItems.id, item.id));
		expect(it2.status).toBe("PESADO");
	});
});

describe("pesaje de producción", () => {
	it("suma al inventario una sola vez y queda COMPLETADA", async () => {
		const before = await stockOf(weightProductId);
		const { id } = await caller.createProductionWeighing({
			productId: weightProductId,
			productName: "Pierna",
			pieces: 3,
		});
		const [item] = await db
			.select()
			.from(orderItems)
			.where(eq(orderItems.order_id, id));

		await caller.updateOrderItemWeight({
			orderItemId: item.id,
			actualWeightGrams: 4200,
		});
		const after = await stockOf(weightProductId);
		expect(after.kg).toBeCloseTo(before.kg + 4.2, 3);
		expect(after.pieces).toBe(before.pieces + 3);

		const [o] = await db.select().from(orders).where(eq(orders.id, id));
		expect(o.status).toBe("COMPLETADA");
		expect(o.requires_weighing).toBe(false);

		// Segundo intento: rechazado y el stock NO cambia (antes se duplicaba).
		await expect(
			caller.updateOrderItemWeight({
				orderItemId: item.id,
				actualWeightGrams: 4200,
			}),
		).rejects.toMatchObject({ code: "CONFLICT" });
		const again = await stockOf(weightProductId);
		expect(again.kg).toBeCloseTo(after.kg, 3);
		expect(again.pieces).toBe(after.pieces);

		const movs = await db
			.select()
			.from(inventoryTransactions)
			.where(eq(inventoryTransactions.reference_id, id));
		expect(movs.length).toBe(1);
		expect(movs[0].transaction_type).toBe("PRODUCCION");
	});
});
