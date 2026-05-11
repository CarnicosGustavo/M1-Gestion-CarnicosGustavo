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

const REQUIRED_USER_COLUMNS = [
  "id",
  "name",
  "email",
  "email_verified",
  "image",
  "created_at",
  "updated_at",
  "role",
  "openId",
  "loginMethod",
  "lastSignedIn",
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
    const info = await client<
      { current_database: string; current_user: string; search_path: string }[]
    >`
      select
        current_database() as current_database,
        current_user as current_user,
        current_setting('search_path') as search_path
    `;

    const resolved = await client<{ user_reg: string | null }[]>`
      select to_regclass('user') as user_reg
    `;

    const rows = await client<{
      rel: string;
      reg: string | null;
    }[]>`
      select rel, to_regclass(rel) as reg
      from unnest(${REQUIRED_TABLES as unknown as string[]}::text[]) as rel
    `;

    const found = Object.fromEntries(rows.map((r) => [r.rel, r.reg]));
    const missing = rows.filter((r) => !r.reg).map((r) => r.rel);

    const cols = await client<{ column_name: string }[]>`
      select c.column_name
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'user'
    `;
    const existingUserColumns = cols.map((c) => c.column_name);
    const missingUserColumns = REQUIRED_USER_COLUMNS.filter(
      (c) => !existingUserColumns.includes(c),
    );

    const userTables = await client<{ table_schema: string; table_name: string }[]>`
      select table_schema, table_name
      from information_schema.tables
      where table_name = 'user'
      order by table_schema
    `;

    return NextResponse.json({
      ok: true,
      db: info[0] ?? null,
      resolved: {
        user_reg: resolved[0]?.user_reg ?? null,
        user_tables: userTables,
      },
      found,
      missing,
      user_columns: {
        required: REQUIRED_USER_COLUMNS,
        existing: existingUserColumns,
        missing: missingUserColumns,
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: toSafeError(err) }, { status: 500 });
  } finally {
    await client.end({ timeout: 2 });
  }
}
