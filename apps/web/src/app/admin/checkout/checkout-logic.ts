export function lineChargeSubtotal(
	kg: number,
	pieces: number,
	price: number,
): number {
	return kg > 0 ? kg * price : pieces * price;
}
