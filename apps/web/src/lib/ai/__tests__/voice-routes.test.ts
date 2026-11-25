import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	mock,
} from "bun:test";
import { createTestDb, SCHEMA_DDL } from "../../trpc/routers/__tests__/helpers";

const { pg, db } = createTestDb();
let currentUser: {
	id: string;
	name: string;
	email: string;
	role: string;
} | null = null;

mock.module("@/lib/db", () => ({ db, pglite: pg }));
mock.module("@/lib/auth-guard", () => ({
	getAuthUser: async () => currentUser,
}));

const { customers, products } = await import("@/lib/db/schema");
const {
	ANTONELLA_ALLOWED_ROLES,
	canUseAntonella,
	consumeAntonellaRateLimit,
	resetAntonellaRateLimits,
} = await import("../antonella-access");
const {
	buildVoiceKeyterms,
	handleSttPost,
	handleTtsPost,
	MAX_STT_BYTES,
	MAX_TTS_CHARS,
} = await import("../voice-routes");

const realFetch = globalThis.fetch;
let prevCarnicosKey: string | undefined;

beforeAll(async () => {
	await pg.exec(SCHEMA_DDL);
	await db.insert(customers).values([
		{ name: "Abarrotes Don Pepe", user_uid: "admin-1" },
		{ name: "Carnicería El Sol", user_uid: "system" },
	]);
	const prodRows = Array.from({ length: 95 }, (_, idx) => ({
		name: `PRODUCTO ${String(idx + 1).padStart(3, "0")}`,
		category: idx === 0 ? "Duplicado" : "Cortes",
		user_uid: "admin-1",
	}));
	await db.insert(products).values(prodRows);
});

afterAll(async () => {
	await pg.close();
});

beforeEach(() => {
	prevCarnicosKey = process.env.CARNICOS_XAI_API_KEY;
	process.env.CARNICOS_XAI_API_KEY = "test-carnicos-key";
	currentUser = {
		id: "admin-1",
		name: "Admin",
		email: "admin@test.com",
		role: "admin",
	};
	resetAntonellaRateLimits();
});

afterEach(() => {
	globalThis.fetch = realFetch;
	if (prevCarnicosKey === undefined) delete process.env.CARNICOS_XAI_API_KEY;
	else process.env.CARNICOS_XAI_API_KEY = prevCarnicosKey;
});

