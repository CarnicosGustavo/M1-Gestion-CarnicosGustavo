import { captureNetG, type PesajeCapture, type PesajeOrder } from "./types";

const now = Date.UTC(2026, 10, 20, 18, 15, 0);

export const DEMO_ORDERS: PesajeOrder[] = [
	{
		id: 1842,
		customer_id: 12,
		total_amount: 248050,
		status: "PENDIENTE_PESAJE",
		user_uid: "demo",
		requires_weighing: true,
		notes: null,
		whatsapp_message_id: "wa-demo",
		created_at: new Date(now - 36 * 60 * 1000).toISOString(),
		customer: { name: "Carnicería La Esperanza" },
		orderItems: [
			{
				id: 501,
				product_id: 1,
				product_name: "Pierna",
				quantity: 2,
				quantity_pieces: 2,
				quantity_kg: "12.500",
				unit_price: "86.00",
				subtotal: "1075.00",
				status: "PENDIENTE_PESAJE",
				product: { name: "Pierna", category: "Cortes" },
			},
			{
				id: 502,
				product_id: 2,
				product_name: "Lomo",
				quantity: 1,
				quantity_pieces: 1,
				quantity_kg: "6.800",
				unit_price: "110.00",
				subtotal: "748.00",
				status: "PENDIENTE_PESAJE",
				product: { name: "Lomo", category: "Cortes" },
			},
			{
				id: 503,
				product_id: 3,
				product_name: "Espaldilla",
				quantity: 2,
				quantity_pieces: 2,
				quantity_kg: "8.150",
				unit_price: "78.00",
				subtotal: "635.70",
				status: "PESADO",
				product: { name: "Espaldilla", category: "Cortes" },
			},
			{
				id: 504,
				product_id: 4,
				product_name: "Costilla",
				quantity: 1,
				quantity_pieces: null,
				quantity_kg: "4.320",
				unit_price: "95.00",
				subtotal: "410.40",
				status: "PESADO",
				product: { name: "Costilla", category: "Cortes" },
			},
		],
	},
	{
		id: 1843,
		customer_id: 18,
		total_amount: 96000,
		status: "PENDIENTE_PESAJE",
		user_uid: "demo",
		requires_weighing: true,
		notes: null,
		whatsapp_message_id: null,
		created_at: new Date(now - 18 * 60 * 1000).toISOString(),
		customer: { name: "Mercado San Juan" },
		orderItems: [
			{
				id: 510,
				product_id: 4,
				product_name: "Costilla",
				quantity: 3,
				quantity_pieces: 3,
				quantity_kg: "9.000",
				unit_price: "95.00",
				subtotal: "855.00",
				status: "PENDIENTE_PESAJE",
				product: { name: "Costilla", category: "Cortes" },
			},
		],
	},
	{
		id: 1844,
		customer_id: null,
		total_amount: 0,
		status: "PENDIENTE_PESAJE",
		user_uid: "system",
		requires_weighing: true,
		notes: "Pesaje de producción",
		whatsapp_message_id: null,
		created_at: new Date(now - 8 * 60 * 1000).toISOString(),
		customer: null,
		orderItems: [
			{
				id: 520,
				product_id: 8,
				product_name: "Desgrase",
				quantity: 0,
				quantity_pieces: null,
				quantity_kg: "4.000",
				unit_price: "0",
				subtotal: "0",
				status: "PENDIENTE_PESAJE",
				product: { name: "Desgrase", category: "Subproductos" },
			},
		],
	},
];

export const DEMO_CAPTURES: PesajeCapture[] = [
	{
		eventId: "demo-c1",
		weightG: 6450,
		pieceCount: 1,
		containerId: "tambo_azul",
		tareG: 2500,
		pending: false,
		at: now - 4 * 60 * 1000,
		source: "PC",
	},
	{
		eventId: "demo-c2",
		weightG: 6300,
		pieceCount: 1,
		containerId: "tambo_azul",
		tareG: 2500,
		pending: false,
		at: now - 90 * 1000,
		source: "PC",
	},
];

export const DEMO_LIVE = {
	weightG: 3750,
	stable: true,
	overload: false,
	net: false,
	containerId: "tambo_azul" as const,
	tareG: 2500,
};

export const DEMO_TICKET_LINES = [
	{
		itemId: 501,
		name: "Pierna",
		status: "PENDIENTE_PESAJE",
		captures: DEMO_CAPTURES.map((capture) => ({
			...capture,
			netG: captureNetG(capture.weightG, capture.tareG),
		})),
	},
	{
		itemId: 530,
		name: "Cuero",
		status: "PESADO",
		captures: [
			{
				eventId: "demo-c0",
				weightG: 4200,
				pieceCount: 1,
				containerId: "cubeta",
				tareG: 900,
				pending: false,
				at: now - 50 * 60 * 1000,
				source: "PC",
				netG: captureNetG(4200, 900),
			},
		],
	},
];

/** Precios del cliente 12 tal como los devuelve customerPrices.getByCustomer. */
export const DEMO_CUSTOMER_PRICES = [
	{
		productId: 1,
		customerPricePerKg: null,
		listPricePerKg: 88,
		pricePerKg: "88",
	},
	{
		productId: 3,
		customerPricePerKg: 82,
		listPricePerKg: 80,
		pricePerKg: "82",
	},
	{
		productId: 4,
		customerPricePerKg: null,
		listPricePerKg: null,
		pricePerKg: null,
	},
];
