import { describe, expect, test } from "bun:test";
import { isPesajeThemeId, nextPesajeTheme } from "../pesaje-themes";

describe("temas de la estación v2", () => {
	test("el predeterminado es m1 y el ciclo vuelve al inicio", () => {
		expect(isPesajeThemeId("m1")).toBe(true);
		expect(isPesajeThemeId("dark")).toBe(false);
		expect(nextPesajeTheme("m1")).toBe("tokyo-night");
		expect(nextPesajeTheme("tokyo-night")).toBe("gruvbox");
		expect(nextPesajeTheme("gruvbox")).toBe("m1");
	});
});
