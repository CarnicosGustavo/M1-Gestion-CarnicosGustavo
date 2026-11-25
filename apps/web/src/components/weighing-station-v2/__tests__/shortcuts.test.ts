import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { matchPesajeShortcut, SHORTCUT_ROWS } from "../shortcuts";

function event(
	key: string,
	init?: Partial<KeyboardEvent> & { target?: EventTarget | null },
) {
	return {
		key,
		code: key,
		metaKey: false,
		altKey: false,
		ctrlKey: false,
		shiftKey: false,
		repeat: false,
		target: null,
		...init,
	};
}

describe("matchPesajeShortcut", () => {
	test("módulos de la fila inferior abren su página en la pantalla 7", () => {
		expect(
			matchPesajeShortcut(event("e", { metaKey: true, code: "KeyE" })),
		).toEqual({ type: "page", page: "recetas" });
		expect(
			matchPesajeShortcut(event("f", { altKey: true, code: "KeyF" })),
		).toEqual({ type: "page", page: "frio" });
		expect(
			matchPesajeShortcut(event(",", { metaKey: true, code: "Comma" })),
		).toEqual({ type: "page", page: "config" });
	});

	test("Alt+Espacio habla con Antonella; Súper+G contado y Súper+Shift+G crédito (P33-7)", () => {
		expect(
			matchPesajeShortcut(event(" ", { altKey: true, code: "Space" })),
		).toEqual({ type: "voice" });
		expect(
			matchPesajeShortcut(event("g", { metaKey: true, code: "KeyG" })),
		).toEqual({ type: "command", command: "charge" });
		expect(
			matchPesajeShortcut(
				event("G", { metaKey: true, shiftKey: true, code: "KeyG" }),
			),
		).toEqual({ type: "command", command: "charge-credit" });
		const gRow = SHORTCUT_ROWS.find((row) => row.keys === "Súper+G");
		const shiftGRow = SHORTCUT_ROWS.find((row) => row.keys === "Súper+Shift+G");
		expect(gRow?.action).toMatch(/contado|efectivo/i);
		expect(shiftGRow?.action).toMatch(/crédito/i);
	});

	test("Súper y Alt enfocan teselas", () => {
		expect(matchPesajeShortcut(event("1", { metaKey: true }))).toEqual({
			type: "focus-tile",
			tile: 1,
		});
		expect(matchPesajeShortcut(event("5", { altKey: true }))).toEqual({
			type: "focus-tile",
			tile: 5,
		});
	});

	test("Súper+T abre tickets y Súper+Shift+T cicla el tema", () => {
		expect(matchPesajeShortcut(event("t", { metaKey: true }))).toEqual({
			type: "page",
			page: "tickets",
		});
		expect(
			matchPesajeShortcut(event("T", { metaKey: true, shiftKey: true })),
		).toEqual({ type: "cycle-theme" });
		expect(matchPesajeShortcut(event("o", { altKey: true }))).toEqual({
			type: "page",
			page: "pedidos",
		});
		expect(matchPesajeShortcut(event("b", { altKey: true }))).toEqual({
			type: "page",
			page: "conexion",
		});
		expect(
			matchPesajeShortcut(event("B", { altKey: true, shiftKey: true })),
		).toEqual({ type: "command", command: "power" });
	});

	test("Súper+7 enfoca la pantalla de funciones y usa la tecla física", () => {
		expect(matchPesajeShortcut(event("7", { metaKey: true }))).toEqual({
			type: "focus-tile",
			tile: 7,
		});
		// macOS: Alt+C produce «ç» en key, pero code sigue siendo KeyC
		expect(
			matchPesajeShortcut(event("ç", { altKey: true, code: "KeyC" })),
		).toEqual({ type: "page", page: "recipiente" });
		expect(matchPesajeShortcut(event("?"))).toEqual({
			type: "page",
			page: "atajos",
		});
	});

	test("Espacio captura, Enter confirma y Esc cierra", () => {
		expect(matchPesajeShortcut(event(" "))).toEqual({ type: "capture" });
		expect(matchPesajeShortcut(event("Enter"))).toEqual({ type: "confirm" });
		expect(matchPesajeShortcut(event("Escape"))).toEqual({ type: "close" });
	});

	test("no intercepta letras ni espacio al escribir en un input", () => {
		const input = {
			tagName: "INPUT",
			isContentEditable: false,
			closest: () => null,
		} as unknown as EventTarget;
		// HTMLElement check fails for this fake; also test with a real input if in DOM
		const real =
			typeof document !== "undefined" ? document.createElement("input") : input;
		expect(matchPesajeShortcut(event(" ", { target: real }))).toBeNull();
		expect(matchPesajeShortcut(event("j", { target: real }))).toBeNull();
		expect(
			matchPesajeShortcut(event("t", { metaKey: true, target: real })),
		).toEqual({ type: "page", page: "tickets" });
	});

	test("no usa Ctrl (evita choques con el navegador)", () => {
		expect(matchPesajeShortcut(event("t", { ctrlKey: true }))).toBeNull();
		expect(
			matchPesajeShortcut(event("t", { ctrlKey: true, metaKey: true })),
		).toBeNull();
	});

	test("la hoja de atajos documenta los respaldos con Alt", () => {
		expect(SHORTCUT_ROWS.some((row) => row.fallback.includes("Alt"))).toBe(
			true,
		);
	});

	function fakeEl(tagName: string, closestHits = false) {
		return {
			tagName,
			isContentEditable: false,
			closest: (selector: string) => {
				if (!closestHits) return null;
				if (
					selector.includes("button") ||
					selector.includes("role='button'") ||
					selector.includes("a,")
				) {
					return {};
				}
				return null;
			},
		} as unknown as EventTarget;
	}

	test("Enter o Espacio en un botón, enlace o role=button no registran ni capturan", () => {
		const button = fakeEl("BUTTON");
		const link = fakeEl("A");
		const roleButton = fakeEl("DIV", true);
		expect(matchPesajeShortcut(event("Enter", { target: button }))).toBeNull();
		expect(matchPesajeShortcut(event(" ", { target: button }))).toBeNull();
		expect(matchPesajeShortcut(event("Enter", { target: link }))).toBeNull();
		expect(matchPesajeShortcut(event(" ", { target: link }))).toBeNull();
		expect(
			matchPesajeShortcut(event("Enter", { target: roleButton })),
		).toBeNull();
		expect(matchPesajeShortcut(event(" ", { target: roleButton }))).toBeNull();
		// Sin foco interactivo siguen funcionando
		expect(matchPesajeShortcut(event("Enter"))).toEqual({ type: "confirm" });
		expect(matchPesajeShortcut(event(" "))).toEqual({ type: "capture" });
		// Los atajos con Súper sí se pueden usar con foco en un botón
		// (#33: Súper+T abre la página de tickets, no el overlay).
		expect(
			matchPesajeShortcut(event("t", { metaKey: true, target: button })),
		).toEqual({ type: "page", page: "tickets" });
	});

	test("ignora event.repeat y deshabilita atajos mientras isPending", () => {
		expect(matchPesajeShortcut(event("Enter", { repeat: true }))).toBeNull();
		expect(matchPesajeShortcut(event(" ", { repeat: true }))).toBeNull();
		expect(
			matchPesajeShortcut(event("t", { metaKey: true, repeat: true })),
		).toBeNull();
		expect(matchPesajeShortcut(event("Enter"), { isPending: true })).toBeNull();
		expect(matchPesajeShortcut(event(" "), { isPending: true })).toBeNull();
		expect(
			matchPesajeShortcut(event("t", { metaKey: true }), { isPending: true }),
		).toBeNull();
		expect(matchPesajeShortcut(event("Escape"), { isPending: true })).toEqual({
			type: "close",
		});
	});

	test("la UI, ayuda, tecla Fn y prompts usan Antonella (sin Peggy visible)", () => {
		const helpActions = SHORTCUT_ROWS.map((row) => row.action).join("\n");
		expect(helpActions).toContain("Antonella");
		expect(helpActions).not.toMatch(/Peggy/);
		for (const rel of [
			"../pesaje-station.tsx",
			"../tiles/fn-pages.tsx",
			"../overlays/voice-note.tsx",
			"../overlays/new-order-overlay.tsx",
			"../../../lib/trpc/routers/antonella.ts",
			"../../../lib/ai/xai.ts",
		]) {
			const src = readFileSync(new URL(rel, import.meta.url), "utf8");
			expect(src).not.toContain("Peggy");
		}
	});
});
