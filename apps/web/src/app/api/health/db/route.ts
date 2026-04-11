import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import postgres from "postgres";

export const runtime = "nodejs";

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
      message: message.slice(0, 600),
      detail: detail?.slice(0, 600),
      hint: hint?.slice(0, 600),
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
      { status: 500 },
    );
  }

  try {
    const drizzleResult = await (db as any).execute(sql`select 1 as ok`);
    const client = postgres(databaseUrl, {
      ssl: "require",
      ...(databaseUrl.includes("pooler.supabase") ? { prepare: false } : null),
    });
    const rawResult = await client`select 1 as ok`;
    await client.end({ timeout: 2 });
    return NextResponse.json({ ok: true, drizzleResult, rawResult });
  } catch (err) {
    return NextResponse.json({ ok: false, error: toSafeError(err) }, { status: 500 });
  }
}
