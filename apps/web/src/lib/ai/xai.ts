// Solo servidor: usa CARNICOS_XAI_API_KEY (nunca XAI_API_KEY, reservada para Marea).
if (typeof window !== "undefined") {
	throw new Error("src/lib/ai/xai.ts solo puede ejecutarse en el servidor.");
}

/**
 * Cliente mínimo de la API de x.ai (Grok): texto con herramientas
 * (/v1/responses), voz (/v1/tts) y dictado (/v1/stt). Sin SDK: solo fetch.
 */

const BASE = "https://api.x.ai/v1";
export const DEFAULT_XAI_TIMEOUT_MS = 20_000;

export const XAI_VOICE = process.env.XAI_VOICE || "ara";
export const XAI_MODEL = process.env.XAI_MODEL || "grok-4.7";

export function xaiEnabled(): boolean {
	return Boolean(process.env.CARNICOS_XAI_API_KEY?.trim());
}

function key(): string {
	const apiKey = process.env.CARNICOS_XAI_API_KEY?.trim();
	if (!apiKey) {
		throw new Error(
			"Antonella no está configurada: falta CARNICOS_XAI_API_KEY.",
		);
	}
	return apiKey;
}

async function fail(res: Response, what: string): Promise<never> {
	const body = await res.text().catch(() => "");
	console.error(`[xai/${what}] HTTP ${res.status}:`, body.slice(0, 300));
	throw new Error("El servicio de voz/IA no pudo responder en este momento.");
}

export function audioFileNameForMime(mime: string | null | undefined): string {
	const base = (mime ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
	if (base === "audio/mp4" || base === "audio/x-m4a") return "nota.m4a";
	if (base === "audio/ogg") return "nota.ogg";
	if (base === "audio/mpeg" || base === "audio/mp3") return "nota.mp3";
	if (base === "audio/wav") return "nota.wav";
	return "nota.webm";
}

function supportsReasoningEffort(model: string): boolean {
	return model.startsWith("grok-4") || model.startsWith("grok-3-mini");
}

/** Herramienta en el formato de Anthropic (name, description, input_schema). */
export interface ToolDef {
	name: string;
	description: string;
	input_schema: Record<string, unknown>;
}

export interface FunctionCall {
	call_id: string;
	name: string;
	arguments: Record<string, unknown>;
}

export interface XaiTurn {
	text: string;
	calls: FunctionCall[];
	/** Elementos de salida tal cual, para devolverlos en la siguiente ronda. */
	output: unknown[];
}

export function toXaiTools(tools: ToolDef[]) {
	return tools.map((tool) => ({
		type: "function",
		name: tool.name,
		description: tool.description,
		parameters: tool.input_schema,
	}));
}

export async function xaiRespond(params: {
	instructions: string;
	input: unknown[];
	tools?: ToolDef[];
	toolChoice?: "auto" | "required" | "none";
	model?: string;
	maxOutputTokens?: number;
	timeoutMs?: number;
}): Promise<XaiTurn> {
	const model = params.model || XAI_MODEL;
	const res = await fetch(`${BASE}/responses`, {
		method: "POST",
		signal: AbortSignal.timeout(params.timeoutMs ?? DEFAULT_XAI_TIMEOUT_MS),
		headers: {
			Authorization: `Bearer ${key()}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model,
			instructions: params.instructions,
			input: params.input,
			...(params.tools?.length
				? {
						tools: toXaiTools(params.tools),
						tool_choice: params.toolChoice ?? "auto",
					}
				: {}),
			...(supportsReasoningEffort(model)
				? { reasoning: { effort: "low" } }
				: {}),
			max_output_tokens: params.maxOutputTokens ?? 2000,
			store: false,
		}),
	});
	if (!res.ok) await fail(res, "responses");
	const data = (await res.json()) as {
		status?: string;
		incomplete_details?: unknown;
		output?: any[];
	};
	const output = Array.isArray(data.output) ? data.output : [];
	let text = "";
	const calls: FunctionCall[] = [];
	for (const item of output) {
		if (item?.type === "message" && Array.isArray(item.content)) {
			for (const part of item.content) {
				if (part?.type === "output_text" && typeof part.text === "string") {
					text += part.text;
				}
			}
		} else if (item?.type === "function_call") {
			let args: Record<string, unknown>;
			if (typeof item.arguments === "string") {
				try {
					const parsed = JSON.parse(item.arguments || "{}");
					if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
						throw new Error("non-object arguments");
					}
					args = parsed as Record<string, unknown>;
				} catch {
					console.warn(
						"[xai/responses] argumentos JSON inválidos en tool call:",
						item.name,
					);
					throw new Error("Antonella devolvió parámetros inválidos.");
				}
			} else if (
				item.arguments &&
				typeof item.arguments === "object" &&
				!Array.isArray(item.arguments)
			) {
				args = item.arguments as Record<string, unknown>;
			} else {
				args = {};
			}
			calls.push({ call_id: item.call_id, name: item.name, arguments: args });
		}
	}
	if (data.status === "incomplete" && calls.length === 0 && !text.trim()) {
		console.warn(
			"[xai/responses] respuesta incompleta sin texto ni llamadas:",
			data.incomplete_details ?? "",
		);
		throw new Error("La respuesta de Antonella quedó incompleta.");
	}
	// Los razonamientos no se reenvían (store:false no los guarda).
	const replay = output.filter((item) => item?.type !== "reasoning");
	return { text: text.trim(), calls, output: replay };
}

/** Texto → audio MP3 con la voz de Antonella (Ara por defecto). */
export async function xaiSpeak(
	text: string,
	timeoutMs = DEFAULT_XAI_TIMEOUT_MS,
): Promise<ArrayBuffer> {
	const res = await fetch(`${BASE}/tts`, {
		method: "POST",
		signal: AbortSignal.timeout(timeoutMs),
		headers: {
			Authorization: `Bearer ${key()}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			text: text.slice(0, 4000),
			voice_id: XAI_VOICE,
			language: "es-MX",
			output_format: { codec: "mp3", sample_rate: 24000, bit_rate: 64000 },
		}),
	});
	if (!res.ok) await fail(res, "tts");
	return res.arrayBuffer();
}

/** Audio grabado en el navegador (webm/opus o mp4) → texto en español. */
export async function xaiTranscribe(
	audio: Blob,
	keyterms: string[] = [],
	timeoutMs = DEFAULT_XAI_TIMEOUT_MS,
): Promise<string> {
	const form = new FormData();
	form.append("model", "grok-voice-transcribe-2.0");
	form.append("language", "es");
	form.append("format", "true");
	for (const term of keyterms.slice(0, 100)) form.append("keyterm", term);
	// El archivo va al final (lo pide la API).
	form.append("file", audio, audioFileNameForMime(audio.type));
	const res = await fetch(`${BASE}/stt`, {
		method: "POST",
		signal: AbortSignal.timeout(timeoutMs),
		headers: { Authorization: `Bearer ${key()}` },
		body: form,
	});
	if (!res.ok) await fail(res, "stt");
	const data = (await res.json()) as { text?: string };
	return String(data.text ?? "").trim();
}
