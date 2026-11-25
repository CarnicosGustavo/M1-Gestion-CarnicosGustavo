/**
 * Tope en memoria para la server action de «olvidé mi contraseña».
 * El rate limit de better-auth (3/60 s) solo cubre el endpoint HTTP;
 * la pantalla oficial usa la server action y no pasa por ese router.
 */
export const LOGIN_RESET_WINDOW_MS = 60_000;
export const LOGIN_RESET_MAX_PER_WINDOW = 3;

const buckets = new Map<string, number[]>();

export function consumeLoginResetLimit(
	key: string,
	now = Date.now(),
): { ok: true } | { ok: false; retryAfterSec: number } {
	const normalized = key.trim().toLowerCase();
	if (!normalized) return { ok: true };
	const cutoff = now - LOGIN_RESET_WINDOW_MS;
	const recent = (buckets.get(normalized) ?? []).filter((ts) => ts > cutoff);
	if (recent.length >= LOGIN_RESET_MAX_PER_WINDOW) {
		buckets.set(normalized, recent);
		const oldest = recent[0] ?? now;
		const retryAfterSec = Math.max(
			1,
			Math.ceil((oldest + LOGIN_RESET_WINDOW_MS - now) / 1000),
		);
		return { ok: false, retryAfterSec };
	}
	recent.push(now);
	buckets.set(normalized, recent);
	return { ok: true };
}

export function resetLoginResetLimits(): void {
	buckets.clear();
}

export function clientIpFromHeaders(headers: Headers): string {
	const real = headers.get("x-real-ip")?.split(",")[0]?.trim();
	if (real) return real;
	const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
	if (forwarded) return forwarded;
	return "unknown";
}
