import { describe, expect, test } from "bun:test";
import { pgConnectionOptions } from "../connection-options";

const normalDatabaseUrl = "postgres://u@db.example.com:5432/carnicos";
const poolerDatabaseUrl =
	"postgres://u@aws-0.pooler.supabase.com:6543/postgres";

describe("pgConnectionOptions", () => {
	describe("valores predeterminados", () => {
		test("sin variables de entorno y una URL normal", () => {
			expect(pgConnectionOptions(normalDatabaseUrl, {})).toEqual({
				ssl: "require",
			});
		});

		test("sin variables de entorno y una URL de pooler.supabase", () => {
			expect(pgConnectionOptions(poolerDatabaseUrl, {})).toEqual({
				ssl: "require",
				prepare: false,
			});
		});
	});

	describe("DATABASE_SSL", () => {
		test.each([
			["require", "require"],
			["prefer", "prefer"],
			["disable", false],
		] as const)("acepta el valor %s", (value, expected) => {
			expect(
				pgConnectionOptions(normalDatabaseUrl, { DATABASE_SSL: value }),
			).toEqual({ ssl: expected });
		});

		test("normaliza mayúsculas y espacios", () => {
			expect(
				pgConnectionOptions(normalDatabaseUrl, {
					DATABASE_SSL: "  PREFER  ",
				}),
			).toEqual({ ssl: "prefer" });
		});

		test("lanza un error para un valor inválido", () => {
			expect(() =>
				pgConnectionOptions(normalDatabaseUrl, {
					DATABASE_SSL: "invalid",
				}),
			).toThrow(
				"DATABASE_SSL no es válida. Los valores válidos son: require, prefer o disable.",
			);
		});
	});

	describe("DATABASE_PREPARE", () => {
		test("true sobrescribe el valor predeterminado del pooler", () => {
			expect(
				pgConnectionOptions(poolerDatabaseUrl, {
					DATABASE_PREPARE: "true",
				}),
			).toEqual({ ssl: "require", prepare: true });
		});

		test("false sobrescribe el valor predeterminado del pooler", () => {
			expect(
				pgConnectionOptions(poolerDatabaseUrl, {
					DATABASE_PREPARE: "false",
				}),
			).toEqual({ ssl: "require", prepare: false });
		});

		test("normaliza mayúsculas y espacios", () => {
			expect(
				pgConnectionOptions(normalDatabaseUrl, {
					DATABASE_PREPARE: "  TRUE  ",
				}),
			).toEqual({ ssl: "require", prepare: true });
		});

		test("lanza un error para un valor inválido", () => {
			expect(() =>
				pgConnectionOptions(normalDatabaseUrl, {
					DATABASE_PREPARE: "invalid",
				}),
			).toThrow(
				"DATABASE_PREPARE no es válida. Los valores válidos son: true o false.",
			);
		});
	});

	test("el error de DATABASE_SSL no contiene la URL", () => {
		const databaseUrl =
			"postgres://usuario:contraseña-ficticia@db.example.com:5432/carnicos";

		let message = "";
		try {
			pgConnectionOptions(databaseUrl, { DATABASE_SSL: "invalid" });
		} catch (error) {
			message = (error as Error).message;
		}
		expect(message).not.toBe("");
		expect(message).not.toContain(databaseUrl);
		expect(message).not.toContain("contraseña-ficticia");
	});

	test("el error de DATABASE_PREPARE no contiene la URL", () => {
		const databaseUrl =
			"postgres://usuario:contraseña-ficticia@db.example.com:5432/carnicos";

		let message = "";
		try {
			pgConnectionOptions(databaseUrl, { DATABASE_PREPARE: "invalid" });
		} catch (error) {
			message = (error as Error).message;
		}
		expect(message).not.toBe("");
		expect(message).not.toContain(databaseUrl);
		expect(message).not.toContain("contraseña-ficticia");
	});
});
