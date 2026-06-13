import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import {
	channelPurchases,
	inventoryTransactions,
	products,
	productTransformations,
	yieldSheetItems,
	yieldSheets,
} from "@/lib/db/schema";
import { protectedProcedure, router } from "../init";

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

// Mapea cuántos canales de cada tipo deja una compra: 1 cerdo americano = 1
// CANAL AMERICANO (canal completo); 1 cerdo nacional = 1 lado Lomo + 1 lado
// Espilomo. Devuelve cuántos "comprados" corresponden al nombre del canal.
function purchasedForCanal(name: string, amer: number, nac: number): number {
	const n = name.toUpperCase();
	if (n.includes("AMERICANO")) return amer;
	if (n.includes("NACIONAL")) return nac; // Lomo y Espilomo, 1 c/u por cerdo
	return 0; // POLINESIO / canal genérico: aún no se compra por tipo
}

// Tipo de la transacción de Drizzle (el parámetro del callback de db.transaction)
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Recalcula el stock de los canales: comprado (todas las fechas) − despiezado.
// Idempotente: hace SET, no incrementa, así re-guardar una compra no duplica.
async function syncCanalStock(tx: Tx, uid: string): Promise<void> {
	const totRows = (await tx.execute(sql`
		SELECT COALESCE(SUM(qty_americano),0)::int AS amer,
		       COALESCE(SUM(qty_nacional),0)::int AS nac
		FROM channel_purchases WHERE user_uid = ${uid}
	`)) as unknown as { amer: number; nac: number }[];
	const amer = Number(totRows?.[0]?.amer ?? 0);
	const nac = Number(totRows?.[0]?.nac ?? 0);

	const canalProds = await tx
		.select({
			id: products.id,
			name: products.name,
			avg: products.avg_weight_per_piece_kg,
		})
		.from(products)
		.where(
			and(
				eq(products.user_uid, uid),
				eq(products.is_parent_product, true),
				ilike(products.name, "CANAL%"),
			),
		);
	if (canalProds.length === 0) return;

	const usedRows = (await tx.execute(sql`
		SELECT product_id AS pid, COALESCE(SUM(-quantity_change_pieces),0)::int AS used
		FROM inventory_transactions
		WHERE transaction_type = 'DESPIECE'
		GROUP BY product_id
	`)) as unknown as { pid: number; used: number }[];
	const usedMap = new Map(
		usedRows.map((r) => [Number(r.pid), Number(r.used) || 0]),
	);

	for (const c of canalProds) {
		const purchased = purchasedForCanal(c.name, amer, nac);
		const used = usedMap.get(c.id) ?? 0;
		const stock = purchased - used;
		const avg = Number(c.avg ?? 0);
		await tx
			.update(products)
			.set({ stock_pieces: stock, stock_kg: (stock * avg).toFixed(3) })
			.where(eq(products.id, c.id));
	}
}

