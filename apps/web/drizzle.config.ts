import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// `generate` no necesita conexión (solo compara el schema contra el último
// snapshot), así que para ese comando aceptamos una URL ficticia.
// `push`/`migrate` sí requieren una conexión real.
const databaseUrl =
	process.env.DATABASE_URL_MIGRATIONS ??
	process.env.DATABASE_URL ??
	"postgres://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/lib/db/schema.ts",
	out: "./drizzle",
	dbCredentials: {
		url: databaseUrl,
	},
	// Solo las tablas declaradas en packages/db/src/schema.ts. La BD tiene otras
	// tablas/vistas gestionadas por migraciones SQL de Supabase
	// (supabase/migrations/) que drizzle-kit NO debe tocar ni borrar.
	tablesFilter: [
		"user",
		"session",
		"account",
		"verification",
		"web_orders",
		"products",
		"channel_purchases",
		"yield_sheets",
		"yield_sheet_items",
		"credit_accounts",
		"credit_charges",
		"credit_payments",
		"customer_prices",
		"price_lists",
		"price_list_items",
		"product_transformations",
		"inventory_transactions",
		"customers",
		"orders",
		"order_items",
		"whatsapp_sessions",
		"whatsapp_messages",
		"payment_methods",
		"transactions",
		"antonella_config",
		"antonella_memories",
		"antonella_datasets",
		"antonella_dataset_rows",
	],
	// Tabla de control de migraciones (esquema `drizzle`, estándar de drizzle-orm)
	migrations: {
		table: "__drizzle_migrations",
		schema: "drizzle",
	},
});
