import { describe, expect, it } from "bun:test";
import { countIsEmpty } from "@/lib/db/count-is-empty";

describe("countIsEmpty — seed de métodos de pago", () => {
	it('trata 0 y el texto "0" como vacío (postgres-js devuelve texto)', () => {
		expect(countIsEmpty(0)).toBe(true);
		expect(countIsEmpty("0")).toBe(true);
	});

	it("no trata un conteo positivo como vacío, ni en número ni en texto", () => {
		expect(countIsEmpty(1)).toBe(false);
		expect(countIsEmpty("3")).toBe(false);
	});
});
