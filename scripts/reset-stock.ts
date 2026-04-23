import { db } from "../apps/web/src/lib/db";
import { products, inventoryTransactions } from "../apps/web/src/lib/db/schema";
import { sql } from "drizzle-orm";

async function resetStock() {
  try {
    console.log("🔄 Iniciando reset de stock...\n");

    // Get all products with stock
    const allProducts = await db.select().from(products);
    console.log(`📦 Total de productos encontrados: ${allProducts.length}`);

    // Create inventory transactions for audit trail
    const productsWithStock = allProducts.filter(
      (p) => Number(p.stock_pieces) > 0 || Number(p.stock_kg) > 0
    );
    console.log(
      `📝 Productos con stock a resetear: ${productsWithStock.length}\n`
    );

    const transactions = productsWithStock.map((product) => ({
      product_id: product.id,
      quantity_change_pieces: -Number(product.stock_pieces),
      quantity_change_kg: String(-Number(product.stock_kg)),
      transaction_type: "RESET",
      reference_id: null,
      notes: "System reset - clearing all stock",
    }));

    // Insert audit transactions
    if (transactions.length > 0) {
      await db.insert(inventoryTransactions).values(transactions);
      console.log(`✅ ${transactions.length} transacciones de auditoría registradas\n`);
    }

    // Reset all stock fields
    await db
      .update(products)
      .set({
        stock_pieces: 0,
        stock_kg: sql`0.000`,
        in_stock: sql`0.000`,
        updated_at: new Date(),
      });

    console.log(`✅ Stock reseteado para ${allProducts.length} productos\n`);

    // Verify the reset
    const updatedProducts = await db
      .select()
      .from(products)
      .where(sql`active = true`)
      .limit(10);

    console.log("📊 Verificación (primeros 10 productos activos):\n");
    console.log("ID | Nombre | Piezas | KG | En Stock");
    console.log("-".repeat(50));
    updatedProducts.forEach((p) => {
      console.log(
        `${p.id} | ${p.name.padEnd(20)} | ${p.stock_pieces} | ${p.stock_kg} | ${p.in_stock}`
      );
    });

    console.log("\n✨ Reset completado exitosamente!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error durante reset:", error);
    process.exit(1);
  }
}

resetStock();
