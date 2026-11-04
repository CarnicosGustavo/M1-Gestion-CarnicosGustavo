/**
 * Obtiene el origen público de una solicitud detrás de un proxy inverso.
 */
export function getRequestOrigin(request: Request): string {
	try {
		const fallback = new URL(request.url);
		const forwardedProto = firstHeaderValue(
			request.headers.get("x-forwarded-proto"),
		);
		const protocol =
			forwardedProto === "http" || forwardedProto === "https"
				? forwardedProto
				: fallback.protocol.replace(/:$/, "");

		const forwardedHost = firstHeaderValue(
			request.headers.get("x-forwarded-host"),
		);
		const headerHost = firstHeaderValue(request.headers.get("host"));
		const host = forwardedHost ?? headerHost ?? fallback.host;

		const { hostname, port } = splitHost(host);
		const forwardedPort = firstHeaderValue(
			request.headers.get("x-forwarded-port"),
		);
		// El puerto interno de request.url (p. ej. 3000) solo aplica si el host también viene de ahí.
		const resolvedPort =
			port ??
			forwardedPort ??
			(forwardedHost || headerHost ? undefined : fallback.port || undefined);
		const authority = resolvedPort ? `${hostname}:${resolvedPort}` : hostname;

		return new URL(`${protocol}://${authority}`).origin;
	} catch {
		return new URL(request.url).origin;
	}
}

/**
 * Normaliza un origen válido o devuelve null si el valor está vacío o es inválido.
 */
export function normalizeOrigin(value: string | undefined): string | null {
	if (!value) {
		return null;
	}

	try {
		return new URL(value).origin;
	} catch {
		return null;
	}
}

/**
 * Compara un origen configurado con el origen público de la solicitud.
 */
export function originMatchesRequest(
	value: string | undefined,
	request: Request,
): boolean | null {
	const origin = normalizeOrigin(value);

	if (origin === null) {
		return null;
	}

	return origin === getRequestOrigin(request);
}

function firstHeaderValue(value: string | null): string | undefined {
	const firstValue = value?.split(",")[0]?.trim();

	return firstValue ? firstValue.toLowerCase() : undefined;
}

function splitHost(host: string): {
	hostname: string;
	port: string | undefined;
} {
	const normalizedHost = host.trim().toLowerCase();
	const url = new URL(`http://${normalizedHost}`);

	return {
		hostname: url.hostname,
		port: url.port || undefined,
	};
}
