import { timingSafeEqual } from "node:crypto";
import { getAuthUser } from "@/lib/auth-guard";

/**
 * Los endpoints de diagnóstico detallado (/api/health/env y /api/health/schema)
 * solo responden a:
 *  - un usuario con sesión y rol "admin", o
 *  - una petición con el header `x-health-token` igual a HEALTH_CHECK_TOKEN
 *    (si esa variable está definida; útil para monitoreo).
 * /api/health/db sigue siendo público (solo responde ok/error).
 */
export async function isHealthAuthorized(req: Request): Promise<boolean> {
	const expected = process.env.HEALTH_CHECK_TOKEN;
	const provided = req.headers.get("x-health-token");
	if (expected && provided) {
		const a = Buffer.from(provided);
		const b = Buffer.from(expected);
		if (a.length === b.length && timingSafeEqual(a, b)) return true;
	}
	try {
		const current = await getAuthUser();
		return current?.role === "admin";
	} catch {
		return false;
	}
}