export const yieldsRouter = router({
	// Lista de hojas recientes con totales
	list: protectedProcedure.input(z.void()).query(async ({ ctx }) => {
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

	// Fechas con compra registrada (para el selector de día)
	purchaseDates: protectedProcedure.input(z.void()).query(async ({ ctx }) => {
		const rows = await db
			.selectDistinct({ date: channelPurchases.purchase_date })
			.from(channelPurchases)
			.where(eq(channelPurchases.user_uid, ctx.user.id))
			.orderBy(desc(channelPurchases.purchase_date));
		return rows.map((r) => r.date).filter(Boolean) as string[];
	}),

	// Compra en pie de un día (renglones por proveedor)
	purchasesByDate: protectedProcedure
		.input(z.object({ date: z.string() }))
		.query(async ({ ctx, input }) => {
			const rows = await db
				.select()
				.from(channelPurchases)
				.where(
					and(
						eq(channelPurchases.user_uid, ctx.user.id),
						eq(channelPurchases.purchase_date, input.date),
					),
				)
				.orderBy(channelPurchases.id);
			return rows.map((r) => ({
				id: r.id,
				supplier: r.supplier ?? "",
				canales: r.num_medias,
				kg: Number(r.total_kg),
				precio: r.price_per_kg != null ? Number(r.price_per_kg) : 0,
				americano: r.qty_americano,
				nacional: r.qty_nacional,
				verifCanales:
					(r as any).verified_canales != null
						? Number((r as any).verified_canales)
						: 0,
				verifKg:
					(r as any).verified_kg != null ? Number((r as any).verified_kg) : 0,
			}));
		}),

	// Verificación CEDIS de un día: por proveedor, peso canal×canal o total.
	cedisDay: protectedProcedure
		.input(z.object({ date: z.string() }))
		.query(async ({ ctx, input }) => {
			const rows = await db
				.select()
				.from(channelPurchases)
				.where(
					and(
						eq(channelPurchases.user_uid, ctx.user.id),
						eq(channelPurchases.purchase_date, input.date),
					),
				)
				.orderBy(channelPurchases.id);
			return rows
				.filter((r) => (r.supplier ?? "").trim().length > 0)
				.map((r) => {
					const enPieKg = Number(r.total_kg) || 0;
					const precio = r.price_per_kg != null ? Number(r.price_per_kg) : 0;
					const detail = (r.cedis_detail as {
						mode?: "canal" | "total";
						tara?: number;
						weights?: number[];
						totalKg?: number;
						totalCanales?: number;
					} | null) ?? null;
					return {
						id: r.id,
						supplier: r.supplier ?? "",
						unidades: (r.qty_americano ?? 0) + (r.qty_nacional ?? 0),
						enPieKg,
						costo: enPieKg * precio,
						detail: {
							mode: detail?.mode ?? "canal",
							tara: detail?.tara ?? 0,
							weights: Array.isArray(detail?.weights) ? detail.weights : [],
							totalKg: detail?.totalKg ?? 0,
							totalCanales: detail?.totalCanales ?? 0,
						},
					};
				});
		}),

	// Agrega un proveedor al día directamente desde CEDIS (sin pasar por la
	// Compra del día). Crea un renglón de channel_purchases con solo el nombre;
	// el peso en pie (para la merma) se completa luego en la Compra del día.
	addCedisSupplier: protectedProcedure
		.input(z.object({ date: z.string(), supplier: z.string().min(1) }))
		.output(z.object({ id: z.number() }))
		.mutation(async ({ ctx, input }) => {
			const [row] = await db
				.insert(channelPurchases)
				.values({
					supplier: input.supplier.trim(),
					purchase_date: input.date,
					user_uid: ctx.user.id,
				})
				.returning({ id: channelPurchases.id });
			return { id: row.id };
		}),

	// Guarda la verificación CEDIS: calcula verified_canales/_kg y persiste detalle.
	saveCedis: protectedProcedure
		.input(
			z.object({
				rows: z.array(
					z.object({
						id: z.number(),
						mode: z.enum(["canal", "total"]).default("canal"),
						tara: z.number().min(0).default(0),
						weights: z.array(z.number()).default([]),
						totalKg: z.number().min(0).default(0),
						totalCanales: z.number().int().min(0).default(0),
					}),
				),
			}),
		)
		.output(z.object({ success: z.boolean(), count: z.number() }))
		.mutation(async ({ ctx, input }) => {
			let count = 0;
			for (const r of input.rows) {
				const verifCanales =
					r.mode === "total" ? r.totalCanales : r.weights.length;
				const verifKg =
					r.mode === "total"
						? r.totalKg
						: r.weights.reduce((a, b) => a + (Number(b) || 0), 0);
				await db
					.update(channelPurchases)
					.set({
						verified_canales: verifCanales > 0 ? verifCanales : null,
						verified_kg: verifKg > 0 ? verifKg.toFixed(3) : null,
						cedis_detail: {
							mode: r.mode,
							tara: r.tara,
							weights: r.weights,
							totalKg: r.totalKg,
							totalCanales: r.totalCanales,
						},
					})
					.where(
						and(
							eq(channelPurchases.id, r.id),
							eq(channelPurchases.user_uid, ctx.user.id),
						),
					);
				count++;
			}
			return { success: true, count };
		}),

	// Guarda la compra en pie de un día: reemplaza los renglones de esa fecha
	savePurchases: protectedProcedure
		.input(
			z.object({
				date: z.string(),
				rows: z.array(
					z.object({
						supplier: z.string().default(""),
						canales: z.number().int().min(0).default(0),
						kg: z.number().min(0).default(0),
						precio: z.number().min(0).default(0),
						americano: z.number().int().min(0).default(0),
						nacional: z.number().int().min(0).default(0),
						verifCanales: z.number().int().min(0).default(0),
						verifKg: z.number().min(0).default(0),
					}),
				),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return db.transaction(async (tx) => {
				await tx
					.delete(channelPurchases)
					.where(
						and(
							eq(channelPurchases.user_uid, ctx.user.id),
							eq(channelPurchases.purchase_date, input.date),
						),
					);
				const valid = input.rows.filter(
					(r) => r.supplier.trim() || r.canales > 0 || r.kg > 0,
				);
				if (valid.length > 0) {
					await tx.insert(channelPurchases).values(
						valid.map((r) => ({
							supplier: r.supplier.trim() || null,
							num_medias: r.canales,
							total_kg: r.kg.toFixed(3),
							price_per_kg: r.precio > 0 ? r.precio.toFixed(2) : null,
							qty_americano: r.americano,
							qty_nacional: r.nacional,
							verified_canales: r.verifCanales > 0 ? r.verifCanales : null,
							verified_kg: r.verifKg > 0 ? r.verifKg.toFixed(3) : null,
							purchase_date: input.date,
							user_uid: ctx.user.id,
						})),
					);
				}

				// La compra alimenta el inventario de canales (idempotente):
				// stock = total comprado − total despiezado. Así el módulo de
				// Despiece ve "canales disponibles" sin doble conteo al re-guardar.
				await syncCanalStock(tx, ctx.user.id);

				return { success: true, count: valid.length };
			});
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

	// Cierre del día: por producto, Entró (producido) − Salió (vendido) = Quedó.
	//  - Entró: producción del día (DESPIECE/PRODUCCION/PESAJE, piezas/kg positivos)
	//  - Salió: ventas del día (VENTA, en valor absoluto)
	cierre: protectedProcedure
		.input(z.object({ date: z.string() }))
		.output(
			z.object({
				rows: z.array(
					z.object({
						productId: z.number(),
						name: z.string(),
						category: z.string().nullable(),
						entroPz: z.number(),
						entroKg: z.number(),
						salioPz: z.number(),
						salioKg: z.number(),
					}),
				),
			}),
		)
		.query(async ({ ctx, input }) => {
			const res = (await db.execute(sql`
				SELECT p.id AS pid, p.name, p.category,
					COALESCE(SUM(CASE WHEN it.transaction_type IN ('DESPIECE','PRODUCCION','PESAJE') AND it.quantity_change_pieces > 0 THEN it.quantity_change_pieces ELSE 0 END),0)::int AS entro_pz,
					COALESCE(SUM(CASE WHEN it.transaction_type IN ('DESPIECE','PRODUCCION','PESAJE') AND COALESCE(it.quantity_change_kg,0) > 0 THEN it.quantity_change_kg ELSE 0 END),0) AS entro_kg,
					COALESCE(SUM(CASE WHEN it.transaction_type = 'VENTA' THEN -it.quantity_change_pieces ELSE 0 END),0)::int AS salio_pz,
					COALESCE(SUM(CASE WHEN it.transaction_type = 'VENTA' THEN -COALESCE(it.quantity_change_kg,0) ELSE 0 END),0) AS salio_kg
				FROM inventory_transactions it
				JOIN products p ON p.id = it.product_id
				WHERE p.user_uid = ${ctx.user.id}
				  AND it.created_at::date = ${input.date}
				GROUP BY p.id, p.name, p.category
				ORDER BY p.name
			`)) as unknown as {
				pid: number;
				name: string;
				category: string | null;
				entro_pz: number;
				entro_kg: string | number;
				salio_pz: number;
				salio_kg: string | number;
			}[];

			const rows = res
				.map((r) => ({
					productId: Number(r.pid),
					name: r.name,
					category: r.category,
					entroPz: Number(r.entro_pz) || 0,
					entroKg: Number(r.entro_kg) || 0,
					salioPz: Number(r.salio_pz) || 0,
					salioKg: Number(r.salio_kg) || 0,
				}))
				.filter(
					(r) =>
						r.entroPz > 0 || r.entroKg > 0 || r.salioPz > 0 || r.salioKg > 0,
				);
			return { rows };
		}),

	// Calibra las recetas con los pesos reales pesados en un día: recalcula el
	// yield_weight_ratio de cada transformación cuya pieza fue pesada ese día.
	//  - Para piezas del canal (1er nivel): % = kg de la pieza / kg del canal.
	//  - Para sub-piezas (2º nivel): % = kg de la pieza / kg de su pieza padre
	//    (solo si el padre también se pesó). Lo no pesado se conserva.
	calibrateFromDay: protectedProcedure
		.input(z.object({ date: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Peso de canal del día (verificado si existe, si no el comprado)
			const buys = await db
				.select({
					total: channelPurchases.total_kg,
					verif: channelPurchases.verified_kg,
				})
				.from(channelPurchases)
				.where(
					and(
						eq(channelPurchases.user_uid, ctx.user.id),
						eq(channelPurchases.purchase_date, input.date),
					),
				);
			const totalCanalKg = buys.reduce(
				(a, b) =>
					a + (b.verif != null ? Number(b.verif) : Number(b.total) || 0),
				0,
			);
			if (totalCanalKg <= 0) {
				throw new Error(
					"Captura primero la compra/peso de canales del día (Compra del día).",
				);
			}

			// Kg real pesado por producto ese día (renglones PESADO)
			const realRows = (await db.execute(sql`
				SELECT oi.product_id AS pid, COALESCE(SUM(oi.quantity_kg),0) AS kg
				FROM order_items oi
				JOIN orders o ON o.id = oi.order_id
				WHERE oi.status = 'PESADO'
				  AND oi.product_id IS NOT NULL
				  AND o.created_at::date = ${input.date}
				GROUP BY oi.product_id
			`)) as unknown as { pid: number; kg: string | number }[];
			const realW = new Map<number, number>();
			for (const r of realRows as any[]) {
				realW.set(Number(r.pid), Number(r.kg) || 0);
			}

			const txns = await db
				.select({
					id: productTransformations.id,
					parentId: productTransformations.parent_product_id,
					childId: productTransformations.child_product_id,
				})
				.from(productTransformations)
				.where(eq(productTransformations.is_active, true));

			const childIds = new Set(txns.map((t) => t.childId));
			const isRoot = (id: number) => !childIds.has(id); // canal: no es hijo de nadie

			let updated = 0;
			for (const t of txns) {
				const childKg = realW.get(t.childId);
				if (!childKg || childKg <= 0) continue;
				let newRatio: number;
				if (isRoot(t.parentId)) {
					newRatio = childKg / totalCanalKg;
				} else {
					const parentKg = realW.get(t.parentId);
					if (!parentKg || parentKg <= 0) continue;
					newRatio = childKg / parentKg;
				}
				await db
					.update(productTransformations)
					.set({
						yield_weight_ratio: newRatio.toFixed(4),
						updated_at: new Date(),
					})
					.where(eq(productTransformations.id, t.id));
				updated += 1;
			}
			return { updated, totalCanalKg, piezasPesadas: realW.size };
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

	// Panel de Despiece: canales disponibles (inventario) + recetas nivel-1 de
	// cada canal + demanda viva por pieza (pedidos abiertos). Todo lo que la UI
	// necesita para "de N canales salen X piernas; me pidieron M; despieza K".
	despiecePanel: protectedProcedure.input(z.void()).query(async () => {
		// 1) Canales (raíz) con su stock disponible
		const canalRows = await db
			.select({
				id: products.id,
				name: products.name,
				stock: products.stock_pieces,
				avg: products.avg_weight_per_piece_kg,
			})
			.from(products)
			.where(
				and(
					eq(products.is_parent_product, true),
					ilike(products.name, "CANAL%"),
				),
			)
			.orderBy(products.name);
		const canalIds = canalRows.map((c) => c.id);

		// 2) Catálogo (nombres, peso promedio y stock de las piezas hijas)
		const prods = await db
			.select({
				id: products.id,
				name: products.name,
				avg: products.avg_weight_per_piece_kg,
				stockPieces: products.stock_pieces,
				stockKg: products.stock_kg,
			})
			.from(products);
		const prodMap = new Map(prods.map((p) => [p.id, p]));

		// 3) Todas las recetas activas de una vez: nivel-1 (padre = canal) y
		// sub-despieces (nivel 2+: la pieza se despieza a su vez)
		const allRecRows = await db
			.select({
				parentId: productTransformations.parent_product_id,
				childId: productTransformations.child_product_id,
				pieces: productTransformations.yield_quantity_pieces,
				ratio: productTransformations.yield_weight_ratio,
				type: productTransformations.transformation_type,
				isVariant: productTransformations.is_variant,
			})
			.from(productTransformations)
			.where(eq(productTransformations.is_active, true));

		const canalIdSet = new Set(canalIds);
		const mapRec = (r: (typeof allRecRows)[number]) => ({
			parentId: r.parentId,
			childId: r.childId,
			childName: prodMap.get(r.childId)?.name ?? `#${r.childId}`,
			pieces: Number(r.pieces) || 0,
			ratio: Number(r.ratio) || 0,
			type: r.type ?? "",
			isVariant: r.isVariant === true,
			childAvgWeight: Number(prodMap.get(r.childId)?.avg ?? 0),
			childStockPieces: prodMap.get(r.childId)?.stockPieces ?? 0,
			childStockKg: Number(prodMap.get(r.childId)?.stockKg ?? 0),
		});
		const recipes = allRecRows
			.filter((r) => canalIdSet.has(r.parentId))
			.map(mapRec);
		// Sub-despieces de cualquier pieza no-canal (la UI los busca por parentId)
		const subRecipes = allRecRows
			.filter((r) => !canalIdSet.has(r.parentId))
			.map(mapRec);

		// Tipo (estilo) de cada canal = el transformation_type de sus recetas
		const typeByCanal = new Map<number, string>();
		for (const r of recipes) {
			if (r.type && !typeByCanal.has(r.parentId))
				typeByCanal.set(r.parentId, r.type);
		}

		// 4) Demanda viva por pieza: pedidos no cerrados, renglones por producir
		const demandRows = (await db.execute(sql`
			SELECT oi.product_id AS pid,
			       COALESCE(SUM(oi.quantity_pieces),0)::int AS pieces,
			       COALESCE(SUM(oi.quantity_kg),0) AS kg
			FROM order_items oi
			JOIN orders o ON o.id = oi.order_id
			WHERE oi.product_id IS NOT NULL
			  AND o.status NOT IN ('cancelled','completed','COMPLETADA','delivered','paid')
			  AND oi.status NOT IN ('PESADO','WEIGHED','COMPLETADO')
			GROUP BY oi.product_id
		`)) as unknown as { pid: number; pieces: number; kg: string | number }[];
		const demandByProduct: Record<number, { pieces: number; kg: number }> = {};
		for (const r of demandRows) {
			demandByProduct[Number(r.pid)] = {
				pieces: Number(r.pieces) || 0,
				kg: Number(r.kg) || 0,
			};
		}

		const canales = canalRows.map((c) => ({
			canalProductId: c.id,
			name: c.name,
			type: typeByCanal.get(c.id) ?? "",
			stockPieces: c.stock ?? 0,
			avgWeight: Number(c.avg ?? 0),
		}));

		return { canales, recipes, subRecipes, demandByProduct };
	}),

	// Plan de despiece sugerido por iAntonella: a partir de los pedidos abiertos,
	// calcula cuántos canales de cada tipo conviene despiezar para cubrir la
	// demanda (descontando el stock ya despiezado) y qué piezas se generarían.
	suggestDespiecePlan: protectedProcedure
		.input(z.void())
		.output(
			z.object({
				hasDemand: z.boolean(),
				totalCanals: z.number(),
				plan: z.array(
					z.object({
						canalProductId: z.number(),
						canalName: z.string(),
						type: z.string(),
						quantity: z.number(),
						generates: z.array(
							z.object({
								name: z.string(),
								pieces: z.number(),
								kg: z.number(),
							}),
						),
					}),
				),
			}),
		)
		.query(async () => {
			// Canales raíz con stock
			const canalRows = await db
				.select({
					id: products.id,
					name: products.name,
					stock: products.stock_pieces,
					avg: products.avg_weight_per_piece_kg,
				})
				.from(products)
				.where(
					and(
						eq(products.is_parent_product, true),
						ilike(products.name, "CANAL%"),
					),
				)
				.orderBy(products.name);
			const canalIds = canalRows.map((c) => c.id);
			if (canalIds.length === 0)
				return { hasDemand: false, totalCanals: 0, plan: [] };

			const prods = await db
				.select({
					id: products.id,
					name: products.name,
					avg: products.avg_weight_per_piece_kg,
					stockPieces: products.stock_pieces,
				})
				.from(products);
			const prodMap = new Map(prods.map((p) => [p.id, p]));

			const recRows = await db
				.select({
					parentId: productTransformations.parent_product_id,
					childId: productTransformations.child_product_id,
					pieces: productTransformations.yield_quantity_pieces,
					ratio: productTransformations.yield_weight_ratio,
					type: productTransformations.transformation_type,
				})
				.from(productTransformations)
				.where(eq(productTransformations.is_active, true));
			const canalIdSet = new Set(canalIds);

			// Demanda viva por pieza
			const demandRows = (await db.execute(sql`
				SELECT oi.product_id AS pid,
				       COALESCE(SUM(oi.quantity_pieces),0)::int AS pieces
				FROM order_items oi
				JOIN orders o ON o.id = oi.order_id
				WHERE oi.product_id IS NOT NULL
				  AND o.status NOT IN ('cancelled','completed','COMPLETADA','delivered','paid')
				  AND oi.status NOT IN ('PESADO','WEIGHED','COMPLETADO')
				GROUP BY oi.product_id
			`)) as unknown as { pid: number; pieces: number }[];
			const demand = new Map<number, number>();
			for (const r of demandRows) demand.set(Number(r.pid), Number(r.pieces) || 0);
			const hasDemand = [...demand.values()].some((v) => v > 0);

			const plan: {
				canalProductId: number;
				canalName: string;
				type: string;
				quantity: number;
				generates: { name: string; pieces: number; kg: number }[];
			}[] = [];

			for (const canal of canalRows) {
				const canalRecipes = recRows.filter((r) => r.parentId === canal.id);
				if (canalRecipes.length === 0) continue;
				const type = canalRecipes.find((r) => r.type)?.type ?? "";

				// Canales necesarios = máx sobre las piezas con demanda no cubierta
				let need = 0;
				for (const r of canalRecipes) {
					const pzPerCanal = Number(r.pieces) || 0;
					if (pzPerCanal <= 0) continue;
					const dem = demand.get(r.childId) ?? 0;
					if (dem <= 0) continue;
					const stock = prodMap.get(r.childId)?.stockPieces ?? 0;
					const missing = Math.max(0, dem - stock);
					if (missing <= 0) continue;
					need = Math.max(need, Math.ceil(missing / pzPerCanal));
				}
				const quantity = Math.min(need, canal.stock ?? 0);
				if (quantity <= 0) continue;

				const avgW = Number(canal.avg ?? 0);
				const generates = canalRecipes.map((r) => ({
					name: prodMap.get(r.childId)?.name ?? `#${r.childId}`,
					pieces: quantity * (Number(r.pieces) || 0),
					kg: quantity * avgW * (Number(r.ratio) || 0),
				}));

				plan.push({
					canalProductId: canal.id,
					canalName: canal.name,
					type,
					quantity,
					generates,
				});
			}

			const totalCanals = plan.reduce((s, p) => s + p.quantity, 0);
			return { hasDemand, totalCanals, plan };
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

		const agg = new Map<
			string,
			{ kgComprado: number; kgReal: number; canales: number; hojas: number }
		>();
		for (const s of sheets) {
			const prov =
				((s as any).supplier as string | null)?.trim() || "Sin proveedor";
			const items = await db
				.select({ kg: yieldSheetItems.kg_total })
				.from(yieldSheetItems)
				.where(eq(yieldSheetItems.sheet_id, s.id));
			const kgReal = items.reduce((a, i) => a + Number(i.kg), 0);
			const cur = agg.get(prov) ?? {
				kgComprado: 0,
				kgReal: 0,
				canales: 0,
				hojas: 0,
			};
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
