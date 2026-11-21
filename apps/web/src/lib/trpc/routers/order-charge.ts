import type { OrderItemStatus } from "@/lib/db/schema";

export type OrderItemForCharge = {
	status: string | null;
	subtotal?: string | number | null;
};

export type OrderStatusAfterCharge =
	| "PENDIENTE_PESAJE"
	| "PARCIAL_DISPONIBLE"
	| "LISTA_PARA_COBRO"
	| "COMPLETADA";

/**
 * Topes de cordura de `priceAndCharge` (P33-1). El precio llega en pesos por
 * kg (o por pieza); un precio de centavos tomado por pesos (×100) o un total
 * descomunal se rechaza en el servidor, con independencia de lo que mande el
 * cliente.
 */
export const MAX_UNIT_PRICE_PESOS = 5000;
export const MAX_CHARGE_TOTAL_CENTS = 50_000_000; // $500,000 (la columna numeric(10,2) desborda en $1,000,000)

export function unitPriceSanityError(pricePerKg: number): string | null {
	if (!Number.isFinite(pricePerKg) || pricePerKg > MAX_UNIT_PRICE_PESOS) {
		return `Precio unitario absurdo ($${Number.isFinite(pricePerKg) ? pricePerKg.toFixed(2) : pricePerKg}): el máximo permitido es $${MAX_UNIT_PRICE_PESOS} por kg o pieza. Revisa que el precio esté en pesos, no en centavos.`;
	}
	return null;
}

export function totalSanityError(totalCents: number): string | null {
	if (!Number.isFinite(totalCents) || totalCents > MAX_CHARGE_TOTAL_CENTS) {
		return `Total absurdo ($${(totalCents / 100).toFixed(2)}): el máximo permitido por cobro es $${(MAX_CHARGE_TOTAL_CENTS / 100).toFixed(2)}. Revisa cantidades y precios.`;
	}
	return null;
}

const CHARGEABLE_STATUSES = new Set<string>([
	"COMPLETADO",
	"PESADO",
	"WEIGHED",
]);

export function isChargeableItem(item: { status: string | null }): boolean {
	return item.status !== null && CHARGEABLE_STATUSES.has(item.status);
}

export function isChargedItem(item: { status: string | null }): boolean {
	return item.status === "COBRADO";
}

export function chargeableSubtotalCents(
	items: readonly OrderItemForCharge[],
): number {
	return items.reduce((total, item) => {
		if (!isChargeableItem(item)) return total;
		return total + Math.round(Number(item.subtotal ?? 0));
	}, 0);
}

export function chargedSubtotalCents(
	items: readonly OrderItemForCharge[],
): number {
	return items.reduce((total, item) => {
		if (!isChargedItem(item)) return total;
		return total + Math.round(Number(item.subtotal ?? 0));
	}, 0);
}

export function nextStatusAfterCharge(
	items: readonly OrderItemForCharge[],
): OrderStatusAfterCharge {
	if (items.some((item) => item.status === "PENDIENTE_PESAJE")) {
		return "PENDIENTE_PESAJE";
	}
	if (items.some((item) => item.status === "PENDIENTE_COMPRA")) {
		return "PARCIAL_DISPONIBLE";
	}
	if (items.some(isChargeableItem)) {
		return "LISTA_PARA_COBRO";
	}
	return "COMPLETADA";
}

export const nextStatusAfterReceive = nextStatusAfterCharge;

export function isOrderItemStatus(status: string): status is OrderItemStatus {
	return (
		status === "COMPLETADO" ||
		status === "PENDIENTE_PESAJE" ||
		status === "PENDIENTE_COMPRA" ||
		status === "PESADO" ||
		status === "PENDING" ||
		status === "WEIGHED" ||
		status === "COBRADO"
	);
}
