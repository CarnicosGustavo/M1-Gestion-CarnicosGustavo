import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
	audioFileNameForMime,
	orderSummary,
} from "@/components/weighing-station-v2/peggy-voice";
import {
	toXaiTools,
	xaiEnabled,
	xaiRespond,
	xaiSpeak,
	xaiTranscribe,
} from "../xai";

const realFetch = globalThis.fetch;
let prevCarnicosKey: string | undefined;
let prevXaiKey: string | undefined;

beforeEach(() => {
	prevCarnicosKey = process.env.CARNICOS_XAI_API_KEY;
	prevXaiKey = process.env.XAI_API_KEY;
	delete process.env.CARNICOS_XAI_API_KEY;
});

afterEach(() => {
	globalThis.fetch = realFetch;
	if (prevCarnicosKey === undefined) delete process.env.CARNICOS_XAI_API_KEY;
	else process.env.CARNICOS_XAI_API_KEY = prevCarnicosKey;
	if (prevXaiKey === undefined) delete process.env.XAI_API_KEY;
	else process.env.XAI_API_KEY = prevXaiKey;
});

function walkFiles(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) out.push(...walkFiles(full));
		else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
	}
	return out;
}

describe("xai (P34-1, P34-4, P34-5, P34-9, P34-10, P34-11)", () => {
	it("P34-1: solo usa CARNICOS_XAI_API_KEY e ignora XAI_API_KEY de Marea", async () => {
		process.env.XAI_API_KEY = "clave-de-marea-no-usar";
		delete process.env.CARNICOS_XAI_API_KEY;
		expect(xaiEnabled()).toBe(false);
		await expect(xaiRespond({ instructions: "s", input: [] })).rejects.toThrow(
			/CARNICOS_XAI_API_KEY/,
		);

		process.env.CARNICOS_XAI_API_KEY = "clave-carnicos-test";
		expect(xaiEnabled()).toBe(true);
	});

	it("convierte herramientas al formato de funciones", () => {
		expect(
			toXaiTools([
				{ name: "a", description: "d", input_schema: { type: "object" } },
			]),
		).toEqual([
			{
				type: "function",
				name: "a",
				description: "d",
				parameters: { type: "object" },
			},
		]);
	});

	it("lee texto y llamadas a función de la respuesta, filtra reasoning y pasa signal", async () => {
		process.env.CARNICOS_XAI_API_KEY = "test";
		let sent: any = null;
		let hadSignal = false;
		globalThis.fetch = mock(async (_url: any, init: any) => {
			sent = JSON.parse(init.body);
			hadSignal = init.signal instanceof AbortSignal;
			return new Response(
				JSON.stringify({
					status: "completed",
					output: [
						{ type: "reasoning", summary: [] },
						{
							type: "function_call",
							call_id: "c1",
							name: "propose_order",
							arguments: '{"customer_id":2,"lines":[]}',
						},
						{
							type: "message",
							content: [{ type: "output_text", text: "Listo" }],
						},
					],
				}),
			);
		}) as any;
		const turn = await xaiRespond({
			instructions: "s",
			input: [{ role: "user", content: "hola" }],
			tools: [{ name: "propose_order", description: "x", input_schema: {} }],
			toolChoice: "required",
			timeoutMs: 5000,
		});
		expect(hadSignal).toBe(true);
		expect(sent.tool_choice).toBe("required");
		expect(sent.tools[0].type).toBe("function");
		expect(sent.reasoning).toEqual({ effort: "low" });
		expect(turn.text).toBe("Listo");
		expect(turn.calls).toEqual([
			{
				call_id: "c1",
				name: "propose_order",
				arguments: { customer_id: 2, lines: [] },
			},
		]);
		expect(turn.output).toHaveLength(2);
	});

	it("P34-11: omite reasoning en modelos sin soporte, detecta incomplete y JSON inválido", async () => {
		process.env.CARNICOS_XAI_API_KEY = "test";
		let sentModelPayload: any = null;
		globalThis.fetch = mock(async (_url: any, init: any) => {
			sentModelPayload = JSON.parse(init.body);
			return new Response(
				JSON.stringify({
					status: "incomplete",
					incomplete_details: { reason: "max_output_tokens" },
					output: [],
				}),
			);
		}) as any;
		await expect(
			xaiRespond({ instructions: "s", input: [], model: "grok-2-latest" }),
		).rejects.toThrow(/incompleta/i);
		expect(sentModelPayload.reasoning).toBeUndefined();

		globalThis.fetch = mock(async () => {
			return new Response(
				JSON.stringify({
					status: "completed",
					output: [
						{
							type: "function_call",
							call_id: "c2",
							name: "forget",
							arguments: "{json-roto",
						},
					],
				}),
			);
		}) as any;
		await expect(xaiRespond({ instructions: "s", input: [] })).rejects.toThrow(
			/inválidos/i,
		);
	});

	it("P34-5: fail() oculta el cuerpo HTTP crudo de xAI en Error.message", async () => {
		process.env.CARNICOS_XAI_API_KEY = "test";
		globalThis.fetch = mock(
			async () =>
				new Response(
					'{"error":{"message":"detalle interno secreto xai-999"}}',
					{
						status: 500,
					},
				),
		) as any;
		let caught: unknown;
		try {
			await xaiRespond({ instructions: "s", input: [] });
		} catch (e) {
			caught = e;
		}
		expect(caught).toBeInstanceOf(Error);
		expect((caught as Error).message).not.toContain("secreto xai-999");
		expect((caught as Error).message).not.toContain("500");
	});

	it("P34-9/P34-10: xaiSpeak y xaiTranscribe envían formato correcto (Safari mp4 → nota.m4a)", async () => {
		process.env.CARNICOS_XAI_API_KEY = "test";
		const calls: Array<{ url: string; init: any }> = [];
		globalThis.fetch = mock(async (url: any, init: any) => {
			calls.push({ url: String(url), init });
			if (String(url).endsWith("/tts")) {
				return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
			}
			return new Response(JSON.stringify({ text: "  ocho piernas  " }), {
				status: 200,
			});
		}) as any;

		const audioBuf = await xaiSpeak("Hola Antonella");
		expect(audioBuf.byteLength).toBe(3);
		expect(calls[0]?.url).toContain("/tts");
		expect(calls[0]?.init.signal).toBeInstanceOf(AbortSignal);
		expect(JSON.parse(calls[0]?.init.body).voice_id).toBe("ara");

		const mp4Blob = new Blob(["fake-m4a"], { type: "audio/mp4" });
		const text = await xaiTranscribe(mp4Blob, ["Mercado San Juan", "PIERNA"]);
		expect(text).toBe("ocho piernas");
		expect(calls[1]?.url).toContain("/stt");
		expect(calls[1]?.init.signal).toBeInstanceOf(AbortSignal);
		const form = calls[1]?.init.body as FormData;
		expect(form.getAll("keyterm")).toEqual(["Mercado San Juan", "PIERNA"]);
		const uploaded = form.get("file") as File;
		expect(uploaded.name).toBe("nota.m4a");
		expect(audioFileNameForMime("audio/webm;codecs=opus")).toBe("nota.webm");
	});

	it("P34-4: parseVoiceOrder solo usa xAI; si falla, BAD_GATEWAY y nada a Anthropic", () => {
		const src = readFileSync(
			join(import.meta.dir, "../../trpc/routers/antonella.ts"),
			"utf8",
		);
		const nextProc = src.indexOf("voiceInfo:", src.indexOf("parseVoiceOrder:"));
		const block = src.slice(
			src.indexOf("parseVoiceOrder:"),
			nextProc === -1 ? undefined : nextProc,
		);
		expect(block).toContain('toolChoice: "required"');
		expect(block).toContain("timeoutMs: 15_000");
		expect(block).toContain('code: "BAD_GATEWAY"');
		expect(block).not.toContain("getClient");
		expect(block).not.toContain("ANTHROPIC_API_KEY");
		expect(block).not.toContain("claude-sonnet");
		expect(block).not.toContain("claude-opus");
		expect(block).not.toContain("tool_choice");
		expect(block).not.toContain('type: "any"');
		expect(block).not.toContain('type: "auto"');
	});

	it("P34-11: ningún componente 'use client' importa módulos solo-servidor de Antonella", () => {
		const srcRoot = join(import.meta.dir, "../../..");
		const files = walkFiles(srcRoot);
		const violations: string[] = [];
		for (const file of files) {
			const content = readFileSync(file, "utf8");
			if (!/^\s*["']use client["']/.test(content)) continue;
			if (
				/from\s+["'][^"']*(lib\/ai\/xai|lib\/ai\/antonella-access|lib\/ai\/voice-routes|trpc\/routers\/antonella)/.test(
					content,
				)
			) {
				violations.push(file);
			}
		}
		expect(violations).toEqual([]);
	});

	it("peggy-voice.ts se importa sin error en bun test y arma orderSummary", () => {
		const summary = orderSummary(
			"Mercado San Juan",
			"",
			[{ productId: 4, pieces: 8, kg: null }],
			() => "PIERNA",
		);
		expect(summary).toContain("Mercado San Juan");
		expect(summary).toContain("8 piezas de pierna");
	});
});
