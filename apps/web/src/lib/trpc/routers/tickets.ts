import { z } from "zod/v4";
import { protectedProcedure, router } from "../init";
import { db } from "@/lib/db";
import {
	orders,
	orderItems,
	customers,
	products,
	creditCharges,
	transactions,
} from "@/lib/db/schema";
import { eq, and, or } from "drizzle-orm";

export const ticketsRouter = router({
  generateTicket: protectedProcedure
    .meta({ openapi: { method: "GET", path: "/tickets/{orderId}", tags: ["Tickets"], summary: "Generate receipt ticket (non-fiscal)" } })
    .input(z.object({ orderId: z.number() }))
    .output(z.object({
      ticketNumber: z.string(),
      orderNumber: z.number(),
      customerName: z.string().nullable(),
      customerCode: z.string(),
      customerPhone: z.string().nullable(),
      date: z.date(),
      items: z.array(z.object({
        productName: z.string(),
        quantity: z.number().nullable(),
        quantityPieces: z.number().nullable(),
        quantityKg: z.string().nullable(),
        unitPrice: z.string(),
        subtotal: z.string(),
      })),
      totalKg: z.number(),
      totalAmount: z.string(),
      amountPaid: z.number(),
      amountDue: z.number(),
      paymentStatus: z.enum(["PAGADO", "CREDITO", "PENDIENTE"]),
      status: z.string(),
      notes: z.string().nullable(),
    }))
    .query(async ({ ctx, input }) => {
      const order = await db.query.orders.findFirst({
        where: and(eq(orders.id, input.orderId), or(eq(orders.user_uid, ctx.user.id), eq(orders.user_uid, "system"))),
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

      // Estado de cobro del pedido:
      //  - Si hay una transacción de venta (contado): PAGADO = total.
      //  - Si hay un cargo en cuenta por cobrar (crédito): POR COBRAR = total.
      //  - Si no hay ninguno (aún no se cobra): POR COBRAR = total.
      const [txn] = await db
        .select({ id: transactions.id })
        .from(transactions)
        .where(and(eq(transactions.order_id, order.id), eq(transactions.type, "income")))
        .limit(1);
      const charge = order.customer_id
        ? await db.query.creditCharges.findFirst({
            where: eq(creditCharges.order_id, order.id),
          })
        : null;

      let amountPaid = 0;
      let amountDue = totalPesos;
      let paymentStatus: "PAGADO" | "CREDITO" | "PENDIENTE" = "PENDIENTE";
      if (txn) {
        amountPaid = totalPesos;
        amountDue = 0;
        paymentStatus = "PAGADO";
      } else if (charge) {
        amountPaid = 0;
        amountDue = totalPesos;
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
