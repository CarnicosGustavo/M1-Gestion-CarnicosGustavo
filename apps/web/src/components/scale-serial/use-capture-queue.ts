"use client";

import { useQueryClient } from "@tanstack/react-query";

import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
	createIndexedDbStore,
	createMemoryStore,
	OfflineQueue,
	type QueuedOp,
} from "@/lib/scale/webserial/queue";
import { trpcClient, useTRPC } from "@/lib/trpc/client";

export type CapturePayload = {
	eventId: string;
	orderItemId: number;
	pieceCount: number | null;
	weight: number;
	unit: "kg" | "g" | "lb";
	weightG: number;
	stable: boolean;
	manual: boolean;
	raw: string | null;
	capturedAt: string;
	seq: number;
	containerId: string | null;
	tareG: number | null;
};

type QueuePayload = CapturePayload | { eventId: string };

export function useCaptureQueue() {
	const [pending, setPending] = useState(0);
	const queueRef = useRef<OfflineQueue | null>(null);
	const queryClient = useQueryClient();
	const trpc = useTRPC();
	const queryClientRef = useRef(queryClient);
	const trpcRef = useRef(trpc);

	queryClientRef.current = queryClient;
	trpcRef.current = trpc;

	useEffect(() => {
		const store =
			typeof indexedDB === "undefined"
				? createMemoryStore()
				: createIndexedDbStore();
		const queue = new OfflineQueue(store, async (op: QueuedOp) => {
			const payload = op.payload as QueuePayload;
			return sendOperation(
				op,
				payload,
				queryClientRef.current,
				trpcRef.current,
			);
		});

		queueRef.current = queue;
		const unsubscribe = queue.subscribe((count) => {
			setPending(count);
		});
		queue.start(5000);

		return () => {
			unsubscribe();
			queue.stop();
			queueRef.current = null;
		};
	}, []);

	const enqueueCapture = useCallback((payload: CapturePayload) => {
		const queue = queueRef.current;
		if (!queue) {
			toast.error("No se pudo preparar la cola de capturas");
			return;
		}

		void queue.enqueue("capture", payload.eventId, { ...payload }).catch(() => {
			toast.error("No se pudo guardar la captura en la cola local");
		});
	}, []);

	const undoCapture = useCallback(async (eventId: string) => {
		const queue = queueRef.current;
		if (!queue) {
			return;
		}

		try {
			const removed = await queue.remove(eventId);
			if (!removed) {
				queue.enqueue("void", `void:${eventId}`, { eventId });
			}
		} catch {
			toast.error("No se pudo deshacer la captura");
		}
	}, []);

	return {
		pending,
		enqueueCapture,
		undoCapture,
	};
}

async function sendOperation(
	op: QueuedOp,
	payload: QueuePayload,
	queryClient: ReturnType<typeof useQueryClient>,
	trpc: ReturnType<typeof useTRPC>,
): Promise<"ok" | "retry" | "drop"> {
	try {
		if (op.kind === "capture") {
			await trpcClient.scaleSerial.capture.mutate(payload as CapturePayload);
		} else {
			await trpcClient.scaleSerial.void.mutate({
				eventId: (payload as { eventId: string }).eventId,
			});
		}

		await queryClient.invalidateQueries({
			queryKey: trpc.scaleSerial.lineCaptures.queryKey(),
		});

		return "ok";
	} catch (error) {
		if (
			error instanceof TRPCClientError &&
			(error.data?.code === "BAD_REQUEST" ||
				error.data?.code === "NOT_FOUND" ||
				error.data?.code === "CONFLICT" ||
				error.data?.code === "FORBIDDEN")
		) {
			const message =
				error.data?.code === "FORBIDDEN"
					? "No tienes permisos para guardar esta captura."
					: error.message;
			toast.error(message);
			return "drop";
		}

		if (
			error instanceof TRPCClientError &&
			error.data?.code === "UNAUTHORIZED"
		) {
			toast.error("Tu sesión expiró; vuelve a iniciar sesión");
			return "retry";
		}

		return "retry";
	}
}
