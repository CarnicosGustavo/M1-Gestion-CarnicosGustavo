import { and, eq, or } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { creditCharges, orders, transactions } from "@/lib/db/schema";
import { protectedProcedure, router } from "../init";

export const ticketsRouter = router({
	generateTicket: protectedProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/tickets/{orderId}",
				tags: ["Tickets"],
				summary: "Generate receipt ticket (non-fiscal)",
			},
		})
		.input(z.object({ orderId: z.number() }))
		.output(
			z.object({
				ticketNumber: z.string(),
				orderNumber: z.number(),
				customerName: z.string().nullable(),
				customerCode: z.string(),
				customerPhone: z.string().nullable(),
				date: z.date(),
				items: z.array(
					z.object({
						productName: z.string().nullable(),
						quantity: z.number().nullable(),
						quantityPieces: z.number().nullable(),
						quantityKg: z.string().nullable(),
						unitPrice: z.string(),
						subtotal: z.string(),
					}),
				),
				totalKg: z.number(),
				totalAmount: z.string(),
				amountPaid: z.number(),
				amountDue: z.number(),
				paymentStatus: z.enum(["PAGADO", "CREDITO", "PENDIENTE", "PARCIAL"]),
				status: z.string().nullable(),
				notes: z.string().nullable(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const order = await db.query.orders.findFirst({
				where: and(
					eq(orders.id, input.orderId),
					or(eq(orders.user_uid, ctx.user.id), eq(orders.user_uid, "system")),
				),
				with: {
					customer: true,
					orderItems: true,
				},
			});

			if (!order) {
				throw new Error(`Pedido ${input.orderId} no encontrado`);
			}

			const totalCents = Number(order.total_amount) || 0;
			const totalPesos = totalCents / 100;

			// R4-5: amountPaid es la suma real de ingresos de contado (centavos →
			// pesos), no el total del pedido. amountDue = total − cobrado − crédito.
			const incomeRows = await db
				.select({ amount: transactions.amount })
				.from(transactions)
				.where(
					and(
						eq(transactions.order_id, order.id),
						eq(transactions.type, "income"),
					),
				);
			const creditRows = await db
				.select({ amount: creditCharges.amount })
				.from(creditCharges)
				.where(eq(creditCharges.order_id, order.id));

			const amountPaid =
				incomeRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0) / 100;
			const creditPesos = creditRows.reduce(
				(sum, row) => sum + Number(row.amount ?? 0),
				0,
			);
			const amountDue = Math.max(0, totalPesos - amountPaid - creditPesos);
			let paymentStatus: "PAGADO" | "CREDITO" | "PENDIENTE" | "PARCIAL" =
				"PENDIENTE";
			if (amountDue > 0 && (amountPaid > 0 || creditPesos > 0)) {
				paymentStatus = "PARCIAL";
			} else if (amountPaid > 0) {
				paymentStatus = "PAGADO";
			} else if (creditPesos > 0) {
				paymentStatus = "CREDITO";
			}

			const totalKg = order.orderItems.reduce(
				(s, it) => s + (Number(it.quantity_kg) || 0),
				0,
			);

			return {
				ticketNumber: String(order.id).padStart(6, "0"),
				orderNumber: order.id,
				customerName: order.customer?.name ?? null,
				customerCode: String(order.customer_id ?? 0).padStart(6, "0"),
				customerPhone:
					(order.customer?.whatsapp_phone as string | null) ??
					(order.customer?.phone as string | null) ??
					null,
				date: order.created_at ?? new Date(),
				items: order.orderItems.map((item) => ({
					productName: item.product_name,
					quantity: item.quantity,
					quantityPieces: item.quantity_pieces,
					quantityKg: item.quantity_kg as string | null,
					unitPrice: String(item.unit_price),
					subtotal: String(item.subtotal),
				})),
				totalKg,
				totalAmount: String(order.total_amount),
				amountPaid,
				amountDue,
				paymentStatus,
				status: order.status,
				notes: order.notes,
			};
		}),
});
