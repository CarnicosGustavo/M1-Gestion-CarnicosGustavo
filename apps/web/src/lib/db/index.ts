import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL?.trim() || undefined;

if (process.env.VERCEL === "1" && !databaseUrl) {
  throw new Error("DATABASE_URL is required on Vercel runtime.");
}

// If we have a DATABASE_URL, use standard Postgres (e.g. Supabase)
// Otherwise, use PGLite (local/ephemeral)
export const db = databaseUrl 
  ? drizzlePostgres(
      postgres(databaseUrl, {
        ssl: "require",
        ...(databaseUrl.includes("pooler.supabase") ? { prepare: false } : null),
      }),
      { schema },
    )
  : drizzle(new PGlite("./data/pglite"), { schema });
