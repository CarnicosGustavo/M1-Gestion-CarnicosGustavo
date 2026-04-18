import { TRPCError } from "@trpc/server";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import {
	inventoryTransactions,
	products,
	productTransformations,
} from "@/lib/db/schema";
import {
	adminProcedure,
	almacenProcedure,
	protectedProcedure,
	router,
} from "../init";

const productSchema = z.object({
	id: z.number(),
	name: z.string(),
	description: z.string().nullable(),
	price_per_kg: z.union([z.number(), z.string()]).nullable(),
	unit: z.string().nullable(),
	active: z.boolean(),
	sort_order: z.number().nullable(),
	in_stock: z.union([z.number(), z.string()]),
	category: z.string().nullable(),
	user_uid: z.string(),
	ncm: z.string().nullable(),
	cfop: z.string().nullable(),
	icms_cst: z.string().nullable(),
	pis_cst: z.string().nullable(),
	cofins_cst: z.string().nullable(),
	unit_of_measure: z.string().nullable(),
	// New Inventory Dual Fields
	stock_pieces: z.number(),
	stock_kg: z.union([z.number(), z.string()]),
	is_parent_product: z.boolean(),
	parent_product_id: z.number().nullable(),
	is_sellable_by_unit: z.boolean(),
	is_sellable_by_weight: z.boolean(),
	default_sale_unit: z.string(),
	price_per_piece: z.union([z.number(), z.string()]).nullable(),
	created_at: z.date().nullable(),
	updated_at: z.date().nullable(),
});

const productWithParentsSchema = productSchema.extend({
	parent_product_ids: z.array(z.number()),
});

const productTransformationSchema = z.object({
	id: z.number(),
	parent_product_id: z.number(),
	child_product_id: z.number(),
	yield_quantity_pieces: z.union([z.string(), z.number()]),
	yield_weight_ratio: z.union([z.string(), z.number()]),
	transformation_type: z.string(),
	is_active: z.boolean(),
	created_at: z.date().nullable().optional(),
	updated_at: z.date().nullable().optional(),
	childProduct: z
		.object({
			id: z.number(),
			name: z.string(),
			category: z.string().nullable(),
		})
		.nullable()
		.optional(),
});

