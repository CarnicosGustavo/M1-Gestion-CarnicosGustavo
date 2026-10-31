import type { WeightUnit } from "./parser";

export type ScaleMode = "continuous" | "request";
export type RequestTerminator = "none" | "cr" | "crlf";

export interface ScaleSettings {
	baudRate: 1200 | 2400 | 4800 | 9600;
	dataBits: 7 | 8;
	parity: "none" | "even" | "odd";
	stopBits: 1 | 2;
	mode: ScaleMode;
	requestIntervalMs: number;
	requestTerminator: RequestTerminator;
	defaultUnit: WeightUnit;
	resolutionG: number;
	simulator: boolean;
}

export const BAUD_RATES = [1200, 2400, 4800, 9600] as const;

export const DEFAULT_SCALE_SETTINGS: ScaleSettings = {
	baudRate: 9600,
	dataBits: 8,
	parity: "none",
	stopBits: 1,
	mode: "continuous",
	requestIntervalMs: 400,
	requestTerminator: "cr",
	defaultUnit: "kg",
	resolutionG: 5,
	simulator: false,
};

const STORAGE_KEY = "cg.scale.webserial.v1";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validBaudRate(value: unknown): value is ScaleSettings["baudRate"] {
	return (
		typeof value === "number" &&
		(BAUD_RATES as readonly number[]).includes(value)
	);
}

function validDataBits(value: unknown): value is ScaleSettings["dataBits"] {
	return value === 7 || value === 8;
}

function validParity(value: unknown): value is ScaleSettings["parity"] {
	return value === "none" || value === "even" || value === "odd";
}

function validStopBits(value: unknown): value is ScaleSettings["stopBits"] {
	return value === 1 || value === 2;
}

function validMode(value: unknown): value is ScaleSettings["mode"] {
	return value === "continuous" || value === "request";
}

function validTerminator(
	value: unknown,
): value is ScaleSettings["requestTerminator"] {
	return value === "none" || value === "cr" || value === "crlf";
}

function validUnit(value: unknown): value is ScaleSettings["defaultUnit"] {
	return value === "kg" || value === "g" || value === "lb";
}

function resolveStorage(
	storage?: Pick<Storage, "getItem"> | null,
): Pick<Storage, "getItem"> | null {
	if (storage !== undefined) {
		return storage;
	}

	try {
		return globalThis.localStorage ?? null;
	} catch {
		return null;
	}
}

export function loadScaleSettings(
	storage?: Pick<Storage, "getItem"> | null,
): ScaleSettings {
	const result: ScaleSettings = { ...DEFAULT_SCALE_SETTINGS };
	const resolvedStorage = resolveStorage(storage);

	if (!resolvedStorage) {
		return result;
	}

	let raw: string | null;
	try {
		raw = resolvedStorage.getItem(STORAGE_KEY);
	} catch {
		return result;
	}

	if (!raw) {
		return result;
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return result;
	}

	if (!isRecord(parsed)) {
		return result;
	}

	if (validBaudRate(parsed.baudRate)) {
		result.baudRate = parsed.baudRate;
	}

	if (validDataBits(parsed.dataBits)) {
		result.dataBits = parsed.dataBits;
	}

	if (validParity(parsed.parity)) {
		result.parity = parsed.parity;
	}

	if (validStopBits(parsed.stopBits)) {
		result.stopBits = parsed.stopBits;
	}

	if (validMode(parsed.mode)) {
		result.mode = parsed.mode;
	}

	if (
		typeof parsed.requestIntervalMs === "number" &&
		Number.isFinite(parsed.requestIntervalMs)
	) {
		result.requestIntervalMs = Math.min(
			500,
			Math.max(300, Math.round(parsed.requestIntervalMs)),
		);
	}

	if (validTerminator(parsed.requestTerminator)) {
		result.requestTerminator = parsed.requestTerminator;
	}

	if (validUnit(parsed.defaultUnit)) {
		result.defaultUnit = parsed.defaultUnit;
	}

	if (
		typeof parsed.resolutionG === "number" &&
		Number.isInteger(parsed.resolutionG) &&
		parsed.resolutionG >= 1 &&
		parsed.resolutionG <= 1000
	) {
		result.resolutionG = parsed.resolutionG;
	}

	if (typeof parsed.simulator === "boolean") {
		result.simulator = parsed.simulator;
	}

	return result;
}

export function saveScaleSettings(
	settings: ScaleSettings,
	storage?: Pick<Storage, "getItem"> | null,
): void {
	const resolvedStorage = storage === undefined ? resolveStorage() : storage;

	if (!resolvedStorage) {
		return;
	}

	try {
		const target = resolvedStorage as Storage;
		target.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch {
		// El almacenamiento puede estar bloqueado o lleno; no interrumpimos la captura.
	}
}

export function requestCommand(terminator: RequestTerminator): string {
	switch (terminator) {
		case "none":
			return "P";
		case "crlf":
			return "P\r\n";
		default:
			return "P\r";
	}
}
