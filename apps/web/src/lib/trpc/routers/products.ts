import { z } from "zod/v4";
import { protectedProcedure, router } from "../init";
import { db } from "@/lib/db";
import { products, productTransformations, inventoryTransactions } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const productSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  price_per_kg: z.union([z.number(), z.string()]).nullable(),
  unit: z.string().nullable(),
  active: z.boolean(),
  sort_order: z.number().nullable(),
  in_stock: z.union([z.number(), z.string()]),
  category: z.string().nullable(),
  user_uid: z.string(),
  ncm: z.string().nullable(),
  cfop: z.string().nullable(),
  icms_cst: z.string().nullable(),
  pis_cst: z.string().nullable(),
  cofins_cst: z.string().nullable(),
  unit_of_measure: z.string().nullable(),
  // New Inventory Dual Fields
  stock_pieces: z.number(),
  stock_kg: z.union([z.number(), z.string()]),
  is_parent_product: z.boolean(),
  is_sellable_by_unit: z.boolean(),
  is_sellable_by_weight: z.boolean(),
  default_sale_unit: z.string(),
  price_per_piece: z.union([z.number(), z.string()]).nullable(),
  created_at: z.date().nullable(),
  updated_at: z.date().nullable(),
});

const productTransformationSchema = z.object({
  id: z.number(),
  parent_product_id: z.number(),
  child_product_id: z.number(),
  yield_quantity_pieces: z.union([z.string(), z.number()]),
  yield_weight_ratio: z.union([z.string(), z.number()]),
  transformation_type: z.string(),
  is_active: z.boolean(),
  created_at: z.date().nullable().optional(),
  updated_at: z.date().nullable().optional(),
  childProduct: z
    .object({
      id: z.number(),
      name: z.string(),
      category: z.string().nullable(),
    })
    .nullable()
    .optional(),
});

