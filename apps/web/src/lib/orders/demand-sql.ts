import { sql } from "drizzle-orm";

/** Pedidos no cerrados: cuentan para la demanda viva. */
export const OPEN_ORDER_STATUS_PRED =
	"o.status NOT IN ('cancelled','completed','COMPLETADA','delivered','paid')";

/** Líneas aún no atendidas. COBRADO no suma a la demanda. */
export const UNSATISFIED_ITEM_STATUS_PRED =
	"oi.status NOT IN ('PESADO','WEIGHED','COMPLETADO','COBRADO')";

/** Kg reales ya pesados o cobrados. */
export const REAL_KG_ITEM_STATUS_PRED = "oi.status IN ('PESADO','COBRADO')";

export const sqlOpenOrder = sql.raw(OPEN_ORDER_STATUS_PRED);
export const sqlUnsatisfiedItem = sql.raw(UNSATISFIED_ITEM_STATUS_PRED);
export const sqlRealKgItem = sql.raw(REAL_KG_ITEM_STATUS_PRED);
