import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import {
	inventoryTransactions,
	priceListItems,
	priceLists,
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

const priceListSchema = z.object({
	id: z.number(),
	code: z.string(),
	name: z.string(),
	is_default: z.boolean(),
});

const priceListItemSchema = z.object({
	product_id: z.number(),
	unit_price_per_kg: z.union([z.string(), z.number()]).nullable(),
	unit_price_per_piece: z.union([z.string(), z.number()]).nullable(),
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
				const nextPieces = p.stock_pieces + deltaPieces;
				const nextStockKg = currentStockKg + deltaKg;

				if (nextPieces < 0 || nextStockKg < 0) {
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
						// Note: in_stock is deprecated and kept for compatibility
						// It should only contain whole kg values (integer)
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

	priceListsList: protectedProcedure
		.input(z.void())
		.output(z.array(priceListSchema))
		.query(async ({ ctx }) => {
			if (ctx.user.id !== VALIDATION_USER_UID) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Acceso no autorizado",
				});
			}
			const uid = VALIDATION_USER_UID;

			return db
				.select({
					id: priceLists.id,
					code: priceLists.code,
					name: priceLists.name,
					is_default: priceLists.is_default,
				})
				.from(priceLists)
				.where(eq(priceLists.user_uid, uid))
				.orderBy(desc(priceLists.is_default), asc(priceLists.name));
		}),

	priceListItemsByList: protectedProcedure
		.input(z.object({ priceListId: z.number() }))
		.output(z.array(priceListItemSchema))
		.query(async ({ ctx, input }) => {
			if (ctx.user.id !== VALIDATION_USER_UID) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Acceso no autorizado",
				});
			}
			const uid = VALIDATION_USER_UID;

			const [list] = await db
				.select({ id: priceLists.id })
				.from(priceLists)
				.where(
					and(
						eq(priceLists.id, input.priceListId),
						eq(priceLists.user_uid, uid),
					),
				)
				.limit(1);

			if (!list) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Lista de precios no encontrada",
				});
			}

			return db
				.select({
					product_id: priceListItems.product_id,
					unit_price_per_kg: priceListItems.unit_price_per_kg,
					unit_price_per_piece: priceListItems.unit_price_per_piece,
				})
				.from(priceListItems)
				.where(eq(priceListItems.price_list_id, input.priceListId));
		}),

	priceListImportCsv: protectedProcedure
		.input(
			z.object({
				listCode: z.enum(["MAYOREO_CONTADO", "MAYOREO_CREDITO", "MENUDEO"]),
				listName: z.string().min(1),
				csvText: z.string().min(1),
				priceIsPerKg: z.boolean().default(true),
			}),
		)
		.output(
			z.object({
				success: z.boolean(),
				priceListId: z.number(),
				matched: z.number(),
				unmatchedAliases: z.array(z.string()),
				uniqueAliases: z.number(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (ctx.user.id !== VALIDATION_USER_UID) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Acceso no autorizado",
				});
			}
			const uid = VALIDATION_USER_UID;

			const normalizeAlias = (s: string) =>
				s
					.trim()
					.replace(/\s+/g, " ")
					.replace(/\u00A0/g, " ")
					.toUpperCase();

			const parsePrice = (s: string) => {
				const cleaned = s.trim().replace(/[^\d.,-]/g, "");
				const normalized = cleaned.replace(/,/g, "");
				const n = Number(normalized);
				return Number.isFinite(n) ? n : null;
			};

			const lines = input.csvText
				.split(/\r?\n/)
				.map((l) => l.trim())
				.filter((l) => l.length > 0);

			const dataLines = lines.filter(
				(l) => !/PIEZAS/i.test(l) && !/PRECIO/i.test(l),
			);

			const aliasToPriceCounts = new Map<string, Map<number, number>>();
			const aliasToLastPrice = new Map<string, number>();

			for (const line of dataLines) {
				const parts = line
					.split(",")
					.map((p) => p.trim())
					.filter(Boolean);
				if (parts.length < 2) continue;
				const alias = normalizeAlias(parts[0]);
				const price = parsePrice(parts[1]);
				if (!alias || price === null) continue;

				let counts = aliasToPriceCounts.get(alias);
				if (!counts) {
					counts = new Map();
					aliasToPriceCounts.set(alias, counts);
				}
				counts.set(price, (counts.get(price) ?? 0) + 1);
				aliasToLastPrice.set(alias, price);
			}

			const aliasToChosenPrice = new Map<string, number>();
			for (const [alias, counts] of aliasToPriceCounts) {
				let bestPrice: number | null = null;
				let bestCount = -1;
				for (const [price, count] of counts) {
					if (count > bestCount) {
						bestCount = count;
						bestPrice = price;
					} else if (count === bestCount && bestPrice !== null) {
						const last = aliasToLastPrice.get(alias) ?? bestPrice;
						if (price === last) bestPrice = price;
					}
				}
				if (bestPrice !== null) aliasToChosenPrice.set(alias, bestPrice);
			}

			const uniqueAliases = aliasToChosenPrice.size;

			return db.transaction(async (tx) => {
				let [list] = await tx
					.select({ id: priceLists.id })
					.from(priceLists)
					.where(
						and(
							eq(priceLists.user_uid, uid),
							eq(priceLists.code, input.listCode),
						),
					)
					.limit(1);

				if (!list) {
					[list] = await tx
						.insert(priceLists)
						.values({
							user_uid: uid,
							code: input.listCode,
							name: input.listName,
							is_default: input.listCode === "MAYOREO_CONTADO",
						})
						.returning({ id: priceLists.id });
				} else {
					await tx
						.update(priceLists)
						.set({ name: input.listName, updated_at: new Date() })
						.where(eq(priceLists.id, list.id));
				}

				const allProducts = await tx
					.select({
						id: products.id,
						name: products.name,
						is_sellable_by_weight: products.is_sellable_by_weight,
						is_sellable_by_unit: products.is_sellable_by_unit,
					})
					.from(products)
					.where(eq(products.user_uid, uid));

				const normalizeProductKey = (name: string) => {
					const trimmed = normalizeAlias(name);
					return trimmed.replace(/^XX\d+\s*-\s*/i, "").trim();
				};

				const keyToProduct = new Map<string, (typeof allProducts)[number]>();
				for (const p of allProducts) {
					const key = normalizeProductKey(p.name);
					if (key && !keyToProduct.has(key)) keyToProduct.set(key, p);
					const full = normalizeAlias(p.name);
					if (full && !keyToProduct.has(full)) keyToProduct.set(full, p);
				}

				const unmatchedAliases: string[] = [];
				let matched = 0;

				for (const [alias, price] of aliasToChosenPrice) {
					const key = normalizeProductKey(alias);
					const p =
						keyToProduct.get(key) ?? keyToProduct.get(normalizeAlias(alias));
					if (!p) {
						unmatchedAliases.push(alias);
						continue;
					}

					const useKg = input.priceIsPerKg && p.is_sellable_by_weight;
					const usePiece = !useKg && p.is_sellable_by_unit;

					const existing = await tx
						.select({ id: priceListItems.id })
						.from(priceListItems)
						.where(
							and(
								eq(priceListItems.price_list_id, list.id),
								eq(priceListItems.product_id, p.id),
							),
						)
						.limit(1);

					const updateData: Partial<typeof priceListItems.$inferInsert> = {
						updated_at: new Date(),
						unit_price_per_kg: useKg ? price.toFixed(2) : null,
						unit_price_per_piece: usePiece ? price.toFixed(2) : null,
					};

					if (existing.length) {
						await tx
							.update(priceListItems)
							.set(updateData)
							.where(eq(priceListItems.id, existing[0].id));
					} else {
						await tx.insert(priceListItems).values({
							price_list_id: list.id,
							product_id: p.id,
							unit_price_per_kg: updateData.unit_price_per_kg ?? null,
							unit_price_per_piece: updateData.unit_price_per_piece ?? null,
						});
					}
					matched += 1;
				}

				return {
					success: true,
					priceListId: list.id,
					matched,
					unmatchedAliases,
					uniqueAliases,
				};
			});
		}),
});
