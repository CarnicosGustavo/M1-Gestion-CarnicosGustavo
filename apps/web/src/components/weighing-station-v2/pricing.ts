/**
 * Precio por kg (o por pieza si no se pesa) sugerido para un renglón en Venta.
 *
 * Prioridad (lo que ya existe en M1):
 * 1. «Último»: `customer_prices` del cliente. `orders.priceAndCharge` lo
 *    sobrescribe con el precio que se cobró, así que es el último precio
 *    cobrado a ese cliente para ese producto.
 * 2. «Lista»: la lista de precios asignada al cliente (`price_list_items`).
 * 3. «Pedido»: el `unit_price` capturado en el pedido.
 * 4. «Base»: `products.price_per_kg` (o `products.price_per_piece`).
 */
export type PriceSource = "ultimo" | "lista" | "pedido" | "base" | "manual";

export const PRICE_SOURCE_LABELS: Record<PriceSource, string> = {
	ultimo: "Último",
	lista: "Lista",
	pedido: "Pedido",
	base: "Base",
	manual: "Manual",
};

export type CustomerPriceRow = {
	productId: number;
	customerPricePerKg: number | null;
	listPricePerKg: number | null;
	pricePerKg: string | number | null;
	customerPricePerPiece?: number | null;
	listPricePerPiece?: number | null;
	pricePerPiece?: string | number | null;
};

function positive(value: unknown): number | null {
	if (value === null || value === undefined || value === "") return null;
	const n = typeof value === "number" ? value : Number(value);
	return Number.isFinite(n) && n > 0 ? n : null;
}

/** P33-5: un producto por pieza toma `price_per_piece`; por peso, `price_per_kg`. */
export function catalogProductPrice(product: {
	is_sellable_by_weight?: boolean | null;
	price_per_kg?: string | number | null;
	price_per_piece?: string | number | null;
}): string | number {
	return product.is_sellable_by_weight
		? (product.price_per_kg ?? 0)
		: (product.price_per_piece ?? 0);
}

/** `unit_price` del renglón del pedido está en centavos; el resto de fuentes van en pesos. */
export function orderUnitPriceToPesos(
	unitPrice: string | number | null | undefined,
): number | null {
	const cents = positive(unitPrice);
	if (cents === null) return null;
	const pesos = cents / 100;
	return pesos > 0 ? pesos : null;
}

export function resolveDefaultPrice(
	row: CustomerPriceRow | undefined,
	orderUnitPriceCents: string | number | null | undefined,
	options?: { byPiece?: boolean },
): { pricePerKg: number; source: PriceSource } | null {
	const byPiece = options?.byPiece ?? false;
	const customer = positive(
		byPiece ? row?.customerPricePerPiece : row?.customerPricePerKg,
	);
	if (customer !== null) return { pricePerKg: customer, source: "ultimo" };
	const list = positive(byPiece ? row?.listPricePerPiece : row?.listPricePerKg);
	if (list !== null) return { pricePerKg: list, source: "lista" };
	const order = orderUnitPriceToPesos(orderUnitPriceCents);
	if (order !== null) return { pricePerKg: order, source: "pedido" };
	const base = positive(byPiece ? row?.pricePerPiece : row?.pricePerKg);
	if (base !== null) return { pricePerKg: base, source: "base" };
	return null;
}

/** Subtotal en centavos (entero) para cantidad × precio en pesos. */
export function lineSubtotalCents(kg: number, pricePerKg: number): number {
	if (!Number.isFinite(kg) || !Number.isFinite(pricePerKg)) return 0;
	return Math.round(kg * pricePerKg * 100);
}

/** Subtotal en centavos de un renglón de Venta (por kg o por pieza si kg <= 0). */
export function saleLineSubtotalCents(line: {
	kg: number;
	pieces: number | null;
	pricePerUnit: number;
}): number {
	if (line.kg > 0) return lineSubtotalCents(line.kg, line.pricePerUnit);
	if ((line.pieces ?? 0) > 0) {
		return lineSubtotalCents(line.pieces ?? 0, line.pricePerUnit);
	}
	return 0;
}

/** Total en centavos de la venta (pantalla 7 / panel 5): piezas y kg. */
export function saleLinesTotalCents(
	lines: ReadonlyArray<{ kg: number; pieces: number | null; price: string }>,
): number {
	return lines.reduce(
		(sum, line) =>
			sum +
			saleLineSubtotalCents({
				kg: line.kg,
				pieces: line.pieces,
				pricePerUnit: Number.parseFloat(line.price) || 0,
			}),
		0,
	);
}

const SALE_LINE_STATUSES = new Set(["PESADO", "COMPLETADO", "WEIGHED"]);

/** P33-5: Venta incluye líneas pesadas y también líneas por pieza ya listas (COMPLETADO). */
export function isSaleLineItem(item: {
	status: string | null;
	quantity_kg: number | string | null;
	quantity_pieces: number | null;
}): boolean {
	if (!item.status || !SALE_LINE_STATUSES.has(item.status)) return false;
	return (Number(item.quantity_kg) || 0) > 0 || (item.quantity_pieces ?? 0) > 0;
}
