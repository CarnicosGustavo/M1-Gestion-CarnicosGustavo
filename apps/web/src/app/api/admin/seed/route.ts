import { seed } from "@/lib/db/seed";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function handle(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const expected = process.env.SEED_TOKEN;

  if (!expected || !token || token !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    await seed({ headers: new Headers(request.headers) });
    return NextResponse.json({ ok: true });
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
