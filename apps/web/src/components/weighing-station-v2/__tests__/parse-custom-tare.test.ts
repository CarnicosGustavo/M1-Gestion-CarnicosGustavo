import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
	canRegisterWeight,
	formatCustomTareHint,
	parseCustomTareKg,
} from "@/lib/weighing/parse-custom-tare";

describe("parseCustomTareKg — tara Otro", () => {
	test("acepta vacío, cero y decimales con punto", () => {
		expect(parseCustomTareKg("")).toBe(0);
		expect(parseCustomTareKg("  ")).toBe(0);
		expect(parseCustomTareKg("0")).toBe(0);
		expect(parseCustomTareKg("0.000")).toBe(0);
		expect(parseCustomTareKg("1.5")).toBe(1.5);
		expect(parseCustomTareKg("1.")).toBe(1);
	});

	test("rechaza la coma, los negativos y el texto no numérico", () => {
		expect(parseCustomTareKg("1,5")).toBeNull();
		expect(parseCustomTareKg("-5")).toBeNull();
		expect(parseCustomTareKg("-0.1")).toBeNull();
		expect(parseCustomTareKg("abc")).toBeNull();
		expect(parseCustomTareKg("1e2")).toBeNull();
	});

	test("una tara negativa no se aplica (no invierte el neto)", () => {
		const tare = parseCustomTareKg("-5") ?? 0;
		const net = Math.max(0, 3.2 - tare);
		expect(tare).toBe(0);
		expect(net).toBe(3.2);
	});
});

describe("canRegisterWeight — P32-1", () => {
	test("no registra si la tara Otro es inválida aunque el neto sea positivo", () => {
		const gross = 3.2;
		for (const raw of ["1,5", "-5"]) {
			const parsed = parseCustomTareKg(raw);
			const customTareInvalid = parsed === null;
			const tareKg = parsed ?? 0;
			const netKg = Math.max(0, gross - tareKg);
			expect(netKg).toBe(3.2);
			expect(
				canRegisterWeight({
					netKg,
					customTareInvalid,
					hasItem: true,
				}),
			).toBe(false);
		}
		expect(
			canRegisterWeight({
				netKg: Math.max(0, 3.2 - (parseCustomTareKg("1.5") ?? 0)),
				customTareInvalid: parseCustomTareKg("1.5") === null,
				hasItem: true,
			}),
		).toBe(true);
	});

	test("no registra sin renglón o con neto 0", () => {
		expect(
			canRegisterWeight({
				netKg: 2,
				customTareInvalid: false,
				hasItem: false,
			}),
		).toBe(false);
		expect(
			canRegisterWeight({
				netKg: 0,
				customTareInvalid: false,
				hasItem: true,
			}),
		).toBe(false);
	});
});

describe("formatCustomTareHint — hint de Otro", () => {
	test("no muestra NaN kg ni negativos", () => {
		expect(formatCustomTareHint("1,5")).toBe("—");
		expect(formatCustomTareHint("-5")).toBe("—");
		expect(formatCustomTareHint("abc")).toBe("—");
		expect(formatCustomTareHint("1,5")).not.toMatch(/NaN/i);
		expect(formatCustomTareHint("-5")).not.toMatch(/-/);
		expect(formatCustomTareHint("1.5")).toBe("1.500 kg");
		expect(formatCustomTareHint("0")).toBe("0.000 kg");
		expect(formatCustomTareHint("")).toBe("0.000 kg");
	});
});

describe("input de tara v2 — aria-invalid", () => {
	test("el input de RecipientePage declara aria-invalid", () => {
		const src = readFileSync(
			new URL("../tiles/fn-pages.tsx", import.meta.url),
			"utf8",
		);
		expect(src).toMatch(/aria-invalid=\{customTareInvalid\}/);
	});
});

describe("canRegisterWeight — botones apagados si isPending", () => {
	test("los botones de registrar quedan deshabilitados mientras el pesaje está pendiente", () => {
		expect(
			canRegisterWeight({
				netKg: 2,
				customTareInvalid: false,
				hasItem: true,
				isPending: true,
			}),
		).toBe(false);
		expect(
			canRegisterWeight({
				netKg: 2,
				customTareInvalid: false,
				hasItem: true,
				isPending: false,
			}),
		).toBe(true);
	});
});
