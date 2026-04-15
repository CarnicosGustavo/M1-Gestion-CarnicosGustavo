import { relations } from "drizzle-orm";
import {
	boolean,
	customType,
	integer,
	numeric,
	pgEnum,
	pgTable,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";

// --- ENUMS ---
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const orderStatusEnum = pgEnum("order_status", [
	"pending",
	"confirmed",
	"processing",
	"ready",
	"delivered",
	"cancelled",
]);
export const orderItemStatusEnum = pgEnum("order_item_status", [
	"COMPLETADO",
	"PENDIENTE_PESAJE",
	"PENDIENTE_COMPRA",
	"PESADO",
	"PENDING",
	"WEIGHED",
]);
export const messageDirectionEnum = pgEnum("message_direction", [
	"inbound",
	"outbound",
]);

// --- TABLAS DE AUTENTICACIÓN (BETTER-AUTH) ---
export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").notNull().default(false),
	image: text("image"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
	// Campos de negocio adicionales
	role: text("role").default("user"),
	openId: varchar("openId").unique(),
	loginMethod: varchar("loginMethod"),
	lastSignedIn: timestamp("lastSignedIn").defaultNow(),
});

export const session = pgTable("session", {
	id: text("id").primaryKey(),
	expiresAt: timestamp("expires_at").notNull(),
	token: text("token").notNull().unique(),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id")
		.notNull()
		.references(() => user.id),
});

