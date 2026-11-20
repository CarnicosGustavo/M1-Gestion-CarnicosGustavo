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

function validPrice(value: number | undefined | null): value is number {
	return value != null && Number.isFinite(value) && value > 0;
}

/**
 * F3 / F4 / R2-9 / R2-10 — Cascada de precios por campo:
 *   1. precio propio del cliente
 *   2. lista elegida a mano en el POS
 *   3. lista asignada al cliente
 *   4. precio base del producto
 *
 * Los precios 0, negativos, NaN e infinitos se consideran ausentes.
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

	const kg = validPrice(own?.kg)
		? own.kg
		: validPrice(sel?.kg)
			? sel.kg
			: validPrice(assigned?.kg)
				? assigned.kg
				: baseKg;
	const piece = validPrice(own?.piece)
		? own.piece
		: validPrice(sel?.piece)
			? sel.piece
			: validPrice(assigned?.piece)
				? assigned.piece
				: basePiece;

	return { kg, piece };
}

/**
 * R2-8 — Un producto por peso requiere pesaje cuando todavía no tiene kg.
 */
export function needsWeigh(p: {
	is_sellable_by_weight?: boolean | null;
	quantityKg: number | null;
}): boolean {
	return Boolean(p.is_sellable_by_weight) && !p.quantityKg;
}

/**
 * F1 — El servidor guarda `unit_price` en CENTAVOS y al pesar calcula
 * `gramos * unit_price / 1000`.
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

export function quantityKgGramsForPayload(
	quantityKg: number | null | undefined,
): number | undefined {
	return quantityKg ? Math.round(quantityKg * 1000) : undefined;
}

export function lineTotal(p: {
	is_sellable_by_weight?: boolean | null;
	quantityKg: number | null;
	quantityPieces: number;
	unitPricePerKg: number;
	unitPricePerPiece: number;
}): number {
	if (p.is_sellable_by_weight) {
		if (p.quantityKg === null || p.quantityKg === undefined) return 0;
		const price = Number(p.unitPricePerKg);
		if (!Number.isFinite(price)) return 0;
		return price * p.quantityKg;
	}

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
		if (p.quantityKg !== null && p.quantityKg !== undefined) {
			if (p.quantityKg <= stockKg) return "stock";
			return derivable ? "despiece" : "faltante";
		}
		if (stockKg > 0) return "pesaje";
		return derivable ? "despiece" : "faltante";
	}

	if (p.quantityPieces <= stockPieces) return "stock";
	return derivable ? "despiece" : "faltante";
}

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

export function isMissingPrice(value: number): boolean {
	return !Number.isFinite(value) || value <= 0;
}
