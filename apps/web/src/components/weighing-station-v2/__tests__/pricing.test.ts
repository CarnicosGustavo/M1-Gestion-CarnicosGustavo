import { describe, expect, test } from "bun:test";
import { lineSubtotalCents, resolveDefaultPrice } from "../pricing";

const row = (
	over: Partial<Parameters<typeof resolveDefaultPrice>[0]> = {},
) => ({
	productId: 1,
	customerPricePerKg: null,
	listPricePerKg: null,
	pricePerKg: null,
	...over,
});

describe("resolveDefaultPrice", () => {
	test("prefiere el último precio cobrado al cliente", () => {
		expect(
			resolveDefaultPrice(
				row({ customerPricePerKg: 92, listPricePerKg: 88, pricePerKg: 80 }),
				"86.00",
			),
		).toEqual({ pricePerKg: 92, source: "ultimo" });
	});

	test("luego la lista del cliente, el pedido y el precio base", () => {
		expect(resolveDefaultPrice(row({ listPricePerKg: 88 }), "86")).toEqual({
			pricePerKg: 88,
			source: "lista",
		});
		expect(resolveDefaultPrice(row({ pricePerKg: "80" }), "86.00")).toEqual({
			pricePerKg: 86,
			source: "pedido",
		});
		expect(resolveDefaultPrice(row({ pricePerKg: "80" }), null)).toEqual({
			pricePerKg: 80,
			source: "base",
		});
		expect(resolveDefaultPrice(undefined, "0")).toBeNull();
	});

	test("subtotal en centavos", () => {
		expect(lineSubtotalCents(8.15, 78)).toBe(63570);
		expect(lineSubtotalCents(Number.NaN, 78)).toBe(0);
	});
});