export const account = pgTable("account", {
	id: text("id").primaryKey(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at"),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
	scope: text("scope"),
	password: text("password"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
});

// --- TABLAS DE NEGOCIO (CÁRNICOS GUSTAVO) ---

export const products = pgTable("products", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
	name: varchar("name", { length: 255 }).notNull(),
	description: text("description"),
	price_per_kg: numeric("price_per_kg", { precision: 10, scale: 2 }),
	unit: varchar("unit", { length: 50 }),
	active: boolean("active").notNull().default(true),
	sort_order: integer("sort_order").default(0),
	in_stock: numeric("in_stock", { precision: 10, scale: 3 })
		.notNull()
		.default("0.000"),
	category: varchar("category", { length: 50 }),
	user_uid: varchar("user_uid", { length: 255 }).notNull(),
	ncm: varchar("ncm", { length: 8 }),
	cfop: varchar("cfop", { length: 4 }),
	icms_cst: varchar("icms_cst", { length: 3 }),
	pis_cst: varchar("pis_cst", { length: 2 }),
	cofins_cst: varchar("cofins_cst", { length: 2 }),
	unit_of_measure: varchar("unit_of_measure", { length: 6 }),
	// Inventario Dual
	stock_pieces: integer("stock_pieces").notNull().default(0),
	stock_kg: numeric("stock_kg", { precision: 10, scale: 3 })
		.notNull()
		.default("0.000"),
	is_parent_product: boolean("is_parent_product").notNull().default(false),
	parent_product_id: integer("parent_product_id").references(() => products.id),
	is_sellable_by_unit: boolean("is_sellable_by_unit").notNull().default(true),
	is_sellable_by_weight: boolean("is_sellable_by_weight")
		.notNull()
		.default(true),
	default_sale_unit: varchar("default_sale_unit", { length: 10 })
		.notNull()
		.default("KG"),
	price_per_piece: numeric("price_per_piece", { precision: 10, scale: 2 }),
	created_at: timestamp("created_at").defaultNow(),
	updated_at: timestamp("updated_at").defaultNow(),
});

export const priceLists = pgTable("price_lists", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
	user_uid: varchar("user_uid", { length: 255 }).notNull(),
	code: varchar("code", { length: 50 }).notNull(),
	name: varchar("name", { length: 255 }).notNull(),
	is_default: boolean("is_default").notNull().default(false),
	created_at: timestamp("created_at").notNull().defaultNow(),
	updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const priceListItems = pgTable("price_list_items", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
	price_list_id: integer("price_list_id")
		.notNull()
		.references(() => priceLists.id),
	product_id: integer("product_id")
		.notNull()
		.references(() => products.id),
	unit_price_per_kg: numeric("unit_price_per_kg", { precision: 10, scale: 2 }),
	unit_price_per_piece: numeric("unit_price_per_piece", {
		precision: 10,
		scale: 2,
	}),
	created_at: timestamp("created_at").notNull().defaultNow(),
	updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const productTransformations = pgTable("product_transformations", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
	parent_product_id: integer("parent_product_id")
		.notNull()
		.references(() => products.id),
	child_product_id: integer("child_product_id")
		.notNull()
		.references(() => products.id),
	yield_quantity_pieces: numeric("yield_quantity_pieces", {
		precision: 10,
		scale: 2,
	}).notNull(),
	yield_weight_ratio: numeric("yield_weight_ratio", {
		precision: 10,
		scale: 4,
	}).notNull(),
	transformation_type: varchar("transformation_type", { length: 50 }).notNull(), // e.g., 'NACIONAL', 'AMERICANO'
	is_active: boolean("is_active").notNull().default(true),
	created_at: timestamp("created_at").notNull().defaultNow(),
	updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const inventoryTransactions = pgTable("inventory_transactions", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
	product_id: integer("product_id")
		.notNull()
		.references(() => products.id),
	quantity_change_pieces: integer("quantity_change_pieces"),
	quantity_change_kg: numeric("quantity_change_kg", {
		precision: 10,
		scale: 3,
	}),
	transaction_type: varchar("transaction_type", { length: 50 }).notNull(), // 'IN', 'OUT', 'TRANSFORMATION', 'SALE'
	reference_id: integer("reference_id"), // e.g., order_id or transformation_id
	notes: text("notes"),
	created_at: timestamp("created_at").notNull().defaultNow(),
});

export const customers = pgTable("customers", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
	name: varchar("name", { length: 255 }).notNull(),
	email: varchar("email", { length: 255 }).notNull().unique(),
	phone: varchar("phone", { length: 20 }),
	whatsapp_phone: varchar("whatsapp_phone", { length: 20 }).unique(),
	user_uid: varchar("user_uid", { length: 255 }).notNull(),
	status: varchar("status", { length: 20 }),
	address: text("address"),
	notes: text("notes"),
	created_at: timestamp("created_at").defaultNow(),
});

export const orders = pgTable("orders", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
	customer_id: integer("customer_id").references(() => customers.id),
	status: varchar("status", { length: 50 }).default("pending"),
	total_amount: numeric("total_amount", { precision: 10, scale: 2 })
		.notNull()
		.default("0.00"),
	user_uid: varchar("user_uid", { length: 255 }).notNull(),
	notes: text("notes"),
	delivery_address: text("delivery_address"),
	whatsapp_message_id: varchar("whatsapp_message_id", { length: 255 }),
	created_at: timestamp("created_at").defaultNow(),
	updated_at: timestamp("updated_at").defaultNow(),
	requires_weighing: boolean("requires_weighing").notNull().default(false),
});

export const orderItems = pgTable("order_items", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
	order_id: integer("order_id")
		.notNull()
		.references(() => orders.id),
	product_id: integer("product_id")
		.notNull()
		.references(() => products.id),
	product_name: varchar("product_name", { length: 255 }).notNull(),
	quantity: integer("quantity"),
	price: numeric("price", { precision: 10, scale: 2 }),
	quantity_pieces: integer("quantity_pieces"),
	quantity_kg: numeric("quantity_kg", { precision: 10, scale: 3 }),
	unit_price: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
	subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
	status: orderItemStatusEnum("status").notNull().default("COMPLETADO"),
	created_at: timestamp("created_at").defaultNow(),
});

// Tabla para rastrear órdenes con items pendientes de compra
export const purchaseOrders = pgTable("purchase_orders", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
	order_id: integer("order_id")
		.notNull()
		.references(() => orders.id),
	status: varchar("status", { length: 20 }).notNull().default("PENDIENTE"), // PENDIENTE, PARCIAL, COMPLETO
	notes: text("notes"),
	created_by: varchar("created_by", { length: 255 }).notNull(),
	created_at: timestamp("created_at").defaultNow(),
	updated_at: timestamp("updated_at").defaultNow(),
});

