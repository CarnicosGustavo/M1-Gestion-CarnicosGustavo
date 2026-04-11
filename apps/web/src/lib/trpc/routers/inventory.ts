import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { inventoryTransactions, products } from "@/lib/db/schema";
import { protectedProcedure, router } from "../init";

const inventoryStatusSchema = z.object({
	productId: z.number(),
	name: z.string(),
	category: z.string().nullable(),
	stock_pieces: z.number(),
	stock_kg: z.union([z.number(), z.string()]),
	in_stock: z.union([z.number(), z.string()]),
	updated_at: z.date().nullable(),
});

const inventoryTransactionSchema = z.object({
	id: z.number(),
	product_id: z.number(),
	quantity_change_pieces: z.number().nullable(),
	quantity_change_kg: z.union([z.number(), z.string()]).nullable(),
	transaction_type: z.string(),
	reference_id: z.number().nullable(),
	notes: z.string().nullable(),
	created_at: z.date().nullable(),
});

export const inventoryRouter = router({
	status: protectedProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/inventory/status",
				tags: ["Inventory"],
				summary: "Get inventory status",
			},
		})
		.input(z.object({ productId: z.number().optional() }).optional())
		.output(z.array(inventoryStatusSchema))
		.query(async ({ ctx, input }) => {
			const uid = ctx.user.id;

			if (input?.productId) {
				const rows = await db
					.select({
						productId: products.id,
						name: products.name,
						category: products.category,
						stock_pieces: products.stock_pieces,
						stock_kg: products.stock_kg,
						in_stock: products.in_stock,
						updated_at: products.updated_at,
					})
					.from(products)
					.where(
						and(eq(products.user_uid, uid), eq(products.id, input.productId)),
					);
				return rows;
			}

			return db
				.select({
					productId: products.id,
					name: products.name,
					category: products.category,
					stock_pieces: products.stock_pieces,
					stock_kg: products.stock_kg,
					in_stock: products.in_stock,
					updated_at: products.updated_at,
				})
				.from(products)
				.where(eq(products.user_uid, uid));
		}),

	adjust: protectedProcedure
		.meta({
			openapi: {
				method: "POST",
				path: "/inventory/adjust",
				tags: ["Inventory"],
				summary: "Adjust inventory (manual)",
			},
		})
		.input(
			z.object({
				productId: z.number(),
				deltaPieces: z.number().int().optional(),
				deltaKg: z.number().optional(),
				transactionType: z.string().default("AJUSTE"),
				notes: z.string().optional(),
			}),
		)
		.output(z.object({ success: z.boolean(), productId: z.number() }))
		.mutation(async ({ ctx, input }) => {
			const uid = ctx.user.id;
			const deltaPieces = input.deltaPieces ?? 0;
			const deltaKg = input.deltaKg ?? 0;

			if (deltaPieces === 0 && deltaKg === 0) {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Ajuste vacío" });
			}

			return db.transaction(async (tx) => {
				const [p] = await tx
					.select()
					.from(products)
					.where(
						and(eq(products.id, input.productId), eq(products.user_uid, uid)),
					)
					.limit(1);

				if (!p) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Producto no encontrado",
					});
				}

				const currentStockKg = Number(p.stock_kg);
				const currentInStock = Number(p.in_stock);
				const nextPieces = p.stock_pieces + deltaPieces;
				const nextStockKg = currentStockKg + deltaKg;
				const nextInStock = currentInStock + deltaKg;

				if (nextPieces < 0 || nextStockKg < 0 || nextInStock < 0) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Stock insuficiente para el ajuste",
					});
				}

				await tx
					.update(products)
					.set({
						stock_pieces: nextPieces,
						stock_kg: nextStockKg.toFixed(3),
						in_stock: nextInStock.toFixed(3),
						updated_at: new Date(),
					})
					.where(eq(products.id, input.productId));

				await tx.insert(inventoryTransactions).values({
					product_id: input.productId,
					quantity_change_pieces: deltaPieces !== 0 ? deltaPieces : null,
					quantity_change_kg: deltaKg !== 0 ? deltaKg.toFixed(3) : null,
					transaction_type: input.transactionType,
					notes: input.notes ?? null,
				});

				return { success: true, productId: input.productId };
			});
		}),

	transactions: protectedProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/inventory/transactions",
				tags: ["Inventory"],
				summary: "List inventory transactions",
			},
		})
		.input(
			z.object({
				productId: z.number(),
				limit: z.number().int().min(1).max(200).default(50),
			}),
		)
		.output(z.array(inventoryTransactionSchema))
		.query(async ({ ctx, input }) => {
			const uid = ctx.user.id;
			const [p] = await db
				.select({ id: products.id })
				.from(products)
				.where(
					and(eq(products.id, input.productId), eq(products.user_uid, uid)),
				)
				.limit(1);

			if (!p) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Producto no encontrado",
				});
			}

			return db
				.select()
				.from(inventoryTransactions)
				.where(eq(inventoryTransactions.product_id, input.productId))
				.orderBy(desc(inventoryTransactions.created_at))
				.limit(input.limit);
		}),
});
