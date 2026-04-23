import { z } from "zod/v4";
import { protectedProcedure, router } from "../init";
import { db } from "@/lib/db";
import { orders, orderItems, customers, products } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const ticketsRouter = router({
  generateTicket: protectedProcedure
    .meta({ openapi: { method: "GET", path: "/tickets/{orderId}", tags: ["Tickets"], summary: "Generate receipt ticket (non-fiscal)" } })
    .input(z.object({ orderId: z.number() }))
    .output(z.object({
      ticketNumber: z.string(),
      orderNumber: z.number(),
      customerName: z.string().nullable(),
      date: z.date(),
      items: z.array(z.object({
        productName: z.string(),
        quantity: z.number().nullable(),
        quantityPieces: z.number().nullable(),
        quantityKg: z.string().nullable(),
        unitPrice: z.string(),
        subtotal: z.string(),
      })),
      totalAmount: z.string(),
      status: z.string(),
      notes: z.string().nullable(),
    }))
    .query(async ({ ctx, input }) => {
      const order = await db.query.orders.findFirst({
        where: and(eq(orders.id, input.orderId), eq(orders.user_uid, ctx.user.id)),
        with: {
          customer: true,
          orderItems: true,
        },
      });

      if (!order) {
        throw new Error(`Pedido ${input.orderId} no encontrado`);
      }

      return {
        ticketNumber: `TKT-${String(order.id).padStart(6, "0")}`,
        orderNumber: order.id,
        customerName: order.customer?.name ?? null,
        date: order.created_at ?? new Date(),
        items: order.orderItems.map((item) => ({
          productName: item.product_name,
          quantity: item.quantity,
          quantityPieces: item.quantity_pieces,
          quantityKg: item.quantity_kg as string | null,
          unitPrice: String(item.unit_price),
          subtotal: String(item.subtotal),
        })),
        totalAmount: String(order.total_amount),
        status: order.status,
        notes: order.notes,
      };
    }),
});
