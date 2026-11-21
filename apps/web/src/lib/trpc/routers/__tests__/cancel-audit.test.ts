import { describe, expect, it } from "bun:test";
import {
	appendCancelAuditNote,
	cancelConfirmSummaryText,
	formatCancelWhen,
	formatPesosFromCents,
} from "@/lib/orders/cancel-audit";

describe("cancel-audit — confirmación y nota al cancelar", () => {
	it("formatea centavos a pesos y la hora en America/Mexico_City", () => {
		expect(formatPesosFromCents(17200)).toBe("172.00");
		expect(formatPesosFromCents(0)).toBe("0.00");
		const label = formatCancelWhen(new Date("2026-11-21T10:50:00Z"));
		expect(label).toBe("2026-11-21 04:50 America/Mexico_City");
	});

	it("anexa la auditoría sin borrar notas previas", () => {
		const line = appendCancelAuditNote("Pedido del martes", {
			userId: "user-rp",
			when: new Date("2026-11-21T10:50:00Z"),
			previousStatus: "PARCIAL_DISPONIBLE",
			incomeCount: 1,
			incomeCents: 10000,
			creditCount: 1,
			creditCents: 5000,
		});
		expect(line.startsWith("Pedido del martes\nCancelado ")).toBe(true);
		expect(line).toContain("por user-rp");
		expect(line).toContain("estado previo: PARCIAL_DISPONIBLE");
		expect(line).toContain("cobros: 1 ($100.00)");
		expect(line).toContain("créditos: 1 ($50.00)");
		expect(line).toContain("El stock no se revierte.");
		expect(
			appendCancelAuditNote(null, {
				userId: "user-rp",
				when: new Date("2026-11-21T10:50:00Z"),
				previousStatus: "pending",
				incomeCount: 0,
				incomeCents: 0,
				creditCount: 0,
				creditCents: 0,
			}),
		).toMatch(/^Cancelado 2026-11-21 04:50 America\/Mexico_City por user-rp/);
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
