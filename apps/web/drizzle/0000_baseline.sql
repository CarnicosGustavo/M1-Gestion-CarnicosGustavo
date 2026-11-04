CREATE TYPE "public"."message_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."order_item_status" AS ENUM('COMPLETADO', 'PENDIENTE_PESAJE', 'PENDIENTE_COMPRA', 'PESADO', 'PENDING', 'WEIGHED');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'confirmed', 'processing', 'ready', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "antonella_config" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "antonella_config_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_uid" varchar(255) NOT NULL,
	"system_prompt" text DEFAULT '' NOT NULL,
	"disabled_tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"custom_tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" varchar(100) DEFAULT 'claude-opus-4-8' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "antonella_config_user_uid_unique" UNIQUE("user_uid")
);
--> statement-breakpoint
CREATE TABLE "antonella_dataset_rows" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "antonella_dataset_rows_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"dataset_id" integer NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "antonella_datasets" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "antonella_datasets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_uid" varchar(255) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"columns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "antonella_memories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "antonella_memories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_uid" varchar(255) NOT NULL,
	"category" varchar(80) DEFAULT 'general' NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"importance" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "channel_purchases" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "channel_purchases_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"supplier" varchar(100),
	"qty_americano" integer DEFAULT 0 NOT NULL,
	"qty_nacional" integer DEFAULT 0 NOT NULL,
	"num_medias" integer DEFAULT 0 NOT NULL,
	"total_kg" numeric(12, 3) DEFAULT '0' NOT NULL,
	"price_per_kg" numeric(10, 2),
	"verified_canales" integer,
	"verified_kg" numeric(12, 3),
	"cedis_detail" jsonb,
	"purchase_date" date DEFAULT now(),
	"user_uid" varchar(255),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cities" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"state_code" varchar(2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_accounts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "credit_accounts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"customer_id" integer NOT NULL,
	"credit_limit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"terms_days" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "credit_charges" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "credit_charges_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"customer_id" integer NOT NULL,
	"order_id" integer,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"concept" varchar(255),
	"charge_date" date DEFAULT now(),
	"source" varchar(30) DEFAULT 'ticket_viejo' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "credit_payments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "credit_payments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"customer_id" integer NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"payment_date" date DEFAULT now(),
	"method" varchar(50),
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_prices" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customer_prices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"customer_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"price_per_kg" numeric(10, 2),
	"price_per_piece" numeric(10, 2),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"contact_name" varchar(255),
	"email" varchar(255) NOT NULL,
	"phone" varchar(20),
	"whatsapp_phone" varchar(20),
	"user_uid" varchar(255) NOT NULL,
	"status" varchar(20),
	"address" text,
	"notes" text,
	"price_list_id" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "customers_email_unique" UNIQUE("email"),
	CONSTRAINT "customers_whatsapp_phone_unique" UNIQUE("whatsapp_phone")
);
--> statement-breakpoint
CREATE TABLE "fiscal_settings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fiscal_settings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_uid" varchar(255) NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"trade_name" varchar(255),
	"tax_id" varchar(14) NOT NULL,
	"state_tax_id" varchar(20) NOT NULL,
	"tax_regime" integer NOT NULL,
	"state_code" varchar(2) NOT NULL,
	"city_code" varchar(7) NOT NULL,
	"city_name" varchar(100) NOT NULL,
	"street" varchar(255) NOT NULL,
	"street_number" varchar(10) NOT NULL,
	"district" varchar(100) NOT NULL,
	"zip_code" varchar(8) NOT NULL,
	"address_complement" varchar(100),
	"environment" integer DEFAULT 2 NOT NULL,
	"nfe_series" integer DEFAULT 1,
	"nfce_series" integer DEFAULT 1,
	"next_nfe_number" integer DEFAULT 1,
	"next_nfce_number" integer DEFAULT 1,
	"csc_id" varchar(10),
	"csc_token" varchar(50),
	"certificate_pfx" "bytea",
	"certificate_password" text,
	"certificate_valid_until" timestamp,
	"default_ncm" varchar(8) DEFAULT '00000000',
	"default_cfop" varchar(4) DEFAULT '5102',
	"default_icms_cst" varchar(3) DEFAULT '00',
	"default_pis_cst" varchar(2) DEFAULT '99',
	"default_cofins_cst" varchar(2) DEFAULT '99',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "fiscal_settings_user_uid_unique" UNIQUE("user_uid")
);
--> statement-breakpoint
CREATE TABLE "inventory_transactions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inventory_transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"product_id" integer NOT NULL,
	"quantity_change_pieces" integer,
	"quantity_change_kg" numeric(10, 3),
	"transaction_type" varchar(50) NOT NULL,
	"reference_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "invoice_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"invoice_id" integer NOT NULL,
	"event_type" varchar(30) NOT NULL,
	"sequence" integer DEFAULT 1,
	"protocol_number" varchar(20),
	"status_code" integer,
	"reason" text,
	"request_xml" text,
	"response_xml" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "invoice_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"invoice_id" integer NOT NULL,
	"product_id" integer,
	"item_number" integer NOT NULL,
	"product_code" varchar(60) NOT NULL,
	"description" varchar(120) NOT NULL,
	"ncm" varchar(8) NOT NULL,
	"cfop" varchar(4) NOT NULL,
	"unit_of_measure" varchar(6) DEFAULT 'UN',
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"total_price" integer NOT NULL,
	"icms_cst" varchar(3),
	"icms_rate" integer DEFAULT 0,
	"icms_amount" integer DEFAULT 0,
	"pis_cst" varchar(2),
	"cofins_cst" varchar(2),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "invoices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"order_id" integer,
	"model" integer NOT NULL,
	"series" integer NOT NULL,
	"number" integer NOT NULL,
	"access_key" varchar(44),
	"operation_nature" varchar(60) DEFAULT 'VENDA',
	"operation_type" integer DEFAULT 1,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"environment" integer NOT NULL,
	"request_xml" text,
	"response_xml" text,
	"protocol_xml" text,
	"protocol_number" varchar(20),
	"status_code" integer,
	"status_message" text,
	"issued_at" timestamp NOT NULL,
	"authorized_at" timestamp,
	"total_amount" integer NOT NULL,
	"is_contingency" boolean DEFAULT false,
	"contingency_type" varchar(20),
	"contingency_at" timestamp,
	"contingency_reason" text,
	"recipient_tax_id" varchar(14),
	"recipient_name" varchar(255),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "order_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_id" integer NOT NULL,
	"product_id" integer,
	"product_name" varchar(255) NOT NULL,
	"quantity" integer,
	"price" numeric(10, 2),
	"quantity_pieces" integer,
	"quantity_kg" numeric(10, 3),
	"unit_price" numeric(10, 2) NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"status" "order_item_status" DEFAULT 'COMPLETADO' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"customer_id" integer,
	"status" varchar(50) DEFAULT 'pending',
	"total_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"user_uid" varchar(255) NOT NULL,
	"notes" text,
	"delivery_address" text,
	"whatsapp_message_id" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"requires_weighing" boolean DEFAULT false NOT NULL,
	"web_order_id" uuid
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payment_methods_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "payment_methods_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "price_list_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "price_list_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"price_list_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"unit_price_per_kg" numeric(10, 2),
	"unit_price_per_piece" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_lists" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "price_lists_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_uid" varchar(255) NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_transformations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_transformations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"parent_product_id" integer NOT NULL,
	"child_product_id" integer NOT NULL,
	"yield_quantity_pieces" numeric(10, 2) NOT NULL,
	"yield_weight_ratio" numeric(10, 4) NOT NULL,
	"transformation_type" varchar(50) NOT NULL,
	"is_variant" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"description" text,
	"price_per_kg" numeric(10, 2),
	"unit" varchar(50),
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0,
	"in_stock" numeric(10, 3) DEFAULT '0.000' NOT NULL,
	"category" varchar(50),
	"user_uid" varchar(255) NOT NULL,
	"ncm" varchar(8),
	"cfop" varchar(4),
	"icms_cst" varchar(3),
	"pis_cst" varchar(2),
	"cofins_cst" varchar(2),
	"unit_of_measure" varchar(6),
	"stock_pieces" integer DEFAULT 0 NOT NULL,
	"weighed_pieces" integer DEFAULT 0 NOT NULL,
	"stock_kg" numeric(10, 3) DEFAULT '0.000' NOT NULL,
	"stock_kg_frozen" numeric(10, 3) DEFAULT '0.000' NOT NULL,
	"stock_pieces_frozen" integer DEFAULT 0 NOT NULL,
	"is_parent_product" boolean DEFAULT false NOT NULL,
	"parent_product_id" integer,
	"is_sellable_by_unit" boolean DEFAULT true NOT NULL,
	"is_sellable_by_weight" boolean DEFAULT true NOT NULL,
	"default_sale_unit" varchar(10) DEFAULT 'KG' NOT NULL,
	"price_per_piece" numeric(10, 2),
	"avg_weight_per_piece_kg" numeric(10, 3),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "purchase_orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_id" integer NOT NULL,
	"status" varchar(20) DEFAULT 'PENDIENTE' NOT NULL,
	"notes" text,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"description" text,
	"order_id" integer,
	"payment_method_id" integer,
	"amount" integer NOT NULL,
	"user_uid" varchar(255) NOT NULL,
	"type" varchar(20),
	"category" varchar(100),
	"status" varchar(20),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" text DEFAULT 'user',
	"openId" varchar,
	"loginMethod" varchar,
	"lastSignedIn" timestamp DEFAULT now(),
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "web_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(50) DEFAULT 'website',
	"business_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"phone" text NOT NULL,
	"delivery_address" text,
	"notes" text,
	"location_label" text,
	"items" jsonb NOT NULL,
	"items_count" integer,
	"user_agent" text,
	"whatsapp_message" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "whatsapp_messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "whatsapp_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"phone" varchar(20) NOT NULL,
	"direction" "message_direction" NOT NULL,
	"message_type" varchar(50) NOT NULL,
	"content" text,
	"whatsapp_message_id" varchar(255),
	"status" varchar(50) DEFAULT 'sent' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_sessions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "whatsapp_sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"phone" varchar(20) NOT NULL,
	"state" varchar(50) DEFAULT 'idle' NOT NULL,
	"cart_data" text DEFAULT '[]' NOT NULL,
	"current_product_id" integer,
	"current_product_name" varchar(255),
	"last_message_at" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_sessions_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "yield_sheet_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "yield_sheet_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sheet_id" integer NOT NULL,
	"product_id" integer,
	"product_name" varchar(255) NOT NULL,
	"pieces" integer DEFAULT 0 NOT NULL,
	"kg_total" numeric(12, 3) DEFAULT '0.000' NOT NULL,
	"weighed" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yield_sheets" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "yield_sheets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sheet_date" date DEFAULT now(),
	"num_canales" integer DEFAULT 0 NOT NULL,
	"kg_comprado" numeric(12, 3) DEFAULT '0.000' NOT NULL,
	"supplier" varchar(100),
	"notes" text,
	"user_uid" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "antonella_dataset_rows" ADD CONSTRAINT "antonella_dataset_rows_dataset_id_antonella_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."antonella_datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_events" ADD CONSTRAINT "invoice_events_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_web_order_id_web_orders_id_fk" FOREIGN KEY ("web_order_id") REFERENCES "public"."web_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_transformations" ADD CONSTRAINT "product_transformations_parent_product_id_products_id_fk" FOREIGN KEY ("parent_product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_transformations" ADD CONSTRAINT "product_transformations_child_product_id_products_id_fk" FOREIGN KEY ("child_product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_parent_product_id_products_id_fk" FOREIGN KEY ("parent_product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yield_sheet_items" ADD CONSTRAINT "yield_sheet_items_sheet_id_yield_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."yield_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yield_sheet_items" ADD CONSTRAINT "yield_sheet_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;