import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import {
	customerPrices,
	customers,
	priceListItems,
	products,
} from "@/lib/db/schema";
import { protectedProcedure, router } from "../init";

function toNumOrNull(value: number | string | null | undefined): number | null {
	if (value === null || value === undefined) return null;
	const n = typeof value === "number" ? value : Number(value);
	return Number.isFinite(n) ? n : null;
}

export const customerPricesRouter = router({
	getByCustomer: protectedProcedure
		.input(z.object({ customerId: z.number() }))
		.query(async ({ ctx, input }) => {
			const [cust] = await db
				.select({ priceListId: customers.price_list_id })
				.from(customers)
				.where(
					and(
						eq(customers.id, input.customerId),
						eq(customers.user_uid, ctx.user.id),
					),
				)
				.limit(1);

			if (!cust) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Cliente no encontrado",
				});
			}

			const listId = cust.priceListId ?? -1;

			const rows = await db
				.select({
					productId: products.id,
					productName: products.name,
					category: products.category,
					basePricePerKg: products.price_per_kg,
					basePricePerPiece: products.price_per_piece,
					customerPricePerKg: customerPrices.price_per_kg,
					customerPricePerPiece: customerPrices.price_per_piece,
					listPricePerKg: priceListItems.unit_price_per_kg,
					listPricePerPiece: priceListItems.unit_price_per_piece,
				})
				.from(products)
				.leftJoin(
					customerPrices,
					and(
						eq(customerPrices.product_id, products.id),
						eq(customerPrices.customer_id, input.customerId),
					),
				)
				.leftJoin(
					priceListItems,
					and(
						eq(priceListItems.product_id, products.id),
						eq(priceListItems.price_list_id, listId),
					),
				)
				.where(eq(products.user_uid, ctx.user.id))
				.orderBy(products.category, products.name);

			return rows.map((row) => ({
				productId: row.productId,
				productName: row.productName,
				category: row.category,
				pricePerKg:
					row.customerPricePerKg ??
					(row.listPricePerKg != null ? String(row.listPricePerKg) : null) ??
					row.basePricePerKg ??
					null,
				pricePerPiece:
					row.customerPricePerPiece ??
					(row.listPricePerPiece != null
						? String(row.listPricePerPiece)
						: null) ??
					row.basePricePerPiece ??
					null,
				hasCustomPrice:
					row.customerPricePerKg != null || row.customerPricePerPiece != null,
				customerPricePerKg: toNumOrNull(row.customerPricePerKg),
				customerPricePerPiece: toNumOrNull(row.customerPricePerPiece),
				listPricePerKg: toNumOrNull(row.listPricePerKg),
				listPricePerPiece: toNumOrNull(row.listPricePerPiece),
			}));
		}),

	bulkUpsert: protectedProcedure
		.input(
			z.object({
				customerId: z.number(),
				items: z.array(
					z.object({
						productId: z.number(),
						pricePerKg: z.number().nullable(),
						pricePerPiece: z.number().nullable(),
					}),
				),
			}),
		)
		.mutation(async ({ input }) => {
			let saved = 0;
			for (const item of input.items) {
				if (item.pricePerKg == null && item.pricePerPiece == null) continue;
				await db
					.insert(customerPrices)
					.values({
						customer_id: input.customerId,
						product_id: item.productId,
						price_per_kg:
							item.pricePerKg != null ? item.pricePerKg.toFixed(2) : null,
						price_per_piece:
							item.pricePerPiece != null ? item.pricePerPiece.toFixed(2) : null,
					})
					.onConflictDoUpdate({
						target: [customerPrices.customer_id, customerPrices.product_id],
						set: {
							price_per_kg:
								item.pricePerKg != null ? item.pricePerKg.toFixed(2) : null,
							price_per_piece:
								item.pricePerPiece != null
									? item.pricePerPiece.toFixed(2)
									: null,
							updated_at: sql`now()`,
						},
					});
				saved++;
			}
			return { saved };
		}),
});
