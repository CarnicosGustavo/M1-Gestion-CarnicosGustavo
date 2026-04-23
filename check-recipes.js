#!/usr/bin/env node

// Quick script to verify BASE recipe quantities
// Usage: node check-recipes.js [--fix]

const db_url = process.env.DATABASE_URL;
if (!db_url) {
  console.error("❌ DATABASE_URL not set");
  process.exit(1);
}

const postgres = require("postgres");
const sql = postgres(db_url);

async function main() {
  const fix = process.argv.includes("--fix");
  console.log("🔍 Verificando cantidades de recetas BASE del CANAL (ID: 533)...\n");

  try {
    const baseRecipes = await sql`
      SELECT
        pt.id,
        pt.child_product_name as child_name,
        pt.yield_quantity_pieces,
        p.name as parent_name
      FROM product_transformations pt
      JOIN products p ON pt.parent_product_id = p.id
      WHERE pt.parent_product_id = 533
        AND pt.transformation_type = 'BASE'
      ORDER BY pt.child_product_name
    `;

    if (!baseRecipes.length) {
      console.log("❌ No se encontraron recetas BASE para el CANAL");
      process.exit(1);
    }

    console.log(`📋 Encontradas ${baseRecipes.length} recetas BASE:\n`);

    let needsFix = 0;
    for (const recipe of baseRecipes) {
      const yieldQty = Number(recipe.yield_quantity_pieces);
      const status = yieldQty === 2 ? "✅" : "⚠️";
      console.log(
        `${status} ${recipe.child_name}: yield=${yieldQty} (esperado: 2)`
      );
      if (yieldQty !== 2) needsFix++;
    }

    if (needsFix > 0) {
      console.log(`\n⚠️  ${needsFix} recetas necesitan corrección`);

      if (fix) {
        console.log("🔧 Actualizando a 2 piezas...\n");
        for (const recipe of baseRecipes) {
          const yieldQty = Number(recipe.yield_quantity_pieces);
          if (yieldQty !== 2) {
            await sql`
              UPDATE product_transformations
              SET yield_quantity_pieces = '2'
              WHERE id = ${recipe.id}
            `;
            console.log(`✅ Actualizado: ${recipe.child_name} → 2 piezas`);
          }
        }
        console.log("\n✅ Todas las recetas BASE actualizadas");
      } else {
        console.log("\n💡 Ejecuta con --fix para corregirlas automáticamente");
      }
    } else {
      console.log("\n✅ Todas las recetas BASE ya tienen la cantidad correcta (2)");
    }

    await sql.end();
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

main();
