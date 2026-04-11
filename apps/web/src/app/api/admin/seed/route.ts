import { seed } from "@/lib/db/seed";
import { NextResponse } from "next/server";

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
      message: message.slice(0, 800),
      detail: detail?.slice(0, 800),
      hint: hint?.slice(0, 800),
      cause,
    };
  }
  return { name: "Error", message: "Unknown error" };
}

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
    return NextResponse.json({ ok: false, error: toSafeError(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
