/**
 * Verificación de conexión a Supabase — ejecutar LOCALMENTE.
 *
 *   cd apps/web && bun run db:check
 *
 * No funciona en Claude Code on the web: el proxy del entorno solo enruta
 * HTTP/HTTPS, así que el puerto Postgres está bloqueado. Córrelo en tu máquina
 * o en un entorno con acceso a la base (Vercel, etc.).
 *
 * Comprueba, de forma independiente:
 *   1. Postgres (lo que usa Drizzle): conecta y cuenta tablas del esquema public.
 *   2. Cliente Supabase JS (REST con service role): hace una consulta real.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const ok = (m: string) => console.log(`${GREEN}✓${RESET} ${m}`);
const fail = (m: string) => console.log(`${RED}✗${RESET} ${m}`);

let hadError = false;

async function checkPostgres() {
	const url =
		process.env.DATABASE_URL_MIGRATIONS?.trim() ||
		process.env.DATABASE_URL?.trim();
	if (!url) {
		fail("DATABASE_URL no definida — omito prueba de Postgres");
		hadError = true;
		return;
	}
	console.log(`\n${DIM}Postgres (Drizzle)…${RESET}`);
	const sql = postgres(url, {
		ssl: "require",
		...(url.includes("pooler.supabase") ? { prepare: false } : null),
		max: 1,
		idle_timeout: 5,
		connect_timeout: 10,
	});
	try {
		const [{ now }] = await sql`select now() as now`;
		ok(`Conexión establecida (hora del servidor: ${now})`);
		const tables = await sql<{ table_name: string }[]>`
			select table_name from information_schema.tables
			where table_schema = 'public' order by table_name`;
		if (tables.length === 0) {
			fail(
				"El esquema public no tiene tablas — falta correr migraciones (bun run db:push)",
			);
			hadError = true;
		} else {
			ok(`${tables.length} tablas en public`);
			const expected = ["orders", "order_items", "products", "customers"];
			const present = new Set(tables.map((t) => t.table_name));
			const missing = expected.filter((t) => !present.has(t));
			if (missing.length > 0) {
				fail(`Faltan tablas esperadas: ${missing.join(", ")}`);
				hadError = true;
			} else {
				ok(`Tablas clave presentes: ${expected.join(", ")}`);
			}
		}
	} catch (e) {
		fail(`No se pudo conectar: ${(e as Error).message}`);
		hadError = true;
	} finally {
		await sql.end({ timeout: 5 });
	}
}

async function checkSupabaseJs() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
	const key =
		process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
	if (!url || !key) {
		fail(
			"NEXT_PUBLIC_SUPABASE_URL o claves no definidas — omito prueba de Supabase JS",
		);
		hadError = true;
		return;
	}
	console.log(`\n${DIM}Cliente Supabase JS (REST)…${RESET}`);
	const supabase = createClient(url, key, {
		auth: { persistSession: false },
	});
	try {
		const { error } = await supabase
			.from("products")
			.select("id", { count: "exact", head: true });
		if (error) {
			fail(`REST respondió con error: ${error.message}`);
			hadError = true;
		} else {
			ok("Consulta REST a 'products' exitosa");
		}
	} catch (e) {
		fail(`No se pudo conectar al cliente JS: ${(e as Error).message}`);
		hadError = true;
	}
}

async function main() {
	console.log("Verificando integración con Supabase…");
	await checkPostgres();
	await checkSupabaseJs();
	console.log();
	if (hadError) {
		fail("Hubo problemas — revisa los mensajes de arriba.");
		process.exit(1);
	}
	ok("Todo correcto.");
	process.exit(0);
}

void main();
