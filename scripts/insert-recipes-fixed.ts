import { db } from "../apps/web/src/lib/db";
import { products, productTransformations } from "../apps/web/src/lib/db/schema";
import { sql, inArray } from "drizzle-orm";

async function insertRecipes() {
  try {
    console.log("🔄 Insertando recetas NACIONAL_LOMO y NACIONAL_ESPILOMO...\n");

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
    ];

    const results = await db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(inArray(products.name, productNames));

    const productMap: { [key: string]: number } = {};
    for (const prod of results) {
      productMap[prod.name] = prod.id;
    }

    const CANAL = productMap["CANAL"];
    const LOMO = productMap["LOMO"];
    const PECHO = productMap["PECHO"];
    const CUERO = productMap["CUERO"];
    const PATAS = productMap["PATAS"];
    const MANOS = productMap["MANOS"];
    const PIERNA = productMap["PIERNA"];
    const ESPALDILLA = productMap["ESPALDILLA"];
    const FILETE = productMap["FILETE"];
    const ESPILOMO = productMap["ESPILOMO"];
    const CABEZA = productMap["CABEZA"];

    if (!CANAL) {
      console.error("❌ Error: No se encontró el producto CANAL. Asegúrate de que el seed haya corrido.");
      process.exit(1);
    }

    console.log("📋 IDs de productos encontrados:\n");
    console.log(`CANAL: ${CANAL}, LOMO: ${LOMO}, PECHO: ${PECHO}`);
    console.log(`CUERO: ${CUERO}, PATAS: ${PATAS}, MANOS: ${MANOS}`);
    console.log(`PIERNA: ${PIERNA}, ESPALDILLA: ${ESPALDILLA}, FILETE: ${FILETE}`);
    console.log(`ESPILOMO: ${ESPILOMO}, CABEZA: ${CABEZA}\n`);

    // Primero, desactivar recetas de POLINESIO
    console.log("⏸️  Desactivando recetas de POLINESIO...");
    const deactivated = await db
      .update(productTransformations)
      .set({ is_active: false })
      .where(
        sql`parent_product_id = ${CANAL} AND (
          transformation_type = 'NACIONAL_POLINESIA_ESPILOMO' OR
          transformation_type = 'NACIONAL_POLINESIA_LOMO'
        )`
      );
    console.log("✅ Recetas de POLINESIO desactivadas\n");

    // NACIONAL_LOMO recipes
    const nacionalLomoRecipes = [
      { parent: CANAL, child: LOMO, pieces: 1, ratio: 1, type: "NACIONAL_LOMO" },
      { parent: CANAL, child: PECHO, pieces: 1, ratio: 1, type: "NACIONAL_LOMO" },
      { parent: CANAL, child: CUERO, pieces: 1, ratio: 1, type: "NACIONAL_LOMO" },
      { parent: CANAL, child: PATAS, pieces: 1, ratio: 1, type: "NACIONAL_LOMO" },
      { parent: CANAL, child: MANOS, pieces: 1, ratio: 1, type: "NACIONAL_LOMO" },
      { parent: CANAL, child: PIERNA, pieces: 1, ratio: 1, type: "NACIONAL_LOMO" },
      { parent: CANAL, child: ESPALDILLA, pieces: 1, ratio: 1, type: "NACIONAL_LOMO" },
      { parent: CANAL, child: FILETE, pieces: 1, ratio: 1, type: "NACIONAL_LOMO" },
    ];

    // NACIONAL_ESPILOMO recipes
    const nacionalEspilomoRecipes = [
      { parent: CANAL, child: ESPILOMO, pieces: 1, ratio: 1, type: "NACIONAL_ESPILOMO" },
      { parent: CANAL, child: PECHO, pieces: 1, ratio: 1, type: "NACIONAL_ESPILOMO" },
      { parent: CANAL, child: CUERO, pieces: 1, ratio: 1, type: "NACIONAL_ESPILOMO" },
      { parent: CANAL, child: PATAS, pieces: 1, ratio: 1, type: "NACIONAL_ESPILOMO" },
      { parent: CANAL, child: MANOS, pieces: 1, ratio: 1, type: "NACIONAL_ESPILOMO" },
      { parent: CANAL, child: PIERNA, pieces: 1, ratio: 1, type: "NACIONAL_ESPILOMO" },
      { parent: CANAL, child: ESPALDILLA, pieces: 1, ratio: 1, type: "NACIONAL_ESPILOMO" },
      { parent: CANAL, child: FILETE, pieces: 1, ratio: 1, type: "NACIONAL_ESPILOMO" },
    ];

    // Combine all recipes
    const allRecipes = [...nacionalLomoRecipes, ...nacionalEspilomoRecipes];

    // Insert recipes
    const recipesToInsert = allRecipes.map((r) => ({
      parent_product_id: r.parent,
      child_product_id: r.child,
      yield_quantity_pieces: String(r.pieces),
      yield_weight_ratio: String(r.ratio),
      transformation_type: r.type,
      is_active: true,
    }));

    console.log(`📝 Insertando ${allRecipes.length} recetas nuevas...\n`);

    await db
      .insert(productTransformations)
      .values(recipesToInsert as any)
      .onConflictDoNothing();

    // Verify results
    console.log("✅ Recetas insertadas exitosamente!\n");
    console.log("📊 Resumen de recetas activas de CANAL (ID: 7):\n");

    const allCanal = await db
      .select({
        type: productTransformations.transformation_type,
        count: sql<number>`count(*)`,
      })
      .from(productTransformations)
      .where(sql`parent_product_id = ${CANAL} AND is_active = true`)
      .groupBy(productTransformations.transformation_type);

    for (const row of allCanal) {
      console.log(`  ${(row.type || "").padEnd(30)} : ${row.count} recetas`);
    }

    console.log("\n✨ Configuración de recetas completada!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

insertRecipes();
