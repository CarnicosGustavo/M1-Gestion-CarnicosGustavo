/**
 * Analizador tolerante de tramas recibidas desde la báscula Rhino I-QY.
 *
 * El formato exacto de la trama no está documentado. El analizador reconoce
 * números, unidades y banderas habituales, pero descarta los caracteres de
 * control y evita interpretar coma y punto de forma ambigua.
 */

export type WeightUnit = "kg" | "g" | "lb";

export const GRAMS_PER_UNIT: Record<WeightUnit, number> = {
	kg: 1000,
	g: 1,
	lb: 453.59237,
};

const MAX_LINE_LENGTH = 512;

export class LineSplitter {
	private buffer = "";
	private pendingCarriageReturn = false;

	/**
	 * Añade un fragmento de texto y devuelve las líneas terminadas.
	 *
	 * CRLF cuenta como un único terminador, incluso si CR y LF llegan en
	 * fragmentos distintos.
	 */
	push(chunk: string): string[] {
		const lines: string[] = [];

		for (const character of chunk) {
			if (this.pendingCarriageReturn) {
				this.pendingCarriageReturn = false;

				// LF que completa un CRLF: la línea ya se emitió con el CR.
				if (character === "\n") continue;
			}

			if (character === "\r") {
				this.emitLine(lines);
				this.pendingCarriageReturn = true;
				continue;
			}

			if (character === "\n") {
				this.emitLine(lines);
				continue;
			}

			this.buffer += character;

			if (this.buffer.length > MAX_LINE_LENGTH) {
				this.buffer = "";
				this.pendingCarriageReturn = false;
			}
		}

		return lines;
	}

	/**
	 * Devuelve el texto pendiente sin terminador.
	 */
	flush(): string | null {
		const pending = this.buffer.trim();
		this.buffer = "";
		this.pendingCarriageReturn = false;

		return pending.length > 0 ? pending : null;
	}

	private emitLine(lines: string[]): void {
		const line = this.buffer.trim();

		if (line.length > 0) {
			lines.push(line);
		}

		this.buffer = "";
	}
}

export interface ParsedFrame {
	raw: string;
	weight: number;
	unit: WeightUnit | null;
	weightG: number | null;
	stableFlag: boolean | null;
	net: boolean | null;
	overload: boolean;
}

interface NumericMatch {
	weight: number;
	endIndex: number;
}

interface UnitMatch {
	unit: WeightUnit;
	index: number;
}

/**
 * Elimina caracteres de control, salvo el espacio, y recorta el texto.
 */
function removeControlCharacters(text: string): string {
	let result = "";

	for (const character of text) {
		const code = character.codePointAt(0) ?? 0;

		if (code <= 0x1f && character !== " ") {
			continue;
		}

		result += character;
	}

	return result.trim();
}

/**
 * Busca un token completo, separado por coma, espacios o inicio/fin.
 */
function hasToken(text: string, token: string): boolean {
	const pattern = new RegExp(`(?:^|[,\\s])${token}(?=$|[,\\s])`, "i");

	return pattern.test(text);
}

/**
 * Localiza el primer número con signo opcional y espacios entre signo y
 * dígitos. Se admiten decimales con punto o coma.
 */
function findNumber(text: string): NumericMatch | null {
	const match = /([+-]?)\s*(\d+(?:[.,]\d+)?)/.exec(text);

	if (!match || match.index === undefined) {
		return null;
	}

	const sign = match[1] === "-" ? -1 : 1;
	const numericText = match[2];
	const decimalIndex = numericText.search(/[.,]/);

	let normalized = numericText;

	if (decimalIndex >= 0) {
		const decimalSeparator = numericText[decimalIndex];
		const integerPart = numericText.slice(0, decimalIndex);
		const decimalPart = numericText.slice(decimalIndex + 1);

		if (
			decimalSeparator === "," &&
			numericText.includes(".") &&
			!decimalPart.includes(".")
		) {
			/*
			 * Con punto y coma no se decide cuál es el separador decimal.
			 * Se conserva el texto, que no será un número válido, y por ello
			 * la trama se considera sin número interpretable.
			 */
			return null;
		}

		normalized = `${integerPart}.${decimalPart}`;
	} else if (numericText.includes(",")) {
		/*
		 * Regla documentada: si existe una sola coma y ningún punto, la coma
		 * se interpreta como separador decimal.
		 */
		const commaCount = (numericText.match(/,/g) ?? []).length;

		if (commaCount === 1) {
			normalized = numericText.replace(",", ".");
		} else {
			return null;
		}
	}

	const weight = sign * Number(normalized);

	if (!Number.isFinite(weight)) {
		return null;
	}

	return {
		weight,
		endIndex: match.index + match[0].length,
	};
}

