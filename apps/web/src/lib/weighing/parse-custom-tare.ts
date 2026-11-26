/** Tara libre («Otro»): solo números ≥ 0 con punto decimal; la coma se rechaza. */
export function parseCustomTareKg(raw: string): number | null {
	const trimmed = raw.trim();
	if (trimmed === "") return 0;
	if (trimmed.includes(",")) return null;
	if (!/^\d*\.?\d*$/.test(trimmed)) return null;
	const value = Number(trimmed);
	if (!Number.isFinite(value) || value < 0) return null;
	return value;
}

/** Hint de «Otro»: nunca «NaN kg» ni un valor negativo. */
export function formatCustomTareHint(raw: string): string {
	const parsed = parseCustomTareKg(raw);
	if (parsed === null) return "—";
	return `${parsed.toFixed(3)} kg`;
}

export function canRegisterWeight(input: {
	netKg: number;
	customTareInvalid: boolean;
	hasItem: boolean;
	isPending?: boolean;
}): boolean {
	return (
		input.netKg > 0 &&
		!input.customTareInvalid &&
		input.hasItem &&
		!input.isPending
	);
}

/** P32-R3-3: con una tara «Otro» inválida no se captura (no se aplica tara 0). */
export const INVALID_TARE_CAPTURE_MESSAGE =
	"Corrige la tara «Otro» (0 o más, con punto) antes de capturar";
