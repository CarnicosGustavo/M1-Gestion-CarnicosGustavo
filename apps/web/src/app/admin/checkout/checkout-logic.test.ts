import { describe, expect, it } from "bun:test";
import { lineChargeSubtotal } from "./checkout-logic";

describe("lineChargeSubtotal", () => {
	it("kg > 0 usa kg × precio; si no, piezas × precio", () => {
		expect(lineChargeSubtotal(2, 3, 10)).toBe(20);
		expect(lineChargeSubtotal(0, 3, 10)).toBe(30);
		expect(lineChargeSubtotal(0, 0, 10)).toBe(0);
	});
});
