/** Texto y nota de auditoría al cancelar un pedido (sin columnas nuevas). */

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

export type CancelImpact = {
	userId: string;
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
	const line = `Cancelado ${when} por ${input.userId}; estado previo: ${input.previousStatus ?? "desconocido"}; cobros: ${input.incomeCount} ($${formatPesosFromCents(input.incomeCents)}); créditos: ${input.creditCount} ($${formatPesosFromCents(input.creditCents)}). El stock no se revierte.`;
	const prev = existing?.trim();
	return prev ? `${prev}\n${line}` : line;
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
	"Pese primero o ajuste inventario: no se puede cancelar un pedido con una compra por peso recibida que todavía no se pesó";
