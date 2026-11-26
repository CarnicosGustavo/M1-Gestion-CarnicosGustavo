if (typeof window !== "undefined") {
	throw new Error(
		"src/lib/ai/antonella-access.ts solo puede ejecutarse en el servidor.",
	);
}

export {
	ANTONELLA_ALLOWED_ROLES,
	canUseAntonella,
} from "./antonella-roles";

/**
 * P34-2: Control de acceso único para Antonella (voz, /stt, /tts, chat y parseVoiceOrder).
 * La lista de roles vive en antonella-roles.ts (también la usa la UI).
 */

export type AntonellaRateBucket = "stt" | "tts" | "chat" | "parseVoiceOrder";

export const ANTONELLA_RATE_WINDOW_MS = 60_000;

export const ANTONELLA_RATE_LIMITS: Record<AntonellaRateBucket, number> = {
	stt: 20,
	tts: 30,
	chat: 20,
	parseVoiceOrder: 20,
};

/**
 * P36-2: el tope vive en un Map de este proceso. Basta por ahora: la
 * producción corre en un solo contenedor de Coolify, no en serverless,
 * así que no hay varias instancias ni cold starts que reinicien el
 * contador. Si más adelante se escala a más de un proceso, habría que
 * moverlo a un almacén compartido.
 */
const buckets = new Map<string, number[]>();

export function consumeAntonellaRateLimit(
	userId: string,
	bucket: AntonellaRateBucket,
	now = Date.now(),
): { ok: true } | { ok: false; retryAfterSec: number } {
	const limit = ANTONELLA_RATE_LIMITS[bucket];
	const key = `${bucket}:${userId}`;
	const cutoff = now - ANTONELLA_RATE_WINDOW_MS;
	const recent = (buckets.get(key) ?? []).filter((ts) => ts > cutoff);
	if (recent.length >= limit) {
		buckets.set(key, recent);
		const oldest = recent[0] ?? now;
		const retryAfterSec = Math.max(
			1,
			Math.ceil((oldest + ANTONELLA_RATE_WINDOW_MS - now) / 1000),
		);
		return { ok: false, retryAfterSec };
	}
	recent.push(now);
	buckets.set(key, recent);
	return { ok: true };
}

export function resetAntonellaRateLimits(): void {
	buckets.clear();
}
