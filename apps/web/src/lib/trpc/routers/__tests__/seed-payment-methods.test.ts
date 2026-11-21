import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const seedPath = new URL("../../../db/seed.ts", import.meta.url);

describe("seed — uso de countIsEmpty en métodos de pago", () => {
	it("falla si seed.ts vuelve a comparar el conteo con === 0", () => {
		const source = readFileSync(seedPath, "utf8");
		const start = source.indexOf("from(paymentMethods)");
		const end = source.indexOf("paymentMethodRows");
		expect(start).toBeGreaterThanOrEqual(0);
		expect(end).toBeGreaterThan(start);
		const block = source.slice(start, end);
		expect(block).toContain("countIsEmpty(existing[0].count)");
		expect(block).not.toMatch(/existing\[0\]\.count\s*===\s*0/);
	});
});