export const productsRouter = router({
	list: protectedProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/products",
				tags: ["Products"],
				summary: "List all products",
			},
		})
		.input(
			z
				.object({
					isParent: z.boolean().optional(),
					parentProductId: z.number().optional(),
					includeDescendants: z.boolean().optional(),
					includeSelf: z.boolean().optional(),
				})
				.optional(),
		)
		.output(z.array(productWithParentsSchema))
		.query(async ({ ctx, input }) => {
			const uid = ctx.user.id;

			const includeDescendants = input?.includeDescendants === true;
			const includeSelf = input?.includeSelf === true;

			let familyIds: number[] | null = null;
			if (input?.parentProductId !== undefined && includeDescendants) {
				type ExecuteResult =
					| { rows?: Array<{ id: unknown }> }
					| Array<{ id: unknown }>;
				const res = (await db.execute(sql`
          with recursive descendants(id) as (
            select id
            from products
            where id = ${input.parentProductId}
              and user_uid = ${uid}
            union
            select p.id
            from products p
            join descendants d on p.parent_product_id = d.id
            where p.user_uid = ${uid}
            union
            select child.id
            from product_transformations pt
            join descendants d on pt.parent_product_id = d.id
            join products child on child.id = pt.child_product_id
            where pt.is_active = true
              and child.user_uid = ${uid}
          )
          select id from descendants
        `)) as unknown as ExecuteResult;

				const rows = Array.isArray(res) ? res : (res.rows ?? []);
				familyIds = rows
					.map((r) => Number(r.id))
					.filter((n) => Number.isFinite(n));
				if (!includeSelf)
					familyIds = familyIds.filter((id) => id !== input.parentProductId);
				familyIds = Array.from(new Set(familyIds));
			}

			if (familyIds && familyIds.length === 0) {
				return [];
			}

			const rows = await db
				.select()
				.from(products)
				.where(
					and(
						eq(products.user_uid, uid),
						input?.isParent !== undefined
							? eq(products.is_parent_product, input.isParent)
							: undefined,
						familyIds
							? inArray(products.id, familyIds)
							: input?.parentProductId !== undefined
								? includeSelf
									? or(
											eq(products.id, input.parentProductId),
											eq(products.parent_product_id, input.parentProductId),
										)
									: eq(products.parent_product_id, input.parentProductId)
								: undefined,
					),
				);

			return rows.map((p) => ({
				...p,
				parent_product_ids:
					p.parent_product_id === null ? [] : [p.parent_product_id],
			}));
		}),

	create: adminProcedure
		.meta({
			openapi: {
				method: "POST",
				path: "/products",
				tags: ["Products"],
				summary: "Create a product",
			},
		})
		.input(
			z.object({
				name: z.string().min(1),
				description: z.string().optional(),
				price_per_kg: z.number().optional(),
				unit: z.string().optional(),
				active: z.boolean().default(true),
				sort_order: z.number().optional(),
				in_stock: z.number().min(0).default(0),
				category: z.string().optional(),
				ncm: z.string().max(8).optional(),
				cfop: z.string().max(4).optional(),
				icms_cst: z.string().max(3).optional(),
				pis_cst: z.string().max(2).optional(),
				cofins_cst: z.string().max(2).optional(),
				unit_of_measure: z.string().max(6).optional(),
				stock_pieces: z.number().int().default(0),
				stock_kg: z.number().default(0),
				is_parent_product: z.boolean().default(false),
				is_sellable_by_unit: z.boolean().default(true),
				is_sellable_by_weight: z.boolean().default(true),
				default_sale_unit: z.string().max(10).default("KG"),
				price_per_piece: z.number().optional(),
			}),
		)
		.output(productSchema)
		.mutation(async ({ ctx, input }) => {
			const { in_stock, stock_kg, price_per_kg, price_per_piece, ...rest } =
				input;
			const [data] = await db
				.insert(products)
				.values({
					...rest,
					in_stock: in_stock.toFixed(3),
					stock_kg: stock_kg.toFixed(3),
					price_per_kg: price_per_kg?.toFixed(2),
					price_per_piece: price_per_piece?.toFixed(2),
					user_uid: ctx.user.id,
				})
				.returning();
			return data;
		}),

	update: adminProcedure
		.meta({
			openapi: {
				method: "PATCH",
				path: "/products/{id}",
				tags: ["Products"],
				summary: "Update a product",
			},
		})
		.input(
			z.object({
				id: z.number(),
				name: z.string().min(1).optional(),
				description: z.string().optional(),
				price_per_kg: z.number().optional(),
				unit: z.string().optional(),
				active: z.boolean().optional(),
				sort_order: z.number().optional(),
				in_stock: z.number().min(0).optional(),
				category: z.string().optional(),
				ncm: z.string().max(8).optional(),
				cfop: z.string().max(4).optional(),
				icms_cst: z.string().max(3).optional(),
				pis_cst: z.string().max(2).optional(),
				cofins_cst: z.string().max(2).optional(),
				unit_of_measure: z.string().max(6).optional(),
				stock_pieces: z.number().int().optional(),
				stock_kg: z.number().optional(),
				is_parent_product: z.boolean().optional(),
				is_sellable_by_unit: z.boolean().optional(),
				is_sellable_by_weight: z.boolean().optional(),
				default_sale_unit: z.string().max(10).optional(),
				price_per_piece: z.number().optional(),
			}),
		)
		.output(productSchema)
		.mutation(async ({ ctx, input }) => {
			const { id, in_stock, stock_kg, price_per_kg, price_per_piece, ...data } =
				input;
			const updateData: Partial<typeof products.$inferInsert> & {
				user_uid: string;
				updated_at: Date;
			} = {
				...data,
				user_uid: ctx.user.id,
				updated_at: new Date(),
			};

			if (in_stock !== undefined) updateData.in_stock = in_stock.toFixed(3);
			if (stock_kg !== undefined) updateData.stock_kg = stock_kg.toFixed(3);
			if (price_per_kg !== undefined)
				updateData.price_per_kg = price_per_kg.toFixed(2);
			if (price_per_piece !== undefined)
				updateData.price_per_piece = price_per_piece.toFixed(2);

			const [updated] = await db
				.update(products)
				.set(updateData)
				.where(and(eq(products.id, id), eq(products.user_uid, ctx.user.id)))
				.returning();
			return updated;
		}),

	delete: adminProcedure
		.meta({
			openapi: {
				method: "DELETE",
				path: "/products/{id}",
				tags: ["Products"],
				summary: "Delete a product",
			},
		})
		.input(z.object({ id: z.number() }))
		.output(z.object({ success: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			await db
				.delete(products)
				.where(
					and(eq(products.id, input.id), eq(products.user_uid, ctx.user.id)),
				);
			return { success: true };
		}),

	processDisassembly: almacenProcedure
		.meta({
			openapi: {
				method: "POST",
				path: "/products/disassembly",
				tags: ["Products"],
				summary: "Process product disassembly",
			},
		})
		.input(
			z.object({
				parentProductId: z.number(),
				quantityToProcess: z.number().int().positive(),
				transformationType: z.string().min(1),
				realWeightMode: z.boolean().optional(),
				entryMode: z.boolean().optional(),
			}),
		)
		.output(z.object({ success: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			const uid = ctx.user.id;
			const {
				parentProductId,
				quantityToProcess,
				transformationType,
				realWeightMode,
				entryMode,
			} = input;
			const useRealWeightMode = realWeightMode !== false;
			const useEntryMode = entryMode === true;

			const normalizePieces = (value: number) =>
				value > 50 ? value / 1000 : value;
			const normalizeRatio = (value: number) =>
				value > 1 ? value / 1000 : value;

			return await db.transaction(async (tx) => {
				// 1. Validar Stock Padre
				const [parent] = await tx
					.select()
					.from(products)
					.where(
						and(eq(products.id, parentProductId), eq(products.user_uid, uid)),
					)
					.limit(1);

				if (!parent) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Producto padre no encontrado",
					});
				}

				if (!useEntryMode && parent.stock_pieces < quantityToProcess) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Stock de piezas insuficiente",
					});
				}

				const stockKg = Number(parent.stock_kg);
				const parentAvgWeight =
					parent.stock_pieces > 0 ? stockKg / parent.stock_pieces : 0;
				const isFullDisassembly = quantityToProcess === parent.stock_pieces;
				const kgToRemove = useRealWeightMode
					? isFullDisassembly
						? stockKg
						: 0
					: quantityToProcess * parentAvgWeight;

				if (!useEntryMode) {
					// Validate that parent has enough kg to remove
					const newStockKg = stockKg - kgToRemove;
					if (newStockKg < 0) {
						throw new TRPCError({
							code: "PRECONDITION_FAILED",
							message: `Stock insuficiente: se requieren ${kgToRemove.toFixed(3)} kg pero solo hay ${stockKg.toFixed(3)} kg disponibles`,
						});
					}

					await tx
						.update(products)
						.set({
							stock_pieces: parent.stock_pieces - quantityToProcess,
							stock_kg: newStockKg.toFixed(3),
							// Note: in_stock is deprecated and kept for compatibility
							// It should only contain whole kg values (integer)
						})
						.where(eq(products.id, parentProductId));

					await tx.insert(inventoryTransactions).values({
						product_id: parentProductId,
						quantity_change_pieces: -quantityToProcess,
						quantity_change_kg:
							kgToRemove !== 0 ? (-kgToRemove).toFixed(3) : null,
						transaction_type: "DESPIECE",
						notes: `Salida por despiece ${transformationType}`,
					});
				}

				// 5. Obtener Recetas
				const selectedType = transformationType;
				const typesToApply =
					selectedType === "BASE" ? ["BASE"] : ["BASE", selectedType];

				const recipes = await tx
					.select()
					.from(productTransformations)
					.where(
						and(
							eq(productTransformations.parent_product_id, parentProductId),
							inArray(productTransformations.transformation_type, typesToApply),
							eq(productTransformations.is_active, true),
						),
					);

				if (recipes.length === 0) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "No se encontraron recetas para este despiece",
					});
				}

				// 6. Incrementar Hijos
				for (const recipe of recipes) {
					const yieldPieces = normalizePieces(
						Number(recipe.yield_quantity_pieces),
					);

					const childPiecesToAdd = Math.round(quantityToProcess * yieldPieces);
					const yieldRatio = useRealWeightMode
						? 0
						: normalizeRatio(Number(recipe.yield_weight_ratio));
					const childKgToAdd = useRealWeightMode
						? 0
						: quantityToProcess * yieldRatio * parentAvgWeight;
					const [child] = await tx
						.select()
						.from(products)
						.where(
							and(
								eq(products.id, recipe.child_product_id),
								eq(products.user_uid, uid),
							),
						)
						.limit(1);

					if (child) {
						const newChildStockKg = Number(child.stock_kg) + childKgToAdd;

						// Validate that new stock doesn't exceed numeric limits
						if (newChildStockKg > 9999999.999) {
							throw new TRPCError({
								code: "INVALID_DATA",
								message: `Stock del producto ${child.name} excedería el límite máximo permitido`,
							});
						}

						await tx
							.update(products)
							.set({
								stock_pieces: child.stock_pieces + childPiecesToAdd,
								stock_kg: newChildStockKg.toFixed(3),
								// Note: in_stock is deprecated and kept for compatibility
								// It should only contain whole kg values (integer)
							})
							.where(eq(products.id, recipe.child_product_id));

						await tx.insert(inventoryTransactions).values({
							product_id: recipe.child_product_id,
							quantity_change_pieces: childPiecesToAdd,
							quantity_change_kg: useRealWeightMode
								? null
								: childKgToAdd.toFixed(3),
							transaction_type: "DESPIECE",
							reference_id: parentProductId,
							notes: useEntryMode
								? `Entrada por despiece (recepción) ${transformationType} - ${parent.name}`
								: `Entrada por despiece ${transformationType} de ${parent.name}`,
						});
					}
				}

				return { success: true };
			});
		}),

	getTransformations: protectedProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/products/transformations",
				tags: ["Products"],
				summary: "Get product transformations",
			},
		})
		.input(
			z.object({
				parentProductId: z.number(),
				transformationType: z.string().optional(),
			}),
		)
		.output(z.array(productTransformationSchema))
		.query(async ({ ctx, input }) => {
			const uid = ctx.user.id;
			const [parent] = await db
				.select({ id: products.id })
				.from(products)
				.where(
					and(
						eq(products.id, input.parentProductId),
						eq(products.user_uid, uid),
					),
				)
				.limit(1);

			if (!parent) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Producto padre no encontrado",
				});
			}

			const selectedType = input.transformationType ?? "BASE";
			const typesToApply =
				selectedType === "BASE" ? ["BASE"] : ["BASE", selectedType];

			return db.query.productTransformations.findMany({
				where: and(
					eq(productTransformations.parent_product_id, input.parentProductId),
					inArray(productTransformations.transformation_type, typesToApply),
					eq(productTransformations.is_active, true),
				),
				with: {
					childProduct: true,
				},
			});
		}),

	registerChannelPurchase: almacenProcedure
		.input(
			z.object({
				purchaseMode: z
					.enum(["CANAL_COMPLETO", "MEDIA_CANAL"])
					.default("CANAL_COMPLETO"),
				qtyNacional: z.number().int().min(0),
				qtyAmericano: z.number().int().min(0),
				totalWeightKg: z.number().positive("Debe ser mayor a 0"),
				supplier: z.string().optional(),
				notes: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const uid = ctx.user.id;
			const channelsTotal = input.qtyNacional + input.qtyAmericano;
			if (channelsTotal <= 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Debe registrar al menos 1 canal",
				});
			}
			const factor = input.purchaseMode === "CANAL_COMPLETO" ? 2 : 1;
			const mediasNacional = input.qtyNacional * factor;
			const mediasAmericano = input.qtyAmericano * factor;
			const quantityPieces = mediasNacional + mediasAmericano;

			return await db.transaction(async (tx) => {
				// 1. Encontrar producto CANAL (parent product only)
				const [canalProduct] = await tx
					.select()
					.from(products)
					.where(
						and(
							sql`LOWER(${products.name}) LIKE '%canal%'`,
							eq(products.is_parent_product, true),
							eq(products.user_uid, uid),
						),
					)
					.limit(1);

				if (!canalProduct) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "No se encontró producto CANAL",
					});
				}

				// 2. Actualizar stock
				const currentStock = Number(canalProduct.stock_pieces);
				const currentKg = Number(canalProduct.stock_kg);
				const newStock = currentStock + quantityPieces;
				const newKg = currentKg + input.totalWeightKg;

				await tx
					.update(products)
					.set({
						stock_pieces: newStock,
						stock_kg: newKg.toFixed(3),
					})
					.where(eq(products.id, canalProduct.id));

				// 3. Registrar transacción
				await tx.insert(inventoryTransactions).values({
					product_id: canalProduct.id,
					quantity_change_pieces: quantityPieces,
					quantity_change_kg: input.totalWeightKg.toFixed(3),
					transaction_type: "COMPRA",
					notes: [
						`Compra ${input.purchaseMode === "CANAL_COMPLETO" ? "canal completo" : "media canal"}`,
						`N:${input.qtyNacional}`,
						`A:${input.qtyAmericano}`,
						`medias N:${mediasNacional}`,
						`medias A:${mediasAmericano}`,
						input.supplier ? `Proveedor: ${input.supplier}` : null,
						input.notes ?? null,
					]
						.filter(Boolean)
						.join(" | "),
				});

				return {
					success: true,
					product: canalProduct.name,
					purchaseMode: input.purchaseMode,
					qtyNacional: input.qtyNacional,
					qtyAmericano: input.qtyAmericano,
					mediasNacional,
					mediasAmericano,
					previousStock: currentStock,
					newStock: newStock,
					previousKg: currentKg,
					newKg: newKg.toFixed(3),
				};
			});
		}),

	getAvailableTransformationTypes: protectedProcedure
		.input(z.object({ parentProductId: z.number() }))
		.query(async ({ input }) => {
			// Get all unique transformation types for this parent product
			const transformationTypes = await db
				.selectDistinct({
					type: productTransformations.transformation_type,
				})
				.from(productTransformations)
				.where(
					and(
						eq(productTransformations.parent_product_id, input.parentProductId),
						eq(productTransformations.is_active, true),
					),
				)
				.orderBy(productTransformations.transformation_type);

			return transformationTypes.map((t) => t.type).filter((t) => t !== null);
		}),
});
