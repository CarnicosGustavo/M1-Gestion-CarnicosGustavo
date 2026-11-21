import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
	appendCancelAuditNote,
	CANCEL_AUDIT_PREFIX,
	cancelConfirmSummaryText,
	formatCancelActor,
	formatCancelWhen,
	formatPesosFromCents,
	stripCancelAuditNotes,
} from "@/lib/orders/cancel-audit";

describe("cancel-audit — confirmación y nota al cancelar", () => {
	it("formatea centavos a pesos y la hora en America/Mexico_City", () => {
		expect(formatPesosFromCents(17200)).toBe("172.00");
		expect(formatPesosFromCents(0)).toBe("0.00");
		const label = formatCancelWhen(new Date("2026-11-21T10:50:00Z"));
		expect(label).toBe("2026-11-21 04:50 America/Mexico_City");
	});

	it("guarda el nombre y el id de quien cancela", () => {
		expect(formatCancelActor("user-rp", "Test")).toBe("Test (user-rp)");
		expect(formatCancelActor("user-rp", "  ")).toBe("user-rp");
		expect(formatCancelActor("user-rp")).toBe("user-rp");
	});

	it("anexa la auditoría con prefijo, sin borrar notas previas", () => {
		const line = appendCancelAuditNote("Pedido del martes", {
			userId: "user-rp",
			userName: "Test",
			when: new Date("2026-11-21T10:50:00Z"),
			previousStatus: "PARCIAL_DISPONIBLE",
			incomeCount: 1,
			incomeCents: 10000,
			creditCount: 1,
			creditCents: 5000,
		});
		expect(
			line.startsWith(`Pedido del martes\n${CANCEL_AUDIT_PREFIX} Cancelado `),
		).toBe(true);
		expect(line).toContain("por Test (user-rp)");
		expect(line).toContain("estado previo: PARCIAL_DISPONIBLE");
		expect(line).toContain("cobros: 1 ($100.00)");
		expect(line).toContain("créditos: 1 ($50.00)");
		expect(line).toContain("El stock no se revierte.");
		expect(
			appendCancelAuditNote(null, {
				userId: "user-rp",
				userName: "Test",
				when: new Date("2026-11-21T10:50:00Z"),
				previousStatus: "pending",
				incomeCount: 0,
				incomeCents: 0,
				creditCount: 0,
				creditCents: 0,
			}),
		).toMatch(
			/^\[AUDITORIA-CANCELACION\] Cancelado 2026-11-21 04:50 America\/Mexico_City por Test \(user-rp\)/,
		);
	});

	it("quita la línea de auditoría al imprimir y deja las notas del cliente", () => {
		const stored = appendCancelAuditNote("Pedido del martes\nSin hueso", {
			userId: "user-rp",
			userName: "Test",
			when: new Date("2026-11-21T10:50:00Z"),
			previousStatus: "LISTA_PARA_COBRO",
			incomeCount: 1,
			incomeCents: 10000,
			creditCount: 0,
			creditCents: 0,
		});
		expect(stripCancelAuditNotes(stored)).toBe("Pedido del martes\nSin hueso");
		expect(stripCancelAuditNotes(stored)).not.toContain(CANCEL_AUDIT_PREFIX);
		expect(stripCancelAuditNotes(stored)).not.toContain("user-rp");
		expect(
			stripCancelAuditNotes(`${CANCEL_AUDIT_PREFIX} solo rastro`),
		).toBeNull();
		expect(stripCancelAuditNotes(null)).toBeNull();
	});

	it("resume cobros y créditos que se quedan y avisa que el stock no se revierte", () => {
		const text = cancelConfirmSummaryText({
			incomeCount: 2,
			incomeCents: 15000,
			creditCount: 1,
			creditCents: 8000,
		});
		expect(text).toContain("Cobros que se quedan: 2 ($150.00)");
		expect(text).toContain("Créditos vigentes que se quedan: 1 ($80.00)");
		expect(text).toContain("El stock no se revierte.");
	});
});

describe("P31-R2-2 — la ficha cancela con orders.update", () => {
	it("el «Sí, cancelar» de la ficha llama a orders.update, no a replaceItems", () => {
		const src = readFileSync(
			new URL("../../../../app/admin/orders/[id]/page.tsx", import.meta.url),
			"utf8",
		);
		expect(src).toContain("trpc.orders.update.mutationOptions");
		expect(src).toMatch(/cancelOrderMutation\.mutate\(\s*\{\s*id: orderId,/);
		expect(src).toMatch(/status:\s*"cancelled"/);
		const confirm = src.slice(
			src.indexOf("<CancelConfirmationDialog"),
			src.indexOf("</CancelConfirmationDialog>"),
		);
		expect(confirm).toContain("cancelOrderMutation.mutate");
		expect(confirm).not.toContain("replaceItemsMutation");
		expect(confirm).not.toContain("buildFullEditPayload");
	});
});
