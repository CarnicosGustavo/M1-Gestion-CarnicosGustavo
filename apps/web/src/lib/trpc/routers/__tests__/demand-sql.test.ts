import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { orderItems, orders, products } from "@/lib/db/schema";
import {
	OPEN_ORDER_STATUS_PRED,
	REAL_KG_ITEM_STATUS_PRED,
	UNSATISFIED_ITEM_STATUS_PRED,
} from "@/lib/orders/demand-sql";
import { createTestDb, SCHEMA_DDL } from "./helpers";

const { pg, db } = createTestDb();

beforeAll(async () => {
	await pg.exec(SCHEMA_DDL);
});

afterAll(async () => {
	await pg.close();
});

describe("demand-sql — M17/M18", () => {
	it("una línea COBRADO no entra en la demanda y sí en el kg real", async () => {
		const [pieceProduct] = await db
			.insert(products)
			.values({
				name: "Producto pieza demanda",
				user_uid: "user-d",
				is_sellable_by_weight: false,
				is_sellable_by_unit: true,
				stock_pieces: 10,
				stock_kg: "0",
			})
			.returning();
		const [weightProduct] = await db
			.insert(products)
			.values({
				name: "Producto peso demanda",
				user_uid: "user-d",
				is_sellable_by_weight: true,
				stock_pieces: 0,
				stock_kg: "10",
			})
			.returning();
		const [order] = await db
			.insert(orders)
			.values({
				status: "PARCIAL_DISPONIBLE",
				total_amount: "0",
				user_uid: "user-d",
			})
			.returning();
		await db.insert(orderItems).values([
			{
				order_id: order.id,
				product_id: pieceProduct.id,
				product_name: pieceProduct.name,
				status: "COBRADO",
				quantity_pieces: 4,
				quantity_kg: null,
				unit_price: "1000",
				subtotal: "4000",
			},
			{
				order_id: order.id,
				product_id: weightProduct.id,
				product_name: weightProduct.name,
				status: "COBRADO",
				quantity_pieces: 0,
				quantity_kg: "2.000",
				unit_price: "1000",
				subtotal: "2000",
			},
		]);

		const demandSql = `
			SELECT oi.product_id AS pid,
			       COALESCE(SUM(oi.quantity_pieces),0)::int AS pieces,
			       COALESCE(SUM(oi.quantity_kg),0) AS kg
			FROM order_items oi
			JOIN orders o ON o.id = oi.order_id
			WHERE oi.product_id IS NOT NULL
			  AND ${OPEN_ORDER_STATUS_PRED}
			  AND ${UNSATISFIED_ITEM_STATUS_PRED}
			GROUP BY oi.product_id
		`;
		const realKgSql = `
			SELECT oi.product_id AS pid, COALESCE(SUM(oi.quantity_kg),0) AS kg
			FROM order_items oi
			JOIN orders o ON o.id = oi.order_id
			WHERE ${REAL_KG_ITEM_STATUS_PRED}
			  AND oi.product_id IS NOT NULL
			GROUP BY oi.product_id
		`;

		const demand = await pg.query<{
			pid: number;
			pieces: number;
			kg: string | number;
		}>(demandSql);
		expect(demand.rows).toHaveLength(0);

		const realKg = await pg.query<{ pid: number; kg: string | number }>(
			realKgSql,
		);
		const weightRow = realKg.rows.find(
			(row) => Number(row.pid) === weightProduct.id,
		);
		expect(Number(weightRow?.kg)).toBe(2);
	});
});
