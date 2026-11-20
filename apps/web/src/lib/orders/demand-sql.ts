import { sql } from "drizzle-orm";

/** Estados de pedido cerrado (sin alias de tabla). */
export const CLOSED_ORDER_STATUS_SQL =
	"'cancelled','completed','COMPLETADA','delivered','paid'";

/** Estados de línea ya atendida (sin alias de tabla). */
export const UNSATISFIED_ITEM_STATUS_SQL =
	"'PESADO','WEIGHED','COMPLETADO','COBRADO'";

/** Pedidos no cerrados: cuentan para la demanda viva. */
export const OPEN_ORDER_STATUS_PRED = `o.status NOT IN (${CLOSED_ORDER_STATUS_SQL})`;

/** Líneas aún no atendidas. COBRADO no suma a la demanda. */
export const UNSATISFIED_ITEM_STATUS_PRED = `oi.status NOT IN (${UNSATISFIED_ITEM_STATUS_SQL})`;

/** Kg reales ya pesados o cobrados. */
export const REAL_KG_ITEM_STATUS_PRED = "oi.status IN ('PESADO','COBRADO')";

export const sqlOpenOrder = sql.raw(OPEN_ORDER_STATUS_PRED);
export const sqlUnsatisfiedItem = sql.raw(UNSATISFIED_ITEM_STATUS_PRED);
export const sqlRealKgItem = sql.raw(REAL_KG_ITEM_STATUS_PRED);
