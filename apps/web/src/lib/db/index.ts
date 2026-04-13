import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL?.trim() || undefined;

if (!databaseUrl) {
	throw new Error("DATABASE_URL is required.");
}

export const db = drizzlePostgres(
	postgres(databaseUrl, {
		ssl: "require",
		...(databaseUrl.includes("pooler.supabase") ? { prepare: false } : null),
	}),
	{ schema },
);
