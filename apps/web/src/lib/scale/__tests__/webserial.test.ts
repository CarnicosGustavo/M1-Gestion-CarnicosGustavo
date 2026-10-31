import { describe, expect, test } from "bun:test";
import { ScaleConnection } from "../webserial/connection";
import { createMemoryStore, OfflineQueue } from "../webserial/queue";
import {
	DEFAULT_SCALE_SETTINGS,
	loadScaleSettings,
	requestCommand,
	type ScaleSettings,
	saveScaleSettings,
} from "../webserial/settings";
import { formatSimFrame, SimulatedScalePort } from "../webserial/simulator";
import type { SerialLike, SerialPortLike } from "../webserial/types";

describe("settings", () => {
	test("devuelve valores por defecto sin storage", () => {
		expect(loadScaleSettings(null)).toEqual(DEFAULT_SCALE_SETTINGS);
	});

	test("valida valores inválidos y aplica defaults", () => {
		const storage = {
			getItem: (): string =>
				JSON.stringify({
					baudRate: 9600,
					dataBits: 9,
					parity: "invalid",
					stopBits: 3,
					mode: "invalid",
					requestIntervalMs: 100,
					requestTerminator: "invalid",
					defaultUnit: "invalid",
					resolutionG: 0,
					simulator: "yes",
				}),
		};

		const settings = loadScaleSettings(storage);

		expect(settings.baudRate).toBe(9600);
		expect(settings.dataBits).toBe(8);
		expect(settings.parity).toBe("none");
		expect(settings.stopBits).toBe(1);
		expect(settings.mode).toBe("continuous");
		expect(settings.requestIntervalMs).toBe(300);
		expect(settings.requestTerminator).toBe("cr");
		expect(settings.defaultUnit).toBe("kg");
		expect(settings.resolutionG).toBe(5);
		expect(settings.simulator).toBe(false);
	});

	test("acota requestIntervalMs entre 300 y 500", () => {
		const storage = {
			getItem: (): string => JSON.stringify({ requestIntervalMs: 1000 }),
		};

		expect(loadScaleSettings(storage).requestIntervalMs).toBe(500);
	});

	test("usa defaults con JSON inválido", () => {
		const storage = {
			getItem: (): string => "{invalid",
		};

		expect(loadScaleSettings(storage)).toEqual(DEFAULT_SCALE_SETTINGS);
	});

	test("guarda y recupera settings", () => {
		const values = new Map<string, string>();
		const storage = {
			getItem: (key: string): string | null => values.get(key) ?? null,
			setItem: (key: string, value: string): void => {
				values.set(key, value);
			},
		};

		const settings: ScaleSettings = {
			...DEFAULT_SCALE_SETTINGS,
			baudRate: 1200,
			mode: "request",
			requestIntervalMs: 500,
		};

		saveScaleSettings(settings, storage);
		expect(loadScaleSettings(storage)).toEqual(settings);
	});

	test("genera comandos de petición", () => {
		expect(requestCommand("none")).toBe("P");
		expect(requestCommand("cr")).toBe("P\r");
		expect(requestCommand("crlf")).toBe("P\r\n");
	});
});

describe("simulador", () => {
	test("formatea trama con banderas", () => {
		expect(formatSimFrame(12.345, true, true, "kg")).toBe("ST,GS,+012.345kg");
		expect(formatSimFrame(-1.5, false, true, "g")).toBe("US,GS,-001.500g");
	});

	test("formatea trama sin banderas", () => {
		expect(formatSimFrame(12.345, true, false, "kg")).toBe("  12.345 kg");
	});

	test("formatea trama sin banderas y valor negativo", () => {
		expect(formatSimFrame(-1.5, false, false, "kg")).toBe("  -1.500 kg");
	});
});

