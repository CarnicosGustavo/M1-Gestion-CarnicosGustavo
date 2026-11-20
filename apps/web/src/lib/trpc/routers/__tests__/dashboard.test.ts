import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { createTestDb, makeUser, SCHEMA_DDL } from "./helpers";

const { pg, db } = createTestDb();
mock.module("@/lib/db", () => ({ db, pglite: pg }));

const { dashboardRouter } = await import("../dashboard");
const { createCallerFactory } = await import("../../init");
const { transactions, products, orders, orderItems } = await import(
	"@/lib/db/schema"
);

const caller = createCallerFactory(dashboardRouter)({
	user: makeUser("user-1"),
});

beforeAll(async () => {
	await pg.exec(SCHEMA_DDL);

	// Seed with exact, verifiable data:
	//
	// user-1, completed:
	//   income/selling  1000  2025-01-15
	//   income/selling   500  2025-01-15
	//   income/refund    200  2025-01-16
	//   expense/overhead 300  2025-01-15
	//   expense/overhead 100  2025-01-16
	//   income/null       50  2025-01-16    (null category)
	//   income/selling    25  null          (null created_at)
	//
	// user-1, pending (must be EXCLUDED):
	//   income/selling 9999  2025-01-15
	//
	// other-user, completed (must be EXCLUDED):
	//   income/selling 5000  2025-01-15

	await db.insert(transactions).values([
		{
			description: "Sale 1",
			amount: 1000,
			user_uid: "user-1",
			type: "income",
			category: "selling",
			status: "completed",
			created_at: new Date("2025-01-15"),
		},
		{
			description: "Sale 2",
			amount: 500,
			user_uid: "user-1",
			type: "income",
			category: "selling",
			status: "completed",
			created_at: new Date("2025-01-15"),
		},
		{
			description: "Refund",
			amount: 200,
			user_uid: "user-1",
			type: "income",
			category: "refund",
			status: "completed",
			created_at: new Date("2025-01-16"),
		},
		{
			description: "Rent",
			amount: 300,
			user_uid: "user-1",
			type: "expense",
			category: "overhead",
			status: "completed",
			created_at: new Date("2025-01-15"),
		},
		{
			description: "Utils",
			amount: 100,
			user_uid: "user-1",
			type: "expense",
			category: "overhead",
			status: "completed",
			created_at: new Date("2025-01-16"),
		},
		{
			description: "Pending",
			amount: 9999,
			user_uid: "user-1",
			type: "income",
			category: "selling",
			status: "pending",
			created_at: new Date("2025-01-15"),
		},
		{
			description: "Other User",
			amount: 5000,
			user_uid: "other-u",
			type: "income",
			category: "selling",
			status: "completed",
			created_at: new Date("2025-01-15"),
		},
		{
			description: "NoCat",
			amount: 50,
			user_uid: "user-1",
			type: "income",
			category: null,
			status: "completed",
			created_at: new Date("2025-01-16"),
		},
		{
			description: "NoDate",
			amount: 25,
			user_uid: "user-1",
			type: "income",
			category: "selling",
			status: "completed",
			created_at: null,
		},
	]);
});

afterAll(async () => {
	await pg.close();
});

