export interface QueuedOp {
	id: string;
	kind: "capture" | "void";
	payload: Record<string, unknown>;
	attempts: number;
	createdAt: number;
	nextAttemptAt: number;
	lastError?: string;
}

export interface OpStore {
	put(op: QueuedOp): Promise<void>;
	delete(id: string): Promise<void>;
	all(): Promise<QueuedOp[]>;
}

export function createIndexedDbStore(
	dbName = "cg-scale-webserial",
	storeName = "ops",
): OpStore {
	const indexedDb = globalThis.indexedDB;

	if (!indexedDb) {
		throw new Error("IndexedDB no está disponible.");
	}

	let dbPromise: Promise<IDBDatabase> | null = null;

	const getDb = (): Promise<IDBDatabase> => {
		if (dbPromise) {
			return dbPromise;
		}

		dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDb.open(dbName, 1);

			request.onupgradeneeded = (): void => {
				const db = request.result;
				if (!db.objectStoreNames.contains(storeName)) {
					db.createObjectStore(storeName, { keyPath: "id" });
				}
			};

			request.onsuccess = (): void => {
				resolve(request.result);
			};

			request.onerror = (): void => {
				reject(request.error ?? new Error("No se pudo abrir IndexedDB."));
			};

			request.onblocked = (): void => {
				reject(new Error("IndexedDB está bloqueado por otra pestaña."));
			};
		});

		return dbPromise;
	};

	const run = <T>(
		mode: IDBTransactionMode,
		operation: (store: IDBObjectStore) => IDBRequest<T>,
	): Promise<T> => {
		return getDb().then(
			(db) =>
				new Promise<T>((resolve, reject) => {
					const transaction = db.transaction(storeName, mode);
					const request = operation(transaction.objectStore(storeName));

					request.onsuccess = (): void => {
						resolve(request.result);
					};

					request.onerror = (): void => {
						reject(request.error ?? new Error("Error de IndexedDB."));
					};

					transaction.onerror = (): void => {
						reject(
							transaction.error ?? new Error("Error de transacción IndexedDB."),
						);
					};

					transaction.onabort = (): void => {
						reject(
							transaction.error ?? new Error("Transacción IndexedDB abortada."),
						);
					};
				}),
		);
	};

	return {
		async put(op: QueuedOp): Promise<void> {
			await run("readwrite", (store) => store.put(op));
		},

		async delete(id: string): Promise<void> {
			await run("readwrite", (store) => store.delete(id));
		},

		async all(): Promise<QueuedOp[]> {
			const result = await run<QueuedOp[]>("readonly", (store) =>
				store.getAll(),
			);
			return result.sort((a, b) => a.createdAt - b.createdAt);
		},
	};
}

export function createMemoryStore(): OpStore {
	const operations = new Map<string, QueuedOp>();

	return {
		async put(op: QueuedOp): Promise<void> {
			operations.set(op.id, { ...op, payload: { ...op.payload } });
		},

		async delete(id: string): Promise<void> {
			operations.delete(id);
		},

		async all(): Promise<QueuedOp[]> {
			return Array.from(operations.values())
				.map((op) => ({ ...op, payload: { ...op.payload } }))
				.sort((a, b) => a.createdAt - b.createdAt);
		},
	};
}

export interface OfflineQueueOptions {
	now?: () => number;
	baseDelayMs?: number;
	maxDelayMs?: number;
}

export interface OfflineQueueFlushResult {
	sent: number;
	pending: number;
}

export class OfflineQueue {
	private readonly store: OpStore;
	private readonly send: (op: QueuedOp) => Promise<"ok" | "retry" | "drop">;
	private readonly now: () => number;
	private readonly baseDelayMs: number;
	private readonly maxDelayMs: number;
	private readonly listeners = new Set<(pending: number) => void>();

	private flushing: Promise<OfflineQueueFlushResult> | null = null;
	private intervalTimer: ReturnType<typeof setInterval> | null = null;
	private onlineHandler: (() => void) | null = null;
	private inFlightId: string | null = null;