export const productsRouter = router({
  list: protectedProcedure
    .meta({ openapi: { method: "GET", path: "/products", tags: ["Products"], summary: "List all products" } })
    .input(z.void())
    .output(z.array(productSchema))
    .query(async ({ ctx }) => {
      return db.select().from(products).where(eq(products.user_uid, ctx.user.id));
    }),

  create: protectedProcedure
    .meta({ openapi: { method: "POST", path: "/products", tags: ["Products"], summary: "Create a product" } })
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        price_per_kg: z.number().optional(),
        unit: z.string().optional(),
        active: z.boolean().default(true),
        sort_order: z.number().optional(),
        in_stock: z.number().min(0).default(0),
        category: z.string().optional(),
        ncm: z.string().max(8).optional(),
        cfop: z.string().max(4).optional(),
        icms_cst: z.string().max(3).optional(),
        pis_cst: z.string().max(2).optional(),
        cofins_cst: z.string().max(2).optional(),
        unit_of_measure: z.string().max(6).optional(),
        stock_pieces: z.number().int().default(0),
        stock_kg: z.number().default(0),
        is_parent_product: z.boolean().default(false),
        is_sellable_by_unit: z.boolean().default(true),
        is_sellable_by_weight: z.boolean().default(true),
        default_sale_unit: z.string().max(10).default("KG"),
        price_per_piece: z.number().optional(),
      })
    )
    .output(productSchema)
    .mutation(async ({ ctx, input }) => {
      const { in_stock, stock_kg, price_per_kg, price_per_piece, ...rest } = input;
      const [data] = await db
        .insert(products)
        .values({ 
          ...rest, 
          in_stock: in_stock.toFixed(3),
          stock_kg: stock_kg.toFixed(3),
          price_per_kg: price_per_kg?.toFixed(2),
          price_per_piece: price_per_piece?.toFixed(2),
          user_uid: ctx.user.id 
        })
        .returning();
      return data;
    }),

  update: protectedProcedure
    .meta({ openapi: { method: "PATCH", path: "/products/{id}", tags: ["Products"], summary: "Update a product" } })
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        price_per_kg: z.number().optional(),
        unit: z.string().optional(),
        active: z.boolean().optional(),
        sort_order: z.number().optional(),
        in_stock: z.number().min(0).optional(),
        category: z.string().optional(),
        ncm: z.string().max(8).optional(),
        cfop: z.string().max(4).optional(),
        icms_cst: z.string().max(3).optional(),
        pis_cst: z.string().max(2).optional(),
        cofins_cst: z.string().max(2).optional(),
        unit_of_measure: z.string().max(6).optional(),
        stock_pieces: z.number().int().optional(),
        stock_kg: z.number().optional(),
        is_parent_product: z.boolean().optional(),
        is_sellable_by_unit: z.boolean().optional(),
        is_sellable_by_weight: z.boolean().optional(),
        default_sale_unit: z.string().max(10).optional(),
        price_per_piece: z.number().optional(),
      })
    )
    .output(productSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, in_stock, stock_kg, price_per_kg, price_per_piece, ...data } = input;
      const updateData: any = { ...data, user_uid: ctx.user.id, updated_at: new Date() };
      
      if (in_stock !== undefined) updateData.in_stock = in_stock.toFixed(3);
      if (stock_kg !== undefined) updateData.stock_kg = stock_kg.toFixed(3);
      if (price_per_kg !== undefined) updateData.price_per_kg = price_per_kg.toFixed(2);
      if (price_per_piece !== undefined) updateData.price_per_piece = price_per_piece.toFixed(2);

      const [updated] = await db
        .update(products)
        .set(updateData)
        .where(and(eq(products.id, id), eq(products.user_uid, ctx.user.id)))
        .returning();
      return updated;
    }),

  delete: protectedProcedure
    .meta({ openapi: { method: "DELETE", path: "/products/{id}", tags: ["Products"], summary: "Delete a product" } })
    .input(z.object({ id: z.number() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(products)
        .where(and(eq(products.id, input.id), eq(products.user_uid, ctx.user.id)));
      return { success: true };
    }),

  processDisassembly: protectedProcedure
    .meta({ openapi: { method: "POST", path: "/products/disassembly", tags: ["Products"], summary: "Process product disassembly" } })
    .input(
      z.object({
        parentProductId: z.number(),
        quantityToProcess: z.number().int().positive(),
        transformationType: z.enum([
          "DESPIECE_NACIONAL",
          "DESPIECE_AMERICANO",
          "DESPIECE_POLINESIO",
          "DESPIECE_PIERNA",
          "DESPIECE_CABEZA",
          "DESPIECE_CUERO",
          "DESPIECE_ESPALDILLA",
          "DESPIECE_COSTILLAR",
        ]),
      })
    )
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const uid = ctx.user.id;
      const { parentProductId, quantityToProcess, transformationType } = input;

      const normalizePieces = (value: number) => (value > 50 ? value / 1000 : value);
      const normalizeRatio = (value: number) => (value > 1 ? value / 1000 : value);

      return await db.transaction(async (tx) => {
        // 1. Validar Stock Padre
        const [parent] = await tx
          .select()
          .from(products)
          .where(and(eq(products.id, parentProductId), eq(products.user_uid, uid)))
          .limit(1);

        if (!parent) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Producto padre no encontrado" });
        }

        if (parent.stock_pieces < quantityToProcess) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Stock de piezas insuficiente" });
        }

        // 2. Calcular Peso Promedio Padre
        // Evitar división por cero
        const stockKg = Number(parent.stock_kg);
        const parentAvgWeight = parent.stock_pieces > 0 
          ? stockKg / parent.stock_pieces 
          : 0;
        
        const kgToRemove = quantityToProcess * parentAvgWeight;

        // 3. Descontar Padre
        await tx
          .update(products)
          .set({
            stock_pieces: parent.stock_pieces - quantityToProcess,
            stock_kg: (stockKg - kgToRemove).toFixed(3),
            in_stock: (Number(parent.in_stock) - kgToRemove).toFixed(3),
          })
          .where(eq(products.id, parentProductId));

        // 4. Registrar Transacción Padre
        await tx.insert(inventoryTransactions).values({
          product_id: parentProductId,
          quantity_change_pieces: -quantityToProcess,
          quantity_change_kg: (-kgToRemove).toFixed(3),
          transaction_type: "DESPIECE",
          notes: `Salida por despiece ${transformationType}`,
        });

        // 5. Obtener Recetas
        const recipes = await tx
          .select()
          .from(productTransformations)
          .where(
            and(
              eq(productTransformations.parent_product_id, parentProductId),
              eq(productTransformations.transformation_type, transformationType),
              eq(productTransformations.is_active, true)
            )
          );

        if (recipes.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "No se encontraron recetas para este despiece" });
        }

        // 6. Incrementar Hijos
        for (const recipe of recipes) {
          const yieldPieces = normalizePieces(Number(recipe.yield_quantity_pieces));
          const yieldRatio = normalizeRatio(Number(recipe.yield_weight_ratio));

          const childPiecesToAdd = Math.round(quantityToProcess * yieldPieces);
          const childKgToAdd = quantityToProcess * yieldRatio * parentAvgWeight;

          const [child] = await tx
            .select()
            .from(products)
            .where(and(eq(products.id, recipe.child_product_id), eq(products.user_uid, uid)))
            .limit(1);

          if (child) {
            await tx
              .update(products)
              .set({
                stock_pieces: child.stock_pieces + childPiecesToAdd,
                stock_kg: (Number(child.stock_kg) + childKgToAdd).toFixed(3),
                in_stock: (Number(child.in_stock) + childKgToAdd).toFixed(3),
              })
              .where(eq(products.id, recipe.child_product_id));

            await tx.insert(inventoryTransactions).values({
              product_id: recipe.child_product_id,
              quantity_change_pieces: childPiecesToAdd,
              quantity_change_kg: childKgToAdd.toFixed(3),
              transaction_type: "DESPIECE",
              reference_id: parentProductId,
              notes: `Entrada por despiece ${transformationType} de ${parent.name}`,
            });
          }
        }

        return { success: true };
      });
    }),

  getTransformations: protectedProcedure
    .meta({ openapi: { method: "GET", path: "/products/transformations", tags: ["Products"], summary: "Get product transformations" } })
    .input(z.object({ parentProductId: z.number(), transformationType: z.string() }))
    .output(z.array(productTransformationSchema))
    .query(async ({ ctx, input }) => {
      const uid = ctx.user.id;
      const [parent] = await db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.id, input.parentProductId), eq(products.user_uid, uid)))
        .limit(1);

      if (!parent) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Producto padre no encontrado" });
      }

      return db.query.productTransformations.findMany({
        where: and(
          eq(productTransformations.parent_product_id, input.parentProductId),
          eq(productTransformations.transformation_type, input.transformationType),
          eq(productTransformations.is_active, true)
        ),
        with: {
          childProduct: true,
        },
      });
    }),
});

