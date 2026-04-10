import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

export default defineConfig(
  databaseUrl
    ? {
        dialect: "postgresql",
        schema: "./src/lib/db/schema.ts",
        dbCredentials: {
          url: databaseUrl,
        },
      }
    : {
        dialect: "postgresql",
        driver: "pglite",
        schema: "./src/lib/db/schema.ts",
        dbCredentials: {
          url: "./data/pglite",
        },
      },
);
