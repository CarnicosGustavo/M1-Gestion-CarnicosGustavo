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
	purchaseOrders,
} from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
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
				let hasPendingPurchase = false;
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

					// NUEVO: Si requiresPurchase, marcar como PENDIENTE_COMPRA
					if (item.requiresPurchase) {
						itemStatus = "PENDIENTE_COMPRA";
						hasPendingPurchase = true;
						// El subtotal se calcula pero no se incluye en el total hasta que se compre
						if (quantityKg) {
							subtotal = Math.round((quantityKg * item.unitPrice) / 1000);
							quantityKg = (quantityKg / 1000).toFixed(3) as any;
						} else if (item.quantityPieces) {
							subtotal = item.quantityPieces * item.unitPrice;
						}
					} else if (
						product.is_sellable_by_weight &&
						(!quantityKg || quantityKg === 0)
					) {
						itemStatus = "PENDIENTE_PESAJE";
						requiresWeighing = true;
						quantityKg = null;
						subtotal = 0;
					} else if (quantityKg) {
						subtotal = Math.round((quantityKg * item.unitPrice) / 1000);
						quantityKg = (quantityKg / 1000).toFixed(3) as any;
					} else if (item.quantityPieces) {
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

				// Calcular total: solo incluir items que NO están PENDIENTE_COMPRA
				const totalAmount = processedItems
					.filter((i) => i.status !== "PENDIENTE_COMPRA")
					.reduce((sum, i) => sum + Number(i.subtotal), 0);
				const orderStatus = requiresWeighing
					? "PENDIENTE_PESAJE"
					: hasPendingPurchase
						? "PARCIAL_DISPONIBLE"
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

				// NUEVO: Si hay items PENDIENTE_COMPRA, crear entrada en purchaseOrders
				const purchaseItems = processedItems.filter(
					(i) => i.status === "PENDIENTE_COMPRA",
				);
				if (purchaseItems.length > 0) {
					await tx.insert(purchaseOrders).values({
						order_id: orderData.id,
						status: "PENDIENTE",
						notes: `${purchaseItems.length} productos sin stock en pedido #${orderData.id}`,
						created_by: ctx.user.id,
					});
				}

				if (!requiresWeighing && !hasPendingPurchase && input.paymentMethodId) {
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

				await tx
					.update(orders)
					.set({
						total_amount: newTotal,
						status: allWeighed ? "LISTA_PARA_COBRO" : "PENDIENTE_PESAJE",
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

							if (newStockKg < 0) {
								throw new TRPCError({
									code: "PRECONDITION_FAILED",
									message: `Stock insuficiente de ${product.name}: se requieren ${itemQuantityKg.toFixed(3)} kg pero solo hay ${currentStockKg.toFixed(3)} kg disponibles`,
								});
							}

							await tx
								.update(products)
								.set({
									stock_pieces: nextPieces,
									weighed_pieces: nextWeighedPieces,
									stock_kg: newStockKg.toFixed(3),
									// Note: in_stock is deprecated and kept for compatibility
									// It should only contain whole kg values (integer)
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
