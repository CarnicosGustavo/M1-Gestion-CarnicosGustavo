import { z } from "zod/v4";
import { protectedProcedure, router, almacenProcedure } from "../init";
import { db } from "@/lib/db";
import {
	orders,
	orderItems,
	transactions,
	customers,
	products,
	productTransformations,
	inventoryTransactions,
	creditCharges,
	customerPrices,
} from "@/lib/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { alias } from "drizzle-orm/pg-core";

const orderWithCustomerSchema = z.object({
	id: z.number(),
	customer_id: z.number().nullable(),
	total_amount: z.union([z.number(), z.string()]),
	status: z.string().nullable(),
	user_uid: z.string(),
	requires_weighing: z.boolean(),
	whatsapp_message_id: z.string().nullable(),
	notes: z.string().nullable(),
	delivery_address: z.string().nullable(),
	created_at: z.date().nullable(),
	customer: z.object({ name: z.string() }).nullable(),
});

const orderDetailSchema = z.object({
	id: z.number(),
	customer_id: z.number().nullable(),
	total_amount: z.union([z.number(), z.string()]),
	status: z.string().nullable(),
	user_uid: z.string(),
	requires_weighing: z.boolean(),
	notes: z.string().nullable(),
	whatsapp_message_id: z.string().nullable(),
	created_at: z.date().nullable(),
	customer: z.object({ name: z.string() }).nullable(),
	orderItems: z.array(
		z.object({
			id: z.number(),
			product_id: z.number().nullable(),
			product_name: z.string().nullable(),
			quantity: z.number(),
			quantity_pieces: z.number().nullable(),
			quantity_kg: z.union([z.number(), z.string()]).nullable(),
			unit_price: z.union([z.number(), z.string()]),
			subtotal: z.union([z.number(), z.string()]).nullable(),
			status: z.string(),
			product: z
				.object({
					name: z.string(),
					category: z.string().nullable(),
					is_sellable_by_weight: z.boolean(),
					is_sellable_by_unit: z.boolean(),
				})
				.nullable(),
		}),
	),
});

const orderDisassemblyCheckSchema = z.object({
	orderId: z.number(),
	transformationType: z.string(),
	canal: z
		.object({
			id: z.number(),
			name: z.string(),
		})
		.nullable(),
	items: z.array(
		z.object({
			orderItemId: z.number(),
			productId: z.number(),
			productName: z.string(),
			demandPieces: z.number(),
			isPurchased: z.boolean(),
			ok: z.boolean(),
			reason: z.string().nullable(),
			path: z
				.array(
					z.object({
						parentId: z.number(),
						parentName: z.string(),
						childId: z.number(),
						childName: z.string(),
						yieldPieces: z.number(),
					}),
				)
				.nullable(),
		}),
	),
	ok: z.boolean(),
});

const orderPrepareDisassemblyResultSchema = z.object({
	orderId: z.number(),
	transformationType: z.string(),
	canal: z.object({ id: z.number(), name: z.string() }),
	canalPiecesProcessed: z.number(),
	intermediatesProcessed: z.array(
		z.object({
			parentId: z.number(),
			parentName: z.string(),
			piecesProcessed: z.number(),
		}),
	),
	ok: z.boolean(),
});

