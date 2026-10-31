import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
	const headers = {
		"Cache-Control": "no-store",
	};

	if (!process.env.DATABASE_URL) {
		return NextResponse.json({ ok: false }, { status: 503, headers });
	}

	try {
		await db.execute(sql`select 1`);
		return NextResponse.json({ ok: true }, { status: 200, headers });
	} catch (error) {
		const name =
			typeof error === "object" && error !== null && "name" in error
				? String(error.name)
				: undefined;
		const code =
			typeof error === "object" && error !== null && "code" in error
				? String(error.code)
				: undefined;

		console.error("health/db: fallo", name, code);
		return NextResponse.json({ ok: false }, { status: 503, headers });
	}
}
