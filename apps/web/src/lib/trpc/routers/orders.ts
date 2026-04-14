import { z } from "zod/v4";
import { protectedProcedure, router } from "../init";
import { db } from "@/lib/db";
import { orders, orderItems, transactions, customers, products, inventoryTransactions } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

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
  orderItems: z.array(z.object({
    id: z.number(),
    product_id: z.number().nullable(),
    product_name: z.string().nullable(),
    quantity: z.number(),
    quantity_pieces: z.number().nullable(),
    quantity_kg: z.union([z.number(), z.string()]).nullable(),
    unit_price: z.union([z.number(), z.string()]),
    subtotal: z.union([z.number(), z.string()]).nullable(),
    status: z.string(),
    product: z.object({ 
      name: z.string(), 
      category: z.string().nullable(),
      is_sellable_by_weight: z.boolean(),
      is_sellable_by_unit: z.boolean(),
    }).nullable(),
  })),
});

export const ordersRouter = router({
  get: protectedProcedure
    .meta({ openapi: { method: "GET", path: "/orders/{id}", tags: ["Orders"], summary: "Get order details" } })
    .input(z.object({ id: z.number() }))
    .output(orderDetailSchema.nullable())
    .query(async ({ ctx, input }) => {
      const result = await db.query.orders.findFirst({
        where: and(eq(orders.id, input.id), eq(orders.user_uid, ctx.user.id)),
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
                } 
              },
            },
          },
        },
      });
      if (!result) return null;
      return {
        ...result,
        orderItems: result.orderItems.map(item => ({
          ...item,
          product: item.product ?? null
        }))
      };
    }),

  list: protectedProcedure
    .meta({ openapi: { method: "GET", path: "/orders", tags: ["Orders"], summary: "List all orders" } })
    .input(z.void())
    .output(z.array(orderWithCustomerSchema))
    .query(async ({ ctx }) => {
      return db.query.orders.findMany({
        where: eq(orders.user_uid, ctx.user.id),
        with: {
          customer: {
            columns: { name: true },
          },
        },
      });
    }),

  getPendingWeighingOrders: protectedProcedure
    .meta({ openapi: { method: "GET", path: "/orders/pending-weighing", tags: ["Orders"], summary: "Get orders pending weighing" } })
    .input(z.void())
    .output(z.array(orderDetailSchema))
    .query(async ({ ctx }) => {
      const results = await db.query.orders.findMany({
        where: and(
          eq(orders.user_uid, ctx.user.id),
          eq(orders.requires_weighing, true)
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
                } 
              },
            },
          },
        },
      });
      return results.map(order => ({
        ...order,
        orderItems: order.orderItems.map(item => ({
          ...item,
          product: item.product ?? null
        }))
      }));
    }),

  create: protectedProcedure
    .meta({ openapi: { method: "POST", path: "/orders", tags: ["Orders"], summary: "Create an order with items" } })
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
          })
        ),
        notes: z.string().optional(),
        deliveryAddress: z.string().optional(),
        whatsappMessageId: z.string().optional(),
      })
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
            .where(eq(products.id, item.productId))
            .limit(1);

          if (!product) throw new TRPCError({ code: "NOT_FOUND", message: `Producto ${item.productId} no encontrado` });

          let itemStatus = "COMPLETADO";
          let quantityKg = item.quantityKg;
          let subtotal = 0;

          if (product.is_sellable_by_weight && (!quantityKg || quantityKg === 0)) {
            itemStatus = "PENDIENTE_PESAJE";
            requiresWeighing = true;
            quantityKg = null;
            subtotal = 0;
          } else if (quantityKg) {
            subtotal = (quantityKg / 1000) * item.unitPrice;
            quantityKg = (quantityKg / 1000).toFixed(3) as any;
          } else if (item.quantityPieces && product.price_per_piece) {
            subtotal = item.quantityPieces * Number(product.price_per_piece);
          }

          processedItems.push({
            product_id: item.productId,
            product_name: product.name,
            quantity: item.quantityKg ? item.quantityKg / 1000 : item.quantityPieces || 0,
            quantity_pieces: item.quantityPieces,
            quantity_kg: quantityKg,
            unit_price: item.unitPrice.toFixed(2),
            subtotal: subtotal.toFixed(2),
            status: itemStatus,
          });
        }

        const totalAmount = processedItems.reduce((sum, i) => sum + Number(i.subtotal), 0);
        const orderStatus = requiresWeighing ? "PENDIENTE_PESAJE" : "LISTA_PARA_COBRO";

        const [orderData] = await tx
          .insert(orders)
          .values({
            customer_id: input.customerId,
            total_amount: totalAmount.toFixed(2),
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
          }))
        );

        if (!requiresWeighing && input.paymentMethodId) {
          await tx.insert(transactions).values({
            order_id: orderData.id,
            payment_method_id: input.paymentMethodId,
            amount: Math.round(totalAmount * 100), // transactions still use cents? let's check.
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
    .meta({ openapi: { method: "PATCH", path: "/orders/items/{orderItemId}/weight", tags: ["Orders"], summary: "Update order item weight" } })
    .input(z.object({ orderItemId: z.number(), actualWeightKg: z.number().int().positive() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return db.transaction(async (tx) => {
        const [item] = await tx
          .select()
          .from(orderItems)
          .where(eq(orderItems.id, input.orderItemId))
          .limit(1);

        if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Ítem no encontrado" });

        const subtotal = (input.actualWeightKg / 1000) * Number(item.unit_price);
        const actualWeightKg = (input.actualWeightKg / 1000).toFixed(3);

        await tx
          .update(orderItems)
          .set({
            quantity_kg: actualWeightKg,
            subtotal: subtotal.toFixed(2),
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

        const allWeighed = allItems.every(i => 
          i.id === input.orderItemId ? true : i.status !== "PENDIENTE_PESAJE"
        );

        await tx
          .update(orders)
          .set({
            total_amount: newTotal.toFixed(2),
            status: allWeighed ? "LISTA_PARA_COBRO" : "PENDIENTE_PESAJE",
            requires_weighing: !allWeighed,
          })
          .where(eq(orders.id, item.order_id!));

        return { success: true };
      });
    }),

  completeOrderPayment: protectedProcedure
    .meta({ openapi: { method: "POST", path: "/orders/{orderId}/pay", tags: ["Orders"], summary: "Complete order payment and discount inventory" } })
    .input(z.object({ orderId: z.number(), paymentMethodId: z.number() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return db.transaction(async (tx) => {
        const [orderData] = await tx
          .select()
          .from(orders)
          .where(and(eq(orders.id, input.orderId), eq(orders.user_uid, ctx.user.id)))
          .limit(1);

        if (!orderData) throw new TRPCError({ code: "NOT_FOUND", message: "Orden no encontrada" });
        if (orderData.status !== "LISTA_PARA_COBRO") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "La orden debe estar lista para cobro" });
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
              const itemQuantityKg = item.quantity_kg ? Number(item.quantity_kg) : 0;
              const newStockKg = currentStockKg - itemQuantityKg;

              if (newStockKg < 0) {
                throw new TRPCError({
                  code: "PRECONDITION_FAILED",
                  message: `Stock insuficiente de ${product.name}: se requieren ${itemQuantityKg.toFixed(3)} kg pero solo hay ${currentStockKg.toFixed(3)} kg disponibles`,
                });
              }

              await tx
                .update(products)
                .set({
                  stock_pieces: item.quantity_pieces ? product.stock_pieces - item.quantity_pieces : product.stock_pieces,
                  stock_kg: newStockKg.toFixed(3),
                  // Note: in_stock is deprecated and kept for compatibility
                  // It should only contain whole kg values (integer)
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

        await tx
          .update(orders)
          .set({ status: "COMPLETADA" })
          .where(eq(orders.id, input.orderId));

        await tx.insert(transactions).values({
          order_id: input.orderId,
          payment_method_id: input.paymentMethodId,
          amount: Math.round(Number(orderData.total_amount) * 100),
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
    .meta({ openapi: { method: "PATCH", path: "/orders/{id}", tags: ["Orders"], summary: "Update an order" } })
    .input(
      z.object({
        id: z.number(),
        total_amount: z.number().optional(),
        status: z.enum(["COMPLETADA", "pending", "cancelled", "PENDIENTE_PESAJE", "LISTA_PARA_COBRO"]).optional(),
      })
    )
    .output(orderWithCustomerSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, total_amount, ...data } = input;
      const updateData: any = { ...data, user_uid: ctx.user.id, updated_at: new Date() };
      if (total_amount !== undefined) updateData.total_amount = total_amount.toFixed(2);

      const [updated] = await db
        .update(orders)
        .set(updateData)
        .where(and(eq(orders.id, id), eq(orders.user_uid, ctx.user.id)))
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
    .meta({ openapi: { method: "DELETE", path: "/orders/{id}", tags: ["Orders"], summary: "Delete an order and its items" } })
    .input(z.object({ id: z.number() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await db.transaction(async (tx) => {
        await tx.delete(orderItems).where(eq(orderItems.order_id, input.id));
        await tx
          .delete(orders)
          .where(and(eq(orders.id, input.id), eq(orders.user_uid, ctx.user.id)));
      });
      return { success: true };
    }),
});

