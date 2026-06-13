"use client";

import { usePathname } from "next/navigation";
import {
	type AntonellaSlotData,
	AntonellaSlot,
} from "@/components/antonella-slot";

// Rutas que ya manejan su propio slot (con datos en vivo): no duplicar.
const SELF_MANAGED = new Set<string>([
	"/admin",
	"/admin/despiece",
	"/admin/weighing-station",
	"/admin/pos",
	"/admin/yield",
	"/admin/cedis",
	"/admin/cierre",
	"/admin/inventory/recipes",
]);

// Slot por defecto, por ruta, para que iAntonella esté presente en TODOS los
// módulos. Mensajes contextuales por módulo (sin datos en vivo).
const ROUTE_SLOT: Record<string, AntonellaSlotData> = {
	"/admin/orders": {
		tone: "aviso",
		titulo: "Pedidos",
		texto:
			"Vigilo los pedidos abiertos. Puedo calcular qué piezas faltan, sugerir el despiece necesario para cubrirlos y decirte qué se generaría.",
		acciones: ["¿Qué falta para los pedidos abiertos?", "¿Qué conviene despiezar?"],
	},
	"/admin/purchase": {
		tone: "sugerencia",
		titulo: "Compra del día",
		texto:
			"De aquí salen los canales para el despiece. Puedo estimar cuántos canales comprar según la demanda y calcular la merma esperada.",
		acciones: ["¿Cuántos canales necesito comprar?"],
	},
	"/admin/checkout": {
		tone: "sugerencia",
		titulo: "Cobro",
		texto:
			"Cola de pedidos ya pesados. Puedo proponer el precio por kilo de cada cliente y revisar que el total cuadre antes de cobrar.",
		acciones: ["¿Qué precio usar para este cliente?"],
	},
	"/admin/customers": {
		tone: "aviso",
		titulo: "Clientes",
		texto:
			"Vigilo saldos y hábitos de compra. Te aviso de clientes con saldo vencido y de quién suele comprar cada día.",
		acciones: ["¿Qué clientes deben?", "Recordar por WhatsApp"],
	},
	"/admin/collections": {
		tone: "alerta",
		titulo: "Cobranza",
		texto:
			"Cartera por cobrar. Priorizo lo vencido (+60 días) y te armo los recordatorios para que cobres primero lo urgente.",
		acciones: ["¿Qué priorizo hoy?", "Ver los de +60 días"],
	},
	"/admin/products": {
		tone: "sugerencia",
		titulo: "Catálogo",
		texto:
			"Conozco todo el catálogo: piezas padre, hijos y de proveedor. Puedo decirte qué producto no tiene receta o aparece duplicado.",
		acciones: ["¿Qué productos no tienen receta?"],
	},
	"/admin/prices": {
		tone: "sugerencia",
		titulo: "Precios por cliente",
		texto:
			"Manejo los precios propios de cada cliente. Puedo sugerir precios a partir del rendimiento y del histórico de cobro.",
		acciones: ["¿Qué precio sugieres para este cliente?"],
	},
	"/admin/cold-inventory": {
		tone: "sugerencia",
		titulo: "Inventario frío",
		texto:
			"Vigilo lo fresco vs lo congelado. Te aviso qué conviene descongelar a fresco para cubrir pedidos sin perder producto.",
		acciones: ["¿Qué conviene descongelar?"],
	},
	"/admin/cashier": {
		tone: "ok",
		titulo: "Caja",
		texto:
			"Registro de ingresos y gastos. Puedo resumirte el flujo del día y detectar movimientos fuera de lo normal.",
		acciones: ["Resumen de caja de hoy"],
	},
	"/admin/payment-methods": {
		tone: "ok",
		titulo: "Métodos de pago",
		texto: "Aquí defines cómo cobras. Avísame si quieres ordenar o limpiar la lista.",
		acciones: [],
	},
};

export function RouteAntonellaSlot() {
	const pathname = usePathname();
	if (SELF_MANAGED.has(pathname)) return null;
	const data = ROUTE_SLOT[pathname];
	if (!data) return null;
	return <AntonellaSlot data={data} />;
}
