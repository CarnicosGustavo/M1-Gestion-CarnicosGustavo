import { relations, sql } from "drizzle-orm";
import {
	bigint,
	bigserial,
	boolean,
	date,
	foreignKey,
	index,
	integer,
	jsonb,
	numeric,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
	unique,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

// --- ENUMS ---
// Los valores y su orden reflejan los tipos enum existentes en la BD de producción.
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const orderStatusEnum = pgEnum("order_status", [
	"pending",
	"confirmed",
	"processing",
	"ready",
	"delivered",
	"cancelled",
	"completed",
	"paid",
	"shipped",
	"PENDIENTE_PESAJE",
	"LISTA_PARA_COBRO",
	"PROCESANDO_PAGO",
	"COMPLETADA",
	"PARCIAL_DISPONIBLE",
]);
/**
 * Valores usados por la app en order_items.status. En la BD la columna es
 * varchar(50) (no existe un tipo enum), así que esto es solo una lista de
 * referencia para TypeScript; no se crea ningún tipo en Postgres.
 */
export const ORDER_ITEM_STATUSES = [
	"COMPLETADO",
	"PENDIENTE_PESAJE",
	"PENDIENTE_COMPRA",
	"PESADO",
	"PENDING",
	"WEIGHED",
] as const;
export type OrderItemStatus = (typeof ORDER_ITEM_STATUSES)[number];
export const messageDirectionEnum = pgEnum("message_direction", [
	"inbound",
	"outbound",
]);

// Nota de alineación: este archivo refleja el esquema real de producción
// (tipos, nulabilidad, defaults y columnas heredadas). Ver sql/README.md.
const tstz = (name: string) => timestamp(name, { withTimezone: true });

// --- TABLAS DE AUTENTICACIÓN (BETTER-AUTH) ---
export const user = pgTable(
	"user",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		email: text("email").notNull(),
		emailVerified: boolean("email_verified").notNull().default(false),
		image: text("image"),
		createdAt: tstz("created_at").notNull().defaultNow(),
		updatedAt: tstz("updated_at").notNull().defaultNow(),
		// Campos de negocio adicionales
		role: text("role").default("user"),
		openId: varchar("openId"),
		loginMethod: varchar("loginMethod"),
		lastSignedIn: tstz("lastSignedIn").defaultNow(),
		user_uid: varchar("user_uid", { length: 255 }),
	},
	(t) => [
		unique("user_email_key1").on(t.email),
		unique("user_openId_key1").on(t.openId),
		uniqueIndex("user_openid_unique").on(t.openId),
	],
);

export const session = pgTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: tstz("expires_at").notNull(),
		token: text("token").notNull(),
		createdAt: tstz("created_at").notNull().defaultNow(),
		updatedAt: tstz("updated_at").notNull().defaultNow(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id").notNull(),
	},
	(t) => [
		unique("session_token_key").on(t.token),
		foreignKey({
			name: "session_user_id_fkey",
			columns: [t.userId],
			foreignColumns: [user.id],
		}).onDelete("cascade"),
	],
);

export const account = pgTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id").notNull(),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: tstz("access_token_expires_at"),
		refreshTokenExpiresAt: tstz("refresh_token_expires_at"),
		scope: text("scope"),
		password: text("password"),
		createdAt: tstz("created_at").notNull().defaultNow(),
		updatedAt: tstz("updated_at").notNull().defaultNow(),
	},
	(t) => [
		foreignKey({
			name: "account_user_id_fkey",
			columns: [t.userId],
			foreignColumns: [user.id],
		}).onDelete("cascade"),
	],
);

export const verification = pgTable("verification", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: tstz("expires_at").notNull(),
	createdAt: tstz("created_at").defaultNow(),
	updatedAt: tstz("updated_at").defaultNow(),
});

// --- TABLAS DE NEGOCIO (CÁRNICOS GUSTAVO) ---

// Pedidos recibidos desde el sitio web (carnicosgustavo.com)
export const webOrders = pgTable(
	"web_orders",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		source: text("source").notNull().default("website"),
		business_name: text("business_name").notNull(),
		contact_name: text("contact_name").notNull(),
		phone: text("phone").notNull(),
		delivery_address: text("delivery_address"),
		notes: text("notes"),
		location_label: text("location_label"),
		items: jsonb("items").notNull(), // [{productId, name, quantity}]
		items_count: integer("items_count").notNull().default(0),
		user_agent: text("user_agent"),
		whatsapp_message: text("whatsapp_message"),
		created_at: tstz("created_at").notNull().defaultNow(),
	},
	(t) => [
		index("web_orders_phone_idx").on(t.phone),
		index("web_orders_created_at_idx").on(t.created_at.desc().nullsFirst()),
	],
);

