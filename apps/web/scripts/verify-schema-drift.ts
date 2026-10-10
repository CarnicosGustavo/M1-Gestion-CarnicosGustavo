/**
 * Verifica que packages/db/src/schema.ts coincide con el esquema real de la BD
 * SIN conectarse a producción: carga supabase/schema/app_tables.sql en una
 * Postgres en memoria (PGlite) y pide a drizzle-kit el diff (`pushSchema`),
 * sin ejecutarlo. Debe imprimir "0 statements".
 *
 * Uso (desde apps/web):  bun run db:verify-drift
 */
import { PGlite } from "@electric-sql/pglite";
import { pushSchema } from "drizzle-kit/api";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../src/lib/db/schema";

const snapshotPath = new URL(
	"../../../supabase/schema/app_tables.sql",
	import.meta.url,
);

const client = new PGlite();
await client.exec(await Bun.file(snapshotPath).text());
const db = drizzle(client);

// biome-ignore lint/suspicious/noExplicitAny: API de drizzle-kit poco tipada
const result = await pushSchema(schema as any, db as any);

console.log(`hasDataLoss: ${result.hasDataLoss}`);
console.log(`${result.statementsToExecute.length} statements`);
for (const statement of result.statementsToExecute)
	console.log(`  ${statement}`);
await client.close();
process.exit(result.statementsToExecute.length === 0 ? 0 : 1);
