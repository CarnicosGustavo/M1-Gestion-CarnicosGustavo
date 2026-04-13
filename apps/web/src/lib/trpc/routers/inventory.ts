import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import {
	inventoryTransactions,
	products,
	productTransformations,
} from "@/lib/db/schema";
import { protectedProcedure, router } from "../init";

const VALIDATION_USER_UID = "yT6H0ck1XlghSQWBZlDDXWUHWzDTbPCN";

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

const recipeSchema = z.object({
	id: z.number(),
	parent_product_id: z.number(),
	child_product_id: z.number(),
	yield_quantity_pieces: z.union([z.string(), z.number()]),
	yield_weight_ratio: z.union([z.string(), z.number()]),
	transformation_type: z.string(),
	is_active: z.boolean(),
	parentProduct: z.object({ id: z.number(), name: z.string() }),
	childProduct: z.object({
		id: z.number(),
		name: z.string(),
		is_parent_product: z.boolean(),
	}),
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
			if (ctx.user.id !== VALIDATION_USER_UID) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Acceso no autorizado",
				});
			}
			const uid = VALIDATION_USER_UID;

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
			if (ctx.user.id !== VALIDATION_USER_UID) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Acceso no autorizado",
				});
			}
			const uid = VALIDATION_USER_UID;
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
			if (ctx.user.id !== VALIDATION_USER_UID) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Acceso no autorizado",
				});
			}
			const uid = VALIDATION_USER_UID;
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

	recipesList: protectedProcedure
		.input(
			z
				.object({
					parentProductId: z.number().optional(),
					transformationType: z.string().optional(),
					includeInactive: z.boolean().default(false),
				})
				.optional(),
		)
		.output(z.array(recipeSchema))
		.query(async ({ ctx, input }) => {
			if (ctx.user.id !== VALIDATION_USER_UID) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Acceso no autorizado",
				});
			}
			const uid = VALIDATION_USER_UID;
			const parent = alias(products, "parent_products");
			const child = alias(products, "child_products");

			const rows = await db
				.select({
					id: productTransformations.id,
					parent_product_id: productTransformations.parent_product_id,
					child_product_id: productTransformations.child_product_id,
					yield_quantity_pieces: productTransformations.yield_quantity_pieces,
					yield_weight_ratio: productTransformations.yield_weight_ratio,
					transformation_type: productTransformations.transformation_type,
					is_active: productTransformations.is_active,
					parentProduct: { id: parent.id, name: parent.name },
					childProduct: {
						id: child.id,
						name: child.name,
						is_parent_product: child.is_parent_product,
					},
				})
				.from(productTransformations)
				.innerJoin(
					parent,
					eq(parent.id, productTransformations.parent_product_id),
				)
				.innerJoin(child, eq(child.id, productTransformations.child_product_id))
				.where(
					and(
						eq(parent.user_uid, uid),
						eq(child.user_uid, uid),
						input?.parentProductId !== undefined
							? eq(
									productTransformations.parent_product_id,
									input.parentProductId,
								)
							: undefined,
						input?.transformationType
							? eq(
									productTransformations.transformation_type,
									input.transformationType,
								)
							: undefined,
						input?.includeInactive
							? undefined
							: eq(productTransformations.is_active, true),
					),
				)
				.orderBy(
					asc(parent.name),
					asc(productTransformations.transformation_type),
					asc(child.name),
				);

			return rows;
		}),

	recipesUpsert: protectedProcedure
		.input(
			z.object({
				id: z.number().optional(),
				parentProductId: z.number(),
				childProductId: z.number(),
				yieldQuantityPieces: z.number().min(0),
				yieldWeightRatio: z.number().min(0),
				transformationType: z.string().min(1),
				isActive: z.boolean().default(true),
				childName: z.string().min(1).optional(),
			}),
		)
		.output(z.object({ success: z.boolean(), id: z.number() }))
		.mutation(async ({ ctx, input }) => {
			if (ctx.user.id !== VALIDATION_USER_UID) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Acceso no autorizado",
				});
			}
			const uid = VALIDATION_USER_UID;

			return db.transaction(async (tx) => {
				const [parentRow] = await tx
					.select({ id: products.id })
					.from(products)
					.where(
						and(
							eq(products.id, input.parentProductId),
							eq(products.user_uid, uid),
						),
					)
					.limit(1);
				const [childRow] = await tx
					.select({
						id: products.id,
						parent_product_id: products.parent_product_id,
					})
					.from(products)
					.where(
						and(
							eq(products.id, input.childProductId),
							eq(products.user_uid, uid),
						),
					)
					.limit(1);

				if (!parentRow || !childRow) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Producto padre/hijo no encontrado",
					});
				}

				if (input.childName || childRow.parent_product_id === null) {
					const updateData: Partial<typeof products.$inferInsert> = {
						updated_at: new Date(),
					};

					if (input.childName) updateData.name = input.childName;
					if (childRow.parent_product_id === null)
						updateData.parent_product_id = input.parentProductId;

					await tx
						.update(products)
						.set(updateData)
						.where(
							and(
								eq(products.id, input.childProductId),
								eq(products.user_uid, uid),
							),
						);
				}

				if (input.id) {
					const [updated] = await tx
						.update(productTransformations)
						.set({
							parent_product_id: input.parentProductId,
							child_product_id: input.childProductId,
							yield_quantity_pieces: input.yieldQuantityPieces.toFixed(2),
							yield_weight_ratio: input.yieldWeightRatio.toFixed(4),
							transformation_type: input.transformationType,
							is_active: input.isActive,
							updated_at: new Date(),
						})
						.where(eq(productTransformations.id, input.id))
						.returning({ id: productTransformations.id });

					if (!updated) {
						throw new TRPCError({
							code: "NOT_FOUND",
							message: "Receta no encontrada",
						});
					}
					return { success: true, id: updated.id };
				}

				const [created] = await tx
					.insert(productTransformations)
					.values({
						parent_product_id: input.parentProductId,
						child_product_id: input.childProductId,
						yield_quantity_pieces: input.yieldQuantityPieces.toFixed(2),
						yield_weight_ratio: input.yieldWeightRatio.toFixed(4),
						transformation_type: input.transformationType,
						is_active: input.isActive,
					})
					.returning({ id: productTransformations.id });

				return { success: true, id: created.id };
			});
		}),

	recipesSetActive: protectedProcedure
		.input(z.object({ id: z.number(), isActive: z.boolean() }))
		.output(z.object({ success: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			if (ctx.user.id !== VALIDATION_USER_UID) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Acceso no autorizado",
				});
			}
			const uid = VALIDATION_USER_UID;
			const parent = alias(products, "parent_products_for_toggle");

			const [row] = await db
				.select({ id: productTransformations.id })
				.from(productTransformations)
				.innerJoin(
					parent,
					eq(parent.id, productTransformations.parent_product_id),
				)
				.where(
					and(
						eq(productTransformations.id, input.id),
						eq(parent.user_uid, uid),
					),
				)
				.limit(1);

			if (!row) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Receta no encontrada",
				});
			}

			await db
				.update(productTransformations)
				.set({ is_active: input.isActive, updated_at: new Date() })
				.where(eq(productTransformations.id, input.id));

			return { success: true };
		}),
});
