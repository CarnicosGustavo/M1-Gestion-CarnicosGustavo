import { describe, expect, it } from "bun:test";
import { initialLinePrice, lineChargeSubtotal } from "./checkout-logic";

describe("lineChargeSubtotal", () => {
	it("kg > 0 usa kg × precio; si no, piezas × precio", () => {
		expect(lineChargeSubtotal(2, 3, 10)).toBe(20);
		expect(lineChargeSubtotal(0, 3, 10)).toBe(30);
		expect(lineChargeSubtotal(0, 0, 10)).toBe(0);
	});
});

describe("initialLinePrice", () => {
	it("usa el precio guardado cuando hay kg", () => {
		expect(initialLinePrice(2, 40, 1000)).toBe("40");
	});

	it("sin kg ignora savedPriceKg y usa unitPrice/100", () => {
		expect(initialLinePrice(0, 40, 1000)).toBe("10");
	});

	it("devuelve vacío cuando no hay kg ni precio", () => {
		expect(initialLinePrice(0, 40, 0)).toBe("");
	});

	it("con kg fraccionarios y sin saved usa unitPrice/100", () => {
		expect(initialLinePrice(1.5, null, 2500)).toBe("25");
	});
});
