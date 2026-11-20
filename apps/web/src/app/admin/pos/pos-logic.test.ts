import { describe, expect, it } from "bun:test";
import {
	catalogDisp,
	isFaltanteLine,
	isMissingPrice,
	lineDisp,
	lineTotal,
	needsWeigh,
	quantityKgGramsForPayload,
	resolvePrice,
	unitPriceCentsForPayload,
} from "./pos-logic";

describe("F1 — unitPriceCentsForPayload", () => {
	it("por peso sin kg captura usa el precio por kg", () => {
		expect(
			unitPriceCentsForPayload({
				is_sellable_by_weight: true,
				quantityKg: null,
				unitPricePerKg: 100,
				unitPricePerPiece: 0,
			}),
		).toBe(10000);
	});

	it("por peso con kg 0 (falsy) sigue usando el precio por kg", () => {
		expect(
			unitPriceCentsForPayload({
				is_sellable_by_weight: true,
				quantityKg: 0,
				unitPricePerKg: 100,
				unitPricePerPiece: 50,
			}),
		).toBe(10000);
	});

	it("por peso con kg capturados usa el precio por kg", () => {
		expect(
			unitPriceCentsForPayload({
				is_sellable_by_weight: true,
				quantityKg: 2,
				unitPricePerKg: 100,
				unitPricePerPiece: 50,
			}),
		).toBe(10000);
	});

	it("por pieza sin kg usa el precio por pieza", () => {
		expect(
			unitPriceCentsForPayload({
				is_sellable_by_weight: false,
				quantityKg: null,
				unitPricePerKg: 100,
				unitPricePerPiece: 50,
			}),
		).toBe(5000);
	});
});

describe("F10 — lineTotal", () => {
	it("por peso sin kg capturados no aporta nada", () => {
		expect(
			lineTotal({
				is_sellable_by_weight: true,
				quantityKg: null,
				quantityPieces: 3,
				unitPricePerKg: 100,
				unitPricePerPiece: 50,
			}),
		).toBe(0);
	});

	it("por peso con kg 0 no aporta nada", () => {
		expect(
			lineTotal({
				is_sellable_by_weight: true,
				quantityKg: 0,
				quantityPieces: 3,
				unitPricePerKg: 100,
				unitPricePerPiece: 50,
			}),
		).toBe(0);
	});

	it("por peso con kg capturados cobra por kg", () => {
		expect(
			lineTotal({
				is_sellable_by_weight: true,
				quantityKg: 2,
				quantityPieces: 3,
				unitPricePerKg: 100,
				unitPricePerPiece: 50,
			}),
		).toBe(200);
	});

	it("por pieza cobra por piezas", () => {
		expect(
			lineTotal({
				is_sellable_by_weight: false,
				quantityKg: null,
				quantityPieces: 3,
				unitPricePerKg: 100,
				unitPricePerPiece: 50,
			}),
		).toBe(150);
	});
});

describe("quantityKgGramsForPayload", () => {
	it("convierte kg a gramos", () => {
		expect(quantityKgGramsForPayload(2.5)).toBe(2500);
	});

	it("kg 0 no se envía", () => {
		expect(quantityKgGramsForPayload(0)).toBeUndefined();
	});

	it("null no se envía", () => {
		expect(quantityKgGramsForPayload(null)).toBeUndefined();
	});
});

