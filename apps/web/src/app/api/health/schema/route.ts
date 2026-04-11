import { NextResponse } from "next/server";
import postgres from "postgres";

export const runtime = "nodejs";

const REQUIRED_TABLES = [
  'public."user"',
  "public.account",
  "public.session",
  "public.verification",
  "public.products",
  "public.customers",
  "public.orders",
  "public.order_items",
  "public.transactions",
  "public.payment_methods",
  "public.product_transformations",
  "public.inventory_transactions",
] as const;

function toSafeError(err: unknown) {
  if (err && typeof err === "object") {
    const anyErr = err as {
      name?: unknown;
      message?: unknown;
      code?: unknown;
      detail?: unknown;
      hint?: unknown;
      severity?: unknown;
      cause?: unknown;
    };
    const name = typeof anyErr.name === "string" ? anyErr.name : "Error";
    const message = typeof anyErr.message === "string" ? anyErr.message : "Unknown error";
    const code = typeof anyErr.code === "string" ? anyErr.code : undefined;
    const detail = typeof anyErr.detail === "string" ? anyErr.detail : undefined;
    const hint = typeof anyErr.hint === "string" ? anyErr.hint : undefined;
    const severity = typeof anyErr.severity === "string" ? anyErr.severity : undefined;
    const cause = anyErr.cause ? toSafeError(anyErr.cause) : undefined;
    return {
      name,
      code,
      severity,
      message: message.slice(0, 800),
      detail: detail?.slice(0, 800),
      hint: hint?.slice(0, 800),
      cause,
    };
  }
  return { name: "Error", message: "Unknown error" };
}

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json(
      { ok: false, error: { name: "Error", message: "DATABASE_URL is not set" } },
      { status: 500 }
    );
  }

  const client = postgres(databaseUrl, {
    ssl: "require",
    ...(databaseUrl.includes("pooler.supabase") ? { prepare: false } : null),
  });

  try {
    const rows = await client<{
      rel: string;
      reg: string | null;
    }[]>`
      select rel, to_regclass(rel) as reg
      from unnest(${REQUIRED_TABLES as unknown as string[]}::text[]) as rel
    `;

    const found = Object.fromEntries(rows.map((r) => [r.rel, r.reg]));
    const missing = rows.filter((r) => !r.reg).map((r) => r.rel);

    return NextResponse.json({
      ok: true,
      found,
      missing,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: toSafeError(err) }, { status: 500 });
  } finally {
    await client.end({ timeout: 2 });
  }
}
