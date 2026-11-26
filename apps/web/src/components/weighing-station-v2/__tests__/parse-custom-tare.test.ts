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

function source(path: string): string {
	return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("P32-R3-2 — el cableado de hasValidWeight usa canRegisterWeight", () => {
	const stations = {
		v2: "../pesaje-station.tsx",
		clásica: "../../../app/admin/weighing-station/page.tsx",
	};

	for (const [name, path] of Object.entries(stations)) {
		test(`${name}: hasValidWeight sale de canRegisterWeight con customTareInvalid (no de netKg > 0)`, () => {
			const src = source(path);
			expect(src).toMatch(
				/const hasValidWeight = canRegisterWeight\(\{[^}]*customTareInvalid,[^}]*\}\)/,
			);
			expect(src).not.toMatch(/hasValidWeight = netKg > 0/);
			expect(src).toMatch(/!currentItem \|\| !hasValidWeight/);
		});
	}

	test("v2: la tecla f (Registrar peso del renglón) queda apagada sin peso válido o con isPending", () => {
		const src = source("../pesaje-station.tsx");
		expect(src).toMatch(
			/label: "Registrar peso del renglón",\s*onPress: handleRegisterWeight,\s*disabled:\s*!hasValidWeight \|\|\s*currentItem === null \|\|\s*updateWeightMutation\.isPending/,
		);
		expect(src).toMatch(
			/if \(!currentItem \|\| !hasValidWeight\) return;\s*if \(updateWeightMutation\.isPending\) return;/,
		);
	});
});

describe("P32-R3-3 — captura serial con tara «Otro» inválida", () => {
	test("el panel serial no captura (ni aplica tara 0) con tareInvalid", () => {
		const src = source("../../scale-serial/scale-serial-panel.tsx");
		const guard = src.indexOf("if (currentContainer.tareInvalid)");
		const tareG = src.indexOf(
			"const tareG = Math.max(0, Math.round(currentContainer",
		);
		expect(guard).toBeGreaterThan(-1);
		expect(tareG).toBeGreaterThan(guard);
		expect(src.slice(guard, tareG)).toContain("return;");
	});

	test("las dos estaciones pasan tareInvalid al panel serial", () => {
		expect(source("../pesaje-station.tsx")).toMatch(
			/tareInvalid: customTareInvalid/,
		);
		expect(source("../../../app/admin/weighing-station/page.tsx")).toMatch(
			/tareInvalid: customTareInvalid/,
		);
	});

	test("v2: Espacio/M+ no captura con tara inválida", () => {
		const src = source("../pesaje-station.tsx");
		expect(src).toMatch(
			/const handleCaptureStable = useCallback\(\(\) => \{\s*if \(customTareInvalid\) \{\s*toast\.error\(INVALID_TARE_CAPTURE_MESSAGE\);\s*return;/,
		);
	});
});

describe("P32-R3-4 — deps del keydown", () => {
	test("handlePrevItem y handleNextItem están memoizados y en las deps", () => {
		const src = source("../pesaje-station.tsx");
		expect(src).toMatch(/const handlePrevItem = useCallback\(/);
		expect(src).toMatch(/const handleNextItem = useCallback\(/);
		const effect = src.slice(src.indexOf('window.addEventListener("keydown"'));
		const deps = effect.slice(effect.indexOf("}, ["), effect.indexOf("]);"));
		expect(deps).toContain("handlePrevItem");
		expect(deps).toContain("handleNextItem");
	});
});