export const whatsappSessions = pgTable("whatsapp_sessions", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
	phone: varchar("phone", { length: 20 }).notNull().unique(),
	state: varchar("state", { length: 50 }).notNull().default("idle"),
	cart_data: text("cart_data").notNull().default("[]"), // JSON string
	current_product_id: integer("current_product_id"),
	current_product_name: varchar("current_product_name", { length: 255 }),
	last_message_at: timestamp("last_message_at").notNull().defaultNow(),
	createdAt: timestamp("createdAt").notNull().defaultNow(),
	updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const whatsappMessages = pgTable("whatsapp_messages", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
	phone: varchar("phone", { length: 20 }).notNull(),
	direction: messageDirectionEnum("direction").notNull(),
	message_type: varchar("message_type", { length: 50 }).notNull(),
	content: text("content"),
	whatsapp_message_id: varchar("whatsapp_message_id", { length: 255 }),
	status: varchar("status", { length: 50 }).notNull().default("sent"),
	createdAt: timestamp("createdAt").notNull().defaultNow(),
});

// --- TABLAS LEGACY (COMPATIBILIDAD CON MÓDULOS FISCAL E INVOICES) ---

export const paymentMethods = pgTable("payment_methods", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
	name: varchar("name", { length: 50 }).notNull().unique(),
	created_at: timestamp("created_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
	description: text("description"),
	order_id: integer("order_id").references(() => orders.id),
	payment_method_id: integer("payment_method_id").references(
		() => paymentMethods.id,
	),
	amount: integer("amount").notNull(),
	user_uid: varchar("user_uid", { length: 255 }).notNull(),
	type: varchar("type", { length: 20 }),
	category: varchar("category", { length: 100 }),
	status: varchar("status", { length: 20 }),
	created_at: timestamp("created_at").defaultNow(),
});

export const cities = pgTable("cities", {
	id: integer("id").primaryKey(),
	name: varchar("name", { length: 120 }).notNull(),
	state_code: varchar("state_code", { length: 2 }).notNull(),
});

// Custom bytea type for certificates
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
	dataType() {
		return "bytea";
	},
});

export const fiscalSettings = pgTable("fiscal_settings", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
	user_uid: varchar("user_uid", { length: 255 }).notNull().unique(),
	company_name: varchar("company_name", { length: 255 }).notNull(),
	trade_name: varchar("trade_name", { length: 255 }),
	tax_id: varchar("tax_id", { length: 14 }).notNull(),
	state_tax_id: varchar("state_tax_id", { length: 20 }).notNull(),
	tax_regime: integer("tax_regime").notNull(),
	state_code: varchar("state_code", { length: 2 }).notNull(),
	city_code: varchar("city_code", { length: 7 }).notNull(),
	city_name: varchar("city_name", { length: 100 }).notNull(),
	street: varchar("street", { length: 255 }).notNull(),
	street_number: varchar("street_number", { length: 10 }).notNull(),
	district: varchar("district", { length: 100 }).notNull(),
	zip_code: varchar("zip_code", { length: 8 }).notNull(),
	address_complement: varchar("address_complement", { length: 100 }),
	environment: integer("environment").notNull().default(2),
	nfe_series: integer("nfe_series").default(1),
	nfce_series: integer("nfce_series").default(1),
	next_nfe_number: integer("next_nfe_number").default(1),
	next_nfce_number: integer("next_nfce_number").default(1),
	csc_id: varchar("csc_id", { length: 10 }),
	csc_token: varchar("csc_token", { length: 50 }),
	certificate_pfx: bytea("certificate_pfx"),
	certificate_password: text("certificate_password"),
	certificate_valid_until: timestamp("certificate_valid_until"),
	default_ncm: varchar("default_ncm", { length: 8 }).default("00000000"),
	default_cfop: varchar("default_cfop", { length: 4 }).default("5102"),
	default_icms_cst: varchar("default_icms_cst", { length: 3 }).default("00"),
	default_pis_cst: varchar("default_pis_cst", { length: 2 }).default("99"),
	default_cofins_cst: varchar("default_cofins_cst", { length: 2 }).default(
		"99",
	),
	created_at: timestamp("created_at").defaultNow(),
	updated_at: timestamp("updated_at").defaultNow(),
});

