import { LineSplitter } from "./parser";
import { requestCommand, type ScaleSettings } from "./settings";
import { SimulatedScalePort } from "./simulator";
import { getSerial, type SerialLike, type SerialPortLike } from "./types";

export type ConnectionStatus =
	| "unsupported"
	| "idle"
	| "connecting"
	| "connected"
	| "reconnecting"
	| "error";

export interface ScaleConnectionEvents {
	onStatus(status: ConnectionStatus, detail?: string): void;
	onLine(line: string, receivedAt: number): void;
	onRawChunk?(text: string): void;
}

export interface ScaleConnectionDependencies {
	serial?: SerialLike | null;
	now?: () => number;
	createSimulator?: (settings: ScaleSettings) => SerialPortLike;
}

export class ScaleConnection {
	private settings: ScaleSettings;
	private readonly events: ScaleConnectionEvents;
	private readonly serial: SerialLike | null;
	private readonly now: () => number;
	private readonly createSimulator: (settings: ScaleSettings) => SerialPortLike;

	private port: SerialPortLike | null = null;
	private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
	private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
	private requestTimer: ReturnType<typeof setInterval> | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private reconnectAttempt = 0;
	private requestPending = false;
	private stopped = false;
	private connectPromise: Promise<void> | null = null;
	private lastPortInfo: { vendorId?: number; productId?: number } | null = null;
	private lastStatus: ConnectionStatus = "idle";
	private serialListenersRegistered = false;

	private readonly onSerialConnect = (): void => {
		void this.scheduleImmediateReconnect();
	};

	private readonly onSerialDisconnect = (event: Event): void => {
		const target = this.getEventTarget(event);

		if (target !== null && this.port !== null && target !== this.port) {
			return;
		}

		void this.handleReadError(new Error("El puerto serie se ha desconectado"));
	};

	public constructor(
		settings: ScaleSettings,
		events: ScaleConnectionEvents,
		deps: ScaleConnectionDependencies = {},
	) {
		this.settings = { ...settings };
		this.events = events;
		this.serial = deps.serial !== undefined ? deps.serial : getSerial();
		this.now = deps.now ?? (() => Date.now());
		this.createSimulator =
			deps.createSimulator ??
			((currentSettings) =>
				new SimulatedScalePort({
					mode: currentSettings.mode,
					unit: currentSettings.defaultUnit,
				}));
	}

	public get status(): ConnectionStatus {
		return this.lastStatus;
	}

	public async connectWithPicker(): Promise<void> {
		this.stopped = false;
		this.registerSerialListeners();

		if (this.settings.simulator) {
			await this.connectSimulator();
			return;
		}

		if (!this.serial) {
			this.emitStatus(
				"unsupported",
				"Web Serial no está disponible en este navegador.",
			);
			return;
		}

		this.emitStatus("connecting", "Selecciona el puerto de la báscula.");

		try {
			// Esta llamada debe conservarse sin awaits previos: requiere un gesto del usuario.
			const port = await this.serial.requestPort();
			await this.openPort(port);
		} catch (error) {
			this.handleError(error);
		}
	}

	public async autoReconnect(): Promise<boolean> {
		this.stopped = false;
		this.registerSerialListeners();

		if (this.settings.simulator) {
			try {
				await this.connectSimulator();
				return true;
			} catch (error) {
				this.handleError(error);
				return false;
			}
		}

		if (!this.serial) {
			this.emitStatus(
				"unsupported",
				"Web Serial no está disponible en este navegador.",
			);
			return false;
		}

		try {
			const ports = await this.serial.getPorts();
			if (ports.length === 0) {
				return false;
			}

			const selected = this.selectKnownPort(ports);
			await this.openPort(selected);
			return true;
		} catch (error) {
			this.handleError(error);
			return false;
		}
	}

	public updateSettings(settings: ScaleSettings): void {
		const previous = this.settings;
		this.settings = { ...settings };

		const connectionChanged =
			previous.baudRate !== settings.baudRate ||
			previous.dataBits !== settings.dataBits ||
			previous.stopBits !== settings.stopBits ||
			previous.parity !== settings.parity ||
			previous.mode !== settings.mode ||
			previous.requestIntervalMs !== settings.requestIntervalMs ||
			previous.requestTerminator !== settings.requestTerminator;

		const wasConnected =
			this.port !== null ||
			this.connectPromise !== null ||
			this.reader !== null ||
			this.writer !== null;

		if (connectionChanged && previous.simulator === settings.simulator) {
			if (wasConnected) {
				void this.reconnectAfterSettingsChange();
			}
			return;
		}

		if (previous.simulator !== settings.simulator && wasConnected) {
			void this.reconnectAfterSettingsChange();
		}
	}

