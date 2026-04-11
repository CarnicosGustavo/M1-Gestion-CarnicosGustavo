import { seed } from "@/lib/db/seed";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function handle(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const mode = url.searchParams.get("mode") === "full" ? "full" : "auth";
  const expected = process.env.SEED_TOKEN;

  if (!expected || !token || token !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const result = await seed({ headers: new Headers(request.headers), mode });
    return NextResponse.json({ ok: true, mode, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
