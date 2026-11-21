/** Texto y nota de auditoría al cancelar un pedido (sin columnas nuevas). */

export const CANCEL_AUDIT_PREFIX = "[AUDITORIA-CANCELACION]";

export function formatPesosFromCents(cents: number): string {
	return (cents / 100).toFixed(2);
}

export function formatCancelWhen(date = new Date()): string {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: "America/Mexico_City",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).formatToParts(date);
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value ?? "";
	return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")} America/Mexico_City`;
}

export function formatCancelActor(
	userId: string,
	userName?: string | null,
): string {
	const name = userName?.trim();
	return name ? `${name} (${userId})` : userId;
}

export type CancelImpact = {
	userId: string;
	userName?: string | null;
	when?: Date;
	previousStatus: string | null;
	incomeCount: number;
	incomeCents: number;
	creditCount: number;
	creditCents: number;
};

export function appendCancelAuditNote(
	existing: string | null | undefined,
	input: CancelImpact,
): string {
	const when = formatCancelWhen(input.when ?? new Date());
	const actor = formatCancelActor(input.userId, input.userName);
	const line = `${CANCEL_AUDIT_PREFIX} Cancelado ${when} por ${actor}; estado previo: ${input.previousStatus ?? "desconocido"}; cobros: ${input.incomeCount} ($${formatPesosFromCents(input.incomeCents)}); créditos: ${input.creditCount} ($${formatPesosFromCents(input.creditCents)}). El stock no se revierte.`;
	const prev = existing?.trim();
	return prev ? `${prev}\n${line}` : line;
}

export function stripCancelAuditNotes(
	notes: string | null | undefined,
): string | null {
	if (notes == null) return notes ?? null;
	const kept = notes
		.split("\n")
		.filter((line) => !line.trim().startsWith(CANCEL_AUDIT_PREFIX))
		.join("\n")
		.trim();
	return kept.length > 0 ? kept : null;
}

export function cancelConfirmSummaryText(input: {
	incomeCount: number;
	incomeCents: number;
	creditCount: number;
	creditCents: number;
}): string {
	return [
		"Al cancelar se quedan los cobros y créditos vigentes. Esta acción no se puede deshacer.",
		`Cobros que se quedan: ${input.incomeCount} ($${formatPesosFromCents(input.incomeCents)})`,
		`Créditos vigentes que se quedan: ${input.creditCount} ($${formatPesosFromCents(input.creditCents)})`,
		"El stock no se revierte.",
	].join("\n");
}

export const CANCEL_UNWEIGHED_RECEIVED_WEIGHT_MESSAGE =
	"Pese primero o ajuste inventario: no se puede cancelar mientras una compra recibida de un producto por peso siga sin pesar.";

export const CANCEL_SUMMARY_ERROR_MESSAGE =
	"No se pudo cargar el resumen de la cancelación. Inténtalo de nuevo.";