describe("antonella-access y voice-routes (P34-2, P34-6, P34-7)", () => {
	it("P34-2: control por rol default solo admin", () => {
		expect(ANTONELLA_ALLOWED_ROLES).toEqual(["admin"]);
		expect(canUseAntonella("admin")).toBe(true);
		expect(canUseAntonella("cajero")).toBe(false);
		expect(canUseAntonella("almacen")).toBe(false);
		expect(canUseAntonella(null)).toBe(false);
	});

	it("P34-2: rate limit por usuario en ventana de 60s", () => {
		const t0 = 1_000_000;
		for (let i = 0; i < 20; i++) {
			expect(consumeAntonellaRateLimit("u1", "stt", t0 + i).ok).toBe(true);
		}
		const blocked = consumeAntonellaRateLimit("u1", "stt", t0 + 100);
		expect(blocked.ok).toBe(false);
		// Otro usuario no se ve afectado
		expect(consumeAntonellaRateLimit("u2", "stt", t0 + 100).ok).toBe(true);
		// Tras 60s se libera
		expect(consumeAntonellaRateLimit("u1", "stt", t0 + 61_000).ok).toBe(true);
	});

	it("P34-2 /stt y /tts: 401 sin sesión y 403 para cajero", async () => {
		currentUser = null;
		const r1 = await handleSttPost(
			new Request("http://localhost/api/antonella/stt", { method: "POST" }),
		);
		expect(r1.status).toBe(401);

		currentUser = {
			id: "c1",
			name: "Cajero",
			email: "c@t.com",
			role: "cajero",
		};
		const r2 = await handleSttPost(
			new Request("http://localhost/api/antonella/stt", { method: "POST" }),
		);
		expect(r2.status).toBe(403);

		const r3 = await handleTtsPost(
			new Request("http://localhost/api/antonella/tts", {
				method: "POST",
				body: JSON.stringify({ text: "hola" }),
			}),
		);
		expect(r3.status).toBe(403);
	});

	it("P34-6 /stt: valida Content-Length ANTES de leer formData y rechaza MIME no audio", async () => {
		let formDataCalled = false;
		const bigReq = new Request("http://localhost/api/antonella/stt", {
			method: "POST",
			headers: {
				"content-length": String(MAX_STT_BYTES + 1),
				"content-type": "multipart/form-data; boundary=abc",
			},
		});
		bigReq.formData = async () => {
			formDataCalled = true;
			return new FormData();
		};
		const bigRes = await handleSttPost(bigReq);
		expect(bigRes.status).toBe(413);
		expect(formDataCalled).toBe(false);

		const form = new FormData();
		form.append(
			"audio",
			new Blob(["hola"], { type: "text/plain" }),
			"nota.txt",
		);
		const badMimeRes = await handleSttPost(
			new Request("http://localhost/api/antonella/stt", {
				method: "POST",
				body: form,
			}),
		);
		expect(badMimeRes.status).toBe(415);
	});

	it("P34-6 /tts: rechaza texto mayor a MAX_TTS_CHARS con 413", async () => {
		const res = await handleTtsPost(
			new Request("http://localhost/api/antonella/tts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text: "a".repeat(MAX_TTS_CHARS + 1) }),
			}),
		);
		expect(res.status).toBe(413);
	});

	it("P34-2 /tts: aplica rate limit 429", async () => {
		globalThis.fetch = mock(
			async () => new Response(new Uint8Array([1])),
		) as any;
		for (let i = 0; i < 30; i++) {
			const ok = await handleTtsPost(
				new Request("http://localhost/api/antonella/tts", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ text: "hola" }),
				}),
			);
			expect(ok.status).toBe(200);
		}
		const limited = await handleTtsPost(
			new Request("http://localhost/api/antonella/tts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text: "hola" }),
			}),
		);
		expect(limited.status).toBe(429);
	});

	it("P34-7 /stt: keyterms ordenados, sin Duplicado y sin dejar fuera clientes", async () => {
		let capturedKeyterms: string[] = [];
		globalThis.fetch = mock(async (_url: any, init: any) => {
			const body = init.body as FormData;
			capturedKeyterms = body.getAll("keyterm").map(String);
			return new Response(JSON.stringify({ text: "ok" }), { status: 200 });
		}) as any;

		const form = new FormData();
		form.append(
			"audio",
			new Blob(["m4a-data"], { type: "audio/mp4" }),
			"nota.m4a",
		);
		const res = await handleSttPost(
			new Request("http://localhost/api/antonella/stt", {
				method: "POST",
				body: form,
			}),
		);
		expect(res.status).toBe(200);
		expect(capturedKeyterms).toContain("Abarrotes Don Pepe");
		expect(capturedKeyterms).toContain("Carnicería El Sol");
		expect(capturedKeyterms).not.toContain("PRODUCTO 001"); // era category Duplicado
		expect(capturedKeyterms).toContain("PRODUCTO 002");

		// También con 100 productos + 10 clientes: clientes siguen incluidos (mitad/mitad)
		const mixed = buildVoiceKeyterms(
			Array.from({ length: 100 }, (_, i) => `Prod ${i}`),
			Array.from({ length: 10 }, (_, i) => `Cliente ${i}`),
		);
		expect(mixed).toHaveLength(100);
		expect(mixed.slice(0, 10)).toEqual(
			Array.from({ length: 10 }, (_, i) => `Cliente ${i}`),
		);
	});
});
