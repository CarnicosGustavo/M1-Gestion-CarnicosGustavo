import dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

async function main() {
	if (!process.env.DATABASE_URL) {
		throw new Error("DATABASE_URL is required (Supabase/Postgres).");
	}
}

main();
