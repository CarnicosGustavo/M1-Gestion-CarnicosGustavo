export interface CaptureConfig {
	/** Peso mínimo para realizar una captura automática, en gramos. */
	minCaptureG: number;
	/** Banda de rearme alrededor de cero, en gramos. */
	rearmBandG: number;
}

export const DEFAULT_CAPTURE_CONFIG: CaptureConfig = {
	minCaptureG: 100,
	rearmBandG: 50,
};

export interface CaptureReading {
	weightG: number;
	stable: boolean;
}

/**
 * Controla el armado de la captura automática.
 */
export class CaptureArming {
	private readonly config: CaptureConfig;
	private armed = true;

	constructor(config: CaptureConfig = DEFAULT_CAPTURE_CONFIG) {
		this.config = config;
	}

	onReading({ weightG, stable }: CaptureReading): "capture" | null {
		if (this.armed && stable && weightG >= this.config.minCaptureG) {
			this.armed = false;
			return "capture";
		}

		if (!this.armed && Math.abs(weightG) <= this.config.rearmBandG) {
			this.armed = true;
		}

		return null;
	}

	/**
	 * Evita que la siguiente lectura automática dispare una captura.
	 */
	markManualCapture(): void {
		this.armed = false;
	}

	reset(): void {
		this.armed = true;
	}

	get isArmed(): boolean {
		return this.armed;
	}
}