describe("Regla (a) y F5 — lineDisp", () => {
	it("por peso con stock_pieces 0 no queda faltante (queda pesaje)", () => {
		expect(
			lineDisp({
				id: 1,
				stock_pieces: 0,
				stock_kg: 2,
				is_sellable_by_weight: true,
				quantityPieces: 1,
				quantityKg: null,
			}),
		).toBe("pesaje");
	});

	it("por peso con 0 kg tecleados queda pesaje, no stock", () => {
		expect(
			lineDisp({
				id: 1,
				stock_pieces: 0,
				stock_kg: 2,
				is_sellable_by_weight: true,
				quantityPieces: 1,
				quantityKg: 0,
			}),
		).toBe("pesaje");
	});

	it("por peso con kg dentro del stock queda stock", () => {
		expect(
			lineDisp({
				id: 1,
				stock_pieces: 0,
				stock_kg: 2,
				is_sellable_by_weight: true,
				quantityPieces: 1,
				quantityKg: 2,
			}),
		).toBe("stock");
	});

	it("por peso con kg por encima del stock y no derivable queda faltante", () => {
		expect(
			lineDisp({
				id: 1,
				stock_pieces: 0,
				stock_kg: 2,
				is_sellable_by_weight: true,
				quantityPieces: 1,
				quantityKg: 3,
			}),
		).toBe("faltante");
	});

	it("por peso con kg por encima del stock y derivable queda despiece", () => {
		expect(
			lineDisp(
				{
					id: 1,
					stock_pieces: 0,
					stock_kg: 2,
					is_sellable_by_weight: true,
					quantityPieces: 1,
					quantityKg: 3,
				},
				{ stockPieces: 0, stockKg: 2, derivable: true },
			),
		).toBe("despiece");
	});

	it("por peso sin stock y no derivable queda faltante", () => {
		expect(
			lineDisp({
				id: 1,
				stock_pieces: 0,
				stock_kg: 0,
				is_sellable_by_weight: true,
				quantityPieces: 1,
				quantityKg: null,
			}),
		).toBe("faltante");
	});

	it("por pieza con stock insuficiente y no derivable queda faltante", () => {
		expect(
			lineDisp({
				id: 1,
				stock_pieces: 2,
				stock_kg: null,
				is_sellable_by_weight: false,
				quantityPieces: 10,
				quantityKg: null,
			}),
		).toBe("faltante");
	});

	it("por pieza con stock suficiente queda stock", () => {
		expect(
			lineDisp({
				id: 1,
				stock_pieces: 2,
				stock_kg: null,
				is_sellable_by_weight: false,
				quantityPieces: 1,
				quantityKg: null,
			}),
		).toBe("stock");
	});

	it("por pieza sin stock pero derivable queda despiece", () => {
		expect(
			lineDisp(
				{
					id: 1,
					stock_pieces: 0,
					stock_kg: null,
					is_sellable_by_weight: false,
					quantityPieces: 1,
					quantityKg: null,
				},
				{ stockPieces: 0, stockKg: 0, derivable: true },
			),
		).toBe("despiece");
	});
});

describe("catalogDisp", () => {
	it("producto por peso con stock en kg queda pesaje", () => {
		expect(
			catalogDisp({
				id: 1,
				stock_pieces: 0,
				stock_kg: 5,
				is_sellable_by_weight: true,
			}),
		).toBe("pesaje");
	});

	it("sin stock y derivable queda despiece", () => {
		expect(
			catalogDisp(
				{
					id: 1,
					stock_pieces: 0,
					stock_kg: 0,
					is_sellable_by_weight: false,
				},
				{ stockPieces: 0, stockKg: 0, derivable: true },
			),
		).toBe("despiece");
	});

	it("sin stock y no derivable queda faltante pero se puede agregar", () => {
		expect(
			catalogDisp({
				id: 1,
				stock_pieces: 0,
				stock_kg: 0,
				is_sellable_by_weight: false,
			}),
		).toBe("faltante");
	});
});

describe("helpers", () => {
	it("isFaltanteLine refleja el estado de línea", () => {
		expect(
			isFaltanteLine({
				id: 1,
				stock_pieces: 0,
				stock_kg: 0,
				is_sellable_by_weight: false,
				quantityPieces: 1,
				quantityKg: null,
			}),
		).toBe(true);
		expect(
			isFaltanteLine({
				id: 1,
				stock_pieces: 0,
				stock_kg: 2,
				is_sellable_by_weight: true,
				quantityPieces: 1,
				quantityKg: null,
			}),
		).toBe(false);
	});

	it("isMissingPrice detecta precios vacíos o inválidos", () => {
		expect(isMissingPrice(0)).toBe(true);
		expect(isMissingPrice(Number.NaN)).toBe(true);
		expect(isMissingPrice(Number.POSITIVE_INFINITY)).toBe(true);
		expect(isMissingPrice(10)).toBe(false);
	});
});