	public constructor(
		store: OpStore,
		send: (op: QueuedOp) => Promise<"ok" | "retry" | "drop">,
		options: OfflineQueueOptions = {},
	) {
		this.store = store;
		this.send = send;
		this.now = options.now ?? (() => Date.now());
		this.baseDelayMs = options.baseDelayMs ?? 2000;
		this.maxDelayMs = options.maxDelayMs ?? 60000;
	}

	public async enqueue(
		kind: QueuedOp["kind"],
		id: string,
		payload: Record<string, unknown>,
	): Promise<void> {
		const createdAt = this.now();
		const operation: QueuedOp = {
			id,
			kind,
			payload: { ...payload },
			attempts: 0,
			createdAt,
			nextAttemptAt: createdAt,
		};

		await this.store.put(operation);
		await this.notify();
		void this.flush().catch(() => undefined);
	}

	public async remove(id: string): Promise<boolean> {
		if (this.inFlightId === id) {
			return false;
		}

		const operations = await this.store.all();
		const exists = operations.some((operation) => operation.id === id);

		if (exists) {
			await this.store.delete(id);
			await this.notify();
		}

		return exists;
	}

	public async flush(): Promise<OfflineQueueFlushResult> {
		if (this.flushing) {
			return this.flushing;
		}

		this.flushing = this.performFlush().finally(() => {
			this.flushing = null;
		});

		return this.flushing;
	}

	public async size(): Promise<number> {
		const operations = await this.store.all();
		return operations.length;
	}

	public subscribe(listener: (pending: number) => void): () => void {
		this.listeners.add(listener);
		void this.size().then(
			(pending) => listener(pending),
			() => undefined,
		);

		return () => {
			this.listeners.delete(listener);
		};
	}

	public start(intervalMs = 5000): void {
		this.stop();

		this.intervalTimer = setInterval(() => {
			void this.flush().catch(() => undefined);
		}, intervalMs);

		if (typeof window !== "undefined") {
			this.onlineHandler = (): void => {
				void this.flush().catch(() => undefined);
			};
			window.addEventListener("online", this.onlineHandler);
		}
	}

	public stop(): void {
		if (this.intervalTimer !== null) {
			clearInterval(this.intervalTimer);
			this.intervalTimer = null;
		}

		if (this.onlineHandler !== null && typeof window !== "undefined") {
			window.removeEventListener("online", this.onlineHandler);
			this.onlineHandler = null;
		}
	}

	private async performFlush(): Promise<OfflineQueueFlushResult> {
		const operations = (await this.store.all()).sort(
			(a, b) => a.createdAt - b.createdAt,
		);

		let sent = 0;

		for (const operation of operations) {
			if (operation.nextAttemptAt > this.now()) {
				break;
			}

			this.inFlightId = operation.id;
			let result: "ok" | "retry" | "drop";

			try {
				result = await this.send(operation);
			} catch (error) {
				result = "retry";
				operation.lastError =
					error instanceof Error ? error.message : "Error al enviar.";
			} finally {
				this.inFlightId = null;
			}

			if (result === "ok" || result === "drop") {
				await this.store.delete(operation.id);
				sent += 1;
				continue;
			}

			operation.attempts += 1;
			operation.nextAttemptAt =
				this.now() +
				Math.min(
					this.maxDelayMs,
					this.baseDelayMs * 2 ** Math.max(0, operation.attempts - 1),
				);

			if (!operation.lastError) {
				operation.lastError = "Se solicitará un nuevo intento.";
			}

			await this.store.put(operation);
			break;
		}

		const pending = (await this.store.all()).length;
		await this.notify(pending);

		return { sent, pending };
	}

	private async notify(pending?: number): Promise<void> {
		const value = pending ?? (await this.size());

		for (const listener of this.listeners) {
			try {
				listener(value);
			} catch {
				// Un suscriptor defectuoso no debe interrumpir la cola.
			}
		}
	}
}
