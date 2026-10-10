import { PGlite } from "@electric-sql/pglite";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/lib/db/schema";

/**
 * DDL de prueba generado por drizzle-kit a partir del schema real
 * (`packages/db/src/schema.ts`): incluye enums, identificadores entre comillas
 * (p. ej. la tabla `user`), defaults, FKs e índices. Así los tests no dependen
 * de un DDL escrito a mano que se desincroniza del schema.
 */
async function buildSchemaDDL(): Promise<string> {
	const empty = generateDrizzleJson({});
	const target = generateDrizzleJson(schema as Record<string, unknown>);
	const statements = await generateMigration(empty, target);
	return statements.join("\n");
}

export const SCHEMA_DDL = await buildSchemaDDL();

export function createTestDb() {
	const pg = new PGlite();
	const db = drizzle({ client: pg, schema });
	return { pg, db };
}

/**
 * Usuario de prueba. Por defecto `admin` para poder ejercitar procedimientos
 * protegidos por rol (adminProcedure/almacenProcedure/cajeroProcedure).
 */
export function makeUser(
	id: string,
	role: "admin" | "almacen" | "cajero" = "admin",
) {
	return {
		id,
		role,
		name: "Test",
		email: `${id}@test.com`,
		emailVerified: false,
		image: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
}
