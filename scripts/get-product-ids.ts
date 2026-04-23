import { db } from "../apps/web/src/lib/db";
import { products } from "../apps/web/src/lib/db/schema";
import { sql } from "drizzle-orm";

async function getProductIds() {
  try {
    console.log("🔍 Obteniendo IDs de todos los productos necesarios...\n");

    // Get product IDs that we need for recipes
    const productNames = [
      "CANAL",
      "LOMO",
      "PECHO",
      "CUERO",
      "PATAS",
      "MANOS",
      "PIERNA",
      "ESPALDILLA",
      "FILETE",
      "ESPILOMO",
      "CABEZA",
      "ESPINAZO",
      "LOMO USA",
      "C/LOMO C/H",
      "COSTILLAR",
    ];

    console.log("📋 Productos y sus IDs:\n");
    console.log("Nombre".padEnd(30) + "ID".padEnd(10) + "Código");
    console.log("-".repeat(50));

    const results = await db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(sql`name IN (${sql.join(productNames, sql`, `)})`);

    const productMap: { [key: string]: number } = {};

    for (const prod of results) {
      console.log(
        prod.name.padEnd(30) + String(prod.id).padEnd(10) + `(${prod.id})`
      );
      productMap[prod.name] = prod.id;
    }

    console.log("\n📝 Mapeo para uso en recetas:\n");
    console.log(JSON.stringify(productMap, null, 2));

    console.log("\n✨ IDs obtenidos. Usa estos para crear las recetas.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

getProductIds();
