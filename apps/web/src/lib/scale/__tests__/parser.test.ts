import { describe, expect, it } from "bun:test";
import {
	GRAMS_PER_UNIT,
	LineSplitter,
	parseFrame,
	resolveStable,
	SoftStability,
	toHex,
} from "../webserial/parser";

describe("LineSplitter", () => {
	it("separa líneas por CR y LF", () => {
		const splitter = new LineSplitter();

		expect(splitter.push("uno\rdos\ntres\n")).toEqual(["uno", "dos", "tres"]);
	});

	it("trata CRLF como un único separador aunque llegue partido", () => {
		const splitter = new LineSplitter();

		expect(splitter.push("uno\r")).toEqual(["uno"]);
		expect(splitter.push("\n")).toEqual([]);
		expect(splitter.push("dos\r\n")).toEqual(["dos"]);
	});

	it("ignora líneas vacías", () => {
		const splitter = new LineSplitter();

		expect(splitter.push("\r\n\n\rfoo\n")).toEqual(["foo"]);
	});

	it("descarta el buffer cuando supera 512 caracteres sin terminador", () => {
		const splitter = new LineSplitter();

		expect(splitter.push("a".repeat(513))).toEqual([]);
		expect(splitter.flush()).toBeNull();
	});

	it("devuelve el contenido pendiente mediante flush", () => {
		const splitter = new LineSplitter();

		expect(splitter.push("pendiente")).toEqual([]);
		expect(splitter.flush()).toBe("pendiente");
		expect(splitter.flush()).toBeNull();
	});
});

describe("parseFrame", () => {
	it("analiza la trama ST,GS,+012.345kg", () => {
		const frame = parseFrame("ST,GS,+012.345kg");

		expect(frame).not.toBeNull();
		expect(frame?.weight).toBe(12.345);
		expect(frame?.unit).toBe("kg");
		expect(frame?.weightG).toBe(12345);
		expect(frame?.stableFlag).toBe(true);
		expect(frame?.net).toBe(false);
		expect(frame?.overload).toBe(false);
	});

	it("analiza la trama US,GS,-0.125 kg", () => {
		const frame = parseFrame("US,GS,-0.125 kg");

		expect(frame?.weight).toBe(-0.125);
		expect(frame?.unit).toBe("kg");
		expect(frame?.weightG).toBe(-125);
		expect(frame?.stableFlag).toBe(false);
		expect(frame?.net).toBe(false);
	});

	it("analiza la trama ST,NT,+  1.250kg", () => {
		const frame = parseFrame("ST,NT,+  1.250kg");

		expect(frame?.weight).toBe(1.25);
		expect(frame?.weightG).toBe(1250);
		expect(frame?.stableFlag).toBe(true);
		expect(frame?.net).toBe(true);
	});

	it("analiza un peso sin unidad ni banderas", () => {
		const frame = parseFrame("  12.34 kg");

		expect(frame?.weight).toBe(12.34);
		expect(frame?.unit).toBe("kg");
		expect(frame?.weightG).toBe(12340);
		expect(frame?.stableFlag).toBeNull();
		expect(frame?.net).toBeNull();
	});

	it("analiza un entero con signo sin unidad", () => {
		const frame = parseFrame("+00125.5");

		expect(frame?.weight).toBe(125.5);
		expect(frame?.unit).toBeNull();
		expect(frame?.weightG).toBeNull();
	});

	it("analiza libras y las convierte a gramos", () => {
		const frame = parseFrame("W: 3.200 lb");

		expect(frame?.weight).toBe(3.2);
		expect(frame?.unit).toBe("lb");
		expect(frame?.weightG).toBe(Math.round(3.2 * GRAMS_PER_UNIT.lb));
		expect(frame?.stableFlag).toBeNull();
		expect(frame?.net).toBeNull();
	});

	it("reconoce motion mediante el token M", () => {
		const frame = parseFrame("M 1.234kg");

		expect(frame?.weight).toBe(1.234);
		expect(frame?.stableFlag).toBe(false);
		expect(frame?.net).toBeNull();
	});

	it("reconoce sobrecarga", () => {
		const overload = parseFrame("OL");

		expect(overload).not.toBeNull();
		expect(overload?.overload).toBe(true);
		expect(overload?.weight).toBeNaN();
		expect(overload?.weightG).toBeNull();
		expect(overload?.stableFlag).toBeNull();
		expect(overload?.net).toBeNull();
	});

	it("reconoce sobrecarga con la palabra OVER", () => {
		const overload = parseFrame("ST, OVER");

		expect(overload?.overload).toBe(true);
		expect(overload?.weightG).toBeNull();
	});

	it("analiza ST,GS,  0.000kg", () => {
		const frame = parseFrame("ST,GS,  0.000kg");

		expect(frame?.weight).toBe(0);
		expect(frame?.weightG).toBe(0);
		expect(frame?.stableFlag).toBe(true);
		expect(frame?.net).toBe(false);
	});

	it("interpreta una única coma como punto decimal", () => {
		const frame = parseFrame("1,234");

		expect(frame?.weight).toBe(1.234);
		expect(frame?.unit).toBeNull();
		expect(frame?.weightG).toBeNull();
	});

	it("usa la unidad por defecto cuando no aparece en la trama", () => {
		const frame = parseFrame("1,25", "kg");

		expect(frame?.weight).toBe(1.25);
		expect(frame?.unit).toBe("kg");
		expect(frame?.weightG).toBe(1250);
	});

	it("sin unidad por defecto deja weightG en null", () => {
		const frame = parseFrame("1.25");

		expect(frame?.unit).toBeNull();
		expect(frame?.weightG).toBeNull();
	});

	it("reconoce banderas separadas por espacios", () => {
		const frame = parseFrame("ST GS 2.5 kg");

		expect(frame?.stableFlag).toBe(true);
		expect(frame?.net).toBe(false);
	});

	it("reconoce banderas al inicio de la trama", () => {
		const frame = parseFrame("S,N,2.5 kg");

		expect(frame?.stableFlag).toBe(true);
		expect(frame?.net).toBe(true);
	});

	it("no confunde S con letras dentro de otra palabra", () => {
		const frame = parseFrame("STABLE 2.5 kg");

		expect(frame?.stableFlag).toBeNull();
	});

	it("acepta lbs como alias de lb", () => {
		const frame = parseFrame("1 lb");

		expect(frame?.unit).toBe("lb");
		expect(frame?.weightG).toBe(Math.round(GRAMS_PER_UNIT.lb));
	});

	it("elimina caracteres de control antes de analizar", () => {
		const frame = parseFrame("\u0002ST\u0003,\u0004GS,1.5kg");

		expect(frame?.weight).toBe(1.5);
		expect(frame?.stableFlag).toBe(true);
		expect(frame?.net).toBe(false);
	});

	it("devuelve null si no hay número", () => {
		expect(parseFrame("ST,GS,sin peso")).toBeNull();
		expect(parseFrame("")).toBeNull();
	});
});

