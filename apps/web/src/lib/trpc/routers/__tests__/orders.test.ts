import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { eq } from "drizzle-orm";
import { createTestDb, makeUser, SCHEMA_DDL } from "./helpers";

const { pg, db } = createTestDb();
mock.module("@/lib/db", () => ({ db, pglite: pg }));

const { ordersRouter } = await import("../orders");
const { createCallerFactory } = await import("../../init");
const { customers, products, paymentMethods, transactions, orderItems } =
	await import("@/lib/db/schema");

const caller = createCallerFactory(ordersRouter)({ user: makeUser("user-1") });
const callerAs = (uid: string) =>
	createCallerFactory(ordersRouter)({ user: makeUser(uid) });

let customerId: number;
let pieceProductId: number; // se vende por pieza (no requiere pesaje)
let weightProductId: number; // se vende por peso (va a pesaje)
let paymentMethodId: number;

beforeAll(async () => {
	await pg.exec(SCHEMA_DDL);

	const [cust] = await db
		.insert(customers)
		.values({
			name: "Test Customer",
			email: "order-test@t.com",
			user_uid: "user-1",
		})
		.returning();
	customerId = cust.id;

	const [piece] = await db
		.insert(products)
		.values({
			name: "Producto por pieza",
			user_uid: "user-1",
			is_sellable_by_weight: false,
			is_sellable_by_unit: true,
			default_sale_unit: "PZ",
		})
		.returning();
	pieceProductId = piece.id;

	const [weight] = await db
		.insert(products)
		.values({
			name: "Producto por peso",
			user_uid: "user-1",
			is_sellable_by_weight: true,
		})
		.returning();
	weightProductId = weight.id;

	const [pm] = await db
		.insert(paymentMethods)
		.values({ name: "Cash-OrderTest" })
		.returning();
	paymentMethodId = pm.id;
});

afterAll(async () => {
	await pg.close();
});

describe("orders.list", () => {
	it("returns empty array initially", async () => {
		const list = await caller.list();
		expect(list).toEqual([]);
	});

	it("returns order with nested customer after create", async () => {
		await caller.create({
			customerId,
			paymentMethodId,
			items: [
				{ productId: pieceProductId, quantityPieces: 2, unitPrice: 1000 },
			],
		});

		const list = await caller.list();
		expect(list.length).toBe(1);
		const order = list[0];
		expect(order.customer?.name).toBe("Test Customer");
		expect(Number(order.total_amount)).toBe(2000);
		expect(order.user_uid).toBe("user-1");
	});

	it("filters by user_uid — other user sees nothing", async () => {
		const otherList = await callerAs("outsider").list();
		expect(otherList.length).toBe(0);

		const myList = await caller.list();
		expect(myList.every((o) => o.user_uid === "user-1")).toBe(true);
		expect(myList.length).toBeGreaterThanOrEqual(1);
	});
});

describe("orders.create", () => {
	it("producto por pieza: orden LISTA_PARA_COBRO + items + transacción", async () => {
		const order = await caller.create({
			customerId,
			paymentMethodId,
			items: [
				{ productId: pieceProductId, quantityPieces: 3, unitPrice: 1000 },
			],
		});

		expect(order.id).toBeGreaterThan(0);
		expect(Number(order.total_amount)).toBe(3000);
		expect(order.status).toBe("LISTA_PARA_COBRO");
		expect(order.requires_weighing).toBe(false);
		expect(order.customer?.name).toBe("Test Customer");

		const items = await db
			.select()
			.from(orderItems)
			.where(eq(orderItems.order_id, order.id));
		expect(items.length).toBe(1);
		expect(items[0].quantity_pieces).toBe(3);
		expect(Number(items[0].subtotal)).toBe(3000);
		expect(items[0].status).toBe("COMPLETADO");
		expect(items[0].product_id).toBe(pieceProductId);

		const txns = await db
			.select()
			.from(transactions)
			.where(eq(transactions.order_id, order.id));
		expect(txns.length).toBe(1);
		expect(Number(txns[0].amount)).toBe(3000);
		expect(txns[0].type).toBe("income");
		expect(txns[0].category).toBe("selling");
		expect(txns[0].status).toBe("completed");
		expect(txns[0].user_uid).toBe("user-1");
		expect(Number(txns[0].payment_method_id)).toBe(paymentMethodId);
	});

	it("producto por peso: orden PENDIENTE_PESAJE, sin transacción", async () => {
		const order = await caller.create({
			customerId,
			paymentMethodId,
			items: [{ productId: weightProductId, quantityKg: 2500, unitPrice: 100 }],
		});

		expect(order.status).toBe("PENDIENTE_PESAJE");
		expect(order.requires_weighing).toBe(true);
		expect(Number(order.total_amount)).toBe(0);

		const items = await db
			.select()
			.from(orderItems)
			.where(eq(orderItems.order_id, order.id));
		expect(items[0].status).toBe("PENDIENTE_PESAJE");
		expect(Number(items[0].quantity_kg)).toBe(2.5);

		const txns = await db
			.select()
			.from(transactions)
			.where(eq(transactions.order_id, order.id));
		expect(txns.length).toBe(0);
	});

	it("rechaza productos de otro usuario — no crea la orden", async () => {
		const before = await caller.list();
		await expect(
			callerAs("outsider").create({
				customerId,
				items: [{ productId: pieceProductId, quantityPieces: 1, unitPrice: 1 }],
			}),
		).rejects.toThrow();
		const after = await caller.list();
		expect(after.length).toBe(before.length);
	});
});

describe("orders.update", () => {
	it("updates status and change persists in list()", async () => {
		const order = await caller.create({
			customerId,
			items: [{ productId: pieceProductId, quantityPieces: 1, unitPrice: 500 }],
		});
		const updated = await caller.update({ id: order.id, status: "cancelled" });
		expect(updated.status).toBe("cancelled");

		const persisted = (await caller.list()).find((o) => o.id === order.id);
		expect(persisted?.status).toBe("cancelled");
		expect(Number(persisted?.total_amount)).toBe(500);
	});

	it("rejects invalid status enum", async () => {
		const order = await caller.create({
			customerId,
			items: [{ productId: pieceProductId, quantityPieces: 1, unitPrice: 500 }],
		});
		await expect(
			caller.update({ id: order.id, status: "bogus" as any }),
		).rejects.toThrow();

		const persisted = (await caller.list()).find((o) => o.id === order.id);
		expect(persisted?.status).toBe("LISTA_PARA_COBRO");
	});
});

describe("orders.delete", () => {
	it("deletes order + orderItems — both gone from DB", async () => {
		const order = await caller.create({
			customerId,
			items: [{ productId: pieceProductId, quantityPieces: 1, unitPrice: 100 }],
		});

		const before = await caller.list();
		await caller.delete({ id: order.id });
		const after = await caller.list();

		expect(after.length).toBe(before.length - 1);
		expect(after.some((o) => o.id === order.id)).toBe(false);

		const items = await db
			.select()
			.from(orderItems)
			.where(eq(orderItems.order_id, order.id));
		expect(items.length).toBe(0);
	});

	it("is idempotent — deleting non-existent id is no-op", async () => {
		const before = await caller.list();
		const result = await caller.delete({ id: 999999 });
		expect(result.success).toBe(true);
		const after = await caller.list();
		expect(after.length).toBe(before.length);
	});
});
