#!/usr/bin/env node

import postgres from "postgres";

const db_url = process.env.DATABASE_URL;
if (!db_url) {
  console.error("❌ DATABASE_URL not set");
  process.exit(1);
}

const sql = postgres(db_url);

async function main() {
  console.log("🔄 MIGRACIÓN DE ESTRUCTURA DE CANALES\n");
  console.log("=".repeat(70) + "\n");

  try {
    // PASO 1: Obtener el user_uid del propietario del canal actual
    console.log("📝 Paso 1: Obtener información de usuario...");
    const canalActual = await sql`
      SELECT user_uid FROM products WHERE id = 533
    `;

    if (!canalActual.length) {
      console.error("❌ No se encontró el CANAL actual (ID: 533)");
      process.exit(1);
    }

    const userUid = canalActual[0].user_uid;
    console.log(`✅ User UID: ${userUid}\n`);

    // PASO 2: Crear 3 nuevos productos padre
    console.log("📝 Paso 2: Crear 3 nuevos productos padre...");

    const newCanals = [
      {
        name: "XX9.1 - CANAL AMERICANO",
        description: "Canal para despiece estilo AMERICANO",
      },
      {
        name: "XX9.2 - CANAL NACIONAL LOMO",
        description: "Canal para despiece estilo NACIONAL LOMO",
      },
      {
        name: "XX9.3 - CANAL NACIONAL ESPILOMO",
        description: "Canal para despiece estilo NACIONAL ESPILOMO",
      },
    ];

    const newCanalIds = [];

    for (const canalData of newCanals) {
      const result = await sql`
        INSERT INTO products (
          user_uid, name, description, category,
          is_parent_product, stock_pieces, stock_kg,
          created_at, updated_at
        ) VALUES (
          ${userUid}, ${canalData.name}, ${canalData.description}, 'CANAL',
          true, 0, 0,
          now(), now()
        )
        RETURNING id
      `;

      newCanalIds.push(result[0].id);
      console.log(`✅ Creado: ${canalData.name} (ID: ${result[0].id})`);
    }

    console.log();

    // PASO 3: Copiar recetas BASE para cada nuevo canal
    console.log("📝 Paso 3: Copiar recetas BASE para cada nuevo canal...");

    const baseRecipes = await sql`
      SELECT
        child_product_id, yield_quantity_pieces, yield_weight_ratio, is_active
      FROM product_transformations
      WHERE parent_product_id = 533 AND transformation_type = 'BASE'
    `;

    for (let i = 0; i < newCanalIds.length; i++) {
      const newCanalId = newCanalIds[i];
      let insertedCount = 0;

      for (const recipe of baseRecipes) {
        await sql`
          INSERT INTO product_transformations (
            parent_product_id, child_product_id,
            yield_quantity_pieces, yield_weight_ratio,
            transformation_type, is_active,
            created_at, updated_at
          ) VALUES (
            ${newCanalId}, ${recipe.child_product_id},
            ${recipe.yield_quantity_pieces}, ${recipe.yield_weight_ratio},
            'BASE', ${recipe.is_active},
            now(), now()
          )
        `;
        insertedCount++;
      }

      const canalNames = [
        "XX9.1 - CANAL AMERICANO",
        "XX9.2 - CANAL NACIONAL LOMO",
        "XX9.3 - CANAL NACIONAL ESPILOMO",
      ];

      console.log(
        `✅ ${insertedCount} recetas BASE copiadas a ${canalNames[i]}`
      );
    }

    console.log();

    // PASO 4: Copiar recetas específicas a cada canal
    console.log("📝 Paso 4: Asignar recetas específicas a cada canal...");

    const styleRecipes = [
      {
        canalId: newCanalIds[0],
        type: "AMERICANO",
        name: "XX9.1 - CANAL AMERICANO",
      },
      {
        canalId: newCanalIds[1],
        type: "NACIONAL_LOMO",
        name: "XX9.2 - CANAL NACIONAL LOMO",
      },
      {
        canalId: newCanalIds[2],
        type: "NACIONAL_ESPILOMO",
        name: "XX9.3 - CANAL NACIONAL ESPILOMO",
      },
    ];

    for (const config of styleRecipes) {
      const recipes = await sql`
        SELECT
          child_product_id, yield_quantity_pieces, yield_weight_ratio, is_active
        FROM product_transformations
        WHERE parent_product_id = 533 AND transformation_type = ${config.type}
      `;

      let insertedCount = 0;

      for (const recipe of recipes) {
        await sql`
          INSERT INTO product_transformations (
            parent_product_id, child_product_id,
            yield_quantity_pieces, yield_weight_ratio,
            transformation_type, is_active,
            created_at, updated_at
          ) VALUES (
            ${config.canalId}, ${recipe.child_product_id},
            ${recipe.yield_quantity_pieces}, ${recipe.yield_weight_ratio},
            ${config.type}, ${recipe.is_active},
            now(), now()
          )
        `;
        insertedCount++;
      }

      console.log(`✅ ${insertedCount} recetas ${config.type} asignadas a ${config.name}`);
    }

    console.log("\n" + "=".repeat(70) + "\n");

    console.log("✅ MIGRACIÓN COMPLETADA\n");

    console.log("📌 PRÓXIMOS PASOS:\n");
    console.log(
      `1. IDs de nuevos canales: ${newCanalIds.join(", ")}\n`
    );
    console.log(
      "2. Actualizar el código de despiece (disassembly/page.tsx) para:\n"
    );
    console.log("   - Detectar los 3 canales automáticamente\n");
    console.log(
      "3. Cambiar 'Ingreso de Compra' para registrar en canal correcto\n"
    );
    console.log("4. Cambiar 'Tablero de Despiece' a 3 cuadros independientes\n");
    console.log("5. Eliminar 'Despiece de Pieza Primaria'\n");

    await sql.end();
  } catch (err) {
    console.error("❌ Error:", err.message);
    console.error(err);
    process.exit(1);
  }
}

main();
