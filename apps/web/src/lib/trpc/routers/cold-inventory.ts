import { z } from "zod/v4";
import { protectedProcedure, router } from "../init";
import { db } from "@/lib/db";
import { products, inventoryTransactions } from "@/lib/db/schema";
import { eq, and, sql, or, gt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const coldInventoryRouter = router({
	// Productos con stock fresco o congelado
	list: protectedProcedure.input(z.void()).query(async ({ ctx }) => {
		const rows = await db
			.select({
				id: products.id,
				name: products.name,
				category: products.category,
				stockKg: products.stock_kg,
				stockPieces: products.stock_pieces,
				stockKgFrozen: products.stock_kg_frozen,
				stockPiecesFrozen: products.stock_pieces_frozen,
			})
			.from(products)
			.where(
				and(
					eq(products.user_uid, ctx.user.id),
					or(
						gt(products.stock_kg, "0"),
						gt(products.stock_pieces, 0),
						gt(products.stock_kg_frozen, "0"),
						gt(products.stock_pieces_frozen, 0),
					),
				),
			)
			.orderBy(products.category, products.name);
		return rows;
	}),

	// Mueve stock fresco -> congelado
	toFrozen: protectedProcedure
		.input(
			z.object({
				productId: z.number(),
				kg: z.number().min(0).default(0),
				pieces: z.number().int().min(0).default(0),
			}),
		)
		.mutation(async ({ input }) => {
			return db.transaction(async (tx) => {
				const [p] = await tx
					.select()
					.from(products)
					.where(eq(products.id, input.productId))
					.limit(1);
				if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Producto no encontrado" });

				if (Number(p.stock_kg) < input.kg || p.stock_pieces < input.pieces) {
					throw new TRPCError({
						code: "PRECONDITION_FAILED",
						message: "Stock fresco insuficiente para enviar a frío",
					});
				}

				await tx
					.update(products)
					.set({
						stock_kg: sql`${products.stock_kg} - ${input.kg.toFixed(3)}`,
						stock_pieces: sql`${products.stock_pieces} - ${input.pieces}`,
						stock_kg_frozen: sql`${products.stock_kg_frozen} + ${input.kg.toFixed(3)}`,
						stock_pieces_frozen: sql`${products.stock_pieces_frozen} + ${input.pieces}`,
					})
					.where(eq(products.id, input.productId));

				await tx.insert(inventoryTransactions).values({
					product_id: input.productId,
					quantity_change_pieces: input.pieces > 0 ? -input.pieces : null,
					quantity_change_kg: input.kg > 0 ? (-input.kg).toFixed(3) : null,
					transaction_type: "TRANSFER_A_FRIO",
					notes: "Fresco -> Congelado",
				});

				return { success: true };
			});
		}),

	// Mueve stock congelado -> fresco (para poder vender)
	toFresh: protectedProcedure
		.input(
			z.object({
				productId: z.number(),
				kg: z.number().min(0).default(0),
				pieces: z.number().int().min(0).default(0),
			}),
		)
		.mutation(async ({ input }) => {
			return db.transaction(async (tx) => {
				const [p] = await tx
					.select()
					.from(products)
					.where(eq(products.id, input.productId))
					.limit(1);
				if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Producto no encontrado" });

				if (Number(p.stock_kg_frozen) < input.kg || p.stock_pieces_frozen < input.pieces) {
					throw new TRPCError({
						code: "PRECONDITION_FAILED",
						message: "Stock congelado insuficiente para descongelar",
					});
				}

				await tx
					.update(products)
					.set({
						stock_kg_frozen: sql`${products.stock_kg_frozen} - ${input.kg.toFixed(3)}`,
						stock_pieces_frozen: sql`${products.stock_pieces_frozen} - ${input.pieces}`,
						stock_kg: sql`${products.stock_kg} + ${input.kg.toFixed(3)}`,
						stock_pieces: sql`${products.stock_pieces} + ${input.pieces}`,
					})
					.where(eq(products.id, input.productId));

				await tx.insert(inventoryTransactions).values({
					product_id: input.productId,
					quantity_change_pieces: input.pieces > 0 ? input.pieces : null,
					quantity_change_kg: input.kg > 0 ? input.kg.toFixed(3) : null,
					transaction_type: "TRANSFER_A_FRESCO",
					notes: "Congelado -> Fresco",
				});

				return { success: true };
			});
		}),
});