export const products = pgTable(
	"products",
	{
		id: serial("id").primaryKey(),
		name: varchar("name", { length: 100 }).notNull(),
		description: text("description"),
		price_per_kg: numeric("price_per_kg", { precision: 10, scale: 2 })
			.notNull()
			.default("0.00"),
		unit: varchar("unit", { length: 20 }).notNull().default("kg"),
		active: boolean("active").notNull().default(true),
		sort_order: integer("sort_order").notNull().default(0),
		// Columnas heredadas (camelCase) presentes en la BD
		createdAt: timestamp("createdAt").notNull().defaultNow(),
		updatedAt: timestamp("updatedAt").notNull().defaultNow(),
		// Inventario Dual
		stock_pieces: integer("stock_pieces").default(0),
		stock_kg: numeric("stock_kg").default("0.0"),
		is_parent_product: boolean("is_parent_product").default(false),
		is_sellable_by_unit: boolean("is_sellable_by_unit").default(true),
		is_sellable_by_weight: boolean("is_sellable_by_weight").default(true),
		default_sale_unit: varchar("default_sale_unit", { length: 10 }).default(
			"KG",
		),
		price_per_piece: numeric("price_per_piece"),
		category: varchar("category", { length: 100 }).default("General"),
		user_uid: varchar("user_uid", { length: 255 }),
		status: varchar("status", { length: 20 }).default("active"),
		image: text("image"),
		// Deprecado: se conserva por compatibilidad (integer en la BD)
		in_stock: integer("in_stock").default(0),
		ncm: varchar("ncm", { length: 20 }),
		cfop: varchar("cfop", { length: 20 }),
		icms_cst: varchar("icms_cst", { length: 20 }),
		pis_cst: varchar("pis_cst", { length: 20 }),
		cofins_cst: varchar("cofins_cst", { length: 20 }),
		unit_of_measure: varchar("unit_of_measure", { length: 20 }).default("KG"),
		created_at: tstz("created_at").defaultNow(),
		updated_at: tstz("updated_at").defaultNow(),
		parent_product_id: integer("parent_product_id"),
		price_alias: varchar("price_alias", { length: 255 }),
		weighed_pieces: integer("weighed_pieces").notNull().default(0),
		// Peso promedio por pieza (kg) para estimar peso/costo antes de pesar
		avg_weight_per_piece_kg: numeric("avg_weight_per_piece_kg", {
			precision: 10,
			scale: 3,
		}),
		// Inventario Frío (congelado) - no vendible hasta transferir a fresco
		stock_kg_frozen: numeric("stock_kg_frozen", { precision: 10, scale: 3 })
			.notNull()
			.default("0"),
		stock_pieces_frozen: integer("stock_pieces_frozen").notNull().default(0),
	},
	(t) => [
		foreignKey({
			name: "products_parent_product_id_fkey",
			columns: [t.parent_product_id],
			foreignColumns: [t.id],
		}).onDelete("set null"),
		index("products_user_uid_idx").on(t.user_uid),
	],
);

// --- COMPRAS DE CANALES (alimentan rendimiento) ---
export const channelPurchases = pgTable(
	"channel_purchases",
	{
		id: serial("id").primaryKey(),
		supplier: varchar("supplier", { length: 100 }),
		qty_americano: integer("qty_americano").notNull().default(0),
		qty_nacional: integer("qty_nacional").notNull().default(0),
		num_medias: integer("num_medias").notNull().default(0),
		total_kg: numeric("total_kg", { precision: 12, scale: 3 })
			.notNull()
			.default("0"),
		price_per_kg: numeric("price_per_kg", { precision: 10, scale: 2 }),
		purchase_date: date("purchase_date").notNull().default(sql`CURRENT_DATE`),
		user_uid: varchar("user_uid", { length: 255 }),
		created_at: tstz("created_at").defaultNow(),
		// Verificación al llegar al CEDIS (peso de canal real recibido)
		verified_canales: integer("verified_canales"),
		verified_kg: numeric("verified_kg", { precision: 12, scale: 3 }),
		// Detalle de la verificación CEDIS: { mode, tara, weights[], totalKg, totalCanales }
		cedis_detail: jsonb("cedis_detail"),
	},
	(t) => [index("idx_channel_purchases_date").on(t.purchase_date)],
);

