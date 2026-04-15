import { TRPCError } from "@trpc/server";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { purchaseOrders, orderItems, orders } from "@/lib/db/schema";
import { protectedProcedure, almacenProcedure, router } from "../init";

const purchaseOrderSchema = z.object({
	id: z.number(),
	order_id: z.number(),
	status: z.string(),
	notes: z.string().nullable(),
	created_by: z.string(),
	created_at: z.date().nullable(),
	updated_at: z.date().nullable(),
});

export const purchaseOrdersRouter = router({
	list: protectedProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/purchase-orders",
				tags: ["Purchase Orders"],
				summary: "List purchase orders",
			},
		})
		.input(
			z
				.object({
					status: z.enum(["PENDIENTE", "PARCIAL", "COMPLETO"]).optional(),
				})
				.optional(),
		)
		.output(z.array(purchaseOrderSchema))
		.query(async ({ ctx, input }) => {
			return db
				.select()
				.from(purchaseOrders)
				.where(
					and(
						eq(purchaseOrders.created_by, ctx.user.id),
						input?.status
							? eq(purchaseOrders.status, input.status)
							: undefined,
					),
				)
				.orderBy(desc(purchaseOrders.created_at));
		}),

	resolve: almacenProcedure
		.meta({
			openapi: {
				method: "POST",
				path: "/purchase-orders/{id}/resolve",
				tags: ["Purchase Orders"],
				summary: "Mark purchase order items as received",
			},
		})
		.input(z.object({ id: z.number() }))
		.output(z.object({ success: z.boolean(), itemsResolved: z.number() }))
		.mutation(async ({ ctx, input }) => {
			return db.transaction(async (tx) => {
				const [po] = await tx
					.select()
					.from(purchaseOrders)
					.where(
						and(
							eq(purchaseOrders.id, input.id),
							eq(purchaseOrders.created_by, ctx.user.id),
						),
					)
					.limit(1);

				if (!po) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Orden de compra no encontrada",
					});
				}

				if (po.status === "COMPLETO") {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Esta orden de compra ya fue completada",
					});
				}

				// Transition all PENDIENTE_COMPRA items for this order to COMPLETADO
				const pendingItems = await tx
					.select()
					.from(orderItems)
					.where(
						and(
							eq(orderItems.order_id, po.order_id),
							eq(orderItems.status, "PENDIENTE_COMPRA"),
						),
					);

				for (const item of pendingItems) {
					await tx
						.update(orderItems)
						.set({ status: "COMPLETADO" })
						.where(eq(orderItems.id, item.id));
				}

				// Mark purchase order as complete
				await tx
					.update(purchaseOrders)
					.set({
						status: "COMPLETO",
						updated_at: new Date(),
					})
					.where(eq(purchaseOrders.id, input.id));

				// Check if the parent order can now transition
				const allItems = await tx
					.select()
					.from(orderItems)
					.where(eq(orderItems.order_id, po.order_id));

				const hasPendingWeighing = allItems.some(
					(i) => i.status === "PENDIENTE_PESAJE",
				);
				const hasPendingPurchase = allItems.some(
					(i) => i.status === "PENDIENTE_COMPRA",
				);

				if (!hasPendingPurchase && !hasPendingWeighing) {
					await tx
						.update(orders)
						.set({ status: "LISTA_PARA_COBRO" })
						.where(eq(orders.id, po.order_id));
				} else if (!hasPendingPurchase && hasPendingWeighing) {
					await tx
						.update(orders)
						.set({ status: "PENDIENTE_PESAJE" })
						.where(eq(orders.id, po.order_id));
				}

				return { success: true, itemsResolved: pendingItems.length };
			});
		}),
});