export const invoices = pgTable("invoices", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
	user_id: text("user_id")
		.notNull()
		.references(() => user.id),
	order_id: integer("order_id").references(() => orders.id),
	model: integer("model").notNull(),
	series: integer("series").notNull(),
	number: integer("number").notNull(),
	access_key: varchar("access_key", { length: 44 }),
	operation_nature: varchar("operation_nature", { length: 60 }).default(
		"VENDA",
	),
	operation_type: integer("operation_type").default(1),
	status: varchar("status", { length: 20 }).default("pending").notNull(),
	environment: integer("environment").notNull(),
	request_xml: text("request_xml"),
	response_xml: text("response_xml"),
	protocol_xml: text("protocol_xml"),
	protocol_number: varchar("protocol_number", { length: 20 }),
	status_code: integer("status_code"),
	status_message: text("status_message"),
	issued_at: timestamp("issued_at").notNull(),
	authorized_at: timestamp("authorized_at"),
	total_amount: integer("total_amount").notNull(),
	is_contingency: boolean("is_contingency").default(false),
	contingency_type: varchar("contingency_type", { length: 20 }),
	contingency_at: timestamp("contingency_at"),
	contingency_reason: text("contingency_reason"),
	recipient_tax_id: varchar("recipient_tax_id", { length: 14 }),
	recipient_name: varchar("recipient_name", { length: 255 }),
	created_at: timestamp("created_at").defaultNow(),
});

export const invoiceItems = pgTable("invoice_items", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
	invoice_id: integer("invoice_id")
		.notNull()
		.references(() => invoices.id),
	product_id: integer("product_id").references(() => products.id),
	item_number: integer("item_number").notNull(),
	product_code: varchar("product_code", { length: 60 }).notNull(),
	description: varchar("description", { length: 120 }).notNull(),
	ncm: varchar("ncm", { length: 8 }).notNull(),
	cfop: varchar("cfop", { length: 4 }).notNull(),
	unit_of_measure: varchar("unit_of_measure", { length: 6 }).default("UN"),
	quantity: integer("quantity").notNull(),
	unit_price: integer("unit_price").notNull(),
	total_price: integer("total_price").notNull(),
	icms_cst: varchar("icms_cst", { length: 3 }),
	icms_rate: integer("icms_rate").default(0),
	icms_amount: integer("icms_amount").default(0),
	pis_cst: varchar("pis_cst", { length: 2 }),
	cofins_cst: varchar("cofins_cst", { length: 2 }),
	created_at: timestamp("created_at").defaultNow(),
});

export const invoiceEvents = pgTable("invoice_events", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
	invoice_id: integer("invoice_id")
		.notNull()
		.references(() => invoices.id),
	event_type: varchar("event_type", { length: 30 }).notNull(),
	sequence: integer("sequence").default(1),
	protocol_number: varchar("protocol_number", { length: 20 }),
	status_code: integer("status_code"),
	reason: text("reason"),
	request_xml: text("request_xml"),
	response_xml: text("response_xml"),
	created_at: timestamp("created_at").defaultNow(),
});

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

export const orderRelations = relations(orders, ({ one, many }) => ({
	customer: one(customers, {
		fields: [orders.customer_id],
		references: [customers.id],
	}),
	items: many(orderItems),
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

export const fiscalSettingsRelations = relations(fiscalSettings, () => ({}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
	order: one(orders, {
		fields: [invoices.order_id],
		references: [orders.id],
	}),
	user: one(user, {
		fields: [invoices.user_id],
		references: [user.id],
	}),
	items: many(invoiceItems),
	events: many(invoiceEvents),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
	invoice: one(invoices, {
		fields: [invoiceItems.invoice_id],
		references: [invoices.id],
	}),
	product: one(products, {
		fields: [invoiceItems.product_id],
		references: [products.id],
	}),
}));

export const invoiceEventsRelations = relations(invoiceEvents, ({ one }) => ({
	invoice: one(invoices, {
		fields: [invoiceEvents.invoice_id],
		references: [invoices.id],
	}),
}));
