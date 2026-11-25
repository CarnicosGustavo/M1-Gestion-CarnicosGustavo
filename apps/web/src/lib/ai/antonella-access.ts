import type { UserRole } from "@finopenpos/api";

if (typeof window !== "undefined") {
	throw new Error(
		"src/lib/ai/antonella-access.ts solo puede ejecutarse en el servidor.",
	);
}

/**
 * P34-2: Control de acceso único para Antonella (voz, /stt, /tts, chat y parseVoiceOrder).
 * Default seguro: solo "admin" hasta que Beto confirme otros roles.
 */
export const ANTONELLA_ALLOWED_ROLES: readonly UserRole[] = ["admin"];

export function canUseAntonella(role: string | null | undefined): boolean {
	if (!role) return false;
	return ANTONELLA_ALLOWED_ROLES.includes(role as UserRole);
}

export type AntonellaRateBucket = "stt" | "tts" | "chat" | "parseVoiceOrder";

export const ANTONELLA_RATE_WINDOW_MS = 60_000;

export const ANTONELLA_RATE_LIMITS: Record<AntonellaRateBucket, number> = {
	stt: 20,
	tts: 30,
	chat: 20,
	parseVoiceOrder: 20,
};

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
