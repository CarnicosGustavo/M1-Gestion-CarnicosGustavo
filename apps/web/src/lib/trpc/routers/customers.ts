import { z } from "zod/v4";
import { protectedProcedure, router } from "../init";
import { db } from "@/lib/db";
import {
	customers,
	orders,
	creditCharges,
	creditPayments,
	customerPrices,
	creditAccounts,
} from "@/lib/db/schema";
import { eq, and, or, desc, sql, inArray } from "drizzle-orm";

const customerSchema = z.object({
  id: z.number(),
  name: z.string().nullable(),
  contact_name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  whatsapp_phone: z.string().nullable(),
  address: z.string().nullable(),
  notes: z.string().nullable(),
  status: z.string().nullable(),
  user_uid: z.string().nullable(),
  created_at: z.date().nullable(),
});

export const customersRouter = router({
  list: protectedProcedure
    .meta({ openapi: { method: "GET", path: "/customers", tags: ["Customers"], summary: "List all customers" } })
    .input(z.void())
    .output(z.array(customerSchema))
    .query(async ({ ctx }) => {
      // Incluye los clientes propios del usuario Y los creados desde la web
      // (pedidos web se sincronizan con user_uid = 'system')
      return db
        .select()
        .from(customers)
        .where(or(eq(customers.user_uid, ctx.user.id), eq(customers.user_uid, "system")));
    }),

  create: protectedProcedure
    .meta({ openapi: { method: "POST", path: "/customers", tags: ["Customers"], summary: "Create a customer" } })
    .input(
      z.object({
        name: z.string().min(1),
        contact_name: z.string().optional(),
        email: z.string().email(),
        phone: z.string().optional(),
        whatsapp_phone: z.string().optional(),
        address: z.string().optional(),
        notes: z.string().optional(),
        status: z.enum(["active", "inactive"]).optional(),
        // Crédito (del diseño): si se define un límite, se crea su cuenta de crédito.
        credit_limit: z.number().nonnegative().optional(),
        terms_days: z.number().int().nonnegative().optional(),
      })
    )
    .output(customerSchema)
    .mutation(async ({ ctx, input }) => {
      const { credit_limit, terms_days, ...customerData } = input;
      const [data] = await db
        .insert(customers)
        .values({ ...customerData, user_uid: ctx.user.id })
        .returning();
      // Cliente a crédito: crea la cuenta de crédito que usa Cobranza.
      if (credit_limit !== undefined) {
        await db.insert(creditAccounts).values({
          customer_id: data.id,
          credit_limit: String(credit_limit),
          terms_days: terms_days ?? 0,
        });
      }
      return data;
    }),

  update: protectedProcedure
    .meta({ openapi: { method: "PATCH", path: "/customers/{id}", tags: ["Customers"], summary: "Update a customer" } })
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        contact_name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        whatsapp_phone: z.string().optional(),
        address: z.string().optional(),
        notes: z.string().optional(),
        status: z.enum(["active", "inactive"]).optional(),
        // Crédito (del diseño): upsert de la cuenta de crédito si se define límite.
        credit_limit: z.number().nonnegative().optional(),
        terms_days: z.number().int().nonnegative().optional(),
      })
    )
    .output(customerSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, credit_limit, terms_days, ...data } = input;
      // Permite editar tambien clientes creados desde la web (user_uid='system')
      const [updated] = await db
        .update(customers)
        .set(data)
        .where(
          and(
            eq(customers.id, id),
            inArray(customers.user_uid, [ctx.user.id, "system"]),
          ),
        )
        .returning();
      // Upsert de la cuenta de crédito (la usa Cobranza) si se define un límite.
      if (credit_limit !== undefined) {
        const [existing] = await db
          .select({ id: creditAccounts.id })
          .from(creditAccounts)
          .where(eq(creditAccounts.customer_id, id))
          .limit(1);
        if (existing) {
          await db
            .update(creditAccounts)
            .set({
              credit_limit: String(credit_limit),
              terms_days: terms_days ?? 0,
              updated_at: new Date(),
            })
            .where(eq(creditAccounts.id, existing.id));
        } else {
          await db.insert(creditAccounts).values({
            customer_id: id,
            credit_limit: String(credit_limit),
            terms_days: terms_days ?? 0,
          });
        }
      }
      return updated;
    }),

  delete: protectedProcedure
    .meta({ openapi: { method: "DELETE", path: "/customers/{id}", tags: ["Customers"], summary: "Delete a customer" } })
    .input(z.object({ id: z.number() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(customers)
        .where(and(eq(customers.id, input.id), eq(customers.user_uid, ctx.user.id)));
      return { success: true };
    }),

  // Ficha completa del cliente: datos + pedidos + saldo + nº de precios propios
  getDetail: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const [customer] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, input.id))
        .limit(1);
      if (!customer) return null;

      const ords = await db
        .select({
          id: orders.id,
          status: orders.status,
          total_amount: orders.total_amount,
          created_at: orders.created_at,
        })
        .from(orders)
        .where(eq(orders.customer_id, input.id))
        .orderBy(desc(orders.id))
        .limit(100);

      const ordersList = ords.map((o) => ({
        id: o.id,
        status: o.status as string,
        totalAmount: Number(o.total_amount) || 0,
        createdAt: o.created_at,
      }));

      const isPaid = (s: string) => s === "COMPLETADA" || s === "completed";
      const totalSpent = ordersList
        .filter((o) => isPaid(o.status))
        .reduce((sum, o) => sum + o.totalAmount, 0);

      const [{ charges }] = await db
        .select({ charges: sql<number>`COALESCE(SUM(${creditCharges.amount}),0)` })
        .from(creditCharges)
        .where(eq(creditCharges.customer_id, input.id));
      const [{ payments }] = await db
        .select({ payments: sql<number>`COALESCE(SUM(${creditPayments.amount}),0)` })
        .from(creditPayments)
        .where(eq(creditPayments.customer_id, input.id));
      const balance = Number(charges) - Number(payments);

      const [{ priceCount }] = await db
        .select({ priceCount: sql<number>`COUNT(*)` })
        .from(customerPrices)
        .where(eq(customerPrices.customer_id, input.id));

      return {
        customer: {
          id: customer.id,
          name: customer.name as string | null,
          email: customer.email as string | null,
          phone: customer.phone as string | null,
          whatsappPhone: (customer as any).whatsapp_phone as string | null,
          address: (customer as any).address as string | null,
          status: customer.status as string | null,
        },
        orders: ordersList,
        totalOrders: ordersList.length,
        totalSpent,
        balance,
        customPriceCount: Number(priceCount),
      };
    }),
});