function findUnit(text: string, afterIndex: number): UnitMatch | null {
	const suffix = text.slice(afterIndex);
	const match = /\b(lbs?|kg|g)\b/i.exec(suffix);

	if (!match || match.index === undefined) {
		return null;
	}

	const normalized = match[1].toLowerCase();

	if (normalized === "kg") {
		return {
			unit: "kg",
			index: afterIndex + match.index,
		};
	}

	if (normalized === "g") {
		return {
			unit: "g",
			index: afterIndex + match.index,
		};
	}

	return {
		unit: "lb",
		index: afterIndex + match.index,
	};
}

export function parseFrame(
	line: string,
	defaultUnit?: WeightUnit,
): ParsedFrame | null {
	const raw = line.trim();
	const cleaned = removeControlCharacters(raw);

	if (cleaned.length === 0) {
		return null;
	}

	const overload = hasToken(cleaned, "OL") || hasToken(cleaned, "OVER");

	if (overload) {
		return {
			raw,
			weight: Number.NaN,
			unit: null,
			weightG: null,
			stableFlag: null,
			net: null,
			overload: true,
		};
	}

	const stableFlag =
		hasToken(cleaned, "ST") || hasToken(cleaned, "S")
			? true
			: hasToken(cleaned, "US") ||
					hasToken(cleaned, "U") ||
					hasToken(cleaned, "M")
				? false
				: null;

	const net =
		hasToken(cleaned, "GS") ||
		hasToken(cleaned, "G") ||
		hasToken(cleaned, "GROSS")
			? false
			: hasToken(cleaned, "NT") ||
					hasToken(cleaned, "N") ||
					hasToken(cleaned, "NET")
				? true
				: null;

	const numericMatch = findNumber(cleaned);

	if (!numericMatch) {
		return null;
	}

	const unitMatch = findUnit(cleaned, numericMatch.endIndex);
	const unit = unitMatch?.unit ?? defaultUnit ?? null;
	const weightG =
		unit === null
			? null
			: Math.round(numericMatch.weight * GRAMS_PER_UNIT[unit]);

	return {
		raw,
		weight: numericMatch.weight,
		unit,
		weightG,
		stableFlag,
		net,
		overload: false,
	};
}

/**
 * Convierte code units a bytes hexadecimales en mayúsculas.
 */
export function toHex(text: string): string {
	const bytes: string[] = [];

	for (let index = 0; index < text.length; index += 1) {
		bytes.push((text.charCodeAt(index) & 0xff).toString(16).padStart(2, "0"));
	}

	return bytes.join(" ").toUpperCase();
}

export interface SoftStabilityOptions {
	stepG: number;
	windowMs?: number;
}

/**
 * Filtro de estabilidad por ventana temporal.
 */
export class SoftStability {
	private readonly stepG: number;
	private readonly windowMs: number;
	private active = false;
	private firstWeightG = 0;
	private startedAtMs = 0;

	constructor({ stepG, windowMs = 800 }: SoftStabilityOptions) {
		this.stepG = stepG;
		this.windowMs = windowMs;
	}

	push(weightG: number, atMs: number): boolean {
		if (!this.active) {
			this.active = true;
			this.firstWeightG = weightG;
			this.startedAtMs = atMs;
		} else if (Math.abs(weightG - this.firstWeightG) > this.stepG) {
			this.active = true;
			this.firstWeightG = weightG;
			this.startedAtMs = atMs;
		}

		return (
			this.active &&
			atMs - this.startedAtMs >= this.windowMs &&
			Math.abs(weightG - this.firstWeightG) <= this.stepG
		);
	}

	reset(): void {
		this.active = false;
		this.firstWeightG = 0;
		this.startedAtMs = 0;
	}
}

/**
 * Determina la estabilidad final y actualiza el filtro software.
 */
export function resolveStable(
	frame: ParsedFrame,
	soft: SoftStability,
	atMs: number,
): boolean {
	if (frame.overload || frame.weightG === null) {
		return false;
	}

	const softwareStable = soft.push(frame.weightG, atMs);

	if (frame.stableFlag !== null) {
		return frame.stableFlag;
	}

	return softwareStable;
}
