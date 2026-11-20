import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { createTestDb, makeUser, SCHEMA_DDL } from "./helpers";

const { pg, db } = createTestDb();
mock.module("@/lib/db", () => ({ db, pglite: pg }));

const { yieldsRouter } = await import("../yields");
const { ordersRouter } = await import("../orders");
const { createCallerFactory } = await import("../../init");
const { customers, products, paymentMethods, inventoryTransactions } =
	await import("@/lib/db/schema");

const userCtx = { user: makeUser("user-yields") };
const yieldsCaller = createCallerFactory(yieldsRouter)(userCtx);
const ordersCaller = createCallerFactory(ordersRouter)(userCtx);

let customerId: number;
let pieceProductId: number;
let paymentMethodId: number;

beforeAll(async () => {
	await pg.exec(SCHEMA_DDL);

	const [cust] = await db
		.insert(customers)
		.values({
			name: "Cliente Yields Compra",
			email: "yields-compra@test.com",
			user_uid: "user-yields",
		})
		.returning();
	customerId = cust.id;

	const [piece] = await db
		.insert(products)
		.values({
			name: "Producto pieza yields",
			user_uid: "user-yields",
			is_sellable_by_weight: false,
			is_sellable_by_unit: true,
			default_sale_unit: "PZ",
			stock_pieces: 0,
			stock_kg: "0",
		})
		.returning();
	pieceProductId = piece.id;

	const [pm] = await db
		.insert(paymentMethods)
		.values({ name: "Cash-Yields" })
		.returning();
	paymentMethodId = pm.id;
});

afterAll(async () => {
	await pg.close();
});

async function createdAtDate(transactionId: number): Promise<string> {
	const res = await db.execute(
		sql`select created_at::date::text as d from inventory_transactions where id = ${transactionId}`,
	);
	const rows = Array.isArray(res)
		? (res as { d: string }[])
		: ((res as unknown as { rows?: { d: string }[] }).rows ?? []);
	const date = rows[0]?.d;
	if (!date) throw new Error("no created_at::date");
	return String(date);
}

describe("yields — P28-2 historial de proveedor y P28-3 cierre del día", () => {
	it("supplierPurchaseHistory omite la COMPRA de recepción y cierre suma ambas entradas", async () => {
		const recorded = await yieldsCaller.recordSupplierPurchase({
			date: "2026-11-20",
			supplier: "Proveedor Test",
			items: [
				{
					productId: pieceProductId,
					pieces: 3,
					kg: 1.25,
				},
			],
		});
		expect(recorded.success).toBe(true);
		expect(recorded.count).toBe(1);

		const supplierMoves = await db
			.select()
			.from(inventoryTransactions)
			.where(eq(inventoryTransactions.transaction_type, "COMPRA"));
		const supplierMove = supplierMoves.find((row) => row.reference_id == null);
		expect(supplierMove).toBeDefined();
		expect(supplierMove?.quantity_change_pieces).toBe(3);
		expect(Number(supplierMove?.quantity_change_kg)).toBe(1.25);

		const date = await createdAtDate(supplierMove!.id);

		const historyBefore = await yieldsCaller.supplierPurchaseHistory({ date });
		expect(historyBefore).toHaveLength(1);
		expect(historyBefore[0]?.id).toBe(supplierMove!.id);
		expect(historyBefore[0]?.name).toBe("Producto pieza yields");
		expect(historyBefore[0]?.pieces).toBe(3);
		expect(historyBefore[0]?.kg).toBe(1.25);
		expect(historyBefore[0]?.notes).toMatch(/Proveedor Test/);

		const order = await ordersCaller.create({
			customerId,
			paymentMethodId,
			items: [
				{
					productId: pieceProductId,
					quantityPieces: 10,
					unitPrice: 1000,
					requiresPurchase: true,
				},
			],
		});
		await ordersCaller.receivePurchase({ orderId: order.id });

		const receiveMoves = await db
			.select()
			.from(inventoryTransactions)
			.where(eq(inventoryTransactions.reference_id, order.id));
		const receiveMove = receiveMoves.find(
			(row) => row.transaction_type === "COMPRA",
		);
		expect(receiveMove).toBeDefined();
		expect(receiveMove?.quantity_change_pieces).toBe(10);
		expect(receiveMove?.reference_id).toBe(order.id);

		const history = await yieldsCaller.supplierPurchaseHistory({ date });
		expect(history.map((row) => row.id)).toEqual([supplierMove!.id]);
		expect(history.some((row) => row.notes.includes("Compra recibida"))).toBe(
			false,
		);
		expect(history.some((row) => row.pieces === 10)).toBe(false);

		const { rows } = await yieldsCaller.cierre({ date });
		const row = rows.find((r) => r.productId === pieceProductId);
		expect(row).toBeDefined();
		expect(row?.entroPz).toBe(13);
		expect(row?.entroKg).toBe(1.25);
	});
});
