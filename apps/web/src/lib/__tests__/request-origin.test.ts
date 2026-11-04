import { describe, expect, test } from "bun:test";
import {
	getRequestOrigin,
	normalizeOrigin,
	originMatchesRequest,
} from "../request-origin";

describe("getRequestOrigin", () => {
	test("usa el protocolo y host públicos enviados por el proxy", () => {
		const request = new Request("http://0.0.0.0:3000/api/health/env", {
			headers: {
				host: "0.0.0.0:3000",
				"x-forwarded-proto": "https",
				"x-forwarded-host": "carnicos.example.test",
			},
		});

		expect(getRequestOrigin(request)).toBe("https://carnicos.example.test");
	});

	test("caso Traefik en Coolify: host público sin puerto y request.url interno", () => {
		const request = new Request("http://0.0.0.0:3000/api/health/env", {
			headers: {
				host: "carnicos.2.25.92.86.sslip.io",
				"x-forwarded-proto": "http",
				"x-forwarded-host": "carnicos.2.25.92.86.sslip.io",
			},
		});

		expect(getRequestOrigin(request)).toBe(
			"http://carnicos.2.25.92.86.sslip.io",
		);
		expect(
			originMatchesRequest("http://carnicos.2.25.92.86.sslip.io", request),
		).toBe(true);
	});

	test("omite el puerto 443 en https", () => {
		const request = new Request("http://0.0.0.0:3000/api/health/env", {
			headers: {
				"x-forwarded-proto": "https",
				"x-forwarded-host": "carnicos.example.test",
				"x-forwarded-port": "443",
			},
		});

		expect(getRequestOrigin(request)).toBe("https://carnicos.example.test");
	});

	test("omite el puerto 80 en http", () => {
		const request = new Request("http://0.0.0.0:3000/api/health/env", {
			headers: {
				"x-forwarded-proto": "http",
				"x-forwarded-host": "carnicos.example.test",
				"x-forwarded-port": "80",
			},
		});

		expect(getRequestOrigin(request)).toBe("http://carnicos.example.test");
	});

	test("conserva un puerto no por defecto", () => {
		const request = new Request("http://0.0.0.0:3000/api/health/env", {
			headers: {
				"x-forwarded-proto": "https",
				"x-forwarded-host": "carnicos.example.test",
				"x-forwarded-port": "8443",
			},
		});

		expect(getRequestOrigin(request)).toBe(
			"https://carnicos.example.test:8443",
		);
	});

	test("toma el primer valor de x-forwarded-host", () => {
		const request = new Request("http://0.0.0.0:3000/api/health/env", {
			headers: {
				"x-forwarded-proto": "https",
				"x-forwarded-host": "carnicos.example.test, proxy.internal",
			},
		});

		expect(getRequestOrigin(request)).toBe("https://carnicos.example.test");
	});

	test("normaliza el host a minúsculas", () => {
		const request = new Request("http://0.0.0.0:3000/api/health/env", {
			headers: {
				"x-forwarded-proto": "https",
				"x-forwarded-host": "CARNICOS.EXAMPLE.TEST",
			},
		});

		expect(getRequestOrigin(request)).toBe("https://carnicos.example.test");
	});

	test("usa el header host cuando no hay headers forwarded", () => {
		const request = new Request("http://0.0.0.0:3000/api/health/env", {
			headers: {
				host: "carnicos.example.test",
			},
		});

		expect(getRequestOrigin(request)).toBe("http://carnicos.example.test");
	});

	test("usa request.url cuando no hay headers de host", () => {
		const request = new Request("http://0.0.0.0:3000/api/health/env");

		expect(getRequestOrigin(request)).toBe("http://0.0.0.0:3000");
	});

	test("ignora un protocolo forwarded inválido", () => {
		const request = new Request("https://0.0.0.0:3000/api/health/env", {
			headers: {
				"x-forwarded-proto": "ftp",
				"x-forwarded-host": "carnicos.example.test",
			},
		});

		expect(getRequestOrigin(request)).toBe("https://carnicos.example.test");
	});
});

describe("normalizeOrigin", () => {
	test("elimina el puerto 443 de https", () => {
		expect(normalizeOrigin("https://carnicos.example.test:443")).toBe(
			"https://carnicos.example.test",
		);
	});

	test("devuelve null para valores vacíos o inválidos", () => {
		expect(normalizeOrigin(undefined)).toBeNull();
		expect(normalizeOrigin("")).toBeNull();
		expect(normalizeOrigin("no-es-una-url")).toBeNull();
	});
});

describe("originMatchesRequest", () => {
	const request = new Request("http://0.0.0.0:3000/api/health/env", {
		headers: {
			host: "0.0.0.0:3000",
			"x-forwarded-proto": "https",
			"x-forwarded-host": "carnicos.example.test",
		},
	});

	test("devuelve true con una barra final y una ruta", () => {
		expect(
			originMatchesRequest("https://carnicos.example.test/", request),
		).toBe(true);
		expect(
			originMatchesRequest("https://carnicos.example.test/api/health", request),
		).toBe(true);
	});

	test("devuelve false con otro host", () => {
		expect(originMatchesRequest("https://otro.example.test", request)).toBe(
			false,
		);
	});

	test("devuelve false si difiere el protocolo", () => {
		expect(originMatchesRequest("http://carnicos.example.test", request)).toBe(
			false,
		);
	});

	test("devuelve null con valores vacíos o inválidos", () => {
		expect(originMatchesRequest(undefined, request)).toBeNull();
		expect(originMatchesRequest("", request)).toBeNull();
		expect(originMatchesRequest("no-es-una-url", request)).toBeNull();
	});
});
