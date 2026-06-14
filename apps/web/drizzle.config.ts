import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// `generate` no necesita conexión (solo diffea el schema contra el snapshot),
// así que para ese comando aceptamos una URL ficticia. `push`/`migrate` sí
// requieren una conexión real a Supabase.
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
	// Tabla de control de migraciones (esquema `drizzle`, estándar de drizzle-orm)
	migrations: {
		table: "__drizzle_migrations",
		schema: "drizzle",
	},
});

