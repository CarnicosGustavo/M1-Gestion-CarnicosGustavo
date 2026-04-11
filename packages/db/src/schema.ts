import { relations, sql } from "drizzle-orm";
import {
  boolean,
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
export const messageDirectionEnum = pgEnum("message_direction", ["inbound", "outbound"]);

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
  price_per_kg: numeric("price_per_kg", { precision: 10, scale: 2 }).notNull().default("0.00"),
  unit: varchar("unit", { length: 50 }).notNull().default("kg"),
  active: boolean("active").notNull().default(true),
  sort_order: integer("sort_order").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  // Inventario Dual
  stock_pieces: integer("stock_pieces").notNull().default(0),
  stock_kg: numeric("stock_kg", { precision: 10, scale: 3 }).notNull().default("0.000"),
  is_parent_product: boolean("is_parent_product").notNull().default(false),
  is_sellable_by_unit: boolean("is_sellable_by_unit").notNull().default(true),
  is_sellable_by_weight: boolean("is_sellable_by_weight").notNull().default(true),
  default_sale_unit: varchar("default_sale_unit", { length: 10 }).notNull().default("KG"),
  price_per_piece: numeric("price_per_piece", { precision: 10, scale: 2 }),
});

export const productTransformations = pgTable("product_transformations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  parent_product_id: integer("parent_product_id")
    .notNull()
    .references(() => products.id),
  child_product_id: integer("child_product_id")
    .notNull()
    .references(() => products.id),
  yield_quantity_pieces: numeric("yield_quantity_pieces", { precision: 10, scale: 2 }).notNull(),
  yield_weight_ratio: numeric("yield_weight_ratio", { precision: 10, scale: 4 }).notNull(),
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
  quantity_change_kg: numeric("quantity_change_kg", { precision: 10, scale: 3 }),
  transaction_type: varchar("transaction_type", { length: 50 }).notNull(), // 'IN', 'OUT', 'TRANSFORMATION', 'SALE'
  reference_id: integer("reference_id"), // e.g., order_id or transformation_id
  notes: text("notes"),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const customers = pgTable("customers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  whatsapp_phone: varchar("whatsapp_phone", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  address: text("address"),
  notes: text("notes"),
  total_orders: integer("total_orders").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  customer_id: integer("customer_id").references(() => customers.id),
  status: orderStatusEnum("status").notNull().default("pending"),
  total_amount: numeric("total_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
  notes: text("notes"),
  delivery_address: text("delivery_address"),
  whatsapp_message_id: varchar("whatsapp_message_id", { length: 255 }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
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
  quantity_pieces: integer("quantity_pieces"),
  quantity_kg: numeric("quantity_kg", { precision: 10, scale: 3 }),
  unit_price: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("PENDING"), // 'PENDING', 'WEIGHED'
  createdAt: timestamp("createdAt").notNull().defaultNow(),
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

export const productRelations = relations(products, ({ many }) => ({
  orderItems: many(orderItems),
  transformationsAsParent: many(productTransformations, { relationName: "parentProduct" }),
  transformationsAsChild: many(productTransformations, { relationName: "childProduct" }),
  inventoryTransactions: many(inventoryTransactions),
}));

export const orderRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, { fields: [orders.customer_id], references: [customers.id] }),
  items: many(orderItems),
}));

export const orderItemRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.order_id], references: [orders.id] }),
  product: one(products, { fields: [orderItems.product_id], references: [products.id] }),
}));

export const productTransformationRelations = relations(productTransformations, ({ one }) => ({
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
}));