describe("dashboard.stats", () => {
	// Expected aggregations (user-1, completed only):
	//   totalRevenue  = 1000+500+200+50+25             = 1775
	//   totalExpenses = 300+100                         = 400
	//   totalProfit   = totalRevenue - totalExpenses    = 1375
	//   (revenueByCategory ahora se calcula por categoría de PRODUCTO a partir de
	//    order_items; este seed no tiene pedidos, así que queda vacío)

	it("totalRevenue = exact sum of completed income", async () => {
		const { totalRevenue } = await caller.stats();
		expect(totalRevenue).toBe(1775);
	});

	it("totalExpenses = exact sum of completed expense", async () => {
		const { totalExpenses } = await caller.stats();
		expect(totalExpenses).toBe(400);
	});

	it("totalProfit = totalRevenue - totalExpenses", async () => {
		const { totalProfit } = await caller.stats();
		expect(totalProfit).toBe(1375);
	});

	it("pending transaction (9999) is excluded from all aggregations", async () => {
		const stats = await caller.stats();
		// If pending leaked, revenue would be 1775+9999=11774
		expect(stats.totalRevenue).toBe(1775);
		// Also check it doesn't appear in cashFlow
		const cfMap = Object.fromEntries(
			stats.cashFlow.map((e) => [e.date, e.amount]),
		);
		// 2025-01-15 should be 1000+500+300=1800, not 1800+9999=11799
		expect(cfMap["2025-01-15"]).toBe(1800);
	});

	it("other user's data (5000) is excluded from all aggregations", async () => {
		const stats = await caller.stats();
		expect(stats.totalRevenue).toBe(1775);
		// cashFlow tampoco incluye los 5000 del otro usuario
		const cfMap = Object.fromEntries(
			stats.cashFlow.map((e) => [e.date, e.amount]),
		);
		expect(cfMap["2025-01-15"]).toBe(1800);
	});

	it("revenueByCategory se agrupa por categoría de producto (sin pedidos → vacío)", async () => {
		const { revenueByCategory } = await caller.stats();
		expect(revenueByCategory).toEqual({});
	});

	it("expensesByCategory groups correctly", async () => {
		const { expensesByCategory } = await caller.stats();
		expect(expensesByCategory.overhead).toBe(400);
		expect(Object.keys(expensesByCategory).length).toBe(1);
	});

	it("cashFlow groups by date, null created_at → 'unknown'", async () => {
		const { cashFlow } = await caller.stats();
		const cfMap = Object.fromEntries(cashFlow.map((e) => [e.date, e.amount]));

		// 2025-01-15: income 1000+500 + expense 300 = 1800
		expect(cfMap["2025-01-15"]).toBe(1800);
		// 2025-01-16: income 200+50 + expense 100 = 350
		expect(cfMap["2025-01-16"]).toBe(350);
		// null date → "unknown": 25
		expect(cfMap.unknown).toBe(25);
		// Exactly 3 entries
		expect(cashFlow.length).toBe(3);
	});

	it("profitMargin: selling>0 → (selling-expense)/selling*100", async () => {
		const { profitMargin } = await caller.stats();
		const pmMap = Object.fromEntries(
			profitMargin.map((e) => [e.date, e.margin]),
		);
		// 2025-01-15: selling=1500, expense=300 → (1200/1500)*100 = 80.00
		expect(pmMap["2025-01-15"]).toBe(80);
	});

	it("profitMargin usa todo el ingreso del día", async () => {
		const { profitMargin } = await caller.stats();
		const pmMap = Object.fromEntries(
			profitMargin.map((e) => [e.date, e.margin]),
		);
		// 2025-01-16: ingreso=200+50=250, gasto=100 → (150/250)*100 = 60
		expect(pmMap["2025-01-16"]).toBe(60);
		// "unknown": ingreso=25, gasto=0 → 100
		expect(pmMap.unknown).toBe(100);
	});

	it("R4-2: dos cobros del mismo pedido no duplican el ingreso por categoría", async () => {
		const [product] = await db
			.insert(products)
			.values({
				name: "Pieza dashboard",
				category: "res",
				user_uid: "user-1",
				is_sellable_by_unit: true,
				stock_pieces: 10,
				stock_kg: "0",
			})
			.returning();
		const [order] = await db
			.insert(orders)
			.values({
				status: "PARCIAL_DISPONIBLE",
				total_amount: "16000",
				user_uid: "user-1",
			})
			.returning();
		await db.insert(orderItems).values([
			{
				order_id: order.id,
				product_id: product.id,
				product_name: product.name,
				quantity_pieces: 2,
				unit_price: "10000",
				subtotal: "10000",
				status: "COBRADO",
			},
			{
				order_id: order.id,
				product_id: product.id,
				product_name: product.name,
				quantity_pieces: 3,
				unit_price: "6000",
				subtotal: "6000",
				status: "COBRADO",
			},
		]);
		await db.insert(transactions).values([
			{
				description: "parcial",
				order_id: order.id,
				amount: 10000,
				user_uid: "user-1",
				type: "income",
				category: "selling",
				status: "completed",
			},
			{
				description: "final",
				order_id: order.id,
				amount: 6000,
				user_uid: "user-1",
				type: "income",
				category: "selling",
				status: "completed",
			},
		]);

		const { revenueByCategory } = await caller.stats();
		// Subtotales 10000+6000=16000, no 32000 por el join 2 txs × 2 líneas.
		expect(revenueByCategory.res).toBe(16000);
	});

	it("R5-4: la rama histórica cuenta estados cerrados y no LISTA_PARA_COBRO", async () => {
		const [product] = await db
			.insert(products)
			.values({
				name: "Pieza cerdo legado",
				category: "cerdo",
				user_uid: "user-1",
				is_sellable_by_unit: true,
				stock_pieces: 20,
				stock_kg: "0",
			})
			.returning();
		const legacyStatuses = [
			"completed",
			"paid",
			"delivered",
			"COMPLETADA",
			"LISTA_PARA_COBRO",
		] as const;
		for (const status of legacyStatuses) {
			const [order] = await db
				.insert(orders)
				.values({
					status,
					total_amount: "3000",
					user_uid: "user-1",
				})
				.returning();
			await db.insert(orderItems).values({
				order_id: order.id,
				product_id: product.id,
				product_name: product.name,
				quantity_pieces: 1,
				unit_price: "3000",
				subtotal: "3000",
				status: "COMPLETADO",
			});
			await db.insert(transactions).values({
				description: `legado ${status}`,
				order_id: order.id,
				amount: 3000,
				user_uid: "user-1",
				type: "income",
				category: "selling",
				status: "completed",
			});
		}

		const { revenueByCategory } = await caller.stats();
		expect(revenueByCategory.cerdo).toBe(12000);
	});
});
