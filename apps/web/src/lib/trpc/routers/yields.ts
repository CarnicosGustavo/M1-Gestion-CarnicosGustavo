import { z } from "zod/v4";
import { protectedProcedure, router } from "../init";
import { db } from "@/lib/db";
import {
	yieldSheets,
	yieldSheetItems,
	channelPurchases,
	products,
	productTransformations,
	inventoryTransactions,
} from "@/lib/db/schema";
import { eq, desc, and, ilike } from "drizzle-orm";

const itemInput = z.object({
	productId: z.number().nullable().optional(),
	productName: z.string().min(1),
	pieces: z.number().int().min(0).default(0),
	kgTotal: z.number().min(0).default(0),
	weighed: z.boolean().default(false),
	sortOrder: z.number().int().default(0),
});

const sheetInput = z.object({
	sheetDate: z.string().optional(),
	numCanales: z.number().int().min(0).default(0),
	kgComprado: z.number().min(0).default(0),
	supplier: z.string().optional(),
	notes: z.string().optional(),
	items: z.array(itemInput),
});

export const yieldsRouter = router({
	// Lista de hojas recientes con totales
	list: protectedProcedure
		.input(z.void())
		.query(async ({ ctx }) => {
			const sheets = await db
				.select()
				.from(yieldSheets)
				.where(eq(yieldSheets.user_uid, ctx.user.id))
				.orderBy(desc(yieldSheets.id))
				.limit(50);

			const result = [];
			for (const s of sheets) {
				const items = await db
					.select()
					.from(yieldSheetItems)
					.where(eq(yieldSheetItems.sheet_id, s.id));
				const totalKg = items.reduce((a, i) => a + Number(i.kg_total), 0);
				const totalPiezas = items.reduce((a, i) => a + (i.pieces ?? 0), 0);
				result.push({
					id: s.id,
					sheetDate: s.sheet_date,
					numCanales: s.num_canales,
					kgComprado: Number(s.kg_comprado),
					supplier: (s as any).supplier as string | null,
					totalKg,
					totalPiezas,
					rendimiento:
						Number(s.kg_comprado) > 0
							? (totalKg / Number(s.kg_comprado)) * 100
							: 0,
				});
			}
			return result;
		}),

	// Última compra de canales registrada (para auto-rellenar la hoja)
	latestPurchase: protectedProcedure.input(z.void()).query(async ({ ctx }) => {
		const [p] = await db
			.select()
			.from(channelPurchases)
			.where(eq(channelPurchases.user_uid, ctx.user.id))
			.orderBy(desc(channelPurchases.id))
			.limit(1);
		if (!p) return null;
		return {
			numMedias: p.num_medias,
			kgComprado: Number(p.total_kg),
			supplier: (p.supplier as string | null) ?? null,
			date: p.purchase_date,
		};
	}),

	// Historial de pesajes de producción por pieza (desde inventory_transactions
	// tipo PRODUCCION). Cada pesaje es una columna; se acumula un total. Sirve
	// para pesar lotes grandes en varios momentos (ej. 120 jamones por partes).
	productionHistory: protectedProcedure.input(z.void()).query(async () => {
		const rows = await db
			.select({
				productId: inventoryTransactions.product_id,
				productName: products.name,
				kg: inventoryTransactions.quantity_change_kg,
				pieces: inventoryTransactions.quantity_change_pieces,
				date: inventoryTransactions.created_at,
			})
			.from(inventoryTransactions)
			.innerJoin(products, eq(products.id, inventoryTransactions.product_id))
			.where(eq(inventoryTransactions.transaction_type, "PRODUCCION"))
			.orderBy(inventoryTransactions.created_at);

		const map = new Map<
			number,
			{
				productId: number;
				productName: string;
				weighings: { kg: number; pieces: number; date: Date | null }[];
				totalKg: number;
				totalPieces: number;
			}
		>();
		for (const r of rows) {
			if (r.productId == null) continue;
			const kg = Number(r.kg) || 0;
			const pcs = Number(r.pieces) || 0;
			const cur = map.get(r.productId) ?? {
				productId: r.productId,
				productName: r.productName,
				weighings: [],
				totalKg: 0,
				totalPieces: 0,
			};
			cur.weighings.push({ kg, pieces: pcs, date: r.date });
			cur.totalKg += kg;
			cur.totalPieces += pcs;
			map.set(r.productId, cur);
		}
		return [...map.values()].sort((a, b) =>
			a.productName.localeCompare(b.productName),
		);
	}),

	// Lista de canales (raíz del despiece) para elegir qué proyectar
	canales: protectedProcedure.input(z.void()).query(async () => {
		const rows = await db
			.select({
				id: products.id,
				name: products.name,
				avgWeight: products.avg_weight_per_piece_kg,
			})
			.from(products)
			.where(
				and(
					eq(products.is_parent_product, true),
					ilike(products.name, "CANAL%"),
				),
			)
			.orderBy(products.name);
		return rows.map((r) => ({
			id: r.id,
			name: r.name,
			avgWeight: Number(r.avgWeight ?? 60),
		}));
	}),

	// Proyecta las piezas resultado del despiece de N canales.
	// Cascada recursiva por yield_weight_ratio: 1er nivel (canal → padres)
	// y 2º nivel (BASE: padre → piezas finales). Devuelve árbol + hojas.
	projectFromCanales: protectedProcedure
		.input(
			z.object({
				canales: z
					.array(
						z.object({
							canalProductId: z.number(),
							numCanales: z.number().min(0),
						}),
					)
					.min(1),
			}),
		)
		.query(async ({ input }) => {
			// Todas las transformaciones activas + catálogo de productos
			const txns = await db
				.select({
					parentId: productTransformations.parent_product_id,
					childId: productTransformations.child_product_id,
					pieces: productTransformations.yield_quantity_pieces,
					ratio: productTransformations.yield_weight_ratio,
				})
				.from(productTransformations)
				.where(eq(productTransformations.is_active, true));

			const prods = await db
				.select({
					id: products.id,
					name: products.name,
					avg: products.avg_weight_per_piece_kg,
				})
				.from(products);
			const prodMap = new Map(prods.map((p) => [p.id, p]));

			const byParent = new Map<number, typeof txns>();
			for (const t of txns) {
				const arr = byParent.get(t.parentId) ?? [];
				arr.push(t);
				byParent.set(t.parentId, arr);
			}

			type Node = {
				productId: number;
				productName: string;
				pieces: number;
				kgEstimado: number;
				level: number;
				isLeaf: boolean;
			};
			const acc = new Map<number, Node>();

			const add = (
				id: number,
				name: string,
				pieces: number,
				kg: number,
				level: number,
				isLeaf: boolean,
			) => {
				const cur = acc.get(id);
				if (cur) {
					cur.pieces += pieces;
					cur.kgEstimado += kg;
					cur.isLeaf = cur.isLeaf && isLeaf;
					cur.level = Math.min(cur.level, level);
				} else {
					acc.set(id, {
						productId: id,
						productName: name,
						pieces,
						kgEstimado: kg,
						level,
						isLeaf,
					});
				}
			};

			const recurse = (
				parentId: number,
				parentKg: number,
				parentPieces: number,
				level: number,
				path: Set<number>,
			) => {
				const children = byParent.get(parentId);
				if (!children || children.length === 0) return;
				for (const c of children) {
					if (path.has(c.childId)) continue; // evita ciclos
					const childPieces = parentPieces * Number(c.pieces);
					const childKg = parentKg * Number(c.ratio);
					const grand = byParent.get(c.childId);
					const isLeaf = !grand || grand.length === 0;
					const name = prodMap.get(c.childId)?.name ?? `#${c.childId}`;
					add(c.childId, name, childPieces, childKg, level, isLeaf);
					if (!isLeaf) {
						recurse(
							c.childId,
							childKg,
							childPieces,
							level + 1,
							new Set([...path, c.childId]),
						);
					}
				}
			};

			for (const canal of input.canales) {
				if (canal.numCanales <= 0) continue;
				const canalProd = prodMap.get(canal.canalProductId);
				const canalWeight = Number(canalProd?.avg ?? 60);
				const totalKg = canal.numCanales * canalWeight;
				recurse(
					canal.canalProductId,
					totalKg,
					canal.numCanales,
					1,
					new Set([canal.canalProductId]),
				);
			}

			const round3 = (n: number) => Number(n.toFixed(3));
			const nodes = [...acc.values()]
				.sort(
					(a, b) =>
						a.level - b.level || a.productName.localeCompare(b.productName),
				)
				.map((n) => ({
					...n,
					pieces: Math.round(n.pieces),
					kgEstimado: round3(n.kgEstimado),
				}));
			// Hojas = piezas finales (lo que realmente se pesa/vende)
			const leaves = nodes
				.filter((n) => n.isLeaf)
				.map((n) => ({
					productId: n.productId,
					productName: n.productName,
					pieces: n.pieces,
					kgEstimado: n.kgEstimado,
				}));
			const totalKgEstimado = round3(
				leaves.reduce((a, n) => a + n.kgEstimado, 0),
			);
			return { nodes, leaves, totalKgEstimado };
		}),

	// Comparativa de rendimiento por proveedor (de todas las hojas)
	byProvider: protectedProcedure.input(z.void()).query(async ({ ctx }) => {
		const sheets = await db
			.select()
			.from(yieldSheets)
			.where(eq(yieldSheets.user_uid, ctx.user.id));

		const agg = new Map<string, { kgComprado: number; kgReal: number; canales: number; hojas: number }>();
		for (const s of sheets) {
			const prov = ((s as any).supplier as string | null)?.trim() || "Sin proveedor";
			const items = await db
				.select({ kg: yieldSheetItems.kg_total })
				.from(yieldSheetItems)
				.where(eq(yieldSheetItems.sheet_id, s.id));
			const kgReal = items.reduce((a, i) => a + Number(i.kg), 0);
			const cur = agg.get(prov) ?? { kgComprado: 0, kgReal: 0, canales: 0, hojas: 0 };
			cur.kgComprado += Number(s.kg_comprado);
			cur.kgReal += kgReal;
			cur.canales += s.num_canales;
			cur.hojas += 1;
			agg.set(prov, cur);
		}

		return [...agg.entries()].map(([supplier, v]) => ({
			supplier,
			...v,
			rendimiento: v.kgComprado > 0 ? (v.kgReal / v.kgComprado) * 100 : 0,
		}));
	}),

	// Detalle de una hoja con sus renglones
	get: protectedProcedure
		.input(z.object({ id: z.number() }))
		.query(async ({ input }) => {
			const [sheet] = await db
				.select()
				.from(yieldSheets)
				.where(eq(yieldSheets.id, input.id))
				.limit(1);
			if (!sheet) return null;
			const items = await db
				.select()
				.from(yieldSheetItems)
				.where(eq(yieldSheetItems.sheet_id, input.id))
				.orderBy(yieldSheetItems.sort_order);
			return { sheet, items };
		}),

	// Crear hoja nueva con sus renglones
	create: protectedProcedure
		.input(sheetInput)
		.mutation(async ({ ctx, input }) => {
			return db.transaction(async (tx) => {
				const [sheet] = await tx
					.insert(yieldSheets)
					.values({
						sheet_date: input.sheetDate ?? undefined,
						num_canales: input.numCanales,
						kg_comprado: input.kgComprado.toFixed(3),
						supplier: input.supplier,
						notes: input.notes,
						user_uid: ctx.user.id,
					})
					.returning();

				if (input.items.length > 0) {
					await tx.insert(yieldSheetItems).values(
						input.items.map((it, idx) => ({
							sheet_id: sheet.id,
							product_id: it.productId ?? null,
							product_name: it.productName,
							pieces: it.pieces,
							kg_total: it.kgTotal.toFixed(3),
							weighed: it.weighed,
							sort_order: it.sortOrder ?? idx,
						})),
					);
				}
				return { id: sheet.id };
			});
		}),

	// Actualizar hoja: reemplaza cabecera + renglones
	update: protectedProcedure
		.input(sheetInput.extend({ id: z.number() }))
		.mutation(async ({ input }) => {
			return db.transaction(async (tx) => {
				await tx
					.update(yieldSheets)
					.set({
						sheet_date: input.sheetDate ?? undefined,
						num_canales: input.numCanales,
						kg_comprado: input.kgComprado.toFixed(3),
						supplier: input.supplier,
						notes: input.notes,
						updated_at: new Date(),
					})
					.where(eq(yieldSheets.id, input.id));

				await tx
					.delete(yieldSheetItems)
					.where(eq(yieldSheetItems.sheet_id, input.id));

				if (input.items.length > 0) {
					await tx.insert(yieldSheetItems).values(
						input.items.map((it, idx) => ({
							sheet_id: input.id,
							product_id: it.productId ?? null,
							product_name: it.productName,
							pieces: it.pieces,
							kg_total: it.kgTotal.toFixed(3),
							weighed: it.weighed,
							sort_order: it.sortOrder ?? idx,
						})),
					);
				}
				return { id: input.id };
			});
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.number() }))
		.mutation(async ({ input }) => {
			await db.delete(yieldSheets).where(eq(yieldSheets.id, input.id));
			return { success: true };
		}),
});
