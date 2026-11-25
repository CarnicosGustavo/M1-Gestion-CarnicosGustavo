"use client";

import type { DraftLine } from "./overlays/new-order-overlay";

/** «PIERNA» → «Piernas» (8 pzs); los nombres compuestos se dejan igual. */
export function noteProductName(name: string, pieces: number): string {
	const title = name
		.toLowerCase()
		.replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
	if (pieces <= 1 || /\s|\//.test(title) || /s$/i.test(title)) return title;
	return /[aeiou]$/i.test(title) ? `${title}s` : `${title}es`;
}

export function noteQuantity(line: DraftLine): string {
	if (line.kg && !line.pieces) return `${line.kg} kg`;
	return `${line.pieces} ${line.pieces === 1 ? "pz" : "pzs"}`;
}

export function audioFileNameForMime(mime: string | null | undefined): string {
	const base = (mime ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
	if (base === "audio/mp4" || base === "audio/x-m4a") return "nota.m4a";
	if (base === "audio/ogg") return "nota.ogg";
	if (base === "audio/mpeg" || base === "audio/mp3") return "nota.mp3";
	if (base === "audio/wav") return "nota.wav";
	return "nota.webm";
}

/**
 * Voz de Antonella con x.ai: se graba la nota en el navegador (MediaRecorder),
 * el servidor la transcribe (Grok STT) y Antonella contesta hablando (voz Ara).
 * Funciona en cualquier navegador moderno (incluido Safari con audio/mp4).
 */

export function canRecord(): boolean {
	return (
		typeof window !== "undefined" &&
		typeof window.MediaRecorder !== "undefined" &&
		Boolean(navigator.mediaDevices?.getUserMedia)
	);
}

export interface NoteRecorder {
	/** Detiene y entrega el audio (vacío si no se grabó nada). */
	stop: () => Promise<Blob>;
	/** Detiene y descarta. */
	cancel: () => void;
}

const RECORD_MIME_CANDIDATES = [
	"audio/webm;codecs=opus",
	"audio/webm",
	"audio/ogg",
	"audio/mp4",
];

export async function startRecording(): Promise<NoteRecorder> {
	const stream = await navigator.mediaDevices.getUserMedia({
		audio: { echoCancellation: true, noiseSuppression: true },
	});
	const type = RECORD_MIME_CANDIDATES.find((candidate) =>
		MediaRecorder.isTypeSupported(candidate),
	);
	const recorder = new MediaRecorder(stream, type ? { mimeType: type } : {});
	const chunks: Blob[] = [];
	recorder.ondataavailable = (event) => {
		if (event.data.size > 0) chunks.push(event.data);
	};
	recorder.start(250);
	const release = () => {
		for (const track of stream.getTracks()) track.stop();
	};
	const resolvedMime = () => recorder.mimeType || type || "audio/webm";
	return {
		stop: () =>
			new Promise<Blob>((resolve) => {
				recorder.onstop = () => {
					release();
					resolve(new Blob(chunks, { type: resolvedMime() }));
				};
				if (recorder.state === "inactive") {
					release();
					resolve(new Blob(chunks, { type: resolvedMime() }));
				} else recorder.stop();
			}),
		cancel: () => {
			recorder.onstop = release;
			if (recorder.state !== "inactive") recorder.stop();
			else release();
		},
	};
}

export async function transcribe(audio: Blob): Promise<string> {
	const form = new FormData();
	form.append("audio", audio, audioFileNameForMime(audio.type));
	const res = await fetch("/api/antonella/stt", { method: "POST", body: form });
	if (!res.ok) throw new Error(`Dictado no disponible (${res.status})`);
	const data = (await res.json()) as { text?: string };
	return String(data.text ?? "").trim();
}

let current: HTMLAudioElement | null = null;
let pending: AbortController | null = null;

/** Calla a Antonella (Esc, nueva nota o cerrar). */
export function hush(): void {
	pending?.abort();
	pending = null;
	if (current) {
		current.pause();
		URL.revokeObjectURL(current.src);
		current = null;
	}
}

/** Antonella dice el texto con su voz; si falla, se queda callada. */
export async function speak(text: string): Promise<void> {
	hush();
	const clean = text.replace(/[*_#`>]/g, "").trim();
	if (!clean) return;
	const controller = new AbortController();
	pending = controller;
	try {
		const res = await fetch("/api/antonella/tts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text: clean }),
			signal: controller.signal,
		});
		if (!res.ok || controller.signal.aborted) return;
		const url = URL.createObjectURL(await res.blob());
		if (controller.signal.aborted) {
			URL.revokeObjectURL(url);
			return;
		}
		const audio = new Audio(url);
		current = audio;
		const cleanup = () => {
			URL.revokeObjectURL(url);
			if (current === audio) current = null;
		};
		audio.onended = cleanup;
		audio.onerror = cleanup;
		await audio.play().catch(() => {
			cleanup();
		});
	} catch {
		// Sin voz: la nota en pantalla basta.
	} finally {
		if (pending === controller) pending = null;
	}
}

/** «Anoté para Mercado San Juan: 8 piezas de pierna y 5 de pecho. ¿Lo confirmo?» */
export function orderSummary(
	customerName: string | null,
	customerQuery: string,
	lines: DraftLine[],
	productName: (productId: number) => string,
	unmatched: string[] = [],
): string {
	const items = lines.map((line) => {
		const qty = noteQuantity(line)
			.replace(/\bpzs\b/, "piezas")
			.replace(/\bpz\b/, "pieza")
			.replace(/\bkg\b/, "kilos");
		return `${qty} de ${noteProductName(productName(line.productId), 1).toLowerCase()}`;
	});
	const list =
		items.length > 1
			? `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`
			: (items[0] ?? "");
	const who = customerName
		? `para ${customerName}`
		: `, pero no encontré al cliente ${customerQuery || ""}`.trim();
	const missing =
		unmatched.length > 0 ? ` No encontré: ${unmatched.join(", ")}.` : "";
	if (!list) return `No entendí los productos ${who}.${missing}`;
	return customerName
		? `Anoté ${who}: ${list}.${missing} ¿Lo confirmo?`
		: `Anoté ${list}${who}. Corrígelo con Editar.${missing}`;
}
