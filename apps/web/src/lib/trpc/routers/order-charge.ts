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
