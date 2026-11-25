import { asc, inArray } from "drizzle-orm";
import {
	canUseAntonella,
	consumeAntonellaRateLimit,
} from "@/lib/ai/antonella-access";
import { xaiEnabled, xaiSpeak, xaiTranscribe } from "@/lib/ai/xai";
import { getAuthUser } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { customers, products } from "@/lib/db/schema";

if (typeof window !== "undefined") {
	throw new Error(
		"src/lib/ai/voice-routes.ts solo puede ejecutarse en el servidor.",
	);
}

export const MAX_STT_BYTES = 4 * 1024 * 1024;
export const MAX_TTS_CHARS = 2000;
export const MAX_KEYTERMS = 100;

export const ALLOWED_STT_MIME_TYPES = new Set([
	"audio/webm",
	"audio/ogg",
	"audio/mp4",
	"audio/mpeg",
	"audio/mp3",
	"audio/wav",
	"audio/x-m4a",
	"audio/aac",
]);

/**
 * Reparte el presupuesto de keyterms entre clientes y productos (ordenados y sin duplicados),
 * rellenando hasta `limit` si uno de los dos grupos usa menos de la mitad.
 */
export function buildVoiceKeyterms(
	productNames: Array<string | null | undefined>,
	customerNames: Array<string | null | undefined>,
	limit = MAX_KEYTERMS,
): string[] {
	const clean = (rows: Array<string | null | undefined>) => {
		const seen = new Set<string>();
		const out: string[] = [];
		for (const raw of rows) {
			const name = raw?.trim();
			if (!name || seen.has(name)) continue;
			seen.add(name);
			out.push(name);
		}
		return out;
	};

	const custs = clean(customerNames);
	const prods = clean(productNames);
	const half = Math.floor(limit / 2);

	const selected = new Set<string>();
	for (const name of custs.slice(0, half)) selected.add(name);
	for (const name of prods.slice(0, limit - half)) selected.add(name);

	// Si faltan términos por cubrir de cualquiera de los dos lados, completar hasta `limit`.
	for (const name of custs) {
		if (selected.size >= limit) break;
		selected.add(name);
	}
	for (const name of prods) {
		if (selected.size >= limit) break;
		selected.add(name);
	}

	return [...selected].slice(0, limit);
}

export async function handleSttPost(req: Request): Promise<Response> {
	const user = await getAuthUser();
	if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
	if (!canUseAntonella(user.role)) {
		return Response.json({ error: "forbidden" }, { status: 403 });
	}
	const rate = consumeAntonellaRateLimit(user.id, "stt");
	if (!rate.ok) {
		return Response.json(
			{ error: "rate_limited", retryAfterSec: rate.retryAfterSec },
			{
				status: 429,
				headers: { "Retry-After": String(rate.retryAfterSec) },
			},
		);
	}
	if (!xaiEnabled()) {
		return Response.json({ error: "voice_disabled" }, { status: 503 });
	}

	// Validar tamaño y tipo de petición antes de cargar formData en memoria.
	const rawLen = req.headers.get("content-length");
	if (rawLen !== null) {
		const contentLength = Number(rawLen);
		if (Number.isFinite(contentLength) && contentLength > MAX_STT_BYTES) {
			return Response.json({ error: "too_large" }, { status: 413 });
		}
	}
	const contentType = req.headers.get("content-type") ?? "";
	if (!contentType.toLowerCase().includes("multipart/form-data")) {
		return Response.json({ error: "invalid_content_type" }, { status: 400 });
	}

	const form = await req.formData().catch(() => null);
	const audio = form?.get("audio");
	if (!(audio instanceof Blob) || audio.size === 0) {
		return Response.json({ error: "no_audio" }, { status: 400 });
	}
	if (audio.size > MAX_STT_BYTES) {
		return Response.json({ error: "too_large" }, { status: 413 });
	}
	const mime = (audio.type || "").split(";")[0]?.trim().toLowerCase() ?? "";
	if (!ALLOWED_STT_MIME_TYPES.has(mime)) {
		return Response.json({ error: "unsupported_media_type" }, { status: 415 });
	}

	try {
		// Nombres del catálogo activo y clientes ayudan a que el dictado los escriba bien.
		const owners = [user.id, "system"];
		const [productRows, customerRows] = await Promise.all([
			db
				.select({ name: products.name, category: products.category })
				.from(products)
				.where(inArray(products.user_uid, owners))
				.orderBy(asc(products.name)),
			db
				.select({ name: customers.name })
				.from(customers)
				.where(inArray(customers.user_uid, owners))
				.orderBy(asc(customers.name)),
		]);
		const terms = buildVoiceKeyterms(
			productRows
				.filter((row) => row.category !== "Duplicado")
				.map((row) => row.name),
			customerRows.map((row) => row.name),
		);
		const text = await xaiTranscribe(audio, terms);
		return Response.json({ text });
	} catch (err) {
		console.error("[antonella/stt]", err instanceof Error ? err.message : err);
		return Response.json({ error: "stt_failed" }, { status: 502 });
	}
}

export async function handleTtsPost(req: Request): Promise<Response> {
	const user = await getAuthUser();
	if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
	if (!canUseAntonella(user.role)) {
		return Response.json({ error: "forbidden" }, { status: 403 });
	}
	const rate = consumeAntonellaRateLimit(user.id, "tts");
	if (!rate.ok) {
		return Response.json(
			{ error: "rate_limited", retryAfterSec: rate.retryAfterSec },
			{
				status: 429,
				headers: { "Retry-After": String(rate.retryAfterSec) },
			},
		);
	}
	if (!xaiEnabled()) {
		return Response.json({ error: "voice_disabled" }, { status: 503 });
	}

	const body = (await req.json().catch(() => ({}))) as { text?: unknown };
	const text = typeof body.text === "string" ? body.text.trim() : "";
	if (!text) return Response.json({ error: "empty" }, { status: 400 });
	if (text.length > MAX_TTS_CHARS) {
		return Response.json(
			{ error: "text_too_long", maxChars: MAX_TTS_CHARS },
			{ status: 413 },
		);
	}

	try {
		const audio = await xaiSpeak(text);
		return new Response(audio, {
			headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
		});
	} catch (err) {
		console.error("[antonella/tts]", err instanceof Error ? err.message : err);
		return Response.json({ error: "tts_failed" }, { status: 502 });
	}
}
