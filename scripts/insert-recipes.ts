import { db } from "../apps/web/src/lib/db";
import { productTransformations } from "../apps/web/src/lib/db/schema";
import { sql, eq, or } from "drizzle-orm";

async function insertRecipes() {
  try {
    console.log("🔄 Insertando recetas NACIONAL_LOMO y NACIONAL_ESPILOMO...\n");

    // Primero, desactivar recetas de POLINESIO
    console.log("⏸️  Desactivando recetas de POLINESIO...");
    await db
      .update(productTransformations)
      .set({ is_active: false })
      .where(
        sql`parent_product_id = 9 AND (
          transformation_type = 'NACIONAL_POLINESIA_ESPILOMO' OR
          transformation_type = 'NACIONAL_POLINESIA_LOMO'
        )`
      );
    console.log("✅ Recetas de POLINESIO desactivadas\n");

    // NACIONAL_LOMO recipes
    const nacionalLomoRecipes = [
      { parent: 9, child: 32, pieces: 1, ratio: 1, type: "NACIONAL_LOMO" }, // LOMO
      { parent: 9, child: 45, pieces: 1, ratio: 1, type: "NACIONAL_LOMO" }, // PECHO
      { parent: 9, child: 13, pieces: 1, ratio: 1, type: "NACIONAL_LOMO" }, // CUERO
      { parent: 9, child: 44, pieces: 1, ratio: 1, type: "NACIONAL_LOMO" }, // PATAS
      { parent: 9, child: 35, pieces: 1, ratio: 1, type: "NACIONAL_LOMO" }, // MANOS
      { parent: 9, child: 47, pieces: 1, ratio: 1, type: "NACIONAL_LOMO" }, // PIERNA
      { parent: 9, child: 20, pieces: 1, ratio: 1, type: "NACIONAL_LOMO" }, // ESPALDILLA
      { parent: 9, child: 23, pieces: 1, ratio: 1, type: "NACIONAL_LOMO" }, // FILETE
    ];

    // NACIONAL_ESPILOMO recipes
    const nacionalEspilomoRecipes = [
      { parent: 9, child: 21, pieces: 1, ratio: 1, type: "NACIONAL_ESPILOMO" }, // ESPILOMO
      { parent: 9, child: 45, pieces: 1, ratio: 1, type: "NACIONAL_ESPILOMO" }, // PECHO
      { parent: 9, child: 13, pieces: 1, ratio: 1, type: "NACIONAL_ESPILOMO" }, // CUERO
      { parent: 9, child: 44, pieces: 1, ratio: 1, type: "NACIONAL_ESPILOMO" }, // PATAS
      { parent: 9, child: 35, pieces: 1, ratio: 1, type: "NACIONAL_ESPILOMO" }, // MANOS
      { parent: 9, child: 47, pieces: 1, ratio: 1, type: "NACIONAL_ESPILOMO" }, // PIERNA
      { parent: 9, child: 20, pieces: 1, ratio: 1, type: "NACIONAL_ESPILOMO" }, // ESPALDILLA
      { parent: 9, child: 23, pieces: 1, ratio: 1, type: "NACIONAL_ESPILOMO" }, // FILETE
    ];

    // Combine all recipes
    const allRecipes = [...nacionalLomoRecipes, ...nacionalEspilomoRecipes];

    // Insert recipes (using onConflictDoNothing to avoid duplicates)
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
    console.log("📊 Resumen de recetas por tipo:\n");

    const types = [
      "NACIONAL_LOMO",
      "NACIONAL_ESPILOMO",
      "BASE",
      "AMERICANO",
      "NACIONAL_POLINESIA_LOMO",
      "NACIONAL_POLINESIA_ESPILOMO",
    ];

    for (const type of types) {
      const count = await db
        .select({ count: sql<number>`count(*)` })
        .from(productTransformations)
        .where(
          sql`parent_product_id = 9 AND transformation_type = ${type} AND is_active = true`
        );
      console.log(
        `  ${type.padEnd(30)} : ${count[0]?.count || 0} recetas activas`
      );
    }

    console.log("\n✨ Configuración de recetas completada!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

insertRecipes();