	public async disconnect(): Promise<void> {
		this.stopped = true;
		this.reconnectAttempt = 0;
		this.clearTimers();
		this.unregisterSerialListeners();
		this.connectPromise = null;

		await this.releaseCurrent();

		this.emitStatus("idle");
	}

	private async connectSimulator(): Promise<void> {
		this.emitStatus("connecting", "Conectando con el simulador.");
		const simulator = this.createSimulator(this.settings);
		await this.openPort(simulator);
	}

	private async reconnectAfterSettingsChange(): Promise<void> {
		try {
			const wasConnected =
				this.port !== null ||
				this.connectPromise !== null ||
				this.reader !== null ||
				this.writer !== null;

			await this.disconnect();
			this.stopped = false;
			this.registerSerialListeners();

			if (!wasConnected) {
				return;
			}

			if (this.settings.simulator) {
				await this.connectSimulator();
				return;
			}

			if (this.serial) {
				const ports = await this.serial.getPorts();
				if (ports.length > 0) {
					await this.openPort(this.selectKnownPort(ports));
				}
			}
		} catch (error) {
			this.handleError(error);
		}
	}

	private selectKnownPort(ports: SerialPortLike[]): SerialPortLike {
		if (!this.lastPortInfo) {
			return ports[0];
		}

		const known = ports.find((candidate) => {
			const info = candidate.getInfo?.();
			return (
				info?.usbVendorId === this.lastPortInfo?.vendorId &&
				info?.usbProductId === this.lastPortInfo?.productId
			);
		});

		return known ?? ports[0];
	}

	private async openPort(port: SerialPortLike): Promise<void> {
		if (this.connectPromise !== null) {
			await this.connectPromise;
			return;
		}

		this.stopped = false;
		this.emitStatus("connecting", "Abriendo el puerto serie.");

		const operation = (async (): Promise<void> => {
			await this.openPortWithRetry(port);

			this.port = port;
			this.lastPortInfo = this.readPortInfo(port);
			this.reconnectAttempt = 0;
			this.emitStatus("connected");

			try {
				this.startRequestLoop();
			} catch (error) {
				this.handleError(error);
			}

			void this.readLoop();
		})();

		this.connectPromise = operation;

		try {
			await operation;
		} finally {
			if (this.connectPromise === operation) {
				this.connectPromise = null;
			}
		}
	}

	private async openPortWithRetry(port: SerialPortLike): Promise<void> {
		const options = {
			baudRate: this.settings.baudRate,
			dataBits: this.settings.dataBits,
			stopBits: this.settings.stopBits,
			parity: this.settings.parity,
			flowControl: "none" as const,
		};

		try {
			await port.open(options);
		} catch (error) {
			if (!this.isInvalidStateError(error)) {
				throw error;
			}

			try {
				await port.close();
			} catch {
				// El puerto podría no estar abierto realmente.
			}

			await port.open(options);
		}
	}

	private readPortInfo(
		port: SerialPortLike,
	): { vendorId?: number; productId?: number } | null {
		try {
			const info = port.getInfo?.();
			if (!info) {
				return null;
			}
			return {
				vendorId: info.usbVendorId,
				productId: info.usbProductId,
			};
		} catch {
			return null;
		}
	}

	private isInvalidStateError(error: unknown): boolean {
		return error instanceof DOMException && error.name === "InvalidStateError";
	}

	private async readLoop(): Promise<void> {
		const port = this.port;

		if (!port?.readable) {
			await this.handleReadError(
				new Error("El puerto no expone un stream de lectura."),
			);
			return;
		}

		const reader = port.readable.getReader();
		this.reader = reader;
		const decoder = new TextDecoder();
		const splitter = new LineSplitter();

		try {
			while (!this.stopped) {
				const { value, done } = await reader.read();

				if (this.reader !== reader || this.port !== port) {
					return;
				}

				if (done) {
					throw new Error("El stream de lectura ha terminado.");
				}

				if (!value) {
					continue;
				}

				const text = decoder.decode(value, { stream: true });
				if (text.length > 0) {
					this.events.onRawChunk?.(text);
				}

				const lines = splitter.push(text);
				for (const line of lines) {
					if (this.reader !== reader || this.port !== port) {
						return;
					}
					this.events.onLine(line, this.now());
				}
			}
		} catch (error) {
			if (!this.stopped && this.reader === reader) {
				await this.handleReadError(error);
			}
		}
	}

	private async handleReadError(error: unknown): Promise<void> {
		if (this.stopped) {
			return;
		}

		const message =
			error instanceof Error
				? error.message
				: "Error de lectura de la báscula.";
		this.emitStatus("reconnecting", message);
		await this.releaseCurrent();
		this.scheduleReconnect();
	}

