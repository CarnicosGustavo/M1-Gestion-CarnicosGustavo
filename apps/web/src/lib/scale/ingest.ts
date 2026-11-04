/**
 * Ingesta de lecturas de básculas físicas (gateway ESP32 T-RSS3).
 * Contrato completo en docs/scale-ingest.md.
 *
 * - Apagador: SCALE_INGEST_ENABLED debe ser "true"; si no → 503 sin tocar la BD.
 * - Autenticación por dispositivo: SCALE_DEVICE_TOKENS_SHA256 =
 *   "deviceId:sha256hex,deviceId2:sha256hex". Solo hashes, nunca tokens.
 * - Idempotente por event_id: un reintento devuelve 200 "duplicate".
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { scaleReadings } from "@/lib/db/schema";

export const MAX_BODY_BYTES = 2048;
const MIN_WEIGHT_G = -50_000;
const MAX_WEIGHT_G = 2_000_000;
const WEIGHT_G_TOLERANCE = 2;
const GRAMS_PER_UNIT = { kg: 1000, g: 1, lb: 453.59237 } as const;
const DEVICE_ID_RE = /^[a-z0-9-]{1,64}$/;

type Env = Record<string, string | undefined>;

const nullableInt = z.number().int().nullable().optional();

export const scaleReadingSchema = z.object({
	event_id: z.uuid(),
	device_id: z.string().regex(DEVICE_ID_RE),
	seq: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
	weight: z.number().finite(),
	unit: z.enum(["kg", "g", "lb"]),
	weight_g: z.number().int().min(MIN_WEIGHT_G).max(MAX_WEIGHT_G),
	stable: z.boolean(),
	net: z.boolean().optional().default(false),
	raw: z.string().max(128).nullable().optional(),
	captured_at: z.iso.datetime({ offset: true }).nullable().optional(),
	order_id: nullableInt,
	order_line_id: nullableInt,
	piece_count: z.number().int().min(0).nullable().optional(),
});

export type ScaleReadingInput = z.infer<typeof scaleReadingSchema>;

function json(status: number, body: Record<string, unknown>) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "no-store",
		},
	});
}

export function isIngestEnabled(env: Env) {
	return env.SCALE_INGEST_ENABLED?.trim().toLowerCase() === "true";
}

/** Parsea "dev1:hex,dev2:hex" → Map(deviceId → hash). Ignora entradas mal formadas. */
export function parseDeviceTokenHashes(value: string | undefined) {
	const map = new Map<string, string>();
	for (const entry of (value ?? "").split(",")) {
		const [id, hash] = entry.trim().split(":");
		if (
			id &&
			hash &&
			DEVICE_ID_RE.test(id.trim()) &&
			/^[0-9a-f]{64}$/i.test(hash.trim())
		)
			map.set(id.trim(), hash.trim().toLowerCase());
	}
	return map;
}

function tokenMatches(token: string, expectedHashHex: string) {
	const actual = createHash("sha256").update(token, "utf8").digest();
	const expected = Buffer.from(expectedHashHex, "hex");
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function handleScaleIngest(
	req: Request,
	env: Env = process.env,
): Promise<Response> {
	if (!isIngestEnabled(env)) return json(503, { error: "ingest_disabled" });

	const contentType = req.headers.get("content-type") ?? "";
	if (!contentType.toLowerCase().startsWith("application/json"))
		return json(415, { error: "unsupported_media_type" });

	// --- Autenticación (antes de leer el cuerpo) ---
	const auth = req.headers.get("authorization") ?? "";
	const match = /^Bearer\s+(\S+)$/i.exec(auth);
	if (!match) return json(401, { error: "unauthorized" });
	const headerDeviceId = req.headers.get("x-device-id")?.trim() ?? "";
	const expectedHash = parseDeviceTokenHashes(
		env.SCALE_DEVICE_TOKENS_SHA256,
	).get(headerDeviceId);
	if (!expectedHash) return json(403, { error: "forbidden" });
	if (!tokenMatches(match[1], expectedHash))
		return json(401, { error: "unauthorized" });

	// --- Cuerpo ---
	const declared = Number(req.headers.get("content-length") ?? "0");
	if (declared > MAX_BODY_BYTES)
		return json(413, { error: "payload_too_large" });
	const text = await req.text();
	if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES)
		return json(413, { error: "payload_too_large" });

	let payload: unknown;
	try {
		payload = JSON.parse(text);
	} catch {
		return json(400, { error: "invalid_json" });
	}
	const parsed = scaleReadingSchema.safeParse(payload);
	if (!parsed.success)
		return json(400, {
			error: "invalid_body",
			issues: parsed.error.issues.map((i) => ({
				path: i.path.join("."),
				message: i.message,
			})),
		});
	const r = parsed.data;

	if (r.device_id !== headerDeviceId) return json(403, { error: "forbidden" });

	const expectedGrams = r.weight * GRAMS_PER_UNIT[r.unit];
	if (Math.abs(expectedGrams - r.weight_g) > WEIGHT_G_TOLERANCE)
		return json(400, {
			error: "invalid_body",
			issues: [{ path: "weight_g", message: "No coincide con weight y unit" }],
		});

	// --- Inserción idempotente ---
	const inserted = await db
		.insert(scaleReadings)
		.values({
			event_id: r.event_id,
			device_id: r.device_id,
			seq: r.seq,
			weight: r.weight.toFixed(3),
			unit: r.unit,
			weight_g: r.weight_g,
			stable: r.stable,
			net: r.net,
			raw: r.raw ?? null,
			captured_at: r.captured_at ? new Date(r.captured_at) : null,
			order_id: r.order_id ?? null,
			order_item_id: r.order_line_id ?? null,
			piece_count: r.piece_count ?? null,
		})
		.onConflictDoNothing({ target: scaleReadings.event_id })
		.returning({ id: scaleReadings.id });

	if (inserted.length > 0)
		return json(201, { status: "stored", id: inserted[0].id });

	const [existing] = await db
		.select({ id: scaleReadings.id, device_id: scaleReadings.device_id })
		.from(scaleReadings)
		.where(eq(scaleReadings.event_id, r.event_id))
		.limit(1);
	if (existing && existing.device_id === r.device_id)
		return json(200, { status: "duplicate", id: existing.id });
	return json(409, { error: "event_id_conflict" });
}
