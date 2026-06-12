import { TRPCError } from "@trpc/server";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import {
	channelPurchases,
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
	weighed_pieces: z.number(),
	stock_kg: z.union([z.number(), z.string()]),
	is_parent_product: z.boolean(),
	parent_product_id: z.number().nullable(),
	is_sellable_by_unit: z.boolean(),
	is_sellable_by_weight: z.boolean(),
	default_sale_unit: z.string(),
	price_per_piece: z.union([z.number(), z.string()]).nullable(),
	avg_weight_per_piece_kg: z
		.union([z.number(), z.string()])
		.nullable()
		.optional(),
	created_at: z.date().nullable(),
	updated_at: z.date().nullable(),
});

const productWithParentsSchema = productSchema.extend({
	parent_product_ids: z.array(z.number()),
	yield_weight_ratio: z.union([z.string(), z.number()]).nullable().optional(),
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
				.select({
					...products,
					yield_weight_ratio: productTransformations.yield_weight_ratio,
				})
				.from(products)
				.leftJoin(
					productTransformations,
					eq(products.id, productTransformations.child_product_id),
				)
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

			// El leftJoin a product_transformations duplica filas cuando un producto
			// es hijo en varias recetas (ej. CABEZA hija de 3 canales). Deduplicamos
			// por id, conservando la primera fila.
			const seen = new Set<number>();
			const unique: Array<
				(typeof rows)[number] & { parent_product_ids: number[] }
			> = [];
			for (const p of rows) {
				if (seen.has(p.id)) continue;
				seen.add(p.id);
				unique.push({
					...p,
					parent_product_ids:
						p.parent_product_id === null ? [] : [p.parent_product_id],
				});
			}
			return unique;
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
			try {
				const [data] = await db
					.insert(products)
					.values({
						...rest,
						// in_stock es columna integer (deprecado): enviar entero, no decimal
						in_stock: String(Math.round(in_stock)),
						stock_kg: stock_kg.toFixed(3),
						price_per_kg: price_per_kg?.toFixed(2),
						price_per_piece: price_per_piece?.toFixed(2),
						user_uid: ctx.user.id,
					})
					.returning();
				return data;
			} catch (err) {
				const e = err as unknown as {
					code?: string;
					detail?: string;
					constraint?: string;
					message?: string;
				};
				const message = [
					e.code ? `code=${e.code}` : null,
					e.constraint ? `constraint=${e.constraint}` : null,
					e.detail ? `detail=${e.detail}` : null,
					e.message ? `message=${e.message}` : null,
				]
					.filter(Boolean)
					.join(" | ");
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: message
						? `Error creando producto: ${message}`
						: "Error creando producto",
				});
			}
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

			if (in_stock !== undefined)
				updateData.in_stock = String(Math.round(in_stock));
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

	// Clasifica un producto huérfano: viene de proveedor (compra) o es duplicado.
	// Asigna una categoría que lo excluye de la alerta "sin receta".
	classifyOrphan: adminProcedure
		.input(
			z.object({
				productId: z.number(),
				action: z.enum(["purchased", "duplicate"]),
			}),
		)
		.output(z.object({ success: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			const category = input.action === "purchased" ? "Compra" : "Duplicado";
			await db
				.update(products)
				.set({ category, updated_at: new Date() })
				.where(
					and(
						eq(products.id, input.productId),
						eq(products.user_uid, ctx.user.id),
					),
				);
			return { success: true };
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

					const nextPieces = parent.stock_pieces - quantityToProcess;
					const nextWeighedPieces = Math.min(
						parent.weighed_pieces ?? 0,
						nextPieces,
					);
					await tx
						.update(products)
						.set({
							stock_pieces: nextPieces,
							weighed_pieces: nextWeighedPieces,
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
				const parentNameLower = parent.name.toLowerCase();
				const typeLower = selectedType.toLowerCase();
				const shouldAutoRecorte =
					typeLower.includes("cuadr") &&
					(typeLower.includes("cuero") ||
						parentNameLower.includes("panza") ||
						parentNameLower.includes("cuero"));
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

				const dedupeByChild = <
					T extends {
						id: number;
						child_product_id: number;
						transformation_type: string | null;
					},
				>(
					rows: T[],
				) => {
					const map = new Map<number, T>();
					for (const r of rows) {
						const prev = map.get(r.child_product_id);
						if (!prev || r.id > prev.id) map.set(r.child_product_id, r);
					}
					return map;
				};

				const effectiveRecipes = (() => {
					const base = recipes.filter((r) => r.transformation_type === "BASE");
					if (selectedType === "BASE")
						return Array.from(dedupeByChild(base).values());
					const specific = recipes.filter(
						(r) => r.transformation_type === selectedType,
					);
					const baseMap = dedupeByChild(base);
					const specMap = dedupeByChild(specific);
					for (const [k, v] of specMap) baseMap.set(k, v);
					return Array.from(baseMap.values());
				})();

				// 6. Incrementar Hijos
				let hasRecorteChild = false;
				for (const recipe of effectiveRecipes) {
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
						if (child.name.toLowerCase().includes("recorte")) {
							hasRecorteChild = true;
						}
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

				if (shouldAutoRecorte && !hasRecorteChild) {
					const recorteCandidates = await tx
						.select()
						.from(products)
						.where(
							and(
								eq(products.user_uid, uid),
								sql`LOWER(${products.name}) LIKE '%recorte%'`,
							),
						);

					const normalizeName = (name: string) =>
						name
							.toLowerCase()
							.replace(/^\s*[a-z]{2}\d+\s*-\s*/i, "")
							.trim();
					const scoreRecorte = (name: string) => {
						const n = normalizeName(name);
						if (n.includes("cuero") && n.includes("recorte")) return 0;
						if (n.includes("recorte")) return 1;
						return 999;
					};

					const recorteProduct = recorteCandidates.slice().sort((a, b) => {
						const sa = scoreRecorte(a.name);
						const sb = scoreRecorte(b.name);
						if (sa !== sb) return sa - sb;
						return a.id - b.id;
					})[0];

					if (!recorteProduct) {
						throw new TRPCError({
							code: "NOT_FOUND",
							message:
								"No se encontró un producto RECORTE para registrar el subproducto",
						});
					}

					await tx
						.update(products)
						.set({
							stock_pieces: recorteProduct.stock_pieces + quantityToProcess,
						})
						.where(eq(products.id, recorteProduct.id));

					await tx.insert(inventoryTransactions).values({
						product_id: recorteProduct.id,
						quantity_change_pieces: quantityToProcess,
						quantity_change_kg: null,
						transaction_type: "DESPIECE",
						reference_id: parentProductId,
						notes: useEntryMode
							? `Entrada por recorte (recepción) ${transformationType} - ${parent.name}`
							: `Entrada por recorte ${transformationType} de ${parent.name}`,
					});
				}

				return { success: true };
			});
		}),

	// Convierte N piezas del producto base a una VARIANTE (especificación de
	// presentación): JAMON → JAMON S/H, etc. Mueve stock base→variante con el
	// ratio de peso de la receta (S/H 90% pierde el hueso). No bloquea por
	// stock (regla del negocio: se compensa al despiezar).
	convertToVariant: almacenProcedure
		.input(
			z.object({
				baseProductId: z.number(),
				variantProductId: z.number(),
				pieces: z.number().int().positive(),
			}),
		)
		.output(z.object({ success: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			const uid = ctx.user.id;
			return await db.transaction(async (tx) => {
				const [t] = await tx
					.select({
						ratio: productTransformations.yield_weight_ratio,
					})
					.from(productTransformations)
					.where(
						and(
							eq(productTransformations.parent_product_id, input.baseProductId),
							eq(
								productTransformations.child_product_id,
								input.variantProductId,
							),
							eq(productTransformations.is_variant, true),
							eq(productTransformations.is_active, true),
						),
					)
					.limit(1);
				if (!t) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "No hay una variante activa configurada para esa pieza",
					});
				}
				const ratio = Number(t.ratio) || 1;

				const [base] = await tx
					.select()
					.from(products)
					.where(
						and(
							eq(products.id, input.baseProductId),
							eq(products.user_uid, uid),
						),
					)
					.limit(1);
				const [variant] = await tx
					.select()
					.from(products)
					.where(
						and(
							eq(products.id, input.variantProductId),
							eq(products.user_uid, uid),
						),
					)
					.limit(1);
				if (!base || !variant) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Producto base o variante no encontrado",
					});
				}

				// Peso por pieza del base: real (stock) o el promedio configurado
				const baseAvg =
					base.stock_pieces > 0
						? Number(base.stock_kg) / base.stock_pieces
						: Number(base.avg_weight_per_piece_kg ?? 0);
				const kgBase = input.pieces * baseAvg;
				const kgVariant = kgBase * ratio;

				await tx
					.update(products)
					.set({
						stock_pieces: base.stock_pieces - input.pieces,
						stock_kg: (Number(base.stock_kg) - kgBase).toFixed(3),
					})
					.where(eq(products.id, base.id));
				await tx
					.update(products)
					.set({
						stock_pieces: variant.stock_pieces + input.pieces,
						stock_kg: (Number(variant.stock_kg) + kgVariant).toFixed(3),
					})
					.where(eq(products.id, variant.id));

				await tx.insert(inventoryTransactions).values([
					{
						product_id: base.id,
						quantity_change_pieces: -input.pieces,
						quantity_change_kg: kgBase !== 0 ? (-kgBase).toFixed(3) : null,
						transaction_type: "VARIANTE",
						reference_id: variant.id,
						notes: `Salida: ${input.pieces} pz de ${base.name} → ${variant.name}`,
					},
					{
						product_id: variant.id,
						quantity_change_pieces: input.pieces,
						quantity_change_kg: kgVariant !== 0 ? kgVariant.toFixed(3) : null,
						transaction_type: "VARIANTE",
						reference_id: base.id,
						notes: `Entrada: ${input.pieces} pz como ${variant.name} (desde ${base.name})`,
					},
				]);

				return { success: true };
			});
		}),

	processDisassemblyPipeline: almacenProcedure
		.input(
			z.object({
				canalProductId: z.number(),
				qtyProcessCanal: z.number().int().min(0),
				transformationType: z.string().min(1),
				intermediateLeaves: z
					.array(
						z.object({
							productId: z.number(),
							leaveComplete: z.number().int().min(0),
							transformationType: z.string().min(1).optional(),
						}),
					)
					.default([]),
				realWeightMode: z.boolean().optional(),
			}),
		)
		.output(z.object({ success: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			const uid = ctx.user.id;
			const useRealWeightMode = input.realWeightMode !== false;

			const normalizePieces = (value: number) =>
				value > 50 ? value / 1000 : value;
			const normalizeRatio = (value: number) =>
				value > 1 ? value / 1000 : value;
			const chooseType = (types: string[]) => {
				if (types.includes("BASE")) return "BASE";
				return types.slice().sort((a, b) => a.localeCompare(b))[0] ?? "BASE";
			};

			return await db.transaction(async (tx) => {
				const dedupeByChild = <
					T extends {
						id: number;
						child_product_id: number;
						transformation_type: string | null;
					},
				>(
					rows: T[],
				) => {
					const map = new Map<number, T>();
					for (const r of rows) {
						const prev = map.get(r.child_product_id);
						if (!prev || r.id > prev.id) map.set(r.child_product_id, r);
					}
					return map;
				};

				const buildEffectiveRecipes = <
					T extends {
						id: number;
						child_product_id: number;
						transformation_type: string | null;
					},
				>(
					rows: T[],
					selectedType: string,
				) => {
					const base = rows.filter((r) => r.transformation_type === "BASE");
					if (selectedType === "BASE")
						return Array.from(dedupeByChild(base).values());
					const specific = rows.filter(
						(r) => r.transformation_type === selectedType,
					);
					const baseMap = dedupeByChild(base);
					const specMap = dedupeByChild(specific);
					for (const [k, v] of specMap) baseMap.set(k, v);
					return Array.from(baseMap.values());
				};

				const applyDisassemblyTx = async (args: {
					parentProductId: number;
					quantityToProcess: number;
					transformationType: string;
				}) => {
					const [parent] = await tx
						.select()
						.from(products)
						.where(eq(products.id, args.parentProductId))
						.limit(1);

					if (!parent) {
						throw new TRPCError({
							code: "NOT_FOUND",
							message: "Producto padre no encontrado",
						});
					}

					if (parent.stock_pieces < args.quantityToProcess) {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message: "Stock de piezas insuficiente",
						});
					}

					const stockKg = Number(parent.stock_kg);
					const parentAvgWeight =
						parent.stock_pieces > 0 ? stockKg / parent.stock_pieces : 0;
					const isFullDisassembly =
						args.quantityToProcess === parent.stock_pieces;
					const kgToRemove = useRealWeightMode
						? isFullDisassembly
							? stockKg
							: 0
						: args.quantityToProcess * parentAvgWeight;

					const newStockKg = stockKg - kgToRemove;
					if (newStockKg < 0) {
						throw new TRPCError({
							code: "PRECONDITION_FAILED",
							message: `Stock insuficiente: se requieren ${kgToRemove.toFixed(3)} kg pero solo hay ${stockKg.toFixed(3)} kg disponibles`,
						});
					}

					const nextPieces = parent.stock_pieces - args.quantityToProcess;
					const nextWeighedPieces = Math.min(
						parent.weighed_pieces ?? 0,
						nextPieces,
					);
					await tx
						.update(products)
						.set({
							stock_pieces: nextPieces,
							weighed_pieces: nextWeighedPieces,
							stock_kg: newStockKg.toFixed(3),
						})
						.where(eq(products.id, args.parentProductId));

					await tx.insert(inventoryTransactions).values({
						product_id: args.parentProductId,
						quantity_change_pieces: -args.quantityToProcess,
						quantity_change_kg:
							kgToRemove !== 0 ? (-kgToRemove).toFixed(3) : null,
						transaction_type: "DESPIECE",
						notes: `Salida por despiece ${args.transformationType}`,
					});

					const selectedType = args.transformationType;
					const parentNameLower = parent.name.toLowerCase();
					const typeLower = selectedType.toLowerCase();
					const shouldAutoRecorte =
						typeLower.includes("cuadr") &&
						(typeLower.includes("cuero") ||
							parentNameLower.includes("panza") ||
							parentNameLower.includes("cuero"));
					const typesToApply =
						selectedType === "BASE" ? ["BASE"] : ["BASE", selectedType];

					const recipes = await tx
						.select()
						.from(productTransformations)
						.where(
							and(
								eq(
									productTransformations.parent_product_id,
									args.parentProductId,
								),
								inArray(
									productTransformations.transformation_type,
									typesToApply,
								),
								eq(productTransformations.is_active, true),
							),
						);

					if (recipes.length === 0) {
						throw new TRPCError({
							code: "NOT_FOUND",
							message: "No se encontraron recetas para este despiece",
						});
					}

					const effectiveRecipes = buildEffectiveRecipes(recipes, selectedType);

					let hasRecorteChild = false;
					for (const recipe of effectiveRecipes) {
						const yieldPieces = normalizePieces(
							Number(recipe.yield_quantity_pieces),
						);

						const childPiecesToAdd = Math.round(
							args.quantityToProcess * yieldPieces,
						);
						const yieldRatio = useRealWeightMode
							? 0
							: normalizeRatio(Number(recipe.yield_weight_ratio));
						const childKgToAdd = useRealWeightMode
							? 0
							: args.quantityToProcess * yieldRatio * parentAvgWeight;

						const [child] = await tx
							.select()
							.from(products)
							.where(eq(products.id, recipe.child_product_id))
							.limit(1);

						if (!child) continue;

						if (child.name.toLowerCase().includes("recorte")) {
							hasRecorteChild = true;
						}

						const newChildStockKg = Number(child.stock_kg) + childKgToAdd;
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
							})
							.where(eq(products.id, recipe.child_product_id));

						await tx.insert(inventoryTransactions).values({
							product_id: recipe.child_product_id,
							quantity_change_pieces: childPiecesToAdd,
							quantity_change_kg: useRealWeightMode
								? null
								: childKgToAdd.toFixed(3),
							transaction_type: "DESPIECE",
							reference_id: args.parentProductId,
							notes: `Entrada por despiece ${args.transformationType} de ${parent.name}`,
						});
					}

					if (shouldAutoRecorte && !hasRecorteChild) {
						const recorteCandidates = await tx
							.select()
							.from(products)
							.where(sql`LOWER(${products.name}) LIKE '%recorte%'`);

						const normalizeName = (name: string) =>
							name
								.toLowerCase()
								.replace(/^\s*[a-z]{2}\d+\s*-\s*/i, "")
								.trim();
						const scoreRecorte = (name: string) => {
							const n = normalizeName(name);
							if (n.includes("cuero") && n.includes("recorte")) return 0;
							if (n.includes("recorte")) return 1;
							return 999;
						};

						const recorteProduct = recorteCandidates.slice().sort((a, b) => {
							const sa = scoreRecorte(a.name);
							const sb = scoreRecorte(b.name);
							if (sa !== sb) return sa - sb;
							return a.id - b.id;
						})[0];

						if (!recorteProduct) {
							throw new TRPCError({
								code: "NOT_FOUND",
								message:
									"No se encontró un producto RECORTE para registrar el subproducto",
							});
						}

						await tx
							.update(products)
							.set({
								stock_pieces:
									recorteProduct.stock_pieces + args.quantityToProcess,
							})
							.where(eq(products.id, recorteProduct.id));

						await tx.insert(inventoryTransactions).values({
							product_id: recorteProduct.id,
							quantity_change_pieces: args.quantityToProcess,
							quantity_change_kg: null,
							transaction_type: "DESPIECE",
							reference_id: args.parentProductId,
							notes: `Entrada por recorte ${args.transformationType} de ${parent.name}`,
						});
					}
				};

				const [canal] = await tx
					.select()
					.from(products)
					.where(
						and(
							eq(products.id, input.canalProductId),
							eq(products.user_uid, uid),
						),
					)
					.limit(1);

				if (!canal) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Producto CANAL no encontrado",
					});
				}

				if (input.qtyProcessCanal <= 0) {
					return { success: true };
				}

				const canalStockKg = Number(canal.stock_kg);
				const canalAvgWeight =
					canal.stock_pieces > 0 ? canalStockKg / canal.stock_pieces : 0;
				const isFullDisassembly = input.qtyProcessCanal === canal.stock_pieces;
				const kgToRemove = useRealWeightMode
					? isFullDisassembly
						? canalStockKg
						: 0
					: input.qtyProcessCanal * canalAvgWeight;

				if (canal.stock_pieces < input.qtyProcessCanal) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Stock de canal insuficiente",
					});
				}

				const newCanalKg = canalStockKg - kgToRemove;
				if (newCanalKg < 0) {
					throw new TRPCError({
						code: "PRECONDITION_FAILED",
						message: `Stock insuficiente: se requieren ${kgToRemove.toFixed(3)} kg pero solo hay ${canalStockKg.toFixed(3)} kg disponibles`,
					});
				}

				const nextCanalPieces = canal.stock_pieces - input.qtyProcessCanal;
				const nextCanalWeighedPieces = Math.min(
					canal.weighed_pieces ?? 0,
					nextCanalPieces,
				);
				await tx
					.update(products)
					.set({
						stock_pieces: nextCanalPieces,
						weighed_pieces: nextCanalWeighedPieces,
						stock_kg: newCanalKg.toFixed(3),
					})
					.where(eq(products.id, input.canalProductId));

				await tx.insert(inventoryTransactions).values({
					product_id: input.canalProductId,
					quantity_change_pieces: -input.qtyProcessCanal,
					quantity_change_kg:
						kgToRemove !== 0 ? (-kgToRemove).toFixed(3) : null,
					transaction_type: "DESPIECE",
					notes: `Salida por despiece ${input.transformationType}`,
				});

				const selectedType = input.transformationType;
				const normalizeName = (name: string) =>
					name
						.toLowerCase()
						.replace(/^\s*[a-z]{2}\d+(\.\d+)?\s*-\s*/i, "")
						.trim();
				const canalName = normalizeName(canal.name);
				const isSpecificCanal =
					canalName.includes("canal americano") ||
					canalName.includes("canal nacional lomo") ||
					canalName.includes("canal nacional espilomo");
				const typesToApply =
					selectedType === "BASE"
						? ["BASE"]
						: isSpecificCanal
							? [selectedType]
							: ["BASE", selectedType];

				const canalRecipes = await tx
					.select()
					.from(productTransformations)
					.where(
						and(
							eq(
								productTransformations.parent_product_id,
								input.canalProductId,
							),
							inArray(productTransformations.transformation_type, typesToApply),
							eq(productTransformations.is_active, true),
						),
					);

				if (!canalRecipes.length) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "No se encontraron recetas para despiece de canal",
					});
				}

				const effectiveCanalRecipes = buildEffectiveRecipes(
					canalRecipes,
					selectedType,
				);

				const generatedByChildId = new Map<number, number>();
				for (const recipe of effectiveCanalRecipes) {
					const yieldPieces = normalizePieces(
						Number(recipe.yield_quantity_pieces),
					);
					const childPiecesToAdd = Math.round(
						input.qtyProcessCanal * yieldPieces,
					);
					if (childPiecesToAdd <= 0) continue;
					generatedByChildId.set(recipe.child_product_id, childPiecesToAdd);

					const yieldRatio = useRealWeightMode
						? 0
						: normalizeRatio(Number(recipe.yield_weight_ratio));
					const childKgToAdd = useRealWeightMode
						? 0
						: input.qtyProcessCanal * yieldRatio * canalAvgWeight;

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

					if (!child) continue;

					const newChildStockKg = Number(child.stock_kg) + childKgToAdd;
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
						})
						.where(eq(products.id, recipe.child_product_id));

					await tx.insert(inventoryTransactions).values({
						product_id: recipe.child_product_id,
						quantity_change_pieces: childPiecesToAdd,
						quantity_change_kg: useRealWeightMode
							? null
							: childKgToAdd.toFixed(3),
						transaction_type: "DESPIECE",
						reference_id: input.canalProductId,
						notes: `Entrada por despiece ${input.transformationType} de ${canal.name}`,
					});
				}

				const intermediateIds = input.intermediateLeaves
					.map((x) => x.productId)
					.filter((x, i, a) => a.indexOf(x) === i);

				if (intermediateIds.length) {
					const typeRows = await tx
						.selectDistinct({
							parentId: productTransformations.parent_product_id,
							type: productTransformations.transformation_type,
						})
						.from(productTransformations)
						.where(
							and(
								inArray(
									productTransformations.parent_product_id,
									intermediateIds,
								),
								eq(productTransformations.is_active, true),
							),
						);

					const typesByParentId = new Map<number, string[]>();
					for (const r of typeRows) {
						typesByParentId.set(r.parentId, [
							...(typesByParentId.get(r.parentId) ?? []),
							r.type,
						]);
					}

					for (const item of input.intermediateLeaves) {
						const generated = generatedByChildId.get(item.productId) ?? 0;
						if (generated <= 0) continue;
						if (item.leaveComplete > generated) {
							throw new TRPCError({
								code: "BAD_REQUEST",
								message: "Cantidad a dejar completa excede lo generado",
							});
						}
						const qtyToProcess = generated - item.leaveComplete;
						if (qtyToProcess <= 0) continue;

						const available = typesByParentId.get(item.productId) ?? [];
						const selected =
							item.transformationType && item.transformationType.trim().length
								? item.transformationType.trim()
								: null;
						if (selected && !available.includes(selected)) {
							throw new TRPCError({
								code: "BAD_REQUEST",
								message: `Tipo de despiece no disponible para intermedio (id ${item.productId}): ${selected}`,
							});
						}
						const t = selected ?? chooseType(available);

						await applyDisassemblyTx({
							parentProductId: item.productId,
							quantityToProcess: qtyToProcess,
							transformationType: t,
						});
					}
				}

				return { success: true };
			});
		}),

	// Mapa de disponibilidad: por producto, stock directo y si es derivable de
	// una pieza padre con stock (vía despiece).
	availabilityMap: protectedProcedure.input(z.void()).query(async ({ ctx }) => {
		const uid = ctx.user.id;
		const prods = await db
			.select({
				id: products.id,
				stock_pieces: products.stock_pieces,
				stock_kg: products.stock_kg,
			})
			.from(products)
			.where(eq(products.user_uid, uid));

		const trans = await db
			.select({
				child: productTransformations.child_product_id,
				parent: productTransformations.parent_product_id,
			})
			.from(productTransformations)
			.where(eq(productTransformations.is_active, true));

		// Padres con stock (piezas o kg)
		const inStock = new Set(
			prods
				.filter((p) => p.stock_pieces > 0 || Number(p.stock_kg) > 0)
				.map((p) => p.id),
		);
		// Hijos derivables (su padre tiene stock)
		const derivable = new Set<number>();
		for (const t of trans) {
			if (inStock.has(t.parent)) derivable.add(t.child);
		}

		return prods.map((p) => ({
			productId: p.id,
			stockPieces: p.stock_pieces,
			stockKg: Number(p.stock_kg),
			derivable: derivable.has(p.id),
		}));
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
				.select({ id: products.id, name: products.name })
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
			const normalizeName = (name: string) =>
				name
					.toLowerCase()
					.replace(/^\s*[a-z]{2}\d+(\.\d+)?\s*-\s*/i, "")
					.trim();
			const parentName = normalizeName(parent.name ?? "");
			const isSpecificCanal =
				parentName.includes("canal americano") ||
				parentName.includes("canal nacional lomo") ||
				parentName.includes("canal nacional espilomo");
			const typesToApply =
				selectedType === "BASE"
					? ["BASE"]
					: isSpecificCanal
						? [selectedType]
						: ["BASE", selectedType];

			const rows = await db.query.productTransformations.findMany({
				where: and(
					eq(productTransformations.parent_product_id, input.parentProductId),
					inArray(productTransformations.transformation_type, typesToApply),
					eq(productTransformations.is_active, true),
				),
				with: {
					childProduct: true,
				},
			});

			const dedupeByChild = <
				T extends {
					id: number;
					child_product_id: number;
					transformation_type: string | null;
				},
			>(
				rs: T[],
			) => {
				const map = new Map<number, T>();
				for (const r of rs) {
					const prev = map.get(r.child_product_id);
					if (!prev || r.id > prev.id) map.set(r.child_product_id, r);
				}
				return map;
			};

			const base = rows.filter((r) => r.transformation_type === "BASE");
			if (selectedType === "BASE")
				return Array.from(dedupeByChild(base).values());
			const specific = rows.filter(
				(r) => r.transformation_type === selectedType,
			);
			const baseMap = dedupeByChild(base);
			const specMap = dedupeByChild(specific);
			for (const [k, v] of specMap) baseMap.set(k, v);
			return Array.from(baseMap.values());
		}),

	registerChannelPurchase: almacenProcedure
		.input(
			z.object({
				purchaseMode: z
					.enum(["CANAL_COMPLETO", "MEDIA_CANAL"])
					.default("CANAL_COMPLETO"),
				qtyAmericano: z.number().int().min(0),
				qtyNacional: z.number().int().min(0).optional().default(0),
				qtyNacionalLomo: z.number().int().min(0).optional().default(0),
				qtyNacionalEspilomo: z.number().int().min(0).optional().default(0),
				totalWeightKg: z.number().positive("Debe ser mayor a 0"),
				pricePerKg: z.number().optional(),
				supplier: z.string().optional(),
				notes: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const uid = ctx.user.id;
			const isFull = input.purchaseMode === "CANAL_COMPLETO";

			const mediasAmericano = isFull
				? input.qtyAmericano * 2
				: input.qtyAmericano;
			const mediasNacionalLomo = isFull
				? input.qtyNacional
				: input.qtyNacionalLomo;
			const mediasNacionalEspilomo = isFull
				? input.qtyNacional
				: input.qtyNacionalEspilomo;

			const quantityPieces =
				mediasAmericano + mediasNacionalLomo + mediasNacionalEspilomo;

			if (quantityPieces <= 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Debe registrar al menos 1 media canal",
				});
			}

			return await db.transaction(async (tx) => {
				const normalizeProductName = (name: string) =>
					name
						.toLowerCase()
						.replace(/^\s*[a-z]{2}\d+\s*-\s*/i, "")
						.trim();
				const canalCandidates = await tx
					.select()
					.from(products)
					.where(
						and(
							sql`LOWER(${products.name}) LIKE '%canal%'`,
							eq(products.is_parent_product, true),
							eq(products.user_uid, uid),
						),
					);

				const scoreCanalSpecific = (
					name: string,
					kind: "US" | "MX_LOMO" | "MX_ESP",
				) => {
					const n = normalizeProductName(name);
					if (kind === "US") {
						if (n.includes("canal americano")) return 0;
						if (n.includes("americano") && n.includes("canal")) return 1;
						if (n === "canal" || n === "canal americano") return 2;
						return 999;
					}
					if (kind === "MX_LOMO") {
						if (
							n.includes("canal nacional lado lomo") ||
							n.includes("canal nacional lomo")
						)
							return 0;
						if (
							n.includes("nacional") &&
							n.includes("lomo") &&
							n.includes("canal")
						)
							return 1;
						if (
							n.includes("nacional") &&
							n.includes("canal") &&
							!n.includes("americano") &&
							!n.includes("espilomo")
						)
							return 2;
						if (n === "canal") return 3;
						return 999;
					}
					if (kind === "MX_ESP") {
						if (
							n.includes("canal nacional lado espilomo") ||
							n.includes("canal nacional espilomo")
						)
							return 0;
						if (
							n.includes("nacional") &&
							n.includes("espilomo") &&
							n.includes("canal")
						)
							return 1;
						if (
							n.includes("nacional") &&
							n.includes("canal") &&
							!n.includes("americano") &&
							!n.includes("lomo")
						)
							return 2;
						if (n === "canal") return 3;
						return 999;
					}
					return 999;
				};

				const pick = (kind: "US" | "MX_LOMO" | "MX_ESP") => {
					const scored = canalCandidates
						.map((p) => ({ p, score: scoreCanalSpecific(p.name, kind) }))
						.filter((x) => x.score < 999)
						.sort((a, b) => a.score - b.score || a.p.id - b.p.id);

					return scored[0]?.p ?? null;
				};

				const canalUs = pick("US");
				const canalMxLomo = pick("MX_LOMO");
				const canalMxEsp = pick("MX_ESP");

				if (mediasAmericano > 0 && !canalUs) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message:
							"No se encontró el producto CANAL. Por favor, asegúrese de que el producto 'CANAL' esté registrado como producto padre.",
					});
				}
				if (mediasNacionalLomo > 0 && !canalMxLomo) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message:
							"No se encontró el producto CANAL. Por favor, asegúrese de que el producto 'CANAL' esté registrado como producto padre.",
					});
				}
				if (mediasNacionalEspilomo > 0 && !canalMxEsp) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message:
							"No se encontró el producto CANAL. Por favor, asegúrese de que el producto 'CANAL' esté registrado como producto padre.",
					});
				}

				const kgPerMedia = input.totalWeightKg / quantityPieces;
				const allocations: Array<{
					productId: number;
					product: string;
					addedPieces: number;
					addedKg: string;
					previousStock: number;
					newStock: number;
					previousKg: number;
					newKg: string;
				}> = [];

				const apply = async (
					product: (typeof canalCandidates)[number],
					pieces: number,
				) => {
					if (pieces <= 0) return;
					const currentStock = Number(product.stock_pieces);
					const currentKg = Number(product.stock_kg);
					const addKg = pieces * kgPerMedia;
					const newStock = currentStock + pieces;
					const newKg = currentKg + addKg;

					const updateData: Partial<typeof products.$inferInsert> = {
						stock_pieces: newStock,
						stock_kg: newKg.toFixed(3),
					};

					if (input.pricePerKg && input.pricePerKg > 0) {
						updateData.price_per_kg = input.pricePerKg.toFixed(2);
					}

					await tx
						.update(products)
						.set(updateData)
						.where(eq(products.id, product.id));

					await tx.insert(inventoryTransactions).values({
						product_id: product.id,
						quantity_change_pieces: pieces,
						quantity_change_kg: addKg.toFixed(3),
						transaction_type: "COMPRA",
						notes: [
							`Compra ${input.purchaseMode === "CANAL_COMPLETO" ? "canal completo" : "media canal"}`,
							`N:${input.qtyNacional}`,
							`A:${input.qtyAmericano}`,
							`medias N lomo:${mediasNacionalLomo}`,
							`medias N espilomo:${mediasNacionalEspilomo}`,
							`medias A:${mediasAmericano}`,
							input.supplier ? `Proveedor: ${input.supplier}` : null,
							input.notes ?? null,
						]
							.filter(Boolean)
							.join(" | "),
					});

					allocations.push({
						productId: product.id,
						product: product.name,
						addedPieces: pieces,
						addedKg: addKg.toFixed(3),
						previousStock: currentStock,
						newStock,
						previousKg: currentKg,
						newKg: newKg.toFixed(3),
					});
				};

				if (canalUs) await apply(canalUs, mediasAmericano);
				if (canalMxLomo) await apply(canalMxLomo, mediasNacionalLomo);
				if (canalMxEsp) await apply(canalMxEsp, mediasNacionalEspilomo);

				// Registro de la compra (alimenta el módulo de Rendimiento)
				await tx.insert(channelPurchases).values({
					supplier: input.supplier,
					qty_americano: input.qtyAmericano,
					qty_nacional: input.qtyNacional,
					num_medias: quantityPieces,
					total_kg: input.totalWeightKg.toFixed(3),
					price_per_kg:
						input.pricePerKg != null ? input.pricePerKg.toFixed(2) : null,
					user_uid: uid,
				});

				return {
					success: true,
					purchaseMode: input.purchaseMode,
					qtyAmericano: input.qtyAmericano,
					qtyNacional: input.qtyNacional,
					qtyNacionalLomo: input.qtyNacionalLomo,
					qtyNacionalEspilomo: input.qtyNacionalEspilomo,
					mediasNacionalLomo,
					mediasNacionalEspilomo,
					mediasAmericano,
					totalPieces: quantityPieces,
					totalKg: input.totalWeightKg.toFixed(3),
					allocations,
				};
			});
		}),

	disassemblyDashboard: almacenProcedure
		.input(z.void())
		.output(
			z.array(
				z.object({
					id: z.number(),
					name: z.string(),
					stock_pieces: z.number(),
					stock_kg: z.union([z.number(), z.string()]),
					is_parent_product: z.boolean(),
					transformationTypes: z.array(z.string()),
				}),
			),
		)
		.query(async ({ ctx }) => {
			const uid = ctx.user.id;

			const stocked = await db
				.select({
					id: products.id,
					name: products.name,
					stock_pieces: products.stock_pieces,
					stock_kg: products.stock_kg,
					is_parent_product: products.is_parent_product,
				})
				.from(products)
				.where(
					and(eq(products.user_uid, uid), sql`${products.stock_pieces} > 0`),
				);

			if (!stocked.length) {
				return [];
			}

			const parentIds = stocked.map((p) => p.id);
			const pairs = await db
				.selectDistinct({
					parent_id: productTransformations.parent_product_id,
					type: productTransformations.transformation_type,
				})
				.from(productTransformations)
				.where(
					and(
						inArray(productTransformations.parent_product_id, parentIds),
						eq(productTransformations.is_active, true),
					),
				);

			const byParent = new Map<number, string[]>();
			for (const p of pairs) {
				if (p.type === null) continue;
				const arr = byParent.get(p.parent_id) ?? [];
				arr.push(p.type);
				byParent.set(p.parent_id, arr);
			}

			for (const [k, v] of byParent) {
				const unique = Array.from(new Set(v));
				unique.sort((a, b) => a.localeCompare(b));
				byParent.set(k, unique);
			}

			return stocked
				.map((p) => ({
					...p,
					transformationTypes: byParent.get(p.id) ?? [],
				}))
				.sort((a, b) => a.name.localeCompare(b.name));
		}),

	disassemblyDashboardRecipes: almacenProcedure
		.input(z.void())
		.output(
			z.array(
				z.object({
					parentId: z.number(),
					transformationType: z.string(),
					children: z.array(
						z.object({
							childId: z.number(),
							childName: z.string(),
							childStockPieces: z.number(),
							yieldQuantityPieces: z.union([z.string(), z.number()]),
							yieldWeightRatio: z.union([z.string(), z.number()]).nullable(),
						}),
					),
				}),
			),
		)
		.query(async ({ ctx }) => {
			const uid = ctx.user.id;

			const stocked = await db
				.select({
					id: products.id,
				})
				.from(products)
				.where(sql`${products.stock_pieces} > 0`);

			if (!stocked.length) return [];

			const seedParentIds = stocked.map((p) => p.id);

			const childParents = await db
				.selectDistinct({
					id: productTransformations.child_product_id,
				})
				.from(productTransformations)
				.where(
					and(
						inArray(productTransformations.parent_product_id, seedParentIds),
						eq(productTransformations.is_active, true),
					),
				);

			const parentIds = Array.from(
				new Set([...seedParentIds, ...childParents.map((x) => x.id)]),
			);
			const child = alias(products, "child_products_for_dashboard");

			const rows = await db
				.select({
					id: productTransformations.id,
					parentId: productTransformations.parent_product_id,
					transformationType: productTransformations.transformation_type,
					childId: productTransformations.child_product_id,
					yieldQuantityPieces: productTransformations.yield_quantity_pieces,
					yieldWeightRatio: productTransformations.yield_weight_ratio,
					childName: child.name,
					childStockPieces: child.stock_pieces,
				})
				.from(productTransformations)
				.innerJoin(child, eq(child.id, productTransformations.child_product_id))
				.where(
					and(
						inArray(productTransformations.parent_product_id, parentIds),
						eq(productTransformations.is_active, true),
					),
				);

			const byPair = new Map<
				string,
				{
					parentId: number;
					transformationType: string;
					childrenById: Map<
						number,
						{
							id: number;
							childId: number;
							childName: string;
							childStockPieces: number;
							yieldQuantityPieces: string | number;
							yieldWeightRatio: string | number | null;
						}
					>;
				}
			>();

			for (const r of rows) {
				const key = `${r.parentId}|${r.transformationType}`;
				const transformationType = r.transformationType ?? "BASE";
				const bucket =
					byPair.get(key) ??
					({
						parentId: r.parentId,
						transformationType,
						childrenById: new Map(),
					} as const);

				if (!byPair.has(key)) byPair.set(key, { ...bucket });

				const current = byPair.get(key);
				if (!current) continue;
				const prev = current.childrenById.get(r.childId);
				if (!prev || r.id > prev.id) {
					current.childrenById.set(r.childId, {
						id: r.id,
						childId: r.childId,
						childName: r.childName,
						childStockPieces: r.childStockPieces,
						yieldQuantityPieces: r.yieldQuantityPieces,
						yieldWeightRatio: r.yieldWeightRatio,
					});
				}
			}

			return Array.from(byPair.values())
				.map((b) => ({
					parentId: b.parentId,
					transformationType: b.transformationType,
					children: Array.from(b.childrenById.values())
						.sort((a, c) => a.childName.localeCompare(c.childName))
						.map((c) => ({
							childId: c.childId,
							childName: c.childName,
							childStockPieces: c.childStockPieces,
							yieldQuantityPieces: c.yieldQuantityPieces,
							yieldWeightRatio: c.yieldWeightRatio,
						})),
				}))
				.sort((a, b) => {
					if (a.parentId !== b.parentId) return a.parentId - b.parentId;
					return a.transformationType.localeCompare(b.transformationType);
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

	// Admin: crear canales base (POLINESIO, genéricos) si no existen
	initializeChannels: adminProcedure
		.input(z.void())
		.output(z.object({ created: z.array(z.string()) }))
		.mutation(async ({ ctx }) => {
			const uid = ctx.user.id;
			const created: string[] = [];

			const channels = [
				{
					name: "CANAL POLINESIO",
					weight: 105,
					category: "Canales",
					sortOrder: 40,
				},
				{
					name: "CANAL GENÉRICO",
					weight: 100,
					category: "Canales",
					sortOrder: 50,
				},
			];

			for (const ch of channels) {
				const exists = await db
					.select({ id: products.id })
					.from(products)
					.where(and(eq(products.user_uid, uid), eq(products.name, ch.name)))
					.limit(1);

				if (!exists.length) {
					await db.insert(products).values({
						user_uid: uid,
						name: ch.name,
						category: ch.category,
						is_parent_product: true,
						is_sellable_by_unit: false,
						is_sellable_by_weight: true,
						default_sale_unit: "KG",
						avg_weight_per_piece_kg: String(ch.weight),
						stock_pieces: 0,
						weighed_pieces: 0,
						stock_kg: "0",
						active: true,
						sort_order: ch.sortOrder,
					});
					created.push(ch.name);
				}
			}

			return { created };
		}),
});
