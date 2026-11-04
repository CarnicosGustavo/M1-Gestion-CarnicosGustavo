-- ============================================================================
--  Snapshot del esquema de las tablas de la app (SOLO estructura, sin datos)
-- ============================================================================
--  Generado el 2026-10-10 a partir del catálogo de producción (consultas de
--  solo lectura a pg_catalog / information_schema). Cubre las tablas
--  declaradas en packages/db/src/schema.ts que existen en la BD: columnas,
--  tipos, nulabilidad, defaults, PK, FKs, UNIQUE e índices.
--
--  Uso: base local para verificar que schema.ts no genera diffs
--  (ver sql/README.md → "Verificar drift"). NO ejecutar en producción.
--
--  No incluye: RLS/policies, triggers, funciones, vistas, el esquema
--  `staging` ni tablas heredadas/de respaldo (ver supabase/migrations/).
-- ============================================================================
CREATE TYPE "public"."order_status" AS ENUM('pending','confirmed','processing','ready','delivered','cancelled','completed','paid','shipped','PENDIENTE_PESAJE','LISTA_PARA_COBRO','PROCESANDO_PAGO','COMPLETADA','PARCIAL_DISPONIBLE');
CREATE TYPE "public"."message_direction" AS ENUM('inbound','outbound');
CREATE TYPE "public"."role" AS ENUM('user','admin');
CREATE TABLE "account" ("id" text PRIMARY KEY, "account_id" text NOT NULL, "provider_id" text NOT NULL, "user_id" text NOT NULL, "access_token" text, "refresh_token" text, "id_token" text, "access_token_expires_at" timestamp with time zone, "refresh_token_expires_at" timestamp with time zone, "scope" text, "password" text, "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE "antonella_config" ("id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY, "user_uid" character varying(255) NOT NULL, "system_prompt" text DEFAULT ''::text NOT NULL, "disabled_tools" jsonb DEFAULT '[]'::jsonb NOT NULL, "custom_tools" jsonb DEFAULT '[]'::jsonb NOT NULL, "model" character varying(100) DEFAULT 'claude-opus-4-8'::character varying NOT NULL, "created_at" timestamp without time zone DEFAULT now(), "updated_at" timestamp without time zone DEFAULT now());
CREATE TABLE "antonella_dataset_rows" ("id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY, "dataset_id" integer NOT NULL, "data" jsonb DEFAULT '{}'::jsonb NOT NULL, "created_at" timestamp without time zone DEFAULT now());
CREATE TABLE "antonella_datasets" ("id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY, "user_uid" character varying(255) NOT NULL, "name" character varying(120) NOT NULL, "description" text DEFAULT ''::text NOT NULL, "columns" jsonb DEFAULT '[]'::jsonb NOT NULL, "created_at" timestamp without time zone DEFAULT now(), "updated_at" timestamp without time zone DEFAULT now());
CREATE TABLE "antonella_memories" ("id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY, "user_uid" character varying(255) NOT NULL, "category" character varying(80) DEFAULT 'general'::character varying NOT NULL, "title" character varying(200) NOT NULL, "content" text NOT NULL, "tags" jsonb DEFAULT '[]'::jsonb NOT NULL, "importance" integer DEFAULT 1 NOT NULL, "created_at" timestamp without time zone DEFAULT now(), "updated_at" timestamp without time zone DEFAULT now());
CREATE TABLE "channel_purchases" ("id" serial PRIMARY KEY, "supplier" character varying(100), "qty_americano" integer DEFAULT 0 NOT NULL, "qty_nacional" integer DEFAULT 0 NOT NULL, "num_medias" integer DEFAULT 0 NOT NULL, "total_kg" numeric(12,3) DEFAULT 0 NOT NULL, "price_per_kg" numeric(10,2), "purchase_date" date DEFAULT CURRENT_DATE NOT NULL, "user_uid" character varying(255), "created_at" timestamp with time zone DEFAULT now(), "verified_canales" integer, "verified_kg" numeric(12,3), "cedis_detail" jsonb);
CREATE TABLE "credit_accounts" ("id" serial PRIMARY KEY, "customer_id" integer NOT NULL, "credit_limit" numeric(12,2) DEFAULT 0 NOT NULL, "terms_days" integer DEFAULT 0 NOT NULL, "created_at" timestamp with time zone DEFAULT now(), "updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE "credit_charges" ("id" serial PRIMARY KEY, "customer_id" integer NOT NULL, "order_id" integer, "amount" numeric(12,2) DEFAULT 0 NOT NULL, "concept" character varying(255), "charge_date" date DEFAULT CURRENT_DATE NOT NULL, "source" character varying(30) DEFAULT 'ticket_viejo'::character varying NOT NULL, "created_at" timestamp with time zone DEFAULT now());
CREATE TABLE "credit_payments" ("id" serial PRIMARY KEY, "customer_id" integer NOT NULL, "amount" numeric(12,2) DEFAULT 0 NOT NULL, "payment_date" date DEFAULT CURRENT_DATE NOT NULL, "method" character varying(50), "notes" text, "created_at" timestamp with time zone DEFAULT now());
CREATE TABLE "customer_prices" ("id" serial PRIMARY KEY, "customer_id" integer NOT NULL, "product_id" integer NOT NULL, "price_per_kg" numeric(10,2), "price_per_piece" numeric(10,2), "updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE "customers" ("id" serial PRIMARY KEY, "whatsapp_phone" character varying(20), "name" character varying(150), "address" text, "notes" text, "total_orders" integer DEFAULT 0 NOT NULL, "createdAt" timestamp without time zone DEFAULT now() NOT NULL, "updatedAt" timestamp without time zone DEFAULT now() NOT NULL, "user_uid" character varying(255), "email" character varying(255), "phone" character varying(50), "status" character varying(20) DEFAULT 'active'::character varying, "created_at" timestamp with time zone DEFAULT now(), "updated_at" timestamp with time zone DEFAULT now(), "contact_name" character varying(255), "price_list_id" integer);
CREATE TABLE "inventory_transactions" ("id" serial PRIMARY KEY, "product_id" integer NOT NULL, "quantity_change_pieces" integer, "quantity_change_kg" numeric, "transaction_type" character varying(50) NOT NULL, "reference_id" integer, "notes" text, "created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE "order_items" ("id" serial PRIMARY KEY, "order_id" integer NOT NULL, "product_id" integer, "product_name" character varying(100), "quantity_kg" numeric(8,3), "unit_price" numeric(10,2), "subtotal" numeric(10,2), "createdAt" timestamp without time zone DEFAULT now() NOT NULL, "quantity_pieces" integer, "status" character varying(50) DEFAULT 'PENDING'::character varying NOT NULL, "user_uid" character varying(255), "quantity" integer DEFAULT 1, "price" numeric(10,2) DEFAULT 0.00, "created_at" timestamp with time zone DEFAULT now(), "updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE "orders" ("id" serial PRIMARY KEY, "customer_id" integer, "status" order_status DEFAULT 'pending'::order_status, "total_amount" numeric(10,2) DEFAULT 0.00, "notes" text, "delivery_address" text, "whatsapp_message_id" character varying(100), "createdAt" timestamp without time zone DEFAULT now() NOT NULL, "updatedAt" timestamp without time zone DEFAULT now() NOT NULL, "requires_weighing" boolean DEFAULT false NOT NULL, "user_uid" character varying(255), "created_at" timestamp with time zone DEFAULT now(), "updated_at" timestamp with time zone DEFAULT now(), "web_order_id" uuid);
CREATE TABLE "payment_methods" ("id" bigserial PRIMARY KEY, "name" character varying(50) NOT NULL, "created_at" timestamp with time zone DEFAULT now());
CREATE TABLE "price_list_items" ("id" bigserial PRIMARY KEY, "price_list_id" bigint NOT NULL, "product_id" bigint NOT NULL, "unit_price_per_kg" numeric(10,2), "unit_price_per_piece" numeric(10,2), "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE "price_lists" ("id" bigserial PRIMARY KEY, "user_uid" character varying(255) NOT NULL, "code" character varying(50) NOT NULL, "name" character varying(255) NOT NULL, "is_default" boolean DEFAULT false NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE "product_transformations" ("id" serial PRIMARY KEY, "parent_product_id" integer NOT NULL, "child_product_id" integer NOT NULL, "yield_quantity_pieces" numeric NOT NULL, "yield_weight_ratio" numeric NOT NULL, "transformation_type" character varying(50) NOT NULL, "is_active" boolean DEFAULT true NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL, "is_variant" boolean DEFAULT false NOT NULL);
CREATE TABLE "products" ("id" serial PRIMARY KEY, "name" character varying(100) NOT NULL, "description" text, "price_per_kg" numeric(10,2) DEFAULT 0.00 NOT NULL, "unit" character varying(20) DEFAULT 'kg'::character varying NOT NULL, "active" boolean DEFAULT true NOT NULL, "sort_order" integer DEFAULT 0 NOT NULL, "createdAt" timestamp without time zone DEFAULT now() NOT NULL, "updatedAt" timestamp without time zone DEFAULT now() NOT NULL, "stock_pieces" integer DEFAULT 0, "stock_kg" numeric DEFAULT 0.0, "is_parent_product" boolean DEFAULT false, "is_sellable_by_unit" boolean DEFAULT true, "is_sellable_by_weight" boolean DEFAULT true, "default_sale_unit" character varying(10) DEFAULT 'KG'::character varying, "price_per_piece" numeric, "category" character varying(100) DEFAULT 'General'::character varying, "user_uid" character varying(255), "status" character varying(20) DEFAULT 'active'::character varying, "image" text, "in_stock" integer DEFAULT 0, "ncm" character varying(20), "cfop" character varying(20), "icms_cst" character varying(20), "pis_cst" character varying(20), "cofins_cst" character varying(20), "unit_of_measure" character varying(20) DEFAULT 'KG'::character varying, "created_at" timestamp with time zone DEFAULT now(), "updated_at" timestamp with time zone DEFAULT now(), "parent_product_id" integer, "price_alias" character varying(255), "weighed_pieces" integer DEFAULT 0 NOT NULL, "avg_weight_per_piece_kg" numeric(10,3), "stock_kg_frozen" numeric(10,3) DEFAULT 0 NOT NULL, "stock_pieces_frozen" integer DEFAULT 0 NOT NULL);
CREATE TABLE "session" ("id" text PRIMARY KEY, "expires_at" timestamp with time zone NOT NULL, "token" text NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL, "ip_address" text, "user_agent" text, "user_id" text NOT NULL);
CREATE TABLE "transactions" ("id" bigserial PRIMARY KEY, "description" text, "order_id" bigint, "payment_method_id" bigint, "amount" numeric(10,2), "user_uid" character varying(255) NOT NULL, "type" character varying(20), "category" character varying(100), "status" character varying(20), "created_at" timestamp with time zone DEFAULT now());
CREATE TABLE "user" ("id" text PRIMARY KEY, "name" text NOT NULL, "email" text NOT NULL, "email_verified" boolean DEFAULT false NOT NULL, "image" text, "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL, "role" text DEFAULT 'user'::text, "openId" character varying, "loginMethod" character varying, "lastSignedIn" timestamp with time zone DEFAULT now(), "user_uid" character varying(255));
CREATE TABLE "verification" ("id" text PRIMARY KEY, "identifier" text NOT NULL, "value" text NOT NULL, "expires_at" timestamp with time zone NOT NULL, "created_at" timestamp with time zone DEFAULT now(), "updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE "web_orders" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "created_at" timestamp with time zone DEFAULT now() NOT NULL, "source" text DEFAULT 'website'::text NOT NULL, "business_name" text NOT NULL, "contact_name" text NOT NULL, "phone" text NOT NULL, "delivery_address" text, "notes" text, "location_label" text, "items" jsonb NOT NULL, "items_count" integer DEFAULT 0 NOT NULL, "user_agent" text, "whatsapp_message" text);
CREATE TABLE "whatsapp_messages" ("id" serial PRIMARY KEY, "phone" character varying(20) NOT NULL, "direction" message_direction NOT NULL, "message_type" character varying(30) NOT NULL, "content" text, "whatsapp_message_id" character varying(100), "status" character varying(30) DEFAULT 'sent'::character varying, "createdAt" timestamp without time zone DEFAULT now() NOT NULL);
CREATE TABLE "whatsapp_sessions" ("id" serial PRIMARY KEY, "phone" character varying(20) NOT NULL, "state" character varying(50) DEFAULT 'idle'::character varying NOT NULL, "cart_data" jsonb DEFAULT '[]'::jsonb, "current_product_id" integer, "current_product_name" character varying(100), "last_message_at" timestamp without time zone DEFAULT now() NOT NULL, "createdAt" timestamp without time zone DEFAULT now() NOT NULL, "updatedAt" timestamp without time zone DEFAULT now() NOT NULL);
CREATE TABLE "yield_sheet_items" ("id" serial PRIMARY KEY, "sheet_id" integer NOT NULL, "product_id" integer, "product_name" character varying NOT NULL, "pieces" integer DEFAULT 0 NOT NULL, "kg_total" numeric(12,3) DEFAULT 0 NOT NULL, "weighed" boolean DEFAULT false NOT NULL, "sort_order" integer DEFAULT 0 NOT NULL);
CREATE TABLE "yield_sheets" ("id" serial PRIMARY KEY, "sheet_date" date DEFAULT CURRENT_DATE NOT NULL, "num_canales" integer DEFAULT 0 NOT NULL, "kg_comprado" numeric(12,3) DEFAULT 0 NOT NULL, "notes" text, "user_uid" character varying, "created_at" timestamp with time zone DEFAULT now(), "updated_at" timestamp with time zone DEFAULT now(), "supplier" character varying(100));
ALTER TABLE "user" ADD CONSTRAINT user_email_key1 UNIQUE (email);
ALTER TABLE "user" ADD CONSTRAINT "user_openId_key1" UNIQUE ("openId");
ALTER TABLE account ADD CONSTRAINT account_user_id_fkey FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE;
ALTER TABLE antonella_config ADD CONSTRAINT antonella_config_user_uid_key UNIQUE (user_uid);
ALTER TABLE antonella_dataset_rows ADD CONSTRAINT antonella_dataset_rows_dataset_id_fkey FOREIGN KEY (dataset_id) REFERENCES antonella_datasets(id) ON DELETE CASCADE;
ALTER TABLE antonella_datasets ADD CONSTRAINT antonella_datasets_user_uid_name_key UNIQUE (user_uid, name);
ALTER TABLE credit_accounts ADD CONSTRAINT credit_accounts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE credit_accounts ADD CONSTRAINT credit_accounts_customer_id_key UNIQUE (customer_id);
ALTER TABLE credit_charges ADD CONSTRAINT credit_charges_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE credit_payments ADD CONSTRAINT credit_payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE customer_prices ADD CONSTRAINT customer_prices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE customer_prices ADD CONSTRAINT customer_prices_customer_id_product_id_key UNIQUE (customer_id, product_id);
ALTER TABLE customer_prices ADD CONSTRAINT customer_prices_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE customers ADD CONSTRAINT customers_whatsapp_phone_key UNIQUE (whatsapp_phone);
ALTER TABLE inventory_transactions ADD CONSTRAINT inventory_transactions_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE order_items ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id);
ALTER TABLE order_items ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id);
ALTER TABLE orders ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id);
ALTER TABLE orders ADD CONSTRAINT orders_web_order_id_fkey FOREIGN KEY (web_order_id) REFERENCES web_orders(id) ON DELETE SET NULL;
ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_name_key UNIQUE (name);
ALTER TABLE price_list_items ADD CONSTRAINT price_list_items_price_list_id_fkey FOREIGN KEY (price_list_id) REFERENCES price_lists(id);
ALTER TABLE price_list_items ADD CONSTRAINT price_list_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id);
ALTER TABLE product_transformations ADD CONSTRAINT product_transformations_child_product_id_fkey FOREIGN KEY (child_product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE product_transformations ADD CONSTRAINT product_transformations_parent_product_id_fkey FOREIGN KEY (parent_product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE products ADD CONSTRAINT products_parent_product_id_fkey FOREIGN KEY (parent_product_id) REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE session ADD CONSTRAINT session_token_key UNIQUE (token);
ALTER TABLE session ADD CONSTRAINT session_user_id_fkey FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE;
ALTER TABLE transactions ADD CONSTRAINT transactions_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id);
ALTER TABLE whatsapp_sessions ADD CONSTRAINT whatsapp_sessions_phone_key UNIQUE (phone);
ALTER TABLE yield_sheet_items ADD CONSTRAINT yield_sheet_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id);
ALTER TABLE yield_sheet_items ADD CONSTRAINT yield_sheet_items_sheet_id_fkey FOREIGN KEY (sheet_id) REFERENCES yield_sheets(id) ON DELETE CASCADE;
CREATE INDEX customers_user_uid_idx ON public.customers USING btree (user_uid);
CREATE INDEX idx_antonella_memories_cat ON public.antonella_memories USING btree (user_uid, category);
CREATE INDEX idx_antonella_memories_user ON public.antonella_memories USING btree (user_uid);
CREATE INDEX idx_antonella_rows_dataset ON public.antonella_dataset_rows USING btree (dataset_id);
CREATE INDEX idx_channel_purchases_date ON public.channel_purchases USING btree (purchase_date);
CREATE INDEX idx_credit_charges_customer ON public.credit_charges USING btree (customer_id);
CREATE INDEX idx_credit_payments_customer ON public.credit_payments USING btree (customer_id);
CREATE INDEX idx_customer_prices_customer ON public.customer_prices USING btree (customer_id);
CREATE INDEX idx_inventory_transactions_product_id ON public.inventory_transactions USING btree (product_id);
CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);
CREATE INDEX idx_orders_customer ON public.orders USING btree (customer_id);
CREATE INDEX idx_orders_status ON public.orders USING btree (status);
CREATE INDEX idx_orders_web_order_id ON public.orders USING btree (web_order_id);
CREATE INDEX idx_product_transformations_child_product_id ON public.product_transformations USING btree (child_product_id);
CREATE INDEX idx_product_transformations_parent_product_id ON public.product_transformations USING btree (parent_product_id);
CREATE INDEX idx_wa_messages_phone ON public.whatsapp_messages USING btree (phone);
CREATE INDEX idx_wa_sessions_phone ON public.whatsapp_sessions USING btree (phone);
CREATE INDEX idx_yield_items_sheet ON public.yield_sheet_items USING btree (sheet_id);
CREATE INDEX order_items_user_uid_idx ON public.order_items USING btree (user_uid);
CREATE INDEX orders_user_uid_idx ON public.orders USING btree (user_uid);
CREATE INDEX products_user_uid_idx ON public.products USING btree (user_uid);
CREATE INDEX transactions_user_uid_idx ON public.transactions USING btree (user_uid);
CREATE UNIQUE INDEX user_openid_unique ON public."user" USING btree ("openId");
CREATE UNIQUE INDEX ux_product_transformations_active ON public.product_transformations USING btree (parent_product_id, child_product_id, transformation_type) WHERE (is_active = true);
CREATE INDEX web_orders_created_at_idx ON public.web_orders USING btree (created_at DESC);
CREATE INDEX web_orders_phone_idx ON public.web_orders USING btree (phone);
