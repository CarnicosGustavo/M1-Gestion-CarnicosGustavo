import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@finopenpos/db/schema";
import { eq, and } from "drizzle-orm";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const client = postgres(connectionString);
const db = drizzle(client, { schema });

async function verifyAndFixRecipes() {
  console.log("🔍 Verificando cantidades de recetas BASE del CANAL...\n");

  const baseRecipes = await db
    .select({
      id: schema.productTransformations.id,
      parent_id: schema.productTransformations.parent_product_id,
      child_id: schema.productTransformations.child_product_id,
      child_name: schema.productTransformations.child_product_name,
      transformation_type: schema.productTransformations.transformation_type,
      yield_quantity_pieces: schema.productTransformations.yield_quantity_pieces,
    })
    .from(schema.productTransformations)
    .where(
      and(
        eq(schema.productTransformations.parent_product_id, 533),
        eq(schema.productTransformations.transformation_type, "BASE")
      )
    )
    .orderBy(schema.productTransformations.child_product_name);

  if (!baseRecipes.length) {
    console.log("❌ No se encontraron recetas BASE para el CANAL");
    return;
  }

  console.log(`📋 Encontradas ${baseRecipes.length} recetas BASE:\n`);
  for (const recipe of baseRecipes) {
    const yieldQty = Number(recipe.yield_quantity_pieces);
    const status = yieldQty === 2 ? "✅" : yieldQty === 1 ? "⚠️" : "❌";
    console.log(
      `${status} ${recipe.child_name}: yield=${yieldQty} piezas (esperado: 2)`
    );
  }

  // Count how many need to be fixed
  const needsFix = baseRecipes.filter(
    (r) => Number(r.yield_quantity_pieces) !== 2
  );

  if (needsFix.length > 0) {
    console.log(`\n🔧 Necesita corrección: ${needsFix.length} recetas`);
    console.log("Actualizando a 2 piezas...\n");

    for (const recipe of needsFix) {
      await db
        .update(schema.productTransformations)
        .set({ yield_quantity_pieces: "2" })
        .where(eq(schema.productTransformations.id, recipe.id));

      console.log(`✅ Actualizado: ${recipe.child_name} → 2 piezas`);
    }

    console.log("\n✅ Todas las recetas BASE actualizadas a 2 piezas");
  } else {
    console.log("\n✅ Todas las recetas BASE ya tienen la cantidad correcta (2)");
  }

  await client.end();
}

verifyAndFixRecipes().catch(console.error);
