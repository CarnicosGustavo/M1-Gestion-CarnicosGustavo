import type { WeightUnit } from "./parser";
import type { ScaleMode } from "./settings";
import type { SerialOpenOptions, SerialPortLike } from "./types";

export interface SimulatedScalePortOptions {
	mode: ScaleMode;
	unit?: WeightUnit;
	withFlags?: boolean;
	intervalMs?: number;
	lineEnding?: "\r\n" | "\r" | "\n";
}

export function formatSimFrame(
	weightKg: number,
	stable: boolean,
	withFlags: boolean,
	unit: WeightUnit,
): string {
	const numeric = Math.abs(weightKg);
	const sign = weightKg < 0 ? "-" : "+";
	const magnitude = numeric.toFixed(3);

	if (!withFlags) {
		const signed = weightKg < 0 ? `-${magnitude}` : magnitude;
		return `${signed.padStart(8, " ")} ${unit}`;
	}

	const flags = stable ? "ST,GS," : "US,GS,";
	return `${flags}${sign}${magnitude.padStart(7, "0")}${unit}`;
}

export class SimulatedScalePort implements SerialPortLike {
	public readable: ReadableStream<Uint8Array> | null = null;
	public writable: WritableStream<Uint8Array> | null = null;
	public readonly written: string[] = [];

	private readonly options: Required<SimulatedScalePortOptions>;
	private readonly encoder = new TextEncoder();
	private readonly eventTarget = new EventTarget();

	private controller: ReadableStreamDefaultController<Uint8Array> | null = null;
	private timer: ReturnType<typeof setInterval> | null = null;
	private cycleStartedAt = 0;
	private opened = false;
	private closed = false;
	private targetWeightKg = 0;

	public constructor(options: SimulatedScalePortOptions) {
		this.options = {
			mode: options.mode,
			unit: options.unit ?? "kg",
			withFlags: options.withFlags ?? true,
			intervalMs: options.intervalMs ?? 200,
			lineEnding: options.lineEnding ?? "\r\n",
		};
		this.targetWeightKg = 0.8 + Math.random() * 5.2;
	}

	public async open(_options: SerialOpenOptions): Promise<void> {
		if (this.opened) {
			throw new DOMException("El puerto ya está abierto", "InvalidStateError");
		}

		this.opened = true;
		this.closed = false;

		const readable = new ReadableStream<Uint8Array>({
			start: (controller): void => {
				this.controller = controller;
			},
			cancel: (): void => {
				this.controller = null;
				this.stopTimer();
			},
		});

		const writable = new WritableStream<Uint8Array>({
			write: (chunk): void => {
				const text = new TextDecoder().decode(chunk);
				this.written.push(text);
				if (text.includes("P")) {
					this.emitFrame(this.currentWeight());
				}
			},
		});

		this.readable = readable;
		this.writable = writable;

		this.cycleStartedAt = Date.now();

		if (this.options.mode === "continuous") {
			this.timer = setInterval(() => {
				this.emitFrame(this.currentWeight());
			}, this.options.intervalMs);
		}
	}

	public async close(): Promise<void> {
		if (this.closed) {
			this.opened = false;
			return;
		}

		this.closed = true;
		this.opened = false;
		this.stopTimer();

		try {
			await this.readable?.cancel();
		} catch {
			// El stream puede haber terminado por un error previo.
		}

		this.controller = null;
	}

	public addEventListener(
		type: "disconnect",
		listener: (event: Event) => void,
	): void {
		this.eventTarget.addEventListener(type, listener);
	}

	public removeEventListener(
		type: "disconnect",
		listener: (event: Event) => void,
	): void {
		this.eventTarget.removeEventListener(type, listener);
	}

	public simulateUnplug(): void {
		if (this.closed) {
			return;
		}

		this.closed = true;
		this.opened = false;
		this.stopTimer();

		try {
			this.controller?.error(new Error("Puerto desconectado"));
		} catch {
			// El stream podría estar cerrado.
		}

		this.controller = null;
		this.eventTarget.dispatchEvent(new Event("disconnect"));
	}

	private stopTimer(): void {
		if (this.timer !== null) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}

	private currentWeight(): number {
		const elapsed = Date.now() - this.cycleStartedAt;
		const phase = elapsed % 6000;

		if (phase < 1500) {
			return 0;
		}

		if (phase < 2300) {
			const progress = (phase - 1500) / 800;
			return this.targetWeightKg * progress + (Math.random() - 0.5) * 0.05;
		}

		if (phase < 4800) {
			return this.targetWeightKg;
		}

		return this.targetWeightKg + (Math.random() - 0.5) * 0.25;
	}

	private emitFrame(weightKg: number): void {
		if (this.closed || !this.controller) {
			return;
		}

		const phase = (Date.now() - this.cycleStartedAt) % 6000;
		const stable = phase < 1500 || (phase >= 2300 && phase < 4800);
		const frame = formatSimFrame(
			weightKg,
			stable,
			this.options.withFlags,
			this.options.unit,
		);

		try {
			this.controller.enqueue(
				this.encoder.encode(`${frame}${this.options.lineEnding}`),
			);
		} catch {
			// El lector pudo cancelar el stream entre la comprobación y la escritura.
		}
	}
}
