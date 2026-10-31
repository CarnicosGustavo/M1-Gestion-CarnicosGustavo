export type PgConnectionOptions = {
	ssl: "require" | "prefer" | false;
	prepare?: boolean;
};

/**
 * Obtiene las opciones de conexión PostgreSQL según las variables de entorno.
 */
export function pgConnectionOptions(
	databaseUrl: string,
	env: Record<string, string | undefined> = process.env,
): PgConnectionOptions {
	const sslValue = env.DATABASE_SSL?.trim().toLowerCase();

	let ssl: PgConnectionOptions["ssl"];

	switch (sslValue) {
		case "require":
			ssl = "require";
			break;
		case "prefer":
			ssl = "prefer";
			break;
		case "disable":
			ssl = false;
			break;
		case "":
		case undefined:
			ssl = "require";
			break;
		default:
			throw new Error(
				"DATABASE_SSL no es válida. Los valores válidos son: require, prefer o disable.",
			);
	}

	const prepareValue = env.DATABASE_PREPARE?.trim().toLowerCase();
	let prepare: boolean | undefined;

	switch (prepareValue) {
		case "true":
			prepare = true;
			break;
		case "false":
			prepare = false;
			break;
		case "":
		case undefined:
			if (databaseUrl.includes("pooler.supabase")) {
				prepare = false;
			}
			break;
		default:
			throw new Error(
				"DATABASE_PREPARE no es válida. Los valores válidos son: true o false.",
			);
	}

	return {
		ssl,
		...(prepare === undefined ? null : { prepare }),
	};
}
