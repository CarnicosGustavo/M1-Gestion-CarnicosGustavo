#!/usr/bin/env node

import postgres from "postgres";

const db_url = process.env.DATABASE_URL;
if (!db_url) {
  console.error("❌ DATABASE_URL not set");
  process.exit(1);
}

const sql = postgres(db_url);

async function main() {
  console.log("🔍 DIAGNÓSTICO DE ESTRUCTURA DE PRODUCTOS Y RECETAS\n");
  console.log("=".repeat(70) + "\n");

  try {
    // 1. Productos padres relacionados con canal
    console.log("📦 PRODUCTOS PADRE (parent products):\n");
    const parentProducts = await sql`
      SELECT id, name, stock_pieces, is_parent_product
      FROM products
      WHERE is_parent_product = true
        AND name ILIKE '%canal%'
      ORDER BY id
    `;

    for (const p of parentProducts) {
      console.log(`  [ID: ${p.id}] ${p.name} - Stock: ${p.stock_pieces} pzas`);
    }

    console.log("\n" + "-".repeat(70) + "\n");

    // 2. Recetas del CANAL (ID 533)
    console.log("📋 RECETAS ACTUALES DEL CANAL (ID: 533):\n");
    const canalRecipes = await sql`
      SELECT
        pt.id,
        p.name as child,
        pt.transformation_type as type,
        pt.yield_quantity_pieces as qty,
        pt.is_active
      FROM product_transformations pt
      JOIN products p ON pt.child_product_id = p.id
      WHERE pt.parent_product_id = 533
      ORDER BY pt.transformation_type, p.name
    `;

    const byType = {};
    for (const recipe of canalRecipes) {
      if (!byType[recipe.type]) byType[recipe.type] = [];
      byType[recipe.type].push(recipe);
    }

    for (const [type, recipes] of Object.entries(byType)) {
      console.log(`  📌 Tipo: ${type}`);
      for (const r of recipes) {
        const status = r.is_active ? "✅" : "❌";
        console.log(
          `     ${status} ${r.child} → ${r.qty} piezas`
        );
      }
      console.log();
    }

    console.log("-".repeat(70) + "\n");

    // 3. Estructura propuesta
    console.log("💡 ESTRUCTURA PROPUESTA:\n");
    console.log("  Para usar 3 productos de canal separados:");
    console.log("  1. XX9.1 - CANAL AMERICANO");
    console.log("  2. XX9.2 - CANAL NACIONAL LOMO");
    console.log("  3. XX9.3 - CANAL NACIONAL ESPILOMO\n");
    console.log("  Cada uno tendría recetas separadas:");
    console.log("  - BASE recipes (comunes a todos)");
    console.log("  - Recetas específicas del estilo\n");

    console.log("-".repeat(70) + "\n");

    // 4. Productos intermedios existentes
    console.log("🔄 PRODUCTOS INTERMEDIOS (se generan del canal):\n");
    const intermediates = await sql`
      SELECT DISTINCT p.name
      FROM product_transformations pt
      JOIN products p ON pt.child_product_id = p.id
      WHERE pt.parent_product_id = 533
        AND pt.transformation_type = 'BASE'
      ORDER BY p.name
    `;

    for (const p of intermediates) {
      console.log(`  • ${p.name}`);
    }

    await sql.end();
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

main();
