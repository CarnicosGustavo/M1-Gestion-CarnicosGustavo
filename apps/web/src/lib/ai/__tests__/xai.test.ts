import { afterEach, describe, expect, it, mock } from "bun:test";
import { toXaiTools, xaiRespond } from "../xai";

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
	delete process.env.XAI_API_KEY;
});

describe("xai", () => {
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

	it("lee texto y llamadas a función de la respuesta", async () => {
		process.env.XAI_API_KEY = "test";
		let sent: any = null;
		globalThis.fetch = mock(async (_url: any, init: any) => {
			sent = JSON.parse(init.body);
			return new Response(
				JSON.stringify({
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
		});
		expect(sent.tool_choice).toBe("required");
		expect(sent.tools[0].type).toBe("function");
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

	it("sin llave avisa claro", async () => {
		await expect(xaiRespond({ instructions: "s", input: [] })).rejects.toThrow(
			/XAI_API_KEY/,
		);
	});
});
