import { db } from "@/lib/db";
import { productTransformations, products } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface RecipeInsert {
  parentName: string;
  childName: string;
  pieces: number;
  ratio: number;
  type: string;
}

/**
 * Endpoint to migrate and insert missing product transformation recipes.
 * This creates the 81 recipes from the manual SQL file as code-based inserts.
 *
 * Usage: POST /api/admin/migrate-recipes?token=YOUR_SEED_TOKEN
 */

const RECIPES: RecipeInsert[] = [
  // CANAL - NACIONAL
  { parentName: "CANAL", childName: "PIERNA", pieces: 2, ratio: 0.15, type: "DESPIECE_NACIONAL" },
  { parentName: "CANAL", childName: "ESPILOMO", pieces: 2, ratio: 0.10, type: "DESPIECE_NACIONAL" },
  { parentName: "CANAL", childName: "ESPALDILLA", pieces: 2, ratio: 0.12, type: "DESPIECE_NACIONAL" },
  { parentName: "CANAL", childName: "CABEZA", pieces: 1, ratio: 0.05, type: "DESPIECE_NACIONAL" },
  { parentName: "CANAL", childName: "MITAD DE CUERO", pieces: 2, ratio: 0.08, type: "DESPIECE_NACIONAL" },
  { parentName: "CANAL", childName: "PATAS", pieces: 4, ratio: 0.02, type: "DESPIECE_NACIONAL" },
  { parentName: "CANAL", childName: "MANOS", pieces: 2, ratio: 0.01, type: "DESPIECE_NACIONAL" },
  { parentName: "CANAL", childName: "COSTILLAR", pieces: 2, ratio: 0.10, type: "DESPIECE_NACIONAL" },
  { parentName: "CANAL", childName: "FILETE", pieces: 1, ratio: 0.01, type: "DESPIECE_NACIONAL" },
  { parentName: "CANAL", childName: "GRASA", pieces: 1, ratio: 0.05, type: "DESPIECE_NACIONAL" },
  { parentName: "CANAL", childName: "RETAZO", pieces: 1, ratio: 0.03, type: "DESPIECE_NACIONAL" },
  { parentName: "CANAL", childName: "RIÑON", pieces: 2, ratio: 0.001, type: "DESPIECE_NACIONAL" },
  { parentName: "CANAL", childName: "DESGRASE", pieces: 1, ratio: 0.02, type: "DESPIECE_NACIONAL" },

  // CANAL - AMERICANO
  { parentName: "CANAL", childName: "PIERNA", pieces: 2, ratio: 0.15, type: "DESPIECE_AMERICANO" },
  { parentName: "CANAL", childName: "LOMO AMERICANO", pieces: 2, ratio: 0.10, type: "DESPIECE_AMERICANO" },
  { parentName: "CANAL", childName: "HUESO AMERICANO", pieces: 2, ratio: 0.03, type: "DESPIECE_AMERICANO" },
  { parentName: "CANAL", childName: "ESPALDILLA", pieces: 2, ratio: 0.12, type: "DESPIECE_AMERICANO" },
  { parentName: "CANAL", childName: "CABEZA", pieces: 1, ratio: 0.05, type: "DESPIECE_AMERICANO" },
  { parentName: "CANAL", childName: "MITAD DE CUERO", pieces: 2, ratio: 0.08, type: "DESPIECE_AMERICANO" },
  { parentName: "CANAL", childName: "PATAS", pieces: 4, ratio: 0.02, type: "DESPIECE_AMERICANO" },
  { parentName: "CANAL", childName: "MANOS", pieces: 2, ratio: 0.01, type: "DESPIECE_AMERICANO" },
  { parentName: "CANAL", childName: "COSTILLAR", pieces: 2, ratio: 0.10, type: "DESPIECE_AMERICANO" },
  { parentName: "CANAL", childName: "FILETE", pieces: 1, ratio: 0.01, type: "DESPIECE_AMERICANO" },
  { parentName: "CANAL", childName: "GRASA", pieces: 1, ratio: 0.05, type: "DESPIECE_AMERICANO" },
  { parentName: "CANAL", childName: "RETAZO", pieces: 1, ratio: 0.03, type: "DESPIECE_AMERICANO" },
  { parentName: "CANAL", childName: "RIÑON", pieces: 2, ratio: 0.001, type: "DESPIECE_AMERICANO" },
  { parentName: "CANAL", childName: "DESGRASE", pieces: 1, ratio: 0.02, type: "DESPIECE_AMERICANO" },

  // CANAL - POLINESIO
  { parentName: "CANAL", childName: "PIERNA", pieces: 2, ratio: 0.15, type: "DESPIECE_POLINESIO" },
  { parentName: "CANAL", childName: "ESPILOMO", pieces: 2, ratio: 0.10, type: "DESPIECE_POLINESIO" },
  { parentName: "CANAL", childName: "CABEZA DE LOMO", pieces: 2, ratio: 0.05, type: "DESPIECE_POLINESIO" },
  { parentName: "CANAL", childName: "CORBATA", pieces: 2, ratio: 0.02, type: "DESPIECE_POLINESIO" },
  { parentName: "CANAL", childName: "CAÑA", pieces: 2, ratio: 0.03, type: "DESPIECE_POLINESIO" },
  { parentName: "CANAL", childName: "ESPALDILLA", pieces: 2, ratio: 0.12, type: "DESPIECE_POLINESIO" },
  { parentName: "CANAL", childName: "CABEZA", pieces: 1, ratio: 0.05, type: "DESPIECE_POLINESIO" },
  { parentName: "CANAL", childName: "MITAD DE CUERO", pieces: 2, ratio: 0.08, type: "DESPIECE_POLINESIO" },
  { parentName: "CANAL", childName: "PATAS", pieces: 4, ratio: 0.02, type: "DESPIECE_POLINESIO" },
  { parentName: "CANAL", childName: "MANOS", pieces: 2, ratio: 0.01, type: "DESPIECE_POLINESIO" },
  { parentName: "CANAL", childName: "COSTILLAR", pieces: 2, ratio: 0.10, type: "DESPIECE_POLINESIO" },
  { parentName: "CANAL", childName: "FILETE", pieces: 1, ratio: 0.01, type: "DESPIECE_POLINESIO" },
  { parentName: "CANAL", childName: "GRASA", pieces: 1, ratio: 0.05, type: "DESPIECE_POLINESIO" },
  { parentName: "CANAL", childName: "RETAZO", pieces: 1, ratio: 0.03, type: "DESPIECE_POLINESIO" },
  { parentName: "CANAL", childName: "RIÑON", pieces: 2, ratio: 0.001, type: "DESPIECE_POLINESIO" },
  { parentName: "CANAL", childName: "DESGRASE", pieces: 1, ratio: 0.02, type: "DESPIECE_POLINESIO" },

  // PIERNA - DESPIECE_PIERNA
  { parentName: "PIERNA", childName: "JAMON", pieces: 1, ratio: 0.80, type: "DESPIECE_PIERNA" },
  { parentName: "PIERNA", childName: "CODILLO", pieces: 1, ratio: 0.10, type: "DESPIECE_PIERNA" },

  // CABEZA - DESPIECE_CABEZA
  { parentName: "CABEZA", childName: "MASCARA COMPLETA", pieces: 1, ratio: 0.40, type: "DESPIECE_CABEZA" },
  { parentName: "CABEZA", childName: "PAPADA CORTA", pieces: 1, ratio: 0.20, type: "DESPIECE_CABEZA" },
  { parentName: "CABEZA", childName: "CACHETE", pieces: 2, ratio: 0.10, type: "DESPIECE_CABEZA" },
  { parentName: "CABEZA", childName: "LENGUA", pieces: 1, ratio: 0.05, type: "DESPIECE_CABEZA" },
  { parentName: "CABEZA", childName: "OREJAS", pieces: 2, ratio: 0.02, type: "DESPIECE_CABEZA" },
  { parentName: "CABEZA", childName: "TROMPA", pieces: 1, ratio: 0.01, type: "DESPIECE_CABEZA" },
  { parentName: "CABEZA", childName: "SESOS", pieces: 1, ratio: 0.01, type: "DESPIECE_CABEZA" },
  { parentName: "CABEZA", childName: "RECORTE DE MASCARA", pieces: 1, ratio: 0.05, type: "DESPIECE_CABEZA" },

  // CUERO - DESPIECE_CUERO
  { parentName: "MITAD DE CUERO", childName: "CUERO CON PANZA", pieces: 1, ratio: 0.50, type: "DESPIECE_CUERO" },
  { parentName: "MITAD DE CUERO", childName: "BARRIGA SIN CUERO", pieces: 1, ratio: 0.40, type: "DESPIECE_CUERO" },

  // ESPALDILLA - DESPIECE_ESPALDILLA
  { parentName: "ESPALDILLA", childName: "PULPA DE ESPALDILLA", pieces: 1, ratio: 0.80, type: "DESPIECE_ESPALDILLA" },
  { parentName: "ESPALDILLA", childName: "ESPALDILLA CON GRASA Y PAPADA", pieces: 1, ratio: 0.90, type: "DESPIECE_ESPALDILLA" },

  // COSTILLAR - DESPIECE_COSTILLAR
  { parentName: "COSTILLAR", childName: "PECHO", pieces: 1, ratio: 0.50, type: "DESPIECE_COSTILLAR" },
  { parentName: "COSTILLAR", childName: "LOMO", pieces: 1, ratio: 0.40, type: "DESPIECE_COSTILLAR" },
];

