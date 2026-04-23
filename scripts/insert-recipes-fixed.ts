import { db } from "../apps/web/src/lib/db";
import { productTransformations } from "../apps/web/src/lib/db/schema";
import { sql } from "drizzle-orm";

async function insertRecipes() {
  try {
    console.log("🔄 Insertando recetas NACIONAL_LOMO y NACIONAL_ESPILOMO...\n");

    // Product IDs (NOTE: Using parent_product_id = 533 which is "XX9 - CANAL", not 7)
    // The system uses the older XX-prefixed product naming for parent products
    const CANAL = 533;        // XX9 - CANAL (parent product)
    const LOMO = 556;         // XX32 - LOMO
    const PECHO = 569;        // XX45 - PECHO
    const CUERO = 609;        // XX13 - CUERO
    const PATAS = 568;        // XX44 - PATAS
    const MANOS = 560;        // XX35 - MANOS
    const PIERNA = 571;       // XX47 - PIERNA
    const ESPALDILLA = 544;   // XX20 - ESPALDILLA
    const FILETE = 547;       // XX23 - FILETE
    const ESPILOMO = 545;     // XX21 - ESPILOMO
    const CABEZA = 605;

    console.log("📋 IDs de productos:\n");
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
