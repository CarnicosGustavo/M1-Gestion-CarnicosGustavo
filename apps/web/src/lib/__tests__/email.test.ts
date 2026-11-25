import { afterEach, describe, expect, it, mock } from "bun:test";
import {
	emailEnabled,
	escapeHtml,
	sendEmail,
	sendPasswordResetEmail,
} from "../email";

const realFetch = globalThis.fetch;
let prevKey: string | undefined;

afterEach(() => {
	globalThis.fetch = realFetch;
	if (prevKey === undefined) delete process.env.RESEND_API_KEY;
	else process.env.RESEND_API_KEY = prevKey;
});

function stashKey() {
	prevKey = process.env.RESEND_API_KEY;
}

describe("email (P35-4, P35-5)", () => {
	it("escapa HTML en el nombre y en el href del enlace", async () => {
		stashKey();
		process.env.RESEND_API_KEY = "test-resend-key";
		let body: any = null;
		globalThis.fetch = mock(async (_url: any, init: any) => {
			body = JSON.parse(init.body);
			return new Response(JSON.stringify({ id: "ok" }), { status: 200 });
		}) as any;

		await sendPasswordResetEmail(
			{
				email: "caja@example.com",
				name: `<img src=x onerror="alert(1)">`,
			},
			'https://example.com/login/nueva?token=abc"onclick=alert(1)',
		);

		expect(body.html).not.toContain("<img");
		expect(body.html).toContain(
			"&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
		);
		expect(body.html).toContain(
			'href="https://example.com/login/nueva?token=abc&quot;onclick=alert(1)"',
		);
		expect(body.html).not.toContain('token=abc"onclick');
		expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
	});

	it("sin clave no llama a Resend y lanza error genérico", async () => {
		stashKey();
		delete process.env.RESEND_API_KEY;
		expect(emailEnabled()).toBe(false);
		let called = 0;
		globalThis.fetch = mock(async () => {
			called += 1;
			return new Response("no", { status: 200 });
		}) as any;
		await expect(
			sendEmail({
				to: "a@b.com",
				subject: "x",
				html: "<p>x</p>",
				text: "x",
			}),
		).rejects.toThrow("email_not_configured");
		expect(called).toBe(0);
	});

	it("si Resend responde error, lanza y no lo trata como envío exitoso", async () => {
		stashKey();
		process.env.RESEND_API_KEY = "test-resend-key";
		globalThis.fetch = mock(
			async () =>
				new Response('{"message":"detalle interno resend xyz"}', {
					status: 500,
				}),
		) as any;
		await expect(
			sendPasswordResetEmail(
				{ email: "a@b.com", name: "Ana" },
				"https://example.com/login/nueva?token=zz",
			),
		).rejects.toThrow("email_send_failed");
	});
});
