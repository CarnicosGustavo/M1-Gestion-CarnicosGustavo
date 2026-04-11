import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL;
  const baseUrl = process.env.BASE_URL;
  const betterAuthUrl = process.env.BETTER_AUTH_URL;

  return NextResponse.json({
    ok: true,
    env: {
      DATABASE_URL_set: Boolean(databaseUrl),
      DATABASE_URL_kind: databaseUrl
        ? databaseUrl.includes("pooler.supabase.com")
          ? "supabase_pooler"
          : databaseUrl.includes("supabase.co")
            ? "supabase_direct"
            : "other"
        : "missing",
      BASE_URL_set: Boolean(baseUrl),
      BETTER_AUTH_URL_set: Boolean(betterAuthUrl),
    },
  });
}
