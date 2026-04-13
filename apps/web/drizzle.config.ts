import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const databaseUrl =
	process.env.DATABASE_URL_MIGRATIONS ?? process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error(
		"DATABASE_URL (or DATABASE_URL_MIGRATIONS) environment variable is required.",
	);
}

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/lib/db/schema.ts",
	dbCredentials: {
		url: databaseUrl,
	},
});
