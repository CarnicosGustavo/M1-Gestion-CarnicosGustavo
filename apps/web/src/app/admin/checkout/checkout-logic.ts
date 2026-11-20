export function lineChargeSubtotal(
	kg: number,
	pieces: number,
	price: number,
): number {
	return kg > 0 ? kg * price : pieces * price;
}

export function initialLinePrice(
	quantityKg: number,
	savedPriceKg: number | string | null | undefined,
	unitPriceCents: number | string | null | undefined,
): string {
	if (quantityKg > 0) {
		const saved = Number(savedPriceKg);
		if (Number.isFinite(saved) && saved > 0) {
			return String(saved);
		}
	}

	const unitPrice = Number(unitPriceCents) / 100;
	if (Number.isFinite(unitPrice) && unitPrice > 0) {
		return String(unitPrice);
	}

	return "";
}
