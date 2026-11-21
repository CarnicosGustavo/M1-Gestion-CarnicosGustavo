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