// --- HOJAS DE RENDIMIENTO (despiece) ---
export const yieldSheets = pgTable("yield_sheets", {
	id: serial("id").primaryKey(),
	sheet_date: date("sheet_date").notNull().default(sql`CURRENT_DATE`),
	num_canales: integer("num_canales").notNull().default(0),
	kg_comprado: numeric("kg_comprado", { precision: 12, scale: 3 })
		.notNull()
		.default("0"),
	notes: text("notes"),
	user_uid: varchar("user_uid"),
	created_at: tstz("created_at").defaultNow(),
	updated_at: tstz("updated_at").defaultNow(),
	supplier: varchar("supplier", { length: 100 }),
});

export const yieldSheetItems = pgTable(
	"yield_sheet_items",
	{
		id: serial("id").primaryKey(),
		sheet_id: integer("sheet_id").notNull(),
		product_id: integer("product_id"),
		product_name: varchar("product_name").notNull(),
		pieces: integer("pieces").notNull().default(0),
		kg_total: numeric("kg_total", { precision: 12, scale: 3 })
			.notNull()
			.default("0"),
		weighed: boolean("weighed").notNull().default(false),
		sort_order: integer("sort_order").notNull().default(0),
	},
	(t) => [
		foreignKey({
			name: "yield_sheet_items_sheet_id_fkey",
			columns: [t.sheet_id],
			foreignColumns: [yieldSheets.id],
		}).onDelete("cascade"),
		foreignKey({
			name: "yield_sheet_items_product_id_fkey",
			columns: [t.product_id],
			foreignColumns: [products.id],
		}),
		index("idx_yield_items_sheet").on(t.sheet_id),
	],
);

// --- COBRANZA / CRÉDITO ---
export const creditAccounts = pgTable(
	"credit_accounts",
	{
		id: serial("id").primaryKey(),
		customer_id: integer("customer_id").notNull(),
		credit_limit: numeric("credit_limit", { precision: 12, scale: 2 })
			.notNull()
			.default("0"),
		terms_days: integer("terms_days").notNull().default(0),
		created_at: tstz("created_at").defaultNow(),
		updated_at: tstz("updated_at").defaultNow(),
	},
	(t) => [
		foreignKey({
			name: "credit_accounts_customer_id_fkey",
			columns: [t.customer_id],
			foreignColumns: [customers.id],
		}).onDelete("cascade"),
		unique("credit_accounts_customer_id_key").on(t.customer_id),
	],
);

export const creditCharges = pgTable(
	"credit_charges",
	{
		id: serial("id").primaryKey(),
		customer_id: integer("customer_id").notNull(),
		order_id: integer("order_id"),
		amount: numeric("amount", { precision: 12, scale: 2 })
			.notNull()
			.default("0"),
		concept: varchar("concept", { length: 255 }),
		charge_date: date("charge_date").notNull().default(sql`CURRENT_DATE`),
		source: varchar("source", { length: 30 }).notNull().default("ticket_viejo"),
		created_at: tstz("created_at").defaultNow(),
	},
	(t) => [
		foreignKey({
			name: "credit_charges_customer_id_fkey",
			columns: [t.customer_id],
			foreignColumns: [customers.id],
		}).onDelete("cascade"),
		index("idx_credit_charges_customer").on(t.customer_id),
	],
);

export const creditPayments = pgTable(
	"credit_payments",
	{
		id: serial("id").primaryKey(),
		customer_id: integer("customer_id").notNull(),
		amount: numeric("amount", { precision: 12, scale: 2 })
			.notNull()
			.default("0"),
		payment_date: date("payment_date").notNull().default(sql`CURRENT_DATE`),
		method: varchar("method", { length: 50 }),
		notes: text("notes"),
		created_at: tstz("created_at").defaultNow(),
	},
	(t) => [
		foreignKey({
			name: "credit_payments_customer_id_fkey",
			columns: [t.customer_id],
			foreignColumns: [customers.id],
		}).onDelete("cascade"),
		index("idx_credit_payments_customer").on(t.customer_id),
	],
);