	private async releaseCurrent(): Promise<void> {
		const reader = this.reader;
		this.reader = null;

		if (reader) {
			try {
				await reader.cancel();
			} catch {
				// La lectura puede haber fallado por una desconexión.
			}
			try {
				reader.releaseLock();
			} catch {
				// El lock puede haber sido liberado por el runtime.
			}
		}

		const writer = this.writer;
		this.writer = null;

		if (writer) {
			try {
				await writer.close();
			} catch {
				// El writable puede estar cerrado o fallido.
			}
			try {
				writer.releaseLock();
			} catch {
				// El lock puede haber sido liberado por el runtime.
			}
		}

		const port = this.port;
		this.port = null;

		if (port) {
			try {
				await port.close();
			} catch {
				// El dispositivo ya pudo desconectarse físicamente.
			}
		}
	}

	private scheduleReconnect(): void {
		if (this.stopped || this.reconnectTimer !== null) {
			return;
		}

		const delay = Math.min(10000, 1000 * 2 ** this.reconnectAttempt);
		this.reconnectAttempt += 1;

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			void this.attemptReconnect();
		}, delay);
	}

	private async attemptReconnect(): Promise<void> {
		if (this.stopped) {
			return;
		}

		try {
			const connected = await this.autoReconnect();
			if (!connected && !this.stopped) {
				this.emitStatus(
					"reconnecting",
					"Esperando una nueva conexión con la báscula.",
				);
				this.scheduleReconnect();
			}
		} catch (error) {
			if (!this.stopped) {
				this.emitStatus(
					"reconnecting",
					"No se pudo establecer la conexión con la báscula.",
				);
				this.scheduleReconnect();
			}
			this.handleError(error);
		}
	}

	private async scheduleImmediateReconnect(): Promise<void> {
		if (this.stopped) {
			return;
		}

		if (this.reconnectTimer !== null) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}

		try {
			const connected = await this.autoReconnect();
			if (!connected && !this.stopped) {
				this.emitStatus(
					"reconnecting",
					"Esperando una nueva conexión con la báscula.",
				);
				this.scheduleReconnect();
			}
		} catch (error) {
			if (!this.stopped) {
				this.emitStatus(
					"reconnecting",
					"No se pudo establecer la conexión con la báscula.",
				);
				this.scheduleReconnect();
			}
			this.handleError(error);
		}
	}

	private startRequestLoop(): void {
		this.stopRequestLoop();

		if (this.settings.mode !== "request" || !this.port?.writable) {
			return;
		}

		const writer = this.port.writable.getWriter();
		this.writer = writer;

		this.requestTimer = setInterval(() => {
			void this.sendRequest(writer);
		}, this.settings.requestIntervalMs);
	}

	private async sendRequest(
		writer: WritableStreamDefaultWriter<Uint8Array>,
	): Promise<void> {
		if (this.stopped || this.requestPending || this.writer !== writer) {
			return;
		}

		this.requestPending = true;

		try {
			await writer.write(
				new TextEncoder().encode(
					requestCommand(this.settings.requestTerminator),
				),
			);
		} catch (error) {
			if (!this.stopped && this.writer === writer) {
				await this.handleReadError(error);
			}
		} finally {
			this.requestPending = false;
		}
	}

	private stopRequestLoop(): void {
		if (this.requestTimer !== null) {
			clearInterval(this.requestTimer);
			this.requestTimer = null;
		}

		this.requestPending = false;
	}

	private clearTimers(): void {
		this.stopRequestLoop();

		if (this.reconnectTimer !== null) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
	}

	private registerSerialListeners(): void {
		if (!this.serial || this.serialListenersRegistered) {
			return;
		}

		this.serial.addEventListener("connect", this.onSerialConnect);
		this.serial.addEventListener("disconnect", this.onSerialDisconnect);
		this.serialListenersRegistered = true;
	}

	private unregisterSerialListeners(): void {
		if (!this.serial || !this.serialListenersRegistered) {
			return;
		}

		this.serial.removeEventListener("connect", this.onSerialConnect);
		this.serial.removeEventListener("disconnect", this.onSerialDisconnect);
		this.serialListenersRegistered = false;
	}

	private getEventTarget(event: Event): SerialPortLike | null {
		const target = (event as Event & { target?: unknown }).target;

		if (target && typeof target === "object") {
			return target as unknown as SerialPortLike;
		}

		return null;
	}

	private emitStatus(status: ConnectionStatus, detail?: string): void {
		this.lastStatus = status;
		this.events.onStatus(status, detail);
	}

	private handleError(error: unknown): void {
		const message =
			error instanceof Error
				? error.message
				: "Error inesperado de la báscula.";
		this.emitStatus("error", message);
	}
}
