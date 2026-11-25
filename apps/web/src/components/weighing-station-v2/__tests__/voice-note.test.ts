import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { matchVoiceNoteKey } from "../shortcuts";

function keyEvent(
	key: string,
	over: Partial<
		Pick<KeyboardEvent, "repeat" | "altKey" | "metaKey" | "ctrlKey" | "target">
	> = {},
) {
	return {
		key,
		repeat: false,
		altKey: false,
		metaKey: false,
		ctrlKey: false,
		target: null,
		...over,
	};
}

function fakeButton(confirm = false) {
	return {
		tagName: "BUTTON",
		dataset: confirm ? { voiceConfirm: "true" } : {},
		getAttribute: (name: string) =>
			confirm && name === "data-voice-confirm" ? "true" : null,
		closest: (selector: string) => {
			if (confirm && selector.includes("data-voice-confirm")) return {};
			if (selector.includes("button")) return {};
			return null;
		},
	} as unknown as EventTarget;
}

describe("P33-6 — nota de voz: Enter respeta botones y evita repetición", () => {
	test("Enter sin foco en otro botón confirma el pedido", () => {
		expect(
			matchVoiceNoteKey(keyEvent("Enter"), {
				canConfirm: true,
				hasOrder: true,
			}),
		).toBe("confirm");
	});

	test("Enter con foco en Cancelar, Editar, enlace o role=button NO confirma", () => {
		const cancelBtn = fakeButton(false);
		const link = {
			tagName: "A",
			closest: () => null,
		} as unknown as EventTarget;
		const roleBtn = {
			tagName: "DIV",
			closest: (s: string) => (s.includes("role='button'") ? {} : null),
		} as unknown as EventTarget;

		expect(
			matchVoiceNoteKey(keyEvent("Enter", { target: cancelBtn }), {
				canConfirm: true,
				hasOrder: true,
			}),
		).toBeNull();
		expect(
			matchVoiceNoteKey(keyEvent("Enter", { target: link }), {
				canConfirm: true,
				hasOrder: true,
			}),
		).toBeNull();
		expect(
			matchVoiceNoteKey(keyEvent("Enter", { target: roleBtn }), {
				canConfirm: true,
				hasOrder: true,
			}),
		).toBeNull();
	});

	test("Enter con foco en el botón Confirmar sí confirma", () => {
		expect(
			matchVoiceNoteKey(keyEvent("Enter", { target: fakeButton(true) }), {
				canConfirm: true,
				hasOrder: true,
			}),
		).toBe("confirm");
	});

	test("ignora event.repeat y no confirma si canConfirm es false (busy)", () => {
		expect(
			matchVoiceNoteKey(keyEvent("Enter", { repeat: true }), {
				canConfirm: true,
				hasOrder: true,
			}),
		).toBeNull();
		expect(
			matchVoiceNoteKey(keyEvent("e", { repeat: true }), {
				canConfirm: true,
				hasOrder: true,
			}),
		).toBeNull();
		expect(
			matchVoiceNoteKey(keyEvent("Enter"), {
				canConfirm: false,
				hasOrder: true,
			}),
		).toBeNull();
	});

	test("E abre Editar salvo al escribir en un campo", () => {
		expect(
			matchVoiceNoteKey(keyEvent("e"), { canConfirm: true, hasOrder: true }),
		).toBe("edit");
		const input = {
			tagName: "INPUT",
			isContentEditable: false,
			closest: () => null,
		} as unknown as EventTarget;
		expect(
			matchVoiceNoteKey(keyEvent("E", { target: input }), {
				canConfirm: true,
				hasOrder: true,
			}),
		).toBeNull();
	});

	test("voice-note y new-order-overlay tienen guardas contra repetición", () => {
		const vnSrc = readFileSync(
			join(import.meta.dir, "../overlays/voice-note.tsx"),
			"utf8",
		);
		const noSrc = readFileSync(
			join(import.meta.dir, "../overlays/new-order-overlay.tsx"),
			"utf8",
		);
		expect(vnSrc).toContain('data-voice-confirm="true"');
		expect(vnSrc).toContain("if (event.repeat)");
		expect(noSrc).toContain("if (event.repeat) return;");
	});
});