// Precios por cliente (override por producto)
export const customerPrices = pgTable(
	"customer_prices",
	{
		id: serial("id").primaryKey(),
		customer_id: integer("customer_id").notNull(),
		product_id: integer("product_id").notNull(),
		price_per_kg: numeric("price_per_kg", { precision: 10, scale: 2 }),
		price_per_piece: numeric("price_per_piece", { precision: 10, scale: 2 }),
		updated_at: tstz("updated_at").defaultNow(),
	},
	(t) => [
		foreignKey({
			name: "customer_prices_customer_id_fkey",
			columns: [t.customer_id],
			foreignColumns: [customers.id],
		}).onDelete("cascade"),
		foreignKey({
			name: "customer_prices_product_id_fkey",
			columns: [t.product_id],
			foreignColumns: [products.id],
		}).onDelete("cascade"),
		unique("customer_prices_customer_id_product_id_key").on(
			t.customer_id,
			t.product_id,
		),
		index("idx_customer_prices_customer").on(t.customer_id),
	],
);

export const priceLists = pgTable("price_lists", {
	id: bigserial("id", { mode: "number" }).primaryKey(),
	user_uid: varchar("user_uid", { length: 255 }).notNull(),
	code: varchar("code", { length: 50 }).notNull(),
	name: varchar("name", { length: 255 }).notNull(),
	is_default: boolean("is_default").notNull().default(false),
	created_at: tstz("created_at").notNull().defaultNow(),
	updated_at: tstz("updated_at").notNull().defaultNow(),
});

export const priceListItems = pgTable(
	"price_list_items",
	{
		id: bigserial("id", { mode: "number" }).primaryKey(),
		price_list_id: bigint("price_list_id", { mode: "number" }).notNull(),
		product_id: bigint("product_id", { mode: "number" }).notNull(),
		unit_price_per_kg: numeric("unit_price_per_kg", {
			precision: 10,
			scale: 2,
		}),
		unit_price_per_piece: numeric("unit_price_per_piece", {
			precision: 10,
			scale: 2,
		}),
		created_at: tstz("created_at").notNull().defaultNow(),
		updated_at: tstz("updated_at").notNull().defaultNow(),
	},
	(t) => [
		foreignKey({
			name: "price_list_items_price_list_id_fkey",
			columns: [t.price_list_id],
			foreignColumns: [priceLists.id],
		}),
		foreignKey({
			name: "price_list_items_product_id_fkey",
			columns: [t.product_id],
			foreignColumns: [products.id],
		}),
	],
);

export const productTransformations = pgTable(
	"product_transformations",
	{
		id: serial("id").primaryKey(),
		parent_product_id: integer("parent_product_id").notNull(),
		child_product_id: integer("child_product_id").notNull(),
		yield_quantity_pieces: numeric("yield_quantity_pieces").notNull(),
		yield_weight_ratio: numeric("yield_weight_ratio").notNull(),
		transformation_type: varchar("transformation_type", {
			length: 50,
		}).notNull(), // e.g., 'NACIONAL', 'AMERICANO'
		is_active: boolean("is_active").notNull().default(true),
		created_at: tstz("created_at").notNull().defaultNow(),
		updated_at: tstz("updated_at").notNull().defaultNow(),
		// Variante: especificación alternativa (no suma al peso del padre)
		is_variant: boolean("is_variant").notNull().default(false),
	},
	(t) => [
		foreignKey({
			name: "product_transformations_parent_product_id_fkey",
			columns: [t.parent_product_id],
			foreignColumns: [products.id],
		}).onDelete("cascade"),
		foreignKey({
			name: "product_transformations_child_product_id_fkey",
			columns: [t.child_product_id],
			foreignColumns: [products.id],
		}).onDelete("cascade"),
		index("idx_product_transformations_parent_product_id").on(
			t.parent_product_id,
		),
		index("idx_product_transformations_child_product_id").on(
			t.child_product_id,
		),
		uniqueIndex("ux_product_transformations_active")
			.on(t.parent_product_id, t.child_product_id, t.transformation_type)
			.where(sql`${t.is_active} = true`),
	],
);

