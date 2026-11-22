// Solo servidor: usa XAI_API_KEY.
/**
 * Cliente mínimo de la API de x.ai (Grok): texto con herramientas
 * (/v1/responses), voz (/v1/tts) y dictado (/v1/stt). Sin SDK: solo fetch.
 */

const BASE = "https://api.x.ai/v1";

export const XAI_VOICE = process.env.XAI_VOICE || "ara";
export const XAI_MODEL = process.env.XAI_MODEL || "grok-4.7";

export function xaiEnabled(): boolean {
	return Boolean(process.env.XAI_API_KEY);
}

function key(): string {
	const apiKey = process.env.XAI_API_KEY;
	if (!apiKey) throw new Error("Peggy no está configurada: falta XAI_API_KEY.");
	return apiKey;
}

async function fail(res: Response, what: string): Promise<never> {
	const body = await res.text().catch(() => "");
	throw new Error(`x.ai ${what} ${res.status}: ${body.slice(0, 300)}`);
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
}): Promise<XaiTurn> {
	const res = await fetch(`${BASE}/responses`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${key()}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: params.model || XAI_MODEL,
			instructions: params.instructions,
			input: params.input,
			...(params.tools?.length
				? {
						tools: toXaiTools(params.tools),
						tool_choice: params.toolChoice ?? "auto",
					}
				: {}),
			reasoning: { effort: "low" },
			max_output_tokens: params.maxOutputTokens ?? 2000,
			store: false,
		}),
	});
	if (!res.ok) await fail(res, "responses");
	const data = (await res.json()) as { output?: any[] };
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
			let args: Record<string, unknown> = {};
			try {
				args =
					typeof item.arguments === "string"
						? JSON.parse(item.arguments || "{}")
						: (item.arguments ?? {});
			} catch {
				args = {};
			}
			calls.push({ call_id: item.call_id, name: item.name, arguments: args });
		}
	}
	// Los razonamientos no se reenvían (store:false no los guarda).
	const replay = output.filter((item) => item?.type !== "reasoning");
	return { text: text.trim(), calls, output: replay };
}

/** Texto → audio MP3 con la voz de Peggy (Ara por defecto). */
export async function xaiSpeak(text: string): Promise<ArrayBuffer> {
	const res = await fetch(`${BASE}/tts`, {
		method: "POST",
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

/** Audio grabado en el navegador (webm/opus) → texto en español. */
export async function xaiTranscribe(
	audio: Blob,
	keyterms: string[] = [],
): Promise<string> {
	const form = new FormData();
	form.append("model", "grok-voice-transcribe-2.0");
	form.append("language", "es");
	form.append("format", "true");
	for (const term of keyterms.slice(0, 100)) form.append("keyterm", term);
	// El archivo va al final (lo pide la API).
	form.append("file", audio, "nota.webm");
	const res = await fetch(`${BASE}/stt`, {
		method: "POST",
		headers: { Authorization: `Bearer ${key()}` },
		body: form,
	});
	if (!res.ok) await fail(res, "stt");
	const data = (await res.json()) as { text?: string };
	return String(data.text ?? "").trim();
}
