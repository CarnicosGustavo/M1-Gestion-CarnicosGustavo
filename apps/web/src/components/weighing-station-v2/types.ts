export const CONTAINERS = [
	{ id: "ninguno", label: "Sin recipiente", tare: 0 },
	{ id: "tambo_azul", label: "Tambo Azul", tare: 2.5 },
	{ id: "tara", label: "Tara", tare: 1.2 },
	{ id: "cubeta", label: "Cubeta", tare: 0.9 },
	{ id: "otro", label: "Otro", tare: null },
] as const;

export type ContainerId = (typeof CONTAINERS)[number]["id"];

export const TILES = [
	{ id: 1, key: "orders", label: "Pedidos" },
	{ id: 2, key: "order", label: "Pedido" },
	{ id: 3, key: "pending", label: "Productos pendientes de pesar" },
	{ id: 4, key: "scale", label: "Báscula I-QY" },
	{ id: 5, key: "sale", label: "Venta / ticket" },
	{ id: 7, key: "functions", label: "Pantalla de funciones" },
] as const;

export type TileId = (typeof TILES)[number]["id"];
export type TileKey = (typeof TILES)[number]["key"];

export type PesajeOverlay = "tickets" | "orders" | "batch" | "module" | null;

/** Páginas de la pantalla de funciones (7). */
export type FnPage =
	| "inicio"
	| "recipiente"
	| "conexion"
	| "diagnostico"
	| "tema"
	| "teclado"
	| "atajos"
	| "config"
	| "pedidos"
	| "tickets"
	| "produccion"
	| "recetas"
	| "frio"
	| "clientes"
	| "cobro"
	| "voz";

/** Módulos del negocio que viven en la fila inferior (pantalla 7 + ventana). */
export function isModulePage(page: FnPage): page is ModulePage {
	return (MODULE_PAGES as readonly FnPage[]).includes(page);
}

export const MODULE_PAGES = [
	"recetas",
	"frio",
	"clientes",
] as const satisfies readonly FnPage[];

/**
 * Teclas con dos niveles: pulsar = vista rápida en la pantalla 7;
 * Fn + tecla (o pulsarla otra vez, o Enter) = ventana grande encima.
 */
export const DETAIL_PAGES = [
	"pedidos",
	"tickets",
	"produccion",
	...MODULE_PAGES,
] as const satisfies readonly FnPage[];
export type DetailPage = (typeof DETAIL_PAGES)[number];
export function isDetailPage(page: FnPage): page is DetailPage {
	return (DETAIL_PAGES as readonly FnPage[]).includes(page);
}
export type ModulePage = (typeof MODULE_PAGES)[number];

export type PesajeThemeId = "m1" | "tokyo-night" | "gruvbox";

export const PESAJE_THEMES: Array<{
	id: PesajeThemeId;
	label: string;
}> = [
	{ id: "m1", label: "M1 (Cárnicos Gustavo)" },
	{ id: "tokyo-night", label: "Tokyo Night" },
	{ id: "gruvbox", label: "Gruvbox" },
];

export const PESAJE_THEME_STORAGE_KEY = "cg.pesajeTheme";

export type PesajeOrderItem = {
	id: number;
	product_id: number | null;
	product_name: string | null;
	quantity: number | null;
	quantity_pieces: number | null;
	quantity_kg: number | string | null;
	unit_price: number | string | null;
	subtotal: number | string | null;
	status: string | null;
	product: {
		name: string;
		category: string | null;
		is_sellable_by_weight?: boolean | null;
		is_sellable_by_unit?: boolean | null;
		stock_pieces?: number | null;
	} | null;
};

export type PesajeOrder = {
	id: number;
	customer_id: number | null;
	total_amount: number | string | null;
	status: string | null;
	user_uid: string | null;
	requires_weighing: boolean | null;
	notes: string | null;
	whatsapp_message_id: string | null;
	created_at: Date | string | null;
	customer: { name: string | null } | null;
	orderItems: PesajeOrderItem[];
};

export type PesajeCapture = {
	eventId: string;
	weightG: number;
	pieceCount: number | null;
	containerId: string | null;
	tareG: number | null;
	pending: boolean;
	at: number;
	source: string;
};

export function orderTitle(order: PesajeOrder | null | undefined): string {
	if (!order) return "";
	return (
		order.customer?.name ||
		(order.notes === "Pesaje de producción"
			? "Pesaje de producción"
			: "Consumidor Final")
	);
}

export function itemName(item: PesajeOrderItem): string {
	return item.product?.name ?? item.product_name ?? "Artículo";
}

export function formatKg(weightG: number | null | undefined): string {
	return ((weightG ?? 0) / 1000).toFixed(3);
}

export function captureNetG(weightG: number, tareG: number | null): number {
	return Math.max(0, weightG - (tareG ?? 0));
}