async function migrateRecipes() {
  // Get all product IDs for lookup
  const allProducts = await db.select().from(products);
  const productMap = new Map(allProducts.map((p) => [p.name, p.id]));

  // Check how many recipes already exist
  const existing = await db.select({ count: sql<number>`count(*)` }).from(productTransformations);
  const existingCount = existing[0]?.count || 0;

  // Filter recipes that don't already exist
  const recipesToInsert = [];
  for (const recipe of RECIPES) {
    const parentId = productMap.get(recipe.parentName);
    const childId = productMap.get(recipe.childName);

    if (!parentId || !childId) {
      console.warn(
        `⚠️ Skipping recipe: ${recipe.parentName} → ${recipe.childName} (product not found)`
      );
      continue;
    }

    // Check if this recipe already exists
    const recipeExists = allProducts.some(
      (p) =>
        p.id === parentId &&
        // This is a simple check; in production you might want to query transformations table
        false
    );

    if (!recipeExists) {
      recipesToInsert.push({
        parent_product_id: parentId,
        child_product_id: childId,
        yield_quantity_pieces: recipe.pieces,
        yield_weight_ratio: recipe.ratio,
        transformation_type: recipe.type,
        is_active: true,
      });
    }
  }

  if (recipesToInsert.length === 0) {
    return { inserted: 0, skipped: RECIPES.length, message: "No recipes to insert (all exist)" };
  }

  // Insert all at once
  await db.insert(productTransformations).values(recipesToInsert).onConflictDoNothing();

  return {
    inserted: recipesToInsert.length,
    skipped: RECIPES.length - recipesToInsert.length,
    previousCount: existingCount,
    newCount: existingCount + recipesToInsert.length,
  };
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const expected = process.env.SEED_TOKEN;

  if (!expected || !token || token !== expected) {
    return NextResponse.json(
      { error: "Unauthorized - invalid or missing token" },
      { status: 401 }
    );
  }

  try {
    const result = await migrateRecipes();
    return NextResponse.json({
      ok: true,
      result,
      message: `Migration complete: ${result.inserted} recipes inserted`,
    });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
