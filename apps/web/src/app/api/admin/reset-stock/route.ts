import { db } from "@/lib/db";
import { products, inventoryTransactions } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Endpoint to reset all product stock to zero.
 * This clears stock_pieces, stock_kg, and in_stock for all products.
 * Also records an inventory transaction for audit trail.
 *
 * Usage: POST /api/admin/reset-stock?token=YOUR_SEED_TOKEN
 */

async function resetStock() {
  const allProducts = await db.select().from(products);

  // Create inventory transactions for audit trail
  const transactions = allProducts.map((product) => ({
    product_id: product.id,
    quantity_change_pieces: -product.stock_pieces,
    quantity_change_kg: product.stock_kg ? String(-Number(product.stock_kg)) : "0",
    transaction_type: "RESET",
    reference_id: null,
    notes: "System reset - clearing all stock",
  }));

  // Insert audit transactions
  if (transactions.length > 0) {
    await db.insert(inventoryTransactions).values(transactions);
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

  return {
    productsReset: allProducts.length,
    transactionsLogged: transactions.length,
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
    const result = await resetStock();
    return NextResponse.json({
      ok: true,
      result,
      message: `Stock reset complete: ${result.productsReset} products cleared, ${result.transactionsLogged} audit transactions logged`,
    });
  } catch (error) {
    console.error("Reset stock error:", error);
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