describe("OfflineQueue", () => {
	test("envía operaciones en orden", async () => {
		const store = createMemoryStore();
		const sent: string[] = [];
		const currentTime = 1000;

		const queue = new OfflineQueue(
			store,
			async (op) => {
				sent.push(op.id);
				return "ok";
			},
			{ now: () => currentTime },
		);

		await queue.enqueue("capture", "a", { value: 1 });
		await queue.enqueue("capture", "b", { value: 2 });
		await queue.flush();

		expect(sent).toEqual(["a", "b"]);
		expect(await queue.size()).toBe(0);
	});

	test("aplica backoff y reintenta", async () => {
		const store = createMemoryStore();
		let currentTime = 1000;
		let attempts = 0;

		const queue = new OfflineQueue(
			store,
			async () => {
				attempts += 1;
				return attempts === 1 ? "retry" : "ok";
			},
			{ now: () => currentTime, baseDelayMs: 2000, maxDelayMs: 60000 },
		);

		await queue.enqueue("capture", "a", {});
		expect(attempts).toBe(1);
		expect(await queue.size()).toBe(1);

		currentTime += 1999;
		await queue.flush();
		expect(attempts).toBe(1);

		currentTime += 1;
		await queue.flush();
		expect(attempts).toBe(2);
		expect(await queue.size()).toBe(0);
	});

	test("elimina operaciones con drop", async () => {
		const store = createMemoryStore();
		const queue = new OfflineQueue(store, async () => "drop");

		await queue.enqueue("void", "a", {});
		await queue.flush();
		expect(await queue.size()).toBe(0);
	});

	test("remove elimina una operación pendiente", async () => {
		const store = createMemoryStore();
		const queue = new OfflineQueue(store, async () => "retry");

		await queue.enqueue("capture", "a", {});
		expect(await queue.size()).toBe(1);
		expect(await queue.remove("a")).toBe(true);
		expect(await queue.remove("a")).toBe(false);
		expect(await queue.size()).toBe(0);
	});

	test("no ejecuta flush concurrentes", async () => {
		const store = createMemoryStore();
		let calls = 0;
		const gate: { release: (() => void) | null } = { release: null };

		await store.put({
			id: "a",
			kind: "capture",
			payload: {},
			attempts: 0,
			createdAt: 1000,
			nextAttemptAt: 0,
		});

		const queue = new OfflineQueue(store, async () => {
			calls += 1;
			await new Promise<void>((resolve) => {
				gate.release = resolve;
			});
			return "ok";
		});

		const first = queue.flush();
		const second = queue.flush();

		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(calls).toBe(1);

		gate.release?.();
		await Promise.all([first, second]);
	});

	test("respeta el orden FIFO cuando la primera operación devuelve retry", async () => {
		const store = createMemoryStore();
		const sent: string[] = [];
		const currentTime = 1000;

		await store.put({
			id: "a",
			kind: "capture",
			payload: {},
			attempts: 0,
			createdAt: 1000,
			nextAttemptAt: 0,
		});

		await store.put({
			id: "b",
			kind: "capture",
			payload: {},
			attempts: 0,
			createdAt: 1001,
			nextAttemptAt: 0,
		});

		const queue = new OfflineQueue(
			store,
			async (op) => {
				sent.push(op.id);
				return op.id === "a" ? "retry" : "ok";
			},
			{ now: () => currentTime },
		);

		await queue.flush();

		expect(sent).toEqual(["a"]);
		expect(await queue.size()).toBe(2);
	});
});

describe("ScaleConnection", () => {
	test("conecta en modo request, envía P\\r y recibe líneas", async () => {
		const settings: ScaleSettings = {
			...DEFAULT_SCALE_SETTINGS,
			mode: "request",
			requestIntervalMs: 300,
			requestTerminator: "cr",
		};

		const port = new SimulatedScalePort({
			mode: "request",
			withFlags: true,
		});

		const serial: SerialLike = {
			requestPort: async (): Promise<SerialPortLike> => port,
			getPorts: async (): Promise<SerialPortLike[]> => [port],
			addEventListener: (): void => undefined,
			removeEventListener: (): void => undefined,
		};

		const lines: string[] = [];
		const statuses: string[] = [];

		const connection = new ScaleConnection(
			settings,
			{
				onStatus: (status): void => {
					statuses.push(status);
				},
				onLine: (line): void => {
					lines.push(line);
				},
			},
			{ serial },
		);

		await connection.connectWithPicker();

		await new Promise((resolve) => setTimeout(resolve, 900));

		expect(statuses).toContain("connected");
		expect(port.written.join("")).toContain("P\r");
		expect(lines.length).toBeGreaterThan(0);
		expect(lines.some((line) => line === "ST,GS,+000.000kg")).toBe(true);

		await connection.disconnect();
		await connection.disconnect();

		expect(statuses[statuses.length - 1]).toBe("idle");
	});

	test("reconecta tras simular una desconexión", async () => {
		const settings: ScaleSettings = {
			...DEFAULT_SCALE_SETTINGS,
			mode: "request",
			requestIntervalMs: 300,
			requestTerminator: "cr",
		};

		const firstPort = new SimulatedScalePort({
			mode: "request",
			withFlags: true,
		});

		const secondPort = new SimulatedScalePort({
			mode: "request",
			withFlags: true,
		});

		let currentPort: SerialPortLike = firstPort;

		const serial: SerialLike = {
			requestPort: async (): Promise<SerialPortLike> => currentPort,
			getPorts: async (): Promise<SerialPortLike[]> => [currentPort],
			addEventListener: (): void => undefined,
			removeEventListener: (): void => undefined,
		};

		const statuses: string[] = [];
		const connection = new ScaleConnection(
			settings,
			{
				onStatus: (status): void => {
					statuses.push(status);
				},
				onLine: (): void => undefined,
			},
			{ serial },
		);

		await connection.connectWithPicker();
		expect(connection.status).toBe("connected");

		firstPort.simulateUnplug();
		currentPort = secondPort;
		await new Promise((resolve) => setTimeout(resolve, 20));

		const deadline = Date.now() + 2500;
		while (Date.now() < deadline && connection.status !== "connected") {
			await new Promise((resolve) => setTimeout(resolve, 50));
		}

		expect(statuses).toContain("reconnecting");
		expect(connection.status).toBe("connected");

		await connection.disconnect();
	});
});
