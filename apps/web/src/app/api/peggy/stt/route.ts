import { inArray } from "drizzle-orm";
import { xaiEnabled, xaiTranscribe } from "@/lib/ai/xai";
import { getAuthUser } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { customers, products } from "@/lib/db/schema";

// Peggy escucha: nota de voz (webm/opus del navegador) → texto en español.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
	const user = await getAuthUser();
	if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
	if (!xaiEnabled()) {
		return Response.json({ error: "voice_disabled" }, { status: 503 });
	}
	const form = await req.formData().catch(() => null);
	const audio = form?.get("audio");
	if (!(audio instanceof Blob) || audio.size === 0) {
		return Response.json({ error: "no_audio" }, { status: 400 });
	}
	if (audio.size > MAX_BYTES) {
		return Response.json({ error: "too_large" }, { status: 413 });
	}
	try {
		// Nombres del catálogo y clientes ayudan a que el dictado los escriba bien.
		const owners = [user.id, "system"];
		const [productRows, customerRows] = await Promise.all([
			db
				.select({ name: products.name })
				.from(products)
				.where(inArray(products.user_uid, owners)),
			db
				.select({ name: customers.name })
				.from(customers)
				.where(inArray(customers.user_uid, owners)),
		]);
		const terms = [
			...new Set(
				[...productRows, ...customerRows]
					.map((row) => row.name?.trim())
					.filter((name): name is string => Boolean(name)),
			),
		];
		const text = await xaiTranscribe(audio, terms);
		return Response.json({ text });
	} catch (err) {
		console.error("[peggy/stt]", err instanceof Error ? err.message : err);
		return Response.json({ error: "stt_failed" }, { status: 502 });
	}
}
