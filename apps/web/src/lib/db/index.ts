import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Cargar variables de entorno para scripts fuera de Next.js
if (typeof process !== "undefined" && !process.env.DATABASE_URL) {
	try {
		const dotenv = await import("dotenv");
		dotenv.config({ path: ".env" });
		dotenv.config({ path: ".env.local", override: true });
	} catch (e) {
		// Ignorar si no hay dotenv (en browser o similar)
	}
}

const databaseUrl = process.env.DATABASE_URL?.trim() || undefined;

if (!databaseUrl) {
	throw new Error("DATABASE_URL is required.");
}

export const db = drizzlePostgres(
	postgres(databaseUrl, {
		ssl: "require",
		...(databaseUrl.includes("pooler.supabase") ? { prepare: false } : null),
		connection: { options: "-c search_path=public" },
	}),
	{ schema },
);
