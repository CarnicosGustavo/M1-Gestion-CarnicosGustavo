import { describe, expect, test } from "bun:test";
import { parseCustomTareKg } from "@/lib/weighing/parse-custom-tare";

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
