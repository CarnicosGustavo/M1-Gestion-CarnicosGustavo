import { useEffect, useState } from "react";

export interface AntonellaMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
	timestamp: Date;
	toolCalls?: any[];
	requiresConfirmation?: boolean;
	confirmationData?: Record<string, unknown>;
}

export interface AntonellaSession {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	messages: AntonellaMessage[];
}

const DB_NAME = "carnicosgustavo-antonella";
const STORE_NAME = "sessions";
const DB_VERSION = 1;

let db: IDBDatabase | null = null;

async function initDB(): Promise<IDBDatabase> {
	if (db) return db;

	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => {
			db = request.result;
			resolve(db);
		};

		request.onupgradeneeded = (event) => {
			const database = (event.target as IDBOpenDBRequest).result;
			if (!database.objectStoreNames.contains(STORE_NAME)) {
				database.createObjectStore(STORE_NAME, {
					keyPath: "id",
				});
			}
		};
	});
}

async function saveSession(session: AntonellaSession): Promise<void> {
	const database = await initDB();
	return new Promise((resolve, reject) => {
		const tx = database.transaction(STORE_NAME, "readwrite");
		const store = tx.objectStore(STORE_NAME);
		const request = store.put({
			...session,
			createdAt: session.createdAt.toISOString(),
			updatedAt: session.updatedAt.toISOString(),
			messages: session.messages.map((m) => ({
				...m,
				timestamp: m.timestamp.toISOString(),
			})),
		});

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();
	});
}

async function loadSession(
	sessionId: string,
): Promise<AntonellaSession | null> {
	const database = await initDB();
	return new Promise((resolve, reject) => {
		const tx = database.transaction(STORE_NAME, "readonly");
		const store = tx.objectStore(STORE_NAME);
		const request = store.get(sessionId);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => {
			const data = request.result;
			if (!data) {
				resolve(null);
				return;
			}

			resolve({
				...data,
				createdAt: new Date(data.createdAt),
				updatedAt: new Date(data.updatedAt),
				messages: data.messages.map((m: any) => ({
					...m,
					timestamp: new Date(m.timestamp),
				})),
			});
		};
	});
}

async function listSessions(): Promise<AntonellaSession[]> {
	const database = await initDB();
	return new Promise((resolve, reject) => {
		const tx = database.transaction(STORE_NAME, "readonly");
		const store = tx.objectStore(STORE_NAME);
		const request = store.getAll();

		request.onerror = () => reject(request.error);
		request.onsuccess = () => {
			const data = request.result as any[];
			resolve(
				data.map((session) => ({
					...session,
					createdAt: new Date(session.createdAt),
					updatedAt: new Date(session.updatedAt),
					messages: session.messages.map((m: any) => ({
						...m,
						timestamp: new Date(m.timestamp),
					})),
				})),
			);
		};
	});
}

async function deleteSession(sessionId: string): Promise<void> {
	const database = await initDB();
	return new Promise((resolve, reject) => {
		const tx = database.transaction(STORE_NAME, "readwrite");
		const store = tx.objectStore(STORE_NAME);
		const request = store.delete(sessionId);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();
	});
}

export function useAntonellaHistory(sessionId: string) {
	const [session, setSession] = useState<AntonellaSession | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		loadSession(sessionId)
			.then((loaded) => {
				if (!loaded) {
					const newSession: AntonellaSession = {
						id: sessionId,
						createdAt: new Date(),
						updatedAt: new Date(),
						messages: [],
					};
					setSession(newSession);
				} else {
					setSession(loaded);
				}
				setIsLoading(false);
			})
			.catch((err) => {
				setError(err.message);
				setIsLoading(false);
			});
	}, [sessionId]);

	const addMessage = async (message: AntonellaMessage) => {
		if (!session) return;

		const updated: AntonellaSession = {
			...session,
			messages: [...session.messages, message],
			updatedAt: new Date(),
		};

		setSession(updated);
		await saveSession(updated);
	};

	const clearHistory = async () => {
		if (!session) return;

		const cleared: AntonellaSession = {
			...session,
			messages: [],
			updatedAt: new Date(),
		};

		setSession(cleared);
		await saveSession(cleared);
	};

	return {
		session,
		isLoading,
		error,
		addMessage,
		clearHistory,
		saveSession,
		listSessions,
		deleteSession,
	};
}
