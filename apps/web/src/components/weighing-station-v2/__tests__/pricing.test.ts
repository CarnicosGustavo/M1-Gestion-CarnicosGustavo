import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	catalogProductPrice,
	isSaleLineItem,
	lineSubtotalCents,
	orderUnitPriceToPesos,
	PRICE_SOURCE_LABELS,
	resolveDefaultPrice,
	saleLineSubtotalCents,
} from "../pricing";

const row = (
	over: Partial<Parameters<typeof resolveDefaultPrice>[0]> = {},
) => ({
	productId: 1,
	customerPricePerKg: null,
	listPricePerKg: null,
	pricePerKg: null,
	...over,
});

/**
 * Fixture con valores como los entrega la BD (P33-1):
 * - `order_items.unit_price` va en CENTAVOS por kg, como numeric ("8600.00").
 * - `products.price_per_kg`, `customer_prices` y listas van en PESOS por kg.
 */
const PIERNA_BASE = "86.00"; // pesos/kg
const PIERNA_ORDER_UNIT_PRICE = "8600.00"; // centavos/kg (= $86.00)
const ESPALDILLA_ORDER_UNIT_PRICE = "7850.00"; // centavos/kg (= $78.50)

describe("resolveDefaultPrice", () => {
	test("prefiere el último precio cobrado al cliente", () => {
		expect(
			resolveDefaultPrice(
				row({ customerPricePerKg: 92, listPricePerKg: 88, pricePerKg: 80 }),
				PIERNA_ORDER_UNIT_PRICE,
			),
		).toEqual({ pricePerKg: 92, source: "ultimo" });
	});

	test("luego la lista del cliente, el pedido y el precio base", () => {
		expect(
			resolveDefaultPrice(row({ listPricePerKg: 88 }), PIERNA_ORDER_UNIT_PRICE),
		).toEqual({ pricePerKg: 88, source: "lista" });
		expect(
			resolveDefaultPrice(
				row({ pricePerKg: "80.00" }),
				PIERNA_ORDER_UNIT_PRICE,
			),
		).toEqual({ pricePerKg: 86, source: "pedido" });
		expect(resolveDefaultPrice(row({ pricePerKg: "80.00" }), null)).toEqual({
			pricePerKg: 80,
			source: "base",
		});
		expect(resolveDefaultPrice(undefined, "0")).toBeNull();
	});

	test("el unit_price del pedido está en centavos (P33-1)", () => {
		expect(orderUnitPriceToPesos(PIERNA_ORDER_UNIT_PRICE)).toBe(86);
		expect(orderUnitPriceToPesos(8600)).toBe(86);
		expect(orderUnitPriceToPesos(ESPALDILLA_ORDER_UNIT_PRICE)).toBe(78.5);
		expect(orderUnitPriceToPesos("0")).toBeNull();
		const suggested = resolveDefaultPrice(row(), PIERNA_ORDER_UNIT_PRICE);
		expect(suggested).toEqual({ pricePerKg: 86, source: "pedido" });
		// 2 kg a $86 = $172.00 = 17,200 centavos (no 1,720,000).
		expect(lineSubtotalCents(2, suggested?.pricePerKg ?? 0)).toBe(17200);
	});

	test("el precio del pedido coincide con el base cuando se capturó igual", () => {
		const fromOrder = resolveDefaultPrice(
			row({ pricePerKg: PIERNA_BASE }),
			PIERNA_ORDER_UNIT_PRICE,
		);
		const fromBase = resolveDefaultPrice(
			row({ pricePerKg: PIERNA_BASE }),
			null,
		);
		expect(fromOrder?.pricePerKg).toBe(fromBase?.pricePerKg);
		expect(fromOrder?.pricePerKg).toBeLessThan(5000);
	});

	test("subtotal en centavos", () => {
		expect(lineSubtotalCents(8.15, 78)).toBe(63570);
		expect(lineSubtotalCents(Number.NaN, 78)).toBe(0);
	});

	test("el precio editado se rotula «Manual» (ya no es vista previa: se cobra)", () => {
		expect(PRICE_SOURCE_LABELS.manual).toBe("Manual");
	});
});

describe("P33-12 — el panel de venta ya no dice «Vista previa»", () => {
	test("sale-panel no declara que los precios editados no se guardan", () => {
		const source = readFileSync(
			join(import.meta.dir, "../tiles/sale-panel.tsx"),
			"utf8",
		);
		expect(source).not.toContain("Vista previa");
		expect(source).not.toContain("no se guardan");
	});
});

describe("P33-5 — productos por pieza en catálogo y Venta", () => {
	test("catalogProductPrice usa price_per_piece cuando no se vende por peso", () => {
		expect(
			catalogProductPrice({
				is_sellable_by_weight: false,
				price_per_kg: null,
				price_per_piece: "50.00",
			}),
		).toBe("50.00");
		expect(
			catalogProductPrice({
				is_sellable_by_weight: true,
				price_per_kg: "86.00",
				price_per_piece: "50.00",
			}),
		).toBe("86.00");
	});

	test("resolveDefaultPrice con byPiece lee precios por pieza (último, lista, pedido, base)", () => {
		expect(
			resolveDefaultPrice(
				row({
					customerPricePerPiece: 55,
					listPricePerPiece: 52,
					pricePerPiece: "50.00",
				}),
				"5000",
				{ byPiece: true },
			),
		).toEqual({ pricePerKg: 55, source: "ultimo" });
		expect(
			resolveDefaultPrice(row({ pricePerPiece: "50.00" }), "5000", {
				byPiece: true,
			}),
		).toEqual({ pricePerKg: 50, source: "pedido" });
		expect(
			resolveDefaultPrice(row({ pricePerPiece: "50.00" }), "0", {
				byPiece: true,
			}),
		).toEqual({ pricePerKg: 50, source: "base" });
	});

	test("isSaleLineItem incluye piezas COMPLETADO y saleLineSubtotalCents cobra piezas × precio", () => {
		expect(
			isSaleLineItem({
				status: "COMPLETADO",
				quantity_kg: null,
				quantity_pieces: 3,
			}),
		).toBe(true);
		expect(
			isSaleLineItem({
				status: "PESADO",
				quantity_kg: "2.000",
				quantity_pieces: null,
			}),
		).toBe(true);
		expect(
			isSaleLineItem({
				status: "PENDIENTE_PESAJE",
				quantity_kg: "2.000",
				quantity_pieces: 1,
			}),
		).toBe(false);
		expect(
			isSaleLineItem({
				status: "COBRADO",
				quantity_kg: null,
				quantity_pieces: 3,
			}),
		).toBe(false);
		// 3 cabezas a $50/pz = 15,000 centavos ($150.00)
		expect(saleLineSubtotalCents({ kg: 0, pieces: 3, pricePerUnit: 50 })).toBe(
			15000,
		);
	});
});
