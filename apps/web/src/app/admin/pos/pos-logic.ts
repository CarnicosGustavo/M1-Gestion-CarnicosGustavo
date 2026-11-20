/**
 * Lógica pura del POS (carne). Sin React, sin next-intl, sin dependencias de DOM.
 * Todo lo que el POS necesita calcular (precios, totales, estados de línea y de catálogo)
 * vive aquí para poder testearlo de forma determinista.
 */

export type PricePair = { kg?: number; piece?: number };
export type Avail = {
	stockPieces: number | null;
	stockKg: number | string | null;
	derivable: boolean;
};
export type Disp = "stock" | "despiece" | "pesaje" | "faltante";

/**
 * F3 / F4 — Cascada de precios, ORDEN POR CAMPO (no por producto):
 *   1. precio propio del cliente
 *   2. lista elegida a mano en el POS
 *   3. lista asignada al cliente
 *   4. precio base del producto
 *
 * Se usa `??` POR CAMPO: un propio solo en kg NO pisa la pieza que viene de la
 * lista ni del base, y una lista con solo pieza deja el kg del base.
 */
export function resolvePrice(
	productId: number,
	baseKg: number,
	basePiece: number,
	customerOwn: Map<number, PricePair>,
	selectedList: Map<number, PricePair>,
	assignedList: Map<number, PricePair>,
): { kg: number; piece: number } {
	const own = customerOwn.get(productId);
	const sel = selectedList.get(productId);
	const assigned = assignedList.get(productId);

	const kg = own?.kg ?? sel?.kg ?? assigned?.kg ?? baseKg;
	const piece = own?.piece ?? sel?.piece ?? assigned?.piece ?? basePiece;

	return { kg, piece };
}

/**
 * F1 — El servidor guarda `unit_price` en CENTAVOS y al pesar calcula
 * `gramos * unit_price / 1000`. Si mandamos el precio por pieza (que suele ser 0)
 * el cobro sale $0.
 *
 * Condición pactada (EXACTA): `p.is_sellable_by_weight || p.quantityKg`.
 *   - is_sellable_by_weight === true  → se cobra por kg (aunque quantityKg sea 0 o null)
 *   - is_sellable_by_weight falsy/null y quantityKg truthy → se cobra por kg
 *   - is_sellable_by_weight falsy/null y quantityKg null/0 → se cobra por pieza
 */
export function unitPriceCentsForPayload(p: {
	is_sellable_by_weight: boolean | null;
	quantityKg: number | null;
	unitPricePerKg: number;
	unitPricePerPiece: number;
}): number {
	const useKg = Boolean(p.is_sellable_by_weight) || Boolean(p.quantityKg);
	const price = useKg ? p.unitPricePerKg : p.unitPricePerPiece;
	return Math.round(price * 100);
}

/**
 * Convierte kg a gramos (lo que espera el servidor en `quantityKg`).
 * kg = 0 no se envía (undefined), igual que antes.
 */
export function quantityKgGramsForPayload(
	quantityKg: number | null | undefined,
): number | undefined {
	return quantityKg ? Math.round(quantityKg * 1000) : undefined;
}

/**
 * F10 — Una sola fuente de verdad para el total del carrito y el subtotal de línea.
 *  - Producto por peso SIN kg capturados (quantityKg === null) → aporta 0.
 *  - Producto por peso CON kg (incluido 0) → unitPricePerKg * quantityKg.
 *  - Producto por pieza → unitPricePerPiece * quantityPieces.
 */
export function lineTotal(p: {
	is_sellable_by_weight?: boolean | null;
	quantityKg: number | null;
	quantityPieces: number;
	unitPricePerKg: number;
	unitPricePerPiece: number;
}): number {
	if (p.is_sellable_by_weight) {
		// Se vende por kg: ignora pieces.
		if (p.quantityKg === null || p.quantityKg === undefined) return 0;
		const price = Number(p.unitPricePerKg);
		if (!Number.isFinite(price)) return 0;
		return price * p.quantityKg;
	}

	// Por pieza (o compatibilidad: si vino kg explícito, se usa kg).
	if (p.quantityKg !== null && p.quantityKg !== undefined) {
		const price = Number(p.unitPricePerKg);
		if (!Number.isFinite(price)) return 0;
		return price * p.quantityKg;
	}

	const price = Number(p.unitPricePerPiece);
	if (!Number.isFinite(price)) return 0;
	return price * (p.quantityPieces || 0);
}

function toNum(value: number | string | null | undefined): number {
	if (value === null || value === undefined) return 0;
	const n = typeof value === "number" ? value : Number(value);
	return Number.isFinite(n) ? n : 0;
}

/**
 * F5 + REGLA (a) — Estado de una línea del carrito (con cantidad).
 * Alimenta el badge, el banner y `requiresPurchase` (=== "faltante").
 *
 * REGLA (a): un producto por peso se vende por kg, así que stock_pieces = 0
 * NO lo marca como «faltante».
 */
export function lineDisp(
	p: {
		id: number;
		stock_pieces: number | null;
		stock_kg: number | string | null;
		is_sellable_by_weight: boolean | null;
		quantityPieces: number;
		quantityKg: number | null;
	},
	avail?: Avail | null,
): Disp {
	const stockPieces = toNum(avail ? avail.stockPieces : p.stock_pieces);
	const stockKg = toNum(avail ? avail.stockKg : p.stock_kg);
	const derivable = avail?.derivable ?? false;

	if (p.is_sellable_by_weight) {
		// Producto por peso.
		if (p.quantityKg !== null && p.quantityKg !== undefined) {
			if (p.quantityKg <= stockKg) return "stock";
			return derivable ? "despiece" : "faltante";
		}
		// Se pesa después.
		if (stockKg > 0) return "pesaje";
		return derivable ? "despiece" : "faltante";
	}

	// Producto por pieza.
	if (p.quantityPieces <= stockPieces) return "stock";
	return derivable ? "despiece" : "faltante";
}

/**
 * Estado de una tarjeta de catálogo (sin cantidad capturada).
 *  - stock 0/0 → derivable ? "despiece" : "faltante"
 *  - si hay stock → por peso ? "pesaje" : "stock"
 */
export function catalogDisp(
	p: {
		id: number;
		stock_pieces: number | null;
		stock_kg: number | string | null;
		is_sellable_by_weight: boolean | null;
	},
	avail?: Avail | null,
): Disp {
	const stockPieces = toNum(avail ? avail.stockPieces : p.stock_pieces);
	const stockKg = toNum(avail ? avail.stockKg : p.stock_kg);
	const derivable = avail?.derivable ?? false;

	if (stockPieces <= 0 && stockKg <= 0) {
		return derivable ? "despiece" : "faltante";
	}
	return p.is_sellable_by_weight ? "pesaje" : "stock";
}

/** ¿La línea quedó sin stock? (regla (b): se puede agregar igual, queda pendiente de compra). */
export function isFaltanteLine(
	p: {
		id: number;
		stock_pieces: number | null;
		stock_kg: number | string | null;
		is_sellable_by_weight: boolean | null;
		quantityPieces: number;
		quantityKg: number | null;
	},
	avail?: Avail | null,
): boolean {
	return lineDisp(p, avail) === "faltante";
}

/** ¿El precio viene vacío / inválido? */
export function isMissingPrice(value: number): boolean {
	return !Number.isFinite(value) || value <= 0;
}