export const inventoryTransactions = pgTable(
	"inventory_transactions",
	{
		id: serial("id").primaryKey(),
		product_id: integer("product_id").notNull(),
		quantity_change_pieces: integer("quantity_change_pieces"),
		quantity_change_kg: numeric("quantity_change_kg"),
		transaction_type: varchar("transaction_type", { length: 50 }).notNull(), // 'IN', 'OUT', 'TRANSFORMATION', 'SALE'
		reference_id: integer("reference_id"), // e.g., order_id or transformation_id
		notes: text("notes"),
		created_at: tstz("created_at").notNull().defaultNow(),
	},
	(t) => [
		foreignKey({
			name: "inventory_transactions_product_id_fkey",
			columns: [t.product_id],
			foreignColumns: [products.id],
		}).onDelete("cascade"),
		index("idx_inventory_transactions_product_id").on(t.product_id),
	],
);

export const customers = pgTable(
	"customers",
	{
		id: serial("id").primaryKey(),
		whatsapp_phone: varchar("whatsapp_phone", { length: 20 }),
		name: varchar("name", { length: 150 }),
		address: text("address"),
		notes: text("notes"),
		total_orders: integer("total_orders").notNull().default(0),
		// Columnas heredadas (camelCase) presentes en la BD
		createdAt: timestamp("createdAt").notNull().defaultNow(),
		updatedAt: timestamp("updatedAt").notNull().defaultNow(),
		user_uid: varchar("user_uid", { length: 255 }),
		email: varchar("email", { length: 255 }),
		phone: varchar("phone", { length: 50 }),
		status: varchar("status", { length: 20 }).default("active"),
		created_at: tstz("created_at").defaultNow(),
		updated_at: tstz("updated_at").defaultNow(),
		contact_name: varchar("contact_name", { length: 255 }),
		// Lista de precios asignada (del diseño): los precios del cliente caen a esta
		// lista cuando no hay un precio propio del cliente para el producto.
		price_list_id: integer("price_list_id"),
	},
	(t) => [
		unique("customers_whatsapp_phone_key").on(t.whatsapp_phone),
		index("customers_user_uid_idx").on(t.user_uid),
	],
);

export const orders = pgTable(
	"orders",
	{
		id: serial("id").primaryKey(),
		customer_id: integer("customer_id"),
		status: orderStatusEnum("status").default("pending"),
		total_amount: numeric("total_amount", { precision: 10, scale: 2 }).default(
			"0.00",
		),
		notes: text("notes"),
		delivery_address: text("delivery_address"),
		whatsapp_message_id: varchar("whatsapp_message_id", { length: 100 }),
		// Columnas heredadas (camelCase) presentes en la BD
		createdAt: timestamp("createdAt").notNull().defaultNow(),
		updatedAt: timestamp("updatedAt").notNull().defaultNow(),
		requires_weighing: boolean("requires_weighing").notNull().default(false),
		user_uid: varchar("user_uid", { length: 255 }),
		created_at: tstz("created_at").defaultNow(),
		updated_at: tstz("updated_at").defaultNow(),
		web_order_id: uuid("web_order_id"),
	},
	(t) => [
		foreignKey({
			name: "orders_customer_id_fkey",
			columns: [t.customer_id],
			foreignColumns: [customers.id],
		}),
		foreignKey({
			name: "orders_web_order_id_fkey",
			columns: [t.web_order_id],
			foreignColumns: [webOrders.id],
		}).onDelete("set null"),
		index("idx_orders_customer").on(t.customer_id),
		index("idx_orders_status").on(t.status),
		index("idx_orders_web_order_id").on(t.web_order_id),
		index("orders_user_uid_idx").on(t.user_uid),
	],
);

export const orderItems = pgTable(
	"order_items",
	{
		id: serial("id").primaryKey(),
		order_id: integer("order_id").notNull(),
		product_id: integer("product_id"),
		product_name: varchar("product_name", { length: 100 }),
		quantity_kg: numeric("quantity_kg", { precision: 8, scale: 3 }),
		unit_price: numeric("unit_price", { precision: 10, scale: 2 }),
		subtotal: numeric("subtotal", { precision: 10, scale: 2 }),
		// Columna heredada (camelCase) presente en la BD
		createdAt: timestamp("createdAt").notNull().defaultNow(),
		quantity_pieces: integer("quantity_pieces"),
		// varchar en la BD; valores esperados en ORDER_ITEM_STATUSES
		status: varchar("status", { length: 50 })
			.$type<OrderItemStatus>()
			.notNull()
			.default("PENDING"),
		user_uid: varchar("user_uid", { length: 255 }),
		quantity: integer("quantity").default(1),
		price: numeric("price", { precision: 10, scale: 2 }).default("0.00"),
		created_at: tstz("created_at").defaultNow(),
		updated_at: tstz("updated_at").defaultNow(),
	},
	(t) => [
		foreignKey({
			name: "order_items_order_id_fkey",
			columns: [t.order_id],
			foreignColumns: [orders.id],
		}),
		foreignKey({
			name: "order_items_product_id_fkey",
			columns: [t.product_id],
			foreignColumns: [products.id],
		}),
		index("idx_order_items_order").on(t.order_id),
		index("order_items_user_uid_idx").on(t.user_uid),
	],
);

