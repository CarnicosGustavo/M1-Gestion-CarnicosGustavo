import { describe, expect, test } from "bun:test";
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
		target: null,
		...init,
	};
}

describe("matchPesajeShortcut", () => {
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
			type: "overlay",
			overlay: "tickets",
		});
		expect(
			matchPesajeShortcut(event("T", { metaKey: true, shiftKey: true })),
		).toEqual({ type: "cycle-theme" });
		expect(matchPesajeShortcut(event("o", { altKey: true }))).toEqual({
			type: "overlay",
			overlay: "orders",
		});
		expect(matchPesajeShortcut(event("b", { altKey: true }))).toEqual({
			type: "overlay",
			overlay: "scale",
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
		).toEqual({ type: "overlay", overlay: "tickets" });
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
});