describe("R2-8 — needsWeigh", () => {
	it("null kg en producto por peso requiere pesaje", () => {
		expect(needsWeigh({ is_sellable_by_weight: true, quantityKg: null })).toBe(
			true,
		);
	});

	it("0 kg en producto por peso requiere pesaje", () => {
		expect(needsWeigh({ is_sellable_by_weight: true, quantityKg: 0 })).toBe(
			true,
		);
	});

	it("2 kg en producto por peso no requiere pesaje", () => {
		expect(needsWeigh({ is_sellable_by_weight: true, quantityKg: 2 })).toBe(
			false,
		);
	});

	it("producto que no se vende por peso no requiere pesaje", () => {
		expect(needsWeigh({ is_sellable_by_weight: false, quantityKg: null })).toBe(
			false,
		);
	});
});

describe("F3 — resolvePrice con lista asignada", () => {
	it("usa la lista asignada cuando no hay precio propio", () => {
		const assigned = new Map([[7, { kg: 80, piece: 55 }]]);
		expect(resolvePrice(7, 100, 60, new Map(), new Map(), assigned)).toEqual({
			kg: 80,
			piece: 55,
		});
	});

	it("usa la lista elegida a mano cuando no hay propio ni asignada", () => {
		const selected = new Map([[7, { piece: 50 }]]);
		expect(resolvePrice(7, 100, 60, new Map(), selected, new Map())).toEqual({
			kg: 100,
			piece: 50,
		});
	});
});

describe("F4 / R2-9 / R2-10 — resolvePrice", () => {
	it("el propio pisa por campo sin pisar la pieza de la lista", () => {
		const own = new Map([[7, { kg: 90 }]]);
		const selected = new Map([[7, { piece: 50 }]]);
		expect(resolvePrice(7, 100, 60, own, selected, new Map())).toEqual({
			kg: 90,
			piece: 50,
		});
	});

	it("el propio gana también en pieza", () => {
		const own = new Map([[7, { kg: 90, piece: 70 }]]);
		const selected = new Map([[7, { piece: 50 }]]);
		expect(resolvePrice(7, 100, 60, own, selected, new Map())).toEqual({
			kg: 90,
			piece: 70,
		});
	});

	it("un precio propio 0 se ignora y deja ganar la lista elegida", () => {
		const own = new Map([[7, { kg: 0 }]]);
		const selected = new Map([[7, { kg: 50 }]]);
		expect(resolvePrice(7, 100, 60, own, selected, new Map())).toEqual({
			kg: 50,
			piece: 60,
		});
	});

	it("un precio propio no finito se ignora y deja ganar la lista elegida", () => {
		const own = new Map([[7, { kg: Number.POSITIVE_INFINITY }]]);
		const selected = new Map([[7, { kg: 50 }]]);
		expect(resolvePrice(7, 100, 60, own, selected, new Map())).toEqual({
			kg: 50,
			piece: 60,
		});
	});

	it("el kg propio 90 gana sobre el kg 50 de la lista elegida", () => {
		const own = new Map([[7, { kg: 90 }]]);
		const selected = new Map([[7, { kg: 50 }]]);
		expect(resolvePrice(7, 100, 60, own, selected, new Map())).toEqual({
			kg: 90,
			piece: 60,
		});
	});

	it("el kg propio 90 gana y la pieza 40 de la lista elegida se conserva", () => {
		const own = new Map([[7, { kg: 90 }]]);
		const selected = new Map([[7, { kg: 50, piece: 40 }]]);
		expect(resolvePrice(7, 100, 60, own, selected, new Map())).toEqual({
			kg: 90,
			piece: 40,
		});
	});
});
