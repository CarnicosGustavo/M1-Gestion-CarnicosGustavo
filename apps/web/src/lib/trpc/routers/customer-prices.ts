import { z } from "zod/v4";
import { protectedProcedure, router } from "../init";
import { db } from "@/lib/db";
import { customerPrices, products } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";

export const customerPricesRouter = router({
	// Lista TODOS los productos del usuario con el precio guardado del cliente (si existe)
	getByCustomer: protectedProcedure
		.input(z.object({ customerId: z.number() }))
		.query(async ({ ctx, input }) => {
			const rows = await db
				.select({
					productId: products.id,
					productName: products.name,
					category: products.category,
					basePricePerKg: products.price_per_kg,
					basePricePerPiece: products.price_per_piece,
					customerPricePerKg: customerPrices.price_per_kg,
					customerPricePerPiece: customerPrices.price_per_piece,
				})
				.from(products)
				.leftJoin(
					customerPrices,
					and(
						eq(customerPrices.product_id, products.id),
						eq(customerPrices.customer_id, input.customerId),
					),
				)
				.where(eq(products.user_uid, ctx.user.id))
				.orderBy(products.category, products.name);

			return rows.map((r) => ({
				productId: r.productId,
				productName: r.productName,
				category: r.category,
				pricePerKg: r.customerPricePerKg ?? r.basePricePerKg ?? null,
				pricePerPiece: r.customerPricePerPiece ?? r.basePricePerPiece ?? null,
				hasCustomPrice: r.customerPricePerKg != null || r.customerPricePerPiece != null,
			}));
		}),

	// Guarda (upsert) los precios de un cliente para varios productos
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
			for (const it of input.items) {
				// Si ambos precios son nulos, no guardamos override
				if (it.pricePerKg == null && it.pricePerPiece == null) continue;
				await db
					.insert(customerPrices)
					.values({
						customer_id: input.customerId,
						product_id: it.productId,
						price_per_kg: it.pricePerKg != null ? it.pricePerKg.toFixed(2) : null,
						price_per_piece:
							it.pricePerPiece != null ? it.pricePerPiece.toFixed(2) : null,
					})
					.onConflictDoUpdate({
						target: [customerPrices.customer_id, customerPrices.product_id],
						set: {
							price_per_kg:
								it.pricePerKg != null ? it.pricePerKg.toFixed(2) : null,
							price_per_piece:
								it.pricePerPiece != null ? it.pricePerPiece.toFixed(2) : null,
							updated_at: sql`now()`,
						},
					});
				saved++;
			}
			return { saved };
		}),
});
