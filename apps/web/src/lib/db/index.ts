import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

// If we have a DATABASE_URL, use standard Postgres (e.g. Supabase)
// Otherwise, use PGLite (local/ephemeral)
export const db = databaseUrl 
  ? drizzlePostgres(
      postgres(databaseUrl, databaseUrl.includes("pooler.supabase") ? { prepare: false } : undefined),
      { schema },
    )
  : drizzle(new PGlite("./data/pglite"), { schema });
