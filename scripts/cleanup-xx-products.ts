import { db } from "../apps/web/src/lib/db";
import { products, productTransformations, orderItems, inventoryTransactions } from "../apps/web/src/lib/db/schema";
import { sql, like } from "drizzle-orm";

async function cleanup() {
  try {
    console.log("🧹 Iniciando limpieza de productos con 'XX'...\n");

    // 1. Encontrar productos a eliminar
    const toDelete = await db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(like(products.name, "%XX%"));

    if (toDelete.length === 0) {
      console.log("✅ No se encontraron productos con 'XX'.");
      process.exit(0);
    }

    const ids = toDelete.map(p => p.id);
    console.log(`🔍 Encontrados ${toDelete.length} productos para eliminar.`);

    // 2. Eliminar dependencias
    console.log("🗑️  Eliminando dependencias (recetas, transacciones, items de pedidos)...");
    
    await db.delete(productTransformations).where(
      sql`parent_product_id IN (${sql.join(ids, sql`, `)}) OR child_product_id IN (${sql.join(ids, sql`, `)})`
    );
    
    await db.delete(inventoryTransactions).where(
      sql`product_id IN (${sql.join(ids, sql`, `)})`
    );

    await db.delete(orderItems).where(
      sql`product_id IN (${sql.join(ids, sql`, `)})`
    );

    // 3. Eliminar productos
    console.log("🗑️  Eliminando productos...");
    await db.delete(products).where(
      sql`id IN (${sql.join(ids, sql`, `)})`
    );

    console.log("\n✨ Limpieza completada con éxito.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error durante la limpieza:", error);
    process.exit(1);
  }
}

cleanup();