export const whatsappSessions = pgTable(
	"whatsapp_sessions",
	{
		id: serial("id").primaryKey(),
		phone: varchar("phone", { length: 20 }).notNull(),
		state: varchar("state", { length: 50 }).notNull().default("idle"),
		cart_data: jsonb("cart_data").default([]),
		current_product_id: integer("current_product_id"),
		current_product_name: varchar("current_product_name", { length: 100 }),
		last_message_at: timestamp("last_message_at").notNull().defaultNow(),
		createdAt: timestamp("createdAt").notNull().defaultNow(),
		updatedAt: timestamp("updatedAt").notNull().defaultNow(),
	},
	(t) => [
		unique("whatsapp_sessions_phone_key").on(t.phone),
		index("idx_wa_sessions_phone").on(t.phone),
	],
);

export const whatsappMessages = pgTable(
	"whatsapp_messages",
	{
		id: serial("id").primaryKey(),
		phone: varchar("phone", { length: 20 }).notNull(),
		direction: messageDirectionEnum("direction").notNull(),
		message_type: varchar("message_type", { length: 30 }).notNull(),
		content: text("content"),
		whatsapp_message_id: varchar("whatsapp_message_id", { length: 100 }),
		status: varchar("status", { length: 30 }).default("sent"),
		createdAt: timestamp("createdAt").notNull().defaultNow(),
	},
	(t) => [index("idx_wa_messages_phone").on(t.phone)],
);

// --- TABLAS LEGACY ---

export const paymentMethods = pgTable(
	"payment_methods",
	{
		id: bigserial("id", { mode: "number" }).primaryKey(),
		name: varchar("name", { length: 50 }).notNull(),
		created_at: tstz("created_at").defaultNow(),
	},
	(t) => [unique("payment_methods_name_key").on(t.name)],
);

export const transactions = pgTable(
	"transactions",
	{
		id: bigserial("id", { mode: "number" }).primaryKey(),
		description: text("description"),
		order_id: bigint("order_id", { mode: "number" }),
		payment_method_id: bigint("payment_method_id", {
			mode: "number",
		}),
		// numeric(10,2) en la BD; se lee como number
		amount: numeric("amount", { precision: 10, scale: 2, mode: "number" }),
		user_uid: varchar("user_uid", { length: 255 }).notNull(),
		type: varchar("type", { length: 20 }),
		category: varchar("category", { length: 100 }),
		status: varchar("status", { length: 20 }),
		created_at: tstz("created_at").defaultNow(),
	},
	(t) => [
		foreignKey({
			name: "transactions_payment_method_id_fkey",
			columns: [t.payment_method_id],
			foreignColumns: [paymentMethods.id],
		}),
		index("transactions_user_uid_idx").on(t.user_uid),
	],
);

// --- CONFIGURACIÓN DE ANTONELLA (ASISTENTE IA) ---
export const antonellaConfig = pgTable(
	"antonella_config",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		user_uid: varchar("user_uid", { length: 255 }).notNull(),
		system_prompt: text("system_prompt").notNull().default(""),
		// IDs de herramientas integradas que el usuario DESACTIVÓ
		disabled_tools: jsonb("disabled_tools").notNull().default([]),
		// Herramientas/habilidades personalizadas que el usuario agregó
		custom_tools: jsonb("custom_tools").notNull().default([]),
		model: varchar("model", { length: 100 })
			.notNull()
			.default("claude-opus-4-8"),
		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(t) => [unique("antonella_config_user_uid_key").on(t.user_uid)],
);

