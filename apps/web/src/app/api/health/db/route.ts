import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function toSafeError(err: unknown) {
  if (err && typeof err === "object") {
    const anyErr = err as { name?: unknown; message?: unknown; code?: unknown };
    const name = typeof anyErr.name === "string" ? anyErr.name : "Error";
    const message = typeof anyErr.message === "string" ? anyErr.message : "Unknown error";
    const code = typeof anyErr.code === "string" ? anyErr.code : undefined;
    return { name, code, message: message.slice(0, 300) };
  }
  return { name: "Error", message: "Unknown error" };
}

export async function GET() {
  try {
    const result = await (db as any).execute(sql`select 1 as ok`);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: toSafeError(err) }, { status: 500 });
  }
}
