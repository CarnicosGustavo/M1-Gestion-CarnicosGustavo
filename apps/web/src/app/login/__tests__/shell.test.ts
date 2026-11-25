import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("portada / login shell (P35-1, P35-2, P35-6, P35-7)", () => {
	it("permite scroll, reserva espacio para cookies y no anida <main>", () => {
		const shell = readFileSync(join(import.meta.dir, "../shell.tsx"), "utf8");
		expect(shell).toContain("overflow-x-hidden");
		expect(shell).toContain("min-h-dvh");
		expect(shell).toContain("pb-32");
		expect(shell).not.toContain("overflow-hidden");
		expect(shell).not.toMatch(/<main\b/);
		expect(shell).toContain('alt=""');
		expect(shell).toContain('aria-hidden="true"');
		expect(shell).toContain("focus-visible:ring-2");
	});

	it("«Entrando…» solo es el pendingLabel por defecto; olvide/nueva usan otro", () => {
		const shell = readFileSync(join(import.meta.dir, "../shell.tsx"), "utf8");
		expect(shell).toContain('pendingLabel = "Entrando…"');
		expect(shell).toContain("pending ? pendingLabel : label");

		const login = readFileSync(join(import.meta.dir, "../page.tsx"), "utf8");
		const olvide = readFileSync(
			join(import.meta.dir, "../olvide/page.tsx"),
			"utf8",
		);
		const nueva = readFileSync(
			join(import.meta.dir, "../nueva/page.tsx"),
			"utf8",
		);
		expect(login).toContain("<SubmitKey");
		expect(login).not.toContain("pendingLabel");
		expect(olvide).toContain('pendingLabel="Enviando…"');
		expect(nueva).toContain('pendingLabel="Guardando…"');
	});

	it("deja redirectTo fijo en /login/nueva", () => {
		const src = readFileSync(join(import.meta.dir, "../actions.ts"), "utf8");
		const block = src.slice(src.indexOf("requestReset"));
		expect(block).toContain('redirectTo: "/login/nueva"');
		expect(block).not.toMatch(/redirectTo:\s*formData|redirectTo:\s*email/);
	});
});