export const ordersRouter = router({
	get: protectedProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/orders/{id}",
				tags: ["Orders"],
				summary: "Get order details",
			},
		})
		.input(z.object({ id: z.number() }))
		.output(orderDetailSchema.nullable())
		.query(async ({ ctx, input }) => {
			const result = await db.query.orders.findFirst({
				where: and(
					eq(orders.id, input.id),
					inArray(orders.user_uid, [ctx.user.id, "system"])
				),
				with: {
					customer: { columns: { name: true } },
					orderItems: {
						with: {
							product: {
								columns: {
									name: true,
									category: true,
									is_sellable_by_weight: true,
									is_sellable_by_unit: true,
								},
							},
						},
					},
				},
			});
			if (!result) return null;
			return {
				...result,
				orderItems: result.orderItems.map((item) => ({
					...item,
					product: item.product ?? null,
				})),
			};
		}),

	list: protectedProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/orders",
				tags: ["Orders"],
				summary: "List all orders",
			},
		})
		.input(z.void())
		.output(z.array(orderWithCustomerSchema))
		.query(async ({ ctx }) => {
			return db.query.orders.findMany({
				where: inArray(orders.user_uid, [ctx.user.id, "system"]),
				with: {
					customer: {
						columns: { name: true },
					},
				},
			});
		}),

	getPendingWeighingOrders: protectedProcedure
		.input(z.void())
		.output(z.array(orderDetailSchema))
		.query(async ({ ctx }) => {
			const results = await db.query.orders.findMany({
				where: and(
					inArray(orders.user_uid, [ctx.user.id, "system"]),
					eq(orders.requires_weighing, true),
				),
				with: {
					customer: { columns: { name: true } },
					orderItems: {
						where: eq(orderItems.status, "PENDIENTE_PESAJE"),
						with: {
							product: {
								columns: {
									name: true,
									category: true,
									is_sellable_by_weight: true,
									is_sellable_by_unit: true,
								},
							},
						},
					},
				},
			});
			return results.map((order) => ({
				...order,
				orderItems: order.orderItems.map((item) => ({
					...item,
					product: item.product ?? null,
				})),
			}));
		}),

	validateDisassemblyRecipes: protectedProcedure
		.meta({
			openapi: {
				method: "POST",
				path: "/orders/{orderId}/validate-disassembly",
				tags: ["Orders"],
				summary: "Validate disassembly recipe coverage for an order (by style)",
			},
		})
		.input(
			z.object({
				orderId: z.number(),
				transformationType: z.string().min(1),
				canalProductId: z.number().optional(),
				productsToLeaveWhole: z.array(z.number()).optional(),
			}),
		)
		.output(orderDisassemblyCheckSchema)
		.mutation(async ({ ctx, input }) => {
			const uid = ctx.user.id;

			const order = await db.query.orders.findFirst({
				where: and(eq(orders.id, input.orderId), inArray(orders.user_uid, [uid, "system"])),
				with: {
					orderItems: {
						with: {
							product: {
								columns: {
									id: true,
									name: true,
									category: true,
									user_uid: true,
								},
							},
						},
					},
				},
			});

			if (!order) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Orden no encontrada",
				});
			}

			const normalizeName = (name: string) =>
				name
					.toLowerCase()
					.replace(/^\s*[a-z]{2}\d+(\.\d+)?\s*-\s*/i, "")
					.trim();

			const isPurchasedProduct = (name: string, category: string | null) => {
				const n = normalizeName(name);
				const c = (category ?? "").toLowerCase().trim();
				if (c === "comprado" || c === "compras" || c === "compra") return true;
				const keywords = ["nana", "buche", "ahumad", "chicharr", "prensa"];
				return keywords.some((k) => n.includes(k));
			};

			const normalizeProductName = (name: string) =>
				name.toLowerCase().replace(/^\s*[a-z]{2}\d+\s*-\s*/i, "").trim();

			const canalCandidates = await db
				.select({ id: products.id, name: products.name })
				.from(products)
				.where(
					and(
						eq(products.user_uid, uid),
						eq(products.is_parent_product, true),
					),
				);

			const scoreCanalSpecific = (name: string, ttype: string): number => {
				const n = normalizeProductName(name);
				const t = ttype.toLowerCase().trim();
				if (!n.includes("canal")) return 999;
				if (t.includes("americano")) {
					if (n.includes("canal americano")) return 0;
					if (n.includes("americano") && n.includes("canal")) return 1;
					return 999;
				}
				if (t.includes("nacional") && t.includes("lomo")) {
					if (n.includes("canal nacional lomo")) return 0;
					if (n.includes("nacional lomo") && n.includes("canal")) return 1;
					return 999;
				}
				if (t.includes("nacional") && t.includes("espilomo")) {
					if (n.includes("canal nacional espilomo")) return 0;
					if (n.includes("nacional espilomo") && n.includes("canal")) return 1;
					return 999;
				}
				if (t.includes("polinesio")) {
					if (n.includes("canal polinesio")) return 0;
					if (n.includes("polinesio") && n.includes("canal")) return 1;
					return 999;
				}
				return 999;
			};

			const canal =
				input.canalProductId !== undefined
					? await db.query.products.findFirst({
							where: and(
								eq(products.id, input.canalProductId),
								eq(products.user_uid, uid),
							),
							columns: { id: true, name: true },
						})
					: (() => {
							const sorted = canalCandidates
								.slice()
								.sort((a, b) => {
									const sa = scoreCanalSpecific(a.name, input.transformationType);
									const sb = scoreCanalSpecific(b.name, input.transformationType);
									if (sa !== sb) return sa - sb;
									return a.id - b.id;
								});
							const best = sorted[0];
							return best &&
								scoreCanalSpecific(best.name, input.transformationType) < 999
								? { id: best.id, name: best.name }
								: null;
						})();

			if (!canal) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message:
						"No se encontró CANAL para este estilo. Verifica que exista un producto canal y recetas activas para ese transformation_type.",
				});
			}

			const parent = alias(products, "parent_products_for_validation");
			const child = alias(products, "child_products_for_validation");
			const edges = await db
				.select({
					parentId: productTransformations.parent_product_id,
					childId: productTransformations.child_product_id,
					yieldPieces: productTransformations.yield_quantity_pieces,
					parentName: parent.name,
					childName: child.name,
				})
				.from(productTransformations)
				.innerJoin(parent, eq(parent.id, productTransformations.parent_product_id))
				.innerJoin(child, eq(child.id, productTransformations.child_product_id))
				.where(
					and(
						eq(parent.user_uid, uid),
						eq(child.user_uid, uid),
						eq(productTransformations.is_active, true),
						eq(productTransformations.transformation_type, input.transformationType),
					),
				);

			const adjacency = new Map<
				number,
				Array<{
					parentId: number;
					parentName: string;
					childId: number;
					childName: string;
					yieldPieces: number;
				}>
			>();
			for (const e of edges) {
				const y = Number(e.yieldPieces);
				if (!Number.isFinite(y) || y <= 0) continue;
				const arr = adjacency.get(e.parentId) ?? [];
				arr.push({
					parentId: e.parentId,
					parentName: e.parentName,
					childId: e.childId,
					childName: e.childName,
					yieldPieces: y,
				});
				adjacency.set(e.parentId, arr);
			}

			type Prev = {
				prevId: number | null;
				via: {
					parentId: number;
					parentName: string;
					childId: number;
					childName: string;
					yieldPieces: number;
				} | null;
				depth: number;
			};
			const visited = new Map<number, Prev>();
			const queue: number[] = [];
			visited.set(canal.id, { prevId: null, via: null, depth: 0 });
			queue.push(canal.id);

			while (queue.length) {
				const current = queue.shift()!;
				const info = visited.get(current)!;
				if (info.depth >= 2) continue;
				const out = adjacency.get(current) ?? [];
				for (const edge of out) {
					if (visited.has(edge.childId)) continue;
					visited.set(edge.childId, {
						prevId: current,
						via: edge,
						depth: info.depth + 1,
					});
					queue.push(edge.childId);
				}
			}

			const buildPath = (targetId: number) => {
				const out: Array<{
					parentId: number;
					parentName: string;
					childId: number;
					childName: string;
					yieldPieces: number;
				}> = [];
				let cur: number | null = targetId;
				while (cur !== null) {
					const p = visited.get(cur);
					if (!p || !p.via) break;
					out.push(p.via);
					cur = p.prevId;
				}
				out.reverse();
				return out;
			};

			const items = order.orderItems
				.filter((i) => i.product && i.product.user_uid === uid)
				.map((i) => {
					const productId = i.product!.id;
					const productName = i.product!.name;
					const demandPieces = i.quantity_pieces ?? i.quantity ?? 0;
					const purchased = isPurchasedProduct(
						productName,
						i.product!.category ?? null,
					);

					if (purchased) {
						return {
							orderItemId: i.id,
							productId,
							productName,
							demandPieces,
							isPurchased: true,
							ok: true,
							reason: null,
							path: null,
						};
					}

					const reachable = visited.has(productId);
					if (!reachable) {
						return {
							orderItemId: i.id,
							productId,
							productName,
							demandPieces,
							isPurchased: false,
							ok: false,
							reason: "RECETA_INCOMPLETA",
							path: null,
						};
					}

					const path = buildPath(productId);
					const isBlocked = path && path.some(step => input.productsToLeaveWhole?.includes(step.childId));

					if (isBlocked) {
						return {
							orderItemId: i.id,
							productId,
							productName,
							demandPieces,
							isPurchased: false,
							ok: false,
							reason: "BLOQUEADO_POR_USUARIO",
							path,
						};
					}

					return {
						orderItemId: i.id,
						productId,
						productName,
						demandPieces,
						isPurchased: false,
						ok: true,
						reason: null,
						path,
					};
				});

			const ok = items.every((i) => i.ok);
			return {
				orderId: order.id,
				transformationType: input.transformationType,
				canal: { id: canal.id, name: canal.name },
				items,
				ok,
			};
		}),

	prepareDisassemblyForOrder: almacenProcedure
		.meta({
			openapi: {
				method: "POST",
				path: "/orders/{orderId}/prepare-disassembly",
				tags: ["Orders"],
				summary: "Generate required disassembly for an order (by style) and move to PENDIENTE_PESAJE",
			},
		})
		.input(
			z.object({
				orderId: z.number(),
				transformationType: z.string().min(1),
				canalProductId: z.number().optional(),
				productsToLeaveWhole: z.array(z.number()).optional(),
			}),
		)
		.output(orderPrepareDisassemblyResultSchema)
		.mutation(async ({ ctx, input }) => {
			const uid = ctx.user.id;

			const order = await db.query.orders.findFirst({
				where: and(eq(orders.id, input.orderId), eq(orders.user_uid, uid)),
				with: {
					orderItems: {
						with: {
							product: {
								columns: {
									id: true,
									name: true,
									category: true,
									user_uid: true,
									stock_pieces: true,
									stock_kg: true,
									is_sellable_by_weight: true,
									is_sellable_by_unit: true,
								},
							},
						},
					},
				},
			});

			if (!order) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Orden no encontrada",
				});
			}

			const normalizeName = (name: string) =>
				name
					.toLowerCase()
					.replace(/^\s*[a-z]{2}\d+(\.\d+)?\s*-\s*/i, "")
					.trim();

			const isPurchasedProduct = (name: string, category: string | null) => {
				const n = normalizeName(name);
				const c = (category ?? "").toLowerCase().trim();
				if (c === "comprado" || c === "compras" || c === "compra") return true;
				const keywords = ["nana", "buche", "ahumad", "chicharr", "prensa"];
				return keywords.some((k) => n.includes(k));
			};

			const normalizeProductName = (name: string) =>
				name.toLowerCase().replace(/^\s*[a-z]{2}\d+\s*-\s*/i, "").trim();

			const canalCandidates = await db
				.select({ id: products.id, name: products.name })
				.from(products)
				.where(
					and(
						eq(products.user_uid, uid),
						eq(products.is_parent_product, true),
					),
				);

			const scoreCanalSpecific = (name: string, ttype: string): number => {
				const n = normalizeProductName(name);
				const t = ttype.toLowerCase().trim();
				if (!n.includes("canal")) return 999;
				if (t.includes("americano")) {
					if (n.includes("canal americano")) return 0;
					if (n.includes("americano") && n.includes("canal")) return 1;
					return 999;
				}
				if (t.includes("nacional") && t.includes("lomo")) {
					if (n.includes("canal nacional lomo")) return 0;
					if (n.includes("nacional lomo") && n.includes("canal")) return 1;
					return 999;
				}
				if (t.includes("nacional") && t.includes("espilomo")) {
					if (n.includes("canal nacional espilomo")) return 0;
					if (n.includes("nacional espilomo") && n.includes("canal")) return 1;
					return 999;
				}
				if (t.includes("polinesio")) {
					if (n.includes("canal polinesio")) return 0;
					if (n.includes("polinesio") && n.includes("canal")) return 1;
					return 999;
				}
				return 999;
			};

			const canal =
				input.canalProductId !== undefined
					? await db.query.products.findFirst({
							where: and(
								eq(products.id, input.canalProductId),
								eq(products.user_uid, uid),
							),
							columns: { id: true, name: true },
						})
					: (() => {
							const sorted = canalCandidates
								.slice()
								.sort((a, b) => {
									const sa = scoreCanalSpecific(a.name, input.transformationType);
									const sb = scoreCanalSpecific(b.name, input.transformationType);
									if (sa !== sb) return sa - sb;
									return a.id - b.id;
								});
							const best = sorted[0];
							return best &&
								scoreCanalSpecific(best.name, input.transformationType) < 999
								? { id: best.id, name: best.name }
								: null;
						})();

			if (!canal) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message:
						"No se encontró CANAL para este estilo. Verifica que exista un producto canal y recetas activas para ese transformation_type.",
				});
			}

			const parent = alias(products, "parent_products_for_prepare");
			const child = alias(products, "child_products_for_prepare");
			const edges = await db
				.select({
					parentId: productTransformations.parent_product_id,
					childId: productTransformations.child_product_id,
					yieldPieces: productTransformations.yield_quantity_pieces,
					parentName: parent.name,
					childName: child.name,
				})
				.from(productTransformations)
				.innerJoin(parent, eq(parent.id, productTransformations.parent_product_id))
				.innerJoin(child, eq(child.id, productTransformations.child_product_id))
				.where(
					and(
						eq(parent.user_uid, uid),
						eq(child.user_uid, uid),
						eq(productTransformations.is_active, true),
						eq(productTransformations.transformation_type, input.transformationType),
					),
				);

			const adjacency = new Map<
				number,
				Array<{
					parentId: number;
					parentName: string;
					childId: number;
					childName: string;
					yieldPieces: number;
				}>
			>();
			for (const e of edges) {
				const y = Number(e.yieldPieces);
				if (!Number.isFinite(y) || y <= 0) continue;
				const arr = adjacency.get(e.parentId) ?? [];
				arr.push({
					parentId: e.parentId,
					parentName: e.parentName,
					childId: e.childId,
					childName: e.childName,
					yieldPieces: y,
				});
				adjacency.set(e.parentId, arr);
			}

			type Prev = {
				prevId: number | null;
				via: {
					parentId: number;
					parentName: string;
					childId: number;
					childName: string;
					yieldPieces: number;
				} | null;
				depth: number;
			};
			const visited = new Map<number, Prev>();
			const queue: number[] = [];
			visited.set(canal.id, { prevId: null, via: null, depth: 0 });
			queue.push(canal.id);

			while (queue.length) {
				const current = queue.shift()!;
				const info = visited.get(current)!;
				if (info.depth >= 2) continue;
				const out = adjacency.get(current) ?? [];
				for (const edge of out) {
					if (visited.has(edge.childId)) continue;
					visited.set(edge.childId, {
						prevId: current,
						via: edge,
						depth: info.depth + 1,
					});
					queue.push(edge.childId);
				}
			}

			const buildPath = (targetId: number) => {
				const out: Array<{
					parentId: number;
					parentName: string;
					childId: number;
					childName: string;
					yieldPieces: number;
				}> = [];
				let cur: number | null = targetId;
				while (cur !== null) {
					const p = visited.get(cur);
					if (!p || !p.via) break;
					out.push(p.via);
					cur = p.prevId;
				}
				out.reverse();
				return out;
			};

			const requiredParentsForDemand = (demandPieces: number, yieldPieces: number) => {
				if (!Number.isFinite(yieldPieces) || yieldPieces <= 0) return 0;
				if (demandPieces <= 0) return 0;
				const approx = Math.max(0, Math.ceil(demandPieces / yieldPieces));
				const start = Math.max(0, approx - 3);
				const maxN = approx * 2 + 20;
				for (let n = start; n <= maxN; n++) {
					if (Math.round(n * yieldPieces) >= demandPieces) return n;
				}
				for (let n = maxN + 1; n <= maxN + 200; n++) {
					if (Math.round(n * yieldPieces) >= demandPieces) return n;
				}
				return maxN + 200;
			};

			const demandedDirect = new Map<number, number>();
			const intermediateDemands = new Map<number, Map<number, { demand: number; yieldPieces: number }>>();
			const missing: Array<{ productName: string; reason: string }> = [];

			const productsById = new Map<number, (typeof order.orderItems)[number]["product"]>();
			for (const i of order.orderItems) {
				if (i.product && i.product.user_uid === uid) {
					productsById.set(i.product.id, i.product);
				}
			}

			const addDemand = (map: Map<number, number>, k: number, v: number) => {
				map.set(k, (map.get(k) ?? 0) + v);
			};

			for (const item of order.orderItems) {
				if (!item.product || item.product.user_uid !== uid) continue;
				const p = item.product;

				if (isPurchasedProduct(p.name, p.category ?? null)) {
					continue;
				}

				const demandByPieces = item.quantity_pieces ?? null;
				const demandByKg = item.quantity_kg !== null ? Number(item.quantity_kg) : null;
				const isWeight = p.is_sellable_by_weight === true;

				let demandPieces = 0;
				if (demandByPieces !== null && demandByPieces > 0) {
					demandPieces = demandByPieces;
				} else if (demandByKg !== null && demandByKg > 0) {
					const stockPieces = Number(p.stock_pieces);
					const stockKg = Number(p.stock_kg);
					const avg = stockPieces > 0 ? stockKg / stockPieces : 0;
					demandPieces = avg > 0 ? Math.max(1, Math.ceil(demandByKg / avg)) : 1;
				} else if (isWeight) {
					demandPieces = 1;
				} else {
					missing.push({ productName: p.name, reason: "CANTIDAD_NO_DEFINIDA" });
					continue;
				}

				const stockPieces = Number(p.stock_pieces);
				const shortage = Math.max(0, demandPieces - stockPieces);
				if (shortage <= 0) continue;

				const reachable = visited.has(p.id);
				if (!reachable) {
					missing.push({ productName: p.name, reason: "RECETA_INCOMPLETA" });
					continue;
				}

				const path = buildPath(p.id);
				if (path.length === 0) {
					missing.push({ productName: p.name, reason: "RECETA_INCOMPLETA" });
					continue;
				}

				const isBlocked = path.some(step => input.productsToLeaveWhole?.includes(step.childId));
				if (isBlocked) {
					missing.push({ productName: p.name, reason: "BLOQUEADO_POR_USUARIO" });
					continue;
				}

				if (path.length === 1) {
					addDemand(demandedDirect, p.id, shortage);
					continue;
				}

				if (path.length === 2) {
					const intermediateId = path[0].childId;
					const yieldPieces = path[1].yieldPieces;
					const m = intermediateDemands.get(intermediateId) ?? new Map();
					const prev = m.get(p.id);
					m.set(p.id, {
						demand: (prev?.demand ?? 0) + shortage,
						yieldPieces,
					});
					intermediateDemands.set(intermediateId, m);
					continue;
				}

				missing.push({ productName: p.name, reason: "RECETA_INCOMPLETA" });
			}

			if (missing.length) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `No se puede preparar: ${missing
						.map((m) => `${m.productName}(${m.reason})`)
						.join(", ")}`,
				});
			}

			const intermediateToProcess = new Map<number, number>();
			for (const [intermediateId, demands] of intermediateDemands) {
				let need = 0;
				for (const d of demands.values()) {
					const n = requiredParentsForDemand(d.demand, d.yieldPieces);
					if (n > need) need = n;
				}
				if (need > 0) {
					intermediateToProcess.set(intermediateId, need);
				}
			}

			for (const [intermediateId, toProcess] of intermediateToProcess) {
				const p = productsById.get(intermediateId);
				const stockPieces = p ? Number(p.stock_pieces) : 0;
				const neededFromCanal = Math.max(0, toProcess - stockPieces);
				if (neededFromCanal > 0) {
					addDemand(demandedDirect, intermediateId, neededFromCanal);
				}
			}

			const canalOut = adjacency.get(canal.id) ?? [];
			const yieldFromCanal = (childId: number) => {
				const e = canalOut.find((x) => x.childId === childId);
				return e ? e.yieldPieces : null;
			};

			let canalPiecesToProcess = 0;
			for (const [childId, demandPieces] of demandedDirect) {
				const y = yieldFromCanal(childId);
				if (y === null) {
					const childName = productsById.get(childId)?.name ?? `id ${childId}`;
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: `RECETA_INCOMPLETA: no existe receta CANAL -> ${childName} para ${input.transformationType}`,
					});
				}
				const n = requiredParentsForDemand(demandPieces, y);
				if (n > canalPiecesToProcess) canalPiecesToProcess = n;
			}

			return db.transaction(async (tx) => {
				const applyDisassemblyTx = async (args: {
					parentProductId: number;
					quantityToProcess: number;
					transformationType: string;
				}) => {
					if (args.quantityToProcess <= 0) return { parentName: "", processed: 0 };

					const [parentRow] = await tx
						.select()
						.from(products)
						.where(
							and(
								eq(products.id, args.parentProductId),
								eq(products.user_uid, uid),
							),
						)
						.limit(1);

					if (!parentRow) {
						throw new TRPCError({
							code: "NOT_FOUND",
							message: `Producto padre no encontrado (${args.parentProductId})`,
						});
					}

					if (parentRow.stock_pieces < args.quantityToProcess) {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message: `Stock insuficiente de ${parentRow.name}`,
						});
					}

					const stockKg = Number(parentRow.stock_kg);
					const parentAvgWeight =
						parentRow.stock_pieces > 0 ? stockKg / parentRow.stock_pieces : 0;
					const kgToRemove = args.quantityToProcess * parentAvgWeight;
					const newStockKg = stockKg - kgToRemove;
					if (newStockKg < -0.0005) {
						throw new TRPCError({
							code: "PRECONDITION_FAILED",
							message: `Stock insuficiente (kg) de ${parentRow.name}`,
						});
					}

					await tx
						.update(products)
						.set({
							stock_pieces: parentRow.stock_pieces - args.quantityToProcess,
							stock_kg: Math.max(0, newStockKg).toFixed(3),
							weighed_pieces: Math.min(
								parentRow.weighed_pieces ?? 0,
								parentRow.stock_pieces - args.quantityToProcess,
							),
						})
						.where(eq(products.id, args.parentProductId));

					await tx.insert(inventoryTransactions).values({
						product_id: args.parentProductId,
						quantity_change_pieces: -args.quantityToProcess,
						quantity_change_kg: kgToRemove !== 0 ? (-kgToRemove).toFixed(3) : null,
						transaction_type: "DESPIECE",
						reference_id: input.orderId,
						notes: `Salida por despiece ${args.transformationType} pedido #${input.orderId}`,
					});

					const recipes = await tx
						.select()
						.from(productTransformations)
						.where(
							and(
								eq(productTransformations.parent_product_id, args.parentProductId),
								eq(productTransformations.transformation_type, args.transformationType),
								eq(productTransformations.is_active, true),
							),
						);

					if (!recipes.length) {
						throw new TRPCError({
							code: "NOT_FOUND",
							message: `RECETA_INCOMPLETA: ${parentRow.name} no tiene receta ${args.transformationType}`,
						});
					}

					for (const r of recipes) {
						const yieldPieces = Number(r.yield_quantity_pieces);
						if (!Number.isFinite(yieldPieces) || yieldPieces <= 0) continue;
						const childPiecesToAdd = Math.round(
							args.quantityToProcess * yieldPieces,
						);
						if (childPiecesToAdd <= 0) continue;

						const yieldRatio = Number(r.yield_weight_ratio);
						const ratio = Number.isFinite(yieldRatio) && yieldRatio > 0 ? yieldRatio : 0;
						const childKgToAdd = ratio * parentAvgWeight * args.quantityToProcess;

						const [childRow] = await tx
							.select()
							.from(products)
							.where(
								and(
									eq(products.id, r.child_product_id),
									eq(products.user_uid, uid),
								),
							)
							.limit(1);

						if (!childRow) continue;

						const newChildKg = Number(childRow.stock_kg) + childKgToAdd;
						if (newChildKg > 9999999.999) {
							throw new TRPCError({
								code: "INVALID_DATA",
								message: `Stock del producto ${childRow.name} excedería el límite máximo permitido`,
							});
						}

						await tx
							.update(products)
							.set({
								stock_pieces: childRow.stock_pieces + childPiecesToAdd,
								stock_kg: newChildKg.toFixed(3),
							})
							.where(eq(products.id, r.child_product_id));

						await tx.insert(inventoryTransactions).values({
							product_id: r.child_product_id,
							quantity_change_pieces: childPiecesToAdd,
							quantity_change_kg: childKgToAdd !== 0 ? childKgToAdd.toFixed(3) : null,
							transaction_type: "DESPIECE",
							reference_id: input.orderId,
							notes: `Entrada por despiece ${args.transformationType} de ${parentRow.name} pedido #${input.orderId}`,
						});
					}

					return { parentName: parentRow.name, processed: args.quantityToProcess };
				};

				const intermediatesProcessed: Array<{
					parentId: number;
					parentName: string;
					piecesProcessed: number;
				}> = [];

				if (canalPiecesToProcess > 0) {
					await applyDisassemblyTx({
						parentProductId: canal.id,
						quantityToProcess: canalPiecesToProcess,
						transformationType: input.transformationType,
					});
				}

				for (const [intermediateId, toProcess] of intermediateToProcess) {
					const result = await applyDisassemblyTx({
						parentProductId: intermediateId,
						quantityToProcess: toProcess,
						transformationType: input.transformationType,
					});
					if (result.processed > 0) {
						intermediatesProcessed.push({
							parentId: intermediateId,
							parentName: result.parentName,
							piecesProcessed: result.processed,
						});
					}
				}

				await tx
					.update(orders)
					.set({
						status: "PENDIENTE_PESAJE",
						requires_weighing: true,
						updated_at: new Date(),
					})
					.where(and(eq(orders.id, input.orderId), eq(orders.user_uid, uid)));

				return {
					orderId: input.orderId,
					transformationType: input.transformationType,
					canal: { id: canal.id, name: canal.name },
					canalPiecesProcessed: canalPiecesToProcess,
					intermediatesProcessed,
					ok: true,
				};
			});
		}),

	create: protectedProcedure
		.meta({
			openapi: {
				method: "POST",
				path: "/orders",
				tags: ["Orders"],
				summary: "Create an order with items",
			},
		})
		.input(
			z.object({
				customerId: z.number(),
				paymentMethodId: z.number().optional(),
				items: z.array(
					z.object({
						productId: z.number(),
						quantityPieces: z.number().int().optional(),
						quantityKg: z.number().int().optional(),
						unitPrice: z.number().int(),
						requiresPurchase: z.boolean().optional(), // NUEVO: indica si el item está pendiente de compra
					}),
				),
				notes: z.string().optional(),
				deliveryAddress: z.string().optional(),
				whatsappMessageId: z.string().optional(),
			}),
		)
		.output(orderWithCustomerSchema)
		.mutation(async ({ ctx, input }) => {
			return db.transaction(async (tx) => {
				let requiresWeighing = false;
				const processedItems = [];

				for (const item of input.items) {
					const [product] = await tx
						.select()
						.from(products)
						.where(
							and(
								eq(products.id, item.productId),
								eq(products.user_uid, ctx.user.id),
							),
						)
						.limit(1);

					if (!product)
						throw new TRPCError({
							code: "NOT_FOUND",
							message: `Producto ${item.productId} no encontrado`,
						});

					let itemStatus = "COMPLETADO";
					let quantityKg = item.quantityKg;
					let subtotal = 0;

					// No se bloquea por stock: el pedido se acepta aunque el producto no
					// exista todavía en inventario. El stock puede quedar negativo y se
					// compensa al despiezar las canales. (Se ignora requiresPurchase.)
					if (product.is_sellable_by_weight) {
						// Producto por peso: SIEMPRE va a la estación de pesaje. El peso
						// real se mide en la báscula y de ahí sale el cálculo. La cantidad
						// capturada (kg solicitados) queda como referencia y se reemplaza
						// con el peso real al pesar.
						itemStatus = "PENDIENTE_PESAJE";
						requiresWeighing = true;
						quantityKg = quantityKg
							? ((quantityKg / 1000).toFixed(3) as any)
							: null;
						subtotal = 0;
					} else if (item.quantityPieces) {
						// Producto que NO se pesa (venta por pieza): queda listo
						subtotal = item.quantityPieces * item.unitPrice;
					}

					processedItems.push({
						product_id: item.productId,
						product_name: product.name,
						quantity: item.quantityKg ?? item.quantityPieces ?? 0,
						quantity_pieces: item.quantityPieces,
						quantity_kg: quantityKg,
						unit_price: item.unitPrice,
						subtotal: subtotal,
						status: itemStatus,
					});
				}

				const totalAmount = processedItems.reduce(
					(sum, i) => sum + Number(i.subtotal),
					0,
				);
				const orderStatus = requiresWeighing
					? "PENDIENTE_PESAJE"
					: "LISTA_PARA_COBRO";

				const [orderData] = await tx
					.insert(orders)
					.values({
						customer_id: input.customerId,
						total_amount: totalAmount,
						user_uid: ctx.user.id,
						status: orderStatus,
						requires_weighing: requiresWeighing,
						notes: input.notes,
						delivery_address: input.deliveryAddress,
						whatsapp_message_id: input.whatsappMessageId,
					})
					.returning();

				await tx.insert(orderItems).values(
					processedItems.map((item) => ({
						order_id: orderData.id,
						...item,
					})),
				);

				if (!requiresWeighing && input.paymentMethodId) {
					await tx.insert(transactions).values({
						order_id: orderData.id,
						payment_method_id: input.paymentMethodId,
						amount: Math.round(totalAmount),
						user_uid: ctx.user.id,
						status: "completed",
						category: "selling",
						type: "income",
						description: `Pago de pedido #${orderData.id}`,
					});
				}

				const customer = input.customerId
					? await tx.query.customers.findFirst({
							where: eq(customers.id, input.customerId),
							columns: { name: true },
						})
					: null;

				return { ...orderData, customer: customer ?? null };
			});
		}),

	updateOrderItemWeight: protectedProcedure
		.meta({
			openapi: {
				method: "PATCH",
				path: "/orders/items/{orderItemId}/weight",
				tags: ["Orders"],
				summary: "Update order item weight",
			},
		})
		.input(
			z.object({
				orderItemId: z.number(),
				actualWeightKg: z.number().int().positive(),
			}),
		)
		.output(z.object({ success: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			return db.transaction(async (tx) => {
				const [item] = await tx
					.select()
					.from(orderItems)
					.where(eq(orderItems.id, input.orderItemId))
					.limit(1);

				if (!item)
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Ítem no encontrado",
					});

				const subtotal = Math.round(
					(input.actualWeightKg * Number(item.unit_price)) / 1000,
				);
				const actualWeightKg = (input.actualWeightKg / 1000).toFixed(3);

				await tx
					.update(orderItems)
					.set({
						quantity_kg: actualWeightKg,
						subtotal: subtotal,
						status: "PESADO",
					})
					.where(eq(orderItems.id, input.orderItemId));

				// Recalcular total de la orden
				const allItems = await tx
					.select()
					.from(orderItems)
					.where(eq(orderItems.order_id, item.order_id!));

				const newTotal = allItems.reduce((sum, i) => {
					if (i.id === input.orderItemId) return sum + subtotal;
					return sum + Number(i.subtotal);
				}, 0);

				const allWeighed = allItems.every((i) =>
					i.id === input.orderItemId ? true : i.status !== "PENDIENTE_PESAJE",
				);

				// ¿Es un pesaje de producción? (pedido sin cliente etiquetado)
				const [ord] = await tx
					.select({ notes: orders.notes })
					.from(orders)
					.where(eq(orders.id, item.order_id!))
					.limit(1);
				const isProduction = ord?.notes === "Pesaje de producción";

				// En producción, lo pesado se suma al inventario (piezas + kg) y el
				// pedido NO va a cobro: queda COMPLETADA.
				if (isProduction && item.product_id) {
					await tx
						.update(products)
						.set({
							stock_kg: sql`${products.stock_kg} + ${actualWeightKg}::numeric`,
							stock_pieces: sql`${products.stock_pieces} + ${item.quantity_pieces ?? 0}`,
							updated_at: new Date(),
						})
						.where(eq(products.id, item.product_id));

					await tx.insert(inventoryTransactions).values({
						product_id: item.product_id,
						quantity_change_pieces: item.quantity_pieces ?? 0,
						quantity_change_kg: actualWeightKg,
						transaction_type: "PRODUCCION",
						reference_id: item.order_id!,
						notes: `Pesaje de producción pedido #${item.order_id}`,
					});
				}

				await tx
					.update(orders)
					.set({
						total_amount: newTotal,
						status: isProduction
							? allWeighed
								? "COMPLETADA"
								: "PENDIENTE_PESAJE"
							: allWeighed
								? "LISTA_PARA_COBRO"
								: "PENDIENTE_PESAJE",
						requires_weighing: !allWeighed,
					})
					.where(eq(orders.id, item.order_id!));

				return { success: true };
			});
		}),

	completeOrderPayment: protectedProcedure
		.meta({
			openapi: {
				method: "POST",
				path: "/orders/{orderId}/pay",
				tags: ["Orders"],
				summary: "Complete order payment and discount inventory",
			},
		})
		.input(z.object({ orderId: z.number(), paymentMethodId: z.number() }))
		.output(z.object({ success: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			return db.transaction(async (tx) => {
				// Atomic status check: only one request can transition from LISTA_PARA_COBRO
				const [orderData] = await tx
					.update(orders)
					.set({ status: "PROCESANDO_PAGO" })
					.where(
						and(
							eq(orders.id, input.orderId),
							inArray(orders.user_uid, [ctx.user.id, "system"]),
							eq(orders.status, "LISTA_PARA_COBRO"),
						),
					)
					.returning();

				if (!orderData) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message:
							"Orden no encontrada o no disponible para cobro (ya fue pagada o no está lista)",
					});
				}

				const items = await tx
					.select()
					.from(orderItems)
					.where(eq(orderItems.order_id, input.orderId));

				for (const item of items) {
					if (item.product_id) {
						const [product] = await tx
							.select()
							.from(products)
							.where(eq(products.id, item.product_id))
							.limit(1);

						if (product) {
							const currentStockKg = Number(product.stock_kg);
							const itemQuantityKg = item.quantity_kg
								? Number(item.quantity_kg)
								: 0;
							const newStockKg = currentStockKg - itemQuantityKg;
							const nextPieces = item.quantity_pieces
								? product.stock_pieces - item.quantity_pieces
								: product.stock_pieces;
							const nextWeighedPieces = Math.min(
								product.weighed_pieces ?? 0,
								nextPieces,
							);

							// Pieza ya pesada y lista para entrega: el cobro no se bloquea por stock.
							await tx
								.update(products)
								.set({
									stock_pieces: nextPieces,
									weighed_pieces: Math.max(0, nextWeighedPieces),
									stock_kg: newStockKg.toFixed(3),
									// Stock puede quedar negativo: se compensa al despiezar.
								})
								.where(eq(products.id, item.product_id));

							await tx.insert(inventoryTransactions).values({
								product_id: item.product_id,
								quantity_change_pieces: item.quantity_pieces
									? -item.quantity_pieces
									: null,
								quantity_change_kg:
									itemQuantityKg > 0 ? (-itemQuantityKg).toFixed(3) : null,
								transaction_type: "VENTA",
								reference_id: input.orderId,
								notes: `Venta pedido #${input.orderId}`,
							});
						}
					}
				}

				await tx
					.update(orders)
					.set({ status: "COMPLETADA" })
					.where(eq(orders.id, input.orderId));

				await tx.insert(transactions).values({
					order_id: input.orderId,
					payment_method_id: input.paymentMethodId,
					// total_amount ya está en centavos (misma convención que el path de creación)
					amount: Math.round(Number(orderData.total_amount)),
					user_uid: ctx.user.id,
					status: "completed",
					category: "selling",
					type: "income",
					description: `Cobro final pedido #${input.orderId}`,
				});

				return { success: true };
			});
		}),

	// Liquidar pedido A CRÉDITO: descuenta inventario y crea cuenta por cobrar
	completeOrderOnCredit: protectedProcedure
		.input(z.object({ orderId: z.number() }))
		.output(z.object({ success: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			return db.transaction(async (tx) => {
				const [orderData] = await tx
					.update(orders)
					.set({ status: "PROCESANDO_PAGO" })
					.where(
						and(
							eq(orders.id, input.orderId),
							inArray(orders.user_uid, [ctx.user.id, "system"]),
							eq(orders.status, "LISTA_PARA_COBRO"),
						),
					)
					.returning();

				if (!orderData) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message:
							"Orden no encontrada o no disponible para cobro (ya fue pagada o no está lista)",
					});
				}

				if (!orderData.customer_id) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "El pedido no tiene cliente; no se puede dejar a crédito",
					});
				}

				const items = await tx
					.select()
					.from(orderItems)
					.where(eq(orderItems.order_id, input.orderId));

				for (const item of items) {
					if (item.product_id) {
						const [product] = await tx
							.select()
							.from(products)
							.where(eq(products.id, item.product_id))
							.limit(1);
						if (product) {
							const currentStockKg = Number(product.stock_kg);
							const itemQuantityKg = item.quantity_kg
								? Number(item.quantity_kg)
								: 0;
							const newStockKg = currentStockKg - itemQuantityKg;
							const nextPieces = item.quantity_pieces
								? product.stock_pieces - item.quantity_pieces
								: product.stock_pieces;
							const nextWeighedPieces = Math.min(
								product.weighed_pieces ?? 0,
								nextPieces,
							);
							// El stock puede quedar negativo: se compensa al despiezar.
							await tx
								.update(products)
								.set({
									stock_pieces: nextPieces,
									weighed_pieces: Math.max(0, nextWeighedPieces),
									stock_kg: newStockKg.toFixed(3),
								})
								.where(eq(products.id, item.product_id));

							await tx.insert(inventoryTransactions).values({
								product_id: item.product_id,
								quantity_change_pieces: item.quantity_pieces
									? -item.quantity_pieces
									: null,
								quantity_change_kg:
									itemQuantityKg > 0 ? (-itemQuantityKg).toFixed(3) : null,
								transaction_type: "VENTA",
								reference_id: input.orderId,
								notes: `Venta a crédito pedido #${input.orderId}`,
							});
						}
					}
				}

				await tx
					.update(orders)
					.set({ status: "COMPLETADA" })
					.where(eq(orders.id, input.orderId));

				// Cargo a la cuenta del cliente (cobranza). total_amount está en centavos → pesos
				await tx.insert(creditCharges).values({
					customer_id: orderData.customer_id,
					order_id: input.orderId,
					amount: (Number(orderData.total_amount) / 100).toFixed(2),
					concept: `Pedido #${input.orderId} (crédito)`,
					source: "pedido",
				});

				return { success: true };
			});
		}),

	// Convierte un pedido ya cobrado (contado) a CRÉDITO: revierte el ingreso
	// en efectivo y crea la cuenta por cobrar en Cobranza.
	convertToCredit: protectedProcedure
		.input(z.object({ orderId: z.number() }))
		.output(z.object({ success: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			return db.transaction(async (tx) => {
				const [order] = await tx
					.select()
					.from(orders)
					.where(
						and(
							eq(orders.id, input.orderId),
							inArray(orders.user_uid, [ctx.user.id, "system"]),
						),
					)
					.limit(1);
				if (!order) {
					throw new TRPCError({ code: "NOT_FOUND", message: "Pedido no encontrado" });
				}
				if (order.status !== "COMPLETADA") {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Solo pedidos ya cobrados/completados pueden pasar a crédito",
					});
				}
				if (!order.customer_id) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "El pedido no tiene cliente",
					});
				}
				const [existing] = await tx
					.select({ id: creditCharges.id })
					.from(creditCharges)
					.where(eq(creditCharges.order_id, input.orderId))
					.limit(1);
				if (existing) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Este pedido ya está en crédito",
					});
				}
				// Revierte el ingreso en efectivo (elimina la transacción del pedido)
				await tx.delete(transactions).where(eq(transactions.order_id, input.orderId));
				// Crea la cuenta por cobrar
				await tx.insert(creditCharges).values({
					customer_id: order.customer_id,
					order_id: input.orderId,
					amount: (Number(order.total_amount) / 100).toFixed(2),
					concept: `Pedido #${input.orderId} (pasó a crédito)`,
					source: "pedido",
				});
				return { success: true };
			});
		}),

	// Pedidos ya pesados, listos para cobro, con precio guardado del cliente
	getReadyToCharge: protectedProcedure
		.input(z.void())
		.query(async ({ ctx }) => {
			const ords = await db
				.select({
					id: orders.id,
					customerId: orders.customer_id,
					customerName: customers.name,
					totalAmount: orders.total_amount,
					createdAt: orders.created_at,
				})
				.from(orders)
				.leftJoin(customers, eq(customers.id, orders.customer_id))
				.where(
					and(
						inArray(orders.user_uid, [ctx.user.id, "system"]),
						eq(orders.status, "LISTA_PARA_COBRO"),
					),
				)
				.orderBy(orders.id);

			const result = [];
			for (const o of ords) {
				const items = await db
					.select({
						id: orderItems.id,
						productId: orderItems.product_id,
						productName: orderItems.product_name,
						quantityKg: orderItems.quantity_kg,
						quantityPieces: orderItems.quantity_pieces,
						unitPrice: orderItems.unit_price,
						savedPriceKg: customerPrices.price_per_kg,
					})
					.from(orderItems)
					.leftJoin(
						customerPrices,
						and(
							eq(customerPrices.product_id, orderItems.product_id),
							eq(customerPrices.customer_id, o.customerId ?? 0),
						),
					)
					.where(eq(orderItems.order_id, o.id));
				result.push({ ...o, items });
			}
			return result;
		}),

	// Aplica precios por kg, guarda en lista del cliente, descuenta inventario y cobra
	priceAndCharge: protectedProcedure
		.input(
			z.object({
				orderId: z.number(),
				paymentType: z.enum(["contado", "credito"]),
				paymentMethodId: z.number().optional(),
				items: z.array(
					z.object({
						orderItemId: z.number(),
						productId: z.number().nullable(),
						pricePerKg: z.number().min(0),
					}),
				),
			}),
		)
		.output(z.object({ success: z.boolean(), total: z.number() }))
		.mutation(async ({ ctx, input }) => {
			return db.transaction(async (tx) => {
				const [orderData] = await tx
					.update(orders)
					.set({ status: "PROCESANDO_PAGO" })
					.where(
						and(
							eq(orders.id, input.orderId),
							inArray(orders.user_uid, [ctx.user.id, "system"]),
							eq(orders.status, "LISTA_PARA_COBRO"),
						),
					)
					.returning();
				if (!orderData) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Pedido no disponible para cobro (ya cobrado o no está listo)",
					});
				}

				// 1. Precio por item + guardar en lista del cliente
				let totalCents = 0;
				for (const it of input.items) {
					const [oi] = await tx
						.select()
						.from(orderItems)
						.where(eq(orderItems.id, it.orderItemId))
						.limit(1);
					if (!oi) continue;
					const kg = Number(oi.quantity_kg) || 0;
					const unitPriceCents = Math.round(it.pricePerKg * 100);
					const subtotalCents = Math.round(kg * it.pricePerKg * 100);
					totalCents += subtotalCents;
					await tx
						.update(orderItems)
						.set({ unit_price: unitPriceCents, subtotal: subtotalCents })
						.where(eq(orderItems.id, it.orderItemId));

					if (it.productId && orderData.customer_id) {
						await tx
							.insert(customerPrices)
							.values({
								customer_id: orderData.customer_id,
								product_id: it.productId,
								price_per_kg: it.pricePerKg.toFixed(2),
							})
							.onConflictDoUpdate({
								target: [customerPrices.customer_id, customerPrices.product_id],
								set: {
									price_per_kg: it.pricePerKg.toFixed(2),
									updated_at: new Date(),
								},
							});
					}
				}

				await tx
					.update(orders)
					.set({ total_amount: totalCents })
					.where(eq(orders.id, input.orderId));

				// 2. Descontar inventario
				const allItems = await tx
					.select()
					.from(orderItems)
					.where(eq(orderItems.order_id, input.orderId));
				for (const item of allItems) {
					if (item.product_id) {
						const [product] = await tx
							.select()
							.from(products)
							.where(eq(products.id, item.product_id))
							.limit(1);
						if (product) {
							const itemQuantityKg = item.quantity_kg ? Number(item.quantity_kg) : 0;
							// La pieza ya fue pesada y está físicamente lista para entrega:
							// el cobro NO se bloquea por stock. Se descuenta sin bajar de 0.
							// Stock puede quedar negativo: se compensa al despiezar.
							const finalStockKg = Number(product.stock_kg) - itemQuantityKg;
							const finalPieces = item.quantity_pieces
								? product.stock_pieces - item.quantity_pieces
								: product.stock_pieces;
							await tx
								.update(products)
								.set({
									stock_pieces: finalPieces,
									weighed_pieces: Math.max(0, Math.min(product.weighed_pieces ?? 0, finalPieces)),
									stock_kg: finalStockKg.toFixed(3),
								})
								.where(eq(products.id, item.product_id));
							await tx.insert(inventoryTransactions).values({
								product_id: item.product_id,
								quantity_change_pieces: item.quantity_pieces ? -item.quantity_pieces : null,
								quantity_change_kg: itemQuantityKg > 0 ? (-itemQuantityKg).toFixed(3) : null,
								transaction_type: "VENTA",
								reference_id: input.orderId,
								notes: `Venta pedido #${input.orderId}`,
							});
						}
					}
				}

				// 3. Completar + pago
				await tx
					.update(orders)
					.set({ status: "COMPLETADA" })
					.where(eq(orders.id, input.orderId));

				if (input.paymentType === "credito") {
					if (!orderData.customer_id) {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message: "El pedido no tiene cliente; no se puede dejar a crédito",
						});
					}
					await tx.insert(creditCharges).values({
						customer_id: orderData.customer_id,
						order_id: input.orderId,
						amount: (totalCents / 100).toFixed(2),
						concept: `Pedido #${input.orderId} (crédito)`,
						source: "pedido",
					});
				} else if (input.paymentMethodId) {
					await tx.insert(transactions).values({
						order_id: input.orderId,
						payment_method_id: input.paymentMethodId,
						amount: totalCents,
						user_uid: ctx.user.id,
						status: "completed",
						category: "selling",
						type: "income",
						description: `Cobro pedido #${input.orderId}`,
					});
				}

				return { success: true, total: totalCents };
			});
		}),

	update: protectedProcedure
		.meta({
			openapi: {
				method: "PATCH",
				path: "/orders/{id}",
				tags: ["Orders"],
				summary: "Update an order",
			},
		})
		.input(
			z.object({
				id: z.number(),
				total_amount: z.number().optional(),
				status: z
					.enum([
						"COMPLETADA",
						"pending",
						"cancelled",
						"PENDIENTE_PESAJE",
						"LISTA_PARA_COBRO",
					])
					.optional(),
			}),
		)
		.output(orderWithCustomerSchema)
		.mutation(async ({ ctx, input }) => {
			const { id, total_amount, ...data } = input;
			const updateData: any = {
				...data,
				user_uid: ctx.user.id,
				updated_at: new Date(),
			};
			if (total_amount !== undefined)
				updateData.total_amount = total_amount.toFixed(2);

			const [updated] = await db
				.update(orders)
				.set(updateData)
				.where(and(eq(orders.id, id), inArray(orders.user_uid, [ctx.user.id, "system"])))
				.returning();

			const customer = updated?.customer_id
				? await db.query.customers.findFirst({
						where: eq(customers.id, updated.customer_id),
						columns: { name: true },
					})
				: null;

			return { ...updated, customer: customer ?? null };
		}),

	// Crea un "pedido" de pesaje de producción: entra a la cola de la estación
	// de pesaje (sin cliente, etiquetado como Pesaje de producción) para pesarlo
	// pieza por pieza en el mismo flujo.
	createProductionWeighing: protectedProcedure
		.input(
			z.object({
				productId: z.number(),
				productName: z.string().min(1),
				// Opcional: productos a granel (DESGRASE, HUESO PELON…) se pesan por
				// tara sin contar piezas.
				pieces: z.number().int().min(0).nullable().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return db.transaction(async (tx) => {
				const [ord] = await tx
					.insert(orders)
					.values({
						customer_id: null,
						total_amount: "0.00",
						user_uid: ctx.user.id,
						status: "PENDIENTE_PESAJE",
						requires_weighing: true,
						notes: "Pesaje de producción",
					})
					.returning();

				await tx.insert(orderItems).values({
					order_id: ord.id,
					product_id: input.productId,
					product_name: input.productName,
					quantity_pieces: input.pieces && input.pieces > 0 ? input.pieces : null,
					quantity_kg: null,
					unit_price: "0.00",
					subtotal: "0.00",
					status: "PENDIENTE_PESAJE",
				});

				return { id: ord.id };
			});
		}),

	// Reemplaza por completo los renglones de un pedido (editar productos,
	// piezas, kg y precios). Recalcula total y si requiere pesaje. Útil cuando
	// el cliente cambia el pedido por teléfono.
	replaceItems: protectedProcedure
		.input(
			z.object({
				orderId: z.number(),
				customerId: z.number().nullable().optional(),
				notes: z.string().optional(),
				status: z
					.enum([
						"COMPLETADA",
						"pending",
						"cancelled",
						"PENDIENTE_PESAJE",
						"LISTA_PARA_COBRO",
					])
					.optional(),
				items: z.array(
					z.object({
						productId: z.number().nullable().optional(),
						productName: z.string().min(1),
						quantityPieces: z.number().min(0).default(0),
						quantityKg: z.number().min(0).default(0),
						unitPrice: z.number().min(0).default(0), // pesos por kg/pieza
					}),
				),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return db.transaction(async (tx) => {
				const [ord] = await tx
					.select({ id: orders.id })
					.from(orders)
					.where(
						and(
							eq(orders.id, input.orderId),
							inArray(orders.user_uid, [ctx.user.id, "system"]),
						),
					)
					.limit(1);
				if (!ord) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Pedido no encontrado",
					});
				}

				const rows = input.items
					.filter((it) => it.productName.trim().length > 0)
					.map((it) => {
						const kg = it.quantityKg || 0;
						const pieces = Math.round(it.quantityPieces || 0);
						const unitCents = Math.round((it.unitPrice || 0) * 100);
						const qty = kg > 0 ? kg : pieces;
						const subtotalCents = Math.round(qty * unitCents);
						return {
							order_id: input.orderId,
							product_id: it.productId ?? null,
							product_name: it.productName.trim(),
							quantity_pieces: pieces,
							quantity_kg: kg > 0 ? kg.toFixed(3) : null,
							unit_price: unitCents.toFixed(2),
							subtotal: subtotalCents.toFixed(2),
							status: (kg > 0 ? "PESADO" : "PENDIENTE_PESAJE") as
								| "PESADO"
								| "PENDIENTE_PESAJE",
						};
					});

				const totalCents = rows.reduce((s, r) => s + Number(r.subtotal), 0);
				const requiresWeighing = rows.some(
					(r) => r.status === "PENDIENTE_PESAJE",
				);

				await tx
					.delete(orderItems)
					.where(eq(orderItems.order_id, input.orderId));
				if (rows.length > 0) {
					await tx.insert(orderItems).values(rows);
				}

				const upd: Record<string, unknown> = {
					total_amount: totalCents.toFixed(2),
					requires_weighing: requiresWeighing,
					updated_at: new Date(),
				};
				if (input.status) upd.status = input.status;
				if (input.customerId !== undefined)
					upd.customer_id = input.customerId;
				if (input.notes !== undefined) upd.notes = input.notes;

				await tx
					.update(orders)
					.set(upd)
					.where(eq(orders.id, input.orderId));

				// Refleja el cambio en el dinero del sistema si el pedido ya estaba
				// cobrado: a crédito (cuenta por cobrar) o de contado (venta).
				const totalPesos = (totalCents / 100).toFixed(2);
				const adjustedCredit = await tx
					.update(creditCharges)
					.set({ amount: totalPesos })
					.where(eq(creditCharges.order_id, input.orderId))
					.returning({ id: creditCharges.id });

				const adjustedSale = await tx
					.update(transactions)
					.set({ amount: totalCents })
					.where(eq(transactions.order_id, input.orderId))
					.returning({ id: transactions.id });

				return {
					success: true,
					total: totalCents,
					adjustedCredit: adjustedCredit.length,
					adjustedSale: adjustedSale.length,
				};
			});
		}),

	delete: protectedProcedure
		.meta({
			openapi: {
				method: "DELETE",
				path: "/orders/{id}",
				tags: ["Orders"],
				summary: "Delete an order and its items",
			},
		})
		.input(z.object({ id: z.number() }))
		.output(z.object({ success: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			await db.transaction(async (tx) => {
				await tx.delete(orderItems).where(eq(orderItems.order_id, input.id));
				await tx
					.delete(orders)
					.where(
						and(eq(orders.id, input.id), inArray(orders.user_uid, [ctx.user.id, "system"])),
					);
			});
			return { success: true };
		}),
});
