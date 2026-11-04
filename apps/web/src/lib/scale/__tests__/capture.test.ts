import { describe, expect, it } from "bun:test";
import { CaptureArming, DEFAULT_CAPTURE_CONFIG } from "../webserial/capture";

describe("CaptureArming", () => {
	it("realiza una sola captura por colocación", () => {
		const capture = new CaptureArming();

		expect(capture.onReading({ weightG: 250, stable: true })).toBe("capture");
		expect(capture.onReading({ weightG: 251, stable: true })).toBeNull();
		expect(capture.onReading({ weightG: 252, stable: true })).toBeNull();
		expect(capture.isArmed).toBe(false);
	});

	it("no captura pesos inferiores a 100 g", () => {
		const capture = new CaptureArming();

		expect(
			capture.onReading({
				weightG: DEFAULT_CAPTURE_CONFIG.minCaptureG - 1,
				stable: true,
			}),
		).toBeNull();
		expect(capture.isArmed).toBe(true);
	});

	it("no captura lecturas inestables", () => {
		const capture = new CaptureArming();

		expect(capture.onReading({ weightG: 250, stable: false })).toBeNull();
		expect(capture.isArmed).toBe(true);
	});

	it("se rearma al volver a la banda de cero", () => {
		const capture = new CaptureArming();

		expect(capture.onReading({ weightG: 250, stable: true })).toBe("capture");
		expect(capture.onReading({ weightG: 40, stable: false })).toBeNull();
		expect(capture.isArmed).toBe(true);
	});

	it("se rearma con un peso negativo dentro de la banda", () => {
		const capture = new CaptureArming();

		expect(capture.onReading({ weightG: 250, stable: true })).toBe("capture");
		expect(capture.onReading({ weightG: -40, stable: false })).toBeNull();
		expect(capture.isArmed).toBe(true);
	});

	it("después de una captura manual espera a volver a cero", () => {
		const capture = new CaptureArming();

		capture.markManualCapture();
		expect(capture.isArmed).toBe(false);
		expect(capture.onReading({ weightG: 250, stable: true })).toBeNull();
		expect(capture.isArmed).toBe(false);
		expect(capture.onReading({ weightG: 0, stable: false })).toBeNull();
		expect(capture.isArmed).toBe(true);
		expect(capture.onReading({ weightG: 250, stable: true })).toBe("capture");
	});

	it("permite capturar dos piezas consecutivas tras el rearme", () => {
		const capture = new CaptureArming();

		expect(capture.onReading({ weightG: 200, stable: true })).toBe("capture");
		expect(capture.onReading({ weightG: 200, stable: true })).toBeNull();
		expect(capture.onReading({ weightG: 30, stable: false })).toBeNull();
		expect(capture.isArmed).toBe(true);
		expect(capture.onReading({ weightG: 300, stable: true })).toBe("capture");
	});
});