// Memorias de Antonella: hechos, detalles, preferencias y estadísticas que recuerda
export const antonellaMemories = pgTable(
	"antonella_memories",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		user_uid: varchar("user_uid", { length: 255 }).notNull(),
		category: varchar("category", { length: 80 }).notNull().default("general"),
		title: varchar("title", { length: 200 }).notNull(),
		content: text("content").notNull(),
		tags: jsonb("tags").notNull().default([]),
		importance: integer("importance").notNull().default(1),
		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(t) => [
		index("idx_antonella_memories_user").on(t.user_uid),
		index("idx_antonella_memories_cat").on(t.user_uid, t.category),
	],
);

// "Bases de datos" que Antonella crea para memorizar cosas cotidianas
export const antonellaDatasets = pgTable(
	"antonella_datasets",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		user_uid: varchar("user_uid", { length: 255 }).notNull(),
		name: varchar("name", { length: 120 }).notNull(),
		description: text("description").notNull().default(""),
		columns: jsonb("columns").notNull().default([]),
		created_at: timestamp("created_at").defaultNow(),
		updated_at: timestamp("updated_at").defaultNow(),
	},
	(t) => [
		unique("antonella_datasets_user_uid_name_key").on(t.user_uid, t.name),
	],
);

// Filas de cada dataset (estructura flexible en jsonb)
export const antonellaDatasetRows = pgTable(
	"antonella_dataset_rows",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		dataset_id: integer("dataset_id").notNull(),
		data: jsonb("data").notNull().default({}),
		created_at: timestamp("created_at").defaultNow(),
	},
	(t) => [
		foreignKey({
			name: "antonella_dataset_rows_dataset_id_fkey",
			columns: [t.dataset_id],
			foreignColumns: [antonellaDatasets.id],
		}).onDelete("cascade"),
		index("idx_antonella_rows_dataset").on(t.dataset_id),
	],
);

// --- RELACIONES ---

export const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const productRelations = relations(products, ({ one, many }) => ({
	parentProduct: one(products, {
		fields: [products.parent_product_id],
		references: [products.id],
		relationName: "productHierarchy",
	}),
	childProducts: many(products, { relationName: "productHierarchy" }),
	orderItems: many(orderItems),
	transformationsAsParent: many(productTransformations, {
		relationName: "parentProduct",
	}),
	transformationsAsChild: many(productTransformations, {
		relationName: "childProduct",
	}),
	inventoryTransactions: many(inventoryTransactions),
	priceListItems: many(priceListItems),
}));

export const priceListRelations = relations(priceLists, ({ many }) => ({
	items: many(priceListItems),
}));

export const priceListItemRelations = relations(priceListItems, ({ one }) => ({
	priceList: one(priceLists, {
		fields: [priceListItems.price_list_id],
		references: [priceLists.id],
	}),
	product: one(products, {
		fields: [priceListItems.product_id],
		references: [products.id],
	}),
}));

export const webOrderRelations = relations(webOrders, ({ many }) => ({
	orders: many(orders),
}));

export const orderRelations = relations(orders, ({ one, many }) => ({
	customer: one(customers, {
		fields: [orders.customer_id],
		references: [customers.id],
	}),
	orderItems: many(orderItems),
	webOrder: one(webOrders, {
		fields: [orders.web_order_id],
		references: [webOrders.id],
	}),
}));

export const orderItemRelations = relations(orderItems, ({ one }) => ({
	order: one(orders, {
		fields: [orderItems.order_id],
		references: [orders.id],
	}),
	product: one(products, {
		fields: [orderItems.product_id],
		references: [products.id],
	}),
}));

export const productTransformationRelations = relations(
	productTransformations,
	({ one }) => ({
		parentProduct: one(products, {
			fields: [productTransformations.parent_product_id],
			references: [products.id],
			relationName: "parentProduct",
		}),
		childProduct: one(products, {
			fields: [productTransformations.child_product_id],
			references: [products.id],
			relationName: "childProduct",
		}),
	}),
);

export const transactionsRelations = relations(transactions, ({ one }) => ({
	order: one(orders, {
		fields: [transactions.order_id],
		references: [orders.id],
	}),
	paymentMethod: one(paymentMethods, {
		fields: [transactions.payment_method_id],
		references: [paymentMethods.id],
	}),
}));

export const paymentMethodsRelations = relations(
	paymentMethods,
	({ many }) => ({
		transactions: many(transactions),
	}),
);
