import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

const redirects: string[] = [];
mock.module("next/navigation", () => ({
	redirect: (url: string) => {
		redirects.push(url);
		throw new Error(`NEXT_REDIRECT:${url}`);
	},
}));
mock.module("next/cache", () => ({
	revalidatePath: () => undefined,
}));

let headerBag = new Headers({ "x-real-ip": "203.0.113.10" });
mock.module("next/headers", () => ({
	headers: async () => headerBag,
}));

const requestPasswordReset = mock(async () => ({ ok: true }));
const resetPasswordApi = mock(async () => ({ ok: true }));
mock.module("@/lib/auth", () => ({
	auth: {
		api: {
			requestPasswordReset,
			resetPassword: resetPasswordApi,
		},
	},
}));

const { requestReset, resetPassword } = await import("../actions");
const { resetLoginResetLimits } = await import("@/lib/login-rate-limit");

let prevKey: string | undefined;

async function dest(fn: () => Promise<void>): Promise<string> {
	try {
		await fn();
		throw new Error("se esperaba un redirect");
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		const match = msg.match(/^NEXT_REDIRECT:(.*)$/);
		if (!match) throw e;
		return match[1];
	}
}

function form(entries: Record<string, string>): FormData {
	const data = new FormData();
	for (const [k, v] of Object.entries(entries)) data.set(k, v);
	return data;
}

beforeEach(() => {
	prevKey = process.env.RESEND_API_KEY;
	process.env.RESEND_API_KEY = "test-resend-key";
	redirects.length = 0;
	requestPasswordReset.mockReset();
	requestPasswordReset.mockImplementation(async () => ({ ok: true }));
	resetPasswordApi.mockReset();
	resetPasswordApi.mockImplementation(async () => ({ ok: true }));
	resetLoginResetLimits();
	headerBag = new Headers({ "x-real-ip": "203.0.113.10" });
});

afterEach(() => {
	if (prevKey === undefined) delete process.env.RESEND_API_KEY;
	else process.env.RESEND_API_KEY = prevKey;
	resetLoginResetLimits();
});

describe("requestReset (P35-3, P35-4, P35-5)", () => {
	it("responde igual exista o no el correo (anti-enumeración)", async () => {
		const known = await dest(() =>
			requestReset(form({ email: "cajero@example.com" })),
		);
		const unknown = await dest(() =>
			requestReset(form({ email: "nadie@example.com" })),
		);
		expect(known).toBe("/login/olvide?enviado=1");
		expect(unknown).toBe("/login/olvide?enviado=1");
		expect(requestPasswordReset).toHaveBeenCalledTimes(2);
	});

	it("sin clave no afirma un envío y no llama a better-auth", async () => {
		delete process.env.RESEND_API_KEY;
		const known = await dest(() =>
			requestReset(form({ email: "cajero@example.com" })),
		);
		const unknown = await dest(() =>
			requestReset(form({ email: "nadie@example.com" })),
		);
		expect(known).toBe("/login/olvide?error=envio");
		expect(unknown).toBe("/login/olvide?error=envio");
		expect(requestPasswordReset).not.toHaveBeenCalled();
	});

	it("si el envío falla, redirige a error genérico sin enumerar ni filtrar el cuerpo", async () => {
		requestPasswordReset.mockImplementation(async () => {
			throw new Error("Resend 500: detalle interno resend xyz");
		});
		const url = await dest(() =>
			requestReset(form({ email: "cajero@example.com" })),
		);
		expect(url).toBe("/login/olvide?error=envio");
		expect(url).not.toContain("cajero");
		expect(url).not.toContain("xyz");
	});

	it("aplica un tope de 3 intentos / 60 s por IP y por correo", async () => {
		for (let i = 0; i < 3; i++) {
			expect(
				await dest(() => requestReset(form({ email: "caja@example.com" }))),
			).toBe("/login/olvide?enviado=1");
		}
		expect(
			await dest(() => requestReset(form({ email: "caja@example.com" }))),
		).toBe("/login/olvide?error=limite");
		expect(requestPasswordReset).toHaveBeenCalledTimes(3);

		// Otra IP con el mismo correo también queda topeada (límite por correo)
		headerBag = new Headers({ "x-real-ip": "198.51.100.20" });
		expect(
			await dest(() => requestReset(form({ email: "caja@example.com" }))),
		).toBe("/login/olvide?error=limite");

		// Otra IP y otro correo sí pasan
		headerBag = new Headers({ "x-real-ip": "198.51.100.21" });
		expect(
			await dest(() => requestReset(form({ email: "otro@example.com" }))),
		).toBe("/login/olvide?enviado=1");
	});
});

describe("resetPassword (P35-5, P35-8)", () => {
	it("rechaza contraseña corta, distintas, demasiado larga y token ausente", async () => {
		expect(
			await dest(() =>
				resetPassword(
					form({ token: "tok", password: "short", confirm: "short" }),
				),
			),
		).toBe("/login/nueva?token=tok&error=corta");

		expect(
			await dest(() =>
				resetPassword(
					form({
						token: "tok",
						password: "correcta1",
						confirm: "correcta2",
					}),
				),
			),
		).toBe("/login/nueva?token=tok&error=distintas");

		expect(
			await dest(() =>
				resetPassword(
					form({
						token: "tok",
						password: "a".repeat(200),
						confirm: "a".repeat(200),
					}),
				),
			),
		).toBe("/login/nueva?token=tok&error=invalida");

		expect(
			await dest(() =>
				resetPassword(
					form({ token: "", password: "correcta1", confirm: "correcta1" }),
				),
			),
		).toBe("/login/olvide?error=enlace");
		expect(resetPasswordApi).not.toHaveBeenCalled();
	});

	it("token vencido o rechazado por better-auth va a enlace; el éxito entra con cambiada=1", async () => {
		resetPasswordApi.mockImplementation(async () => {
			throw new Error("INVALID_TOKEN");
		});
		expect(
			await dest(() =>
				resetPassword(
					form({
						token: "expired",
						password: "correcta1",
						confirm: "correcta1",
					}),
				),
			),
		).toBe("/login/olvide?error=enlace");

		resetPasswordApi.mockImplementation(async () => ({ ok: true }));
		expect(
			await dest(() =>
				resetPassword(
					form({
						token: "good",
						password: "correcta1",
						confirm: "correcta1",
					}),
				),
			),
		).toBe("/login?cambiada=1");
	});
});