describe("toHex", () => {
	it("convierte code units a bytes hexadecimales en mayúsculas", () => {
		expect(toHex("A\u0000\u00ff\u0100")).toBe("41 00 FF 00");
	});
});

describe("SoftStability", () => {
	it("considera estable una racha de 800 ms", () => {
		const soft = new SoftStability({ stepG: 10 });

		expect(soft.push(1000, 0)).toBe(false);
		expect(soft.push(1005, 400)).toBe(false);
		expect(soft.push(1008, 800)).toBe(true);
	});

	it("no considera estable una racha de 799 ms", () => {
		const soft = new SoftStability({ stepG: 10 });

		expect(soft.push(1000, 0)).toBe(false);
		expect(soft.push(1005, 799)).toBe(false);
	});

	it("se reinicia al salir de ±step", () => {
		const soft = new SoftStability({ stepG: 10 });

		expect(soft.push(1000, 0)).toBe(false);
		expect(soft.push(1005, 799)).toBe(false);
		expect(soft.push(1020, 800)).toBe(false);
		expect(soft.push(1021, 1599)).toBe(false);
		expect(soft.push(1022, 1600)).toBe(true);
	});
});

describe("resolveStable", () => {
	it("da prioridad a la bandera de estabilidad", () => {
		const soft = new SoftStability({ stepG: 10 });
		const frame = parseFrame("ST,1.000kg");

		expect(frame).not.toBeNull();

		if (frame) {
			expect(resolveStable(frame, soft, 0)).toBe(true);
		}
	});

	it("usa el filtro software cuando no existe bandera", () => {
		const soft = new SoftStability({ stepG: 10, windowMs: 800 });
		const frame = parseFrame("1.000kg");

		expect(frame).not.toBeNull();

		if (frame) {
			expect(resolveStable(frame, soft, 0)).toBe(false);
			expect(resolveStable(frame, soft, 799)).toBe(false);
			expect(resolveStable(frame, soft, 800)).toBe(true);
		}
	});

	it("no alimenta el filtro software con sobrecarga", () => {
		const soft = new SoftStability({ stepG: 10 });
		const frame = parseFrame("OL");

		expect(frame).not.toBeNull();

		if (frame) {
			expect(resolveStable(frame, soft, 0)).toBe(false);
			expect(resolveStable(frame, soft, 800)).toBe(false);
		}
	});
});
