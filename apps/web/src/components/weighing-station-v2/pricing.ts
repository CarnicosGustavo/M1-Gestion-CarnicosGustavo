/**
 * Precio por kg sugerido para un renglón pesado, según el cliente.
 *
 * Prioridad (lo que ya existe en M1):
 * 1. «Último»: `customer_prices` del cliente. `orders.priceAndCharge` lo
 *    sobrescribe con el precio que se cobró, así que es el último precio
 *    cobrado a ese cliente para ese producto.
 * 2. «Lista»: la lista de precios asignada al cliente (`price_list_items`).
 * 3. «Pedido»: el `unit_price` capturado en el pedido.
 * 4. «Base»: `products.price_per_kg`.
 */
export type PriceSource = "ultimo" | "lista" | "pedido" | "base" | "manual";

export const PRICE_SOURCE_LABELS: Record<PriceSource, string> = {
	ultimo: "Último",
	lista: "Lista",
	pedido: "Pedido",
	base: "Base",
	manual: "Vista previa",
};

export type CustomerPriceRow = {
	productId: number;
	customerPricePerKg: number | null;
	listPricePerKg: number | null;
	pricePerKg: string | number | null;
};

function positive(value: unknown): number | null {
	if (value === null || value === undefined || value === "") return null;
	const n = typeof value === "number" ? value : Number(value);
	return Number.isFinite(n) && n > 0 ? n : null;
}

/** `unit_price` del renglón del pedido está en centavos; el resto de fuentes van en pesos/kg. */
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
): { pricePerKg: number; source: PriceSource } | null {
	const customer = positive(row?.customerPricePerKg);
	if (customer !== null) return { pricePerKg: customer, source: "ultimo" };
	const list = positive(row?.listPricePerKg);
	if (list !== null) return { pricePerKg: list, source: "lista" };
	const order = orderUnitPriceToPesos(orderUnitPriceCents);
	if (order !== null) return { pricePerKg: order, source: "pedido" };
	const base = positive(row?.pricePerKg);
	if (base !== null) return { pricePerKg: base, source: "base" };
	return null;
}

/** Subtotal en centavos (entero) para kg × precio por kg en pesos. */
export function lineSubtotalCents(kg: number, pricePerKg: number): number {
	if (!Number.isFinite(kg) || !Number.isFinite(pricePerKg)) return 0;
	return Math.round(kg * pricePerKg * 100);
}
