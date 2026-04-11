import { NextResponse } from "next/server";

export const runtime = "nodejs";

function parseDatabaseUrl(databaseUrl: string | undefined) {
  if (!databaseUrl) return null;
  try {
    const u = new URL(databaseUrl);
    const dbName = u.pathname.replace(/^\//, "") || null;
    return {
      protocol: u.protocol.replace(":", ""),
      host: u.hostname,
      port: u.port ? Number(u.port) : null,
      database: dbName,
      username: u.username || null,
      password_set: Boolean(u.password),
      params: {
        sslmode: u.searchParams.get("sslmode"),
      },
    };
  } catch {
    return { parse_error: true };
  }
}

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
      DATABASE_URL_parsed: parseDatabaseUrl(databaseUrl),
      BASE_URL_set: Boolean(baseUrl),
      BETTER_AUTH_URL_set: Boolean(betterAuthUrl),
    },
  });
}
