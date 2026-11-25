import { xaiEnabled, xaiSpeak } from "@/lib/ai/xai";
import { getAuthUser } from "@/lib/auth-guard";

// Antonella habla: texto → MP3 con la voz de x.ai (Ara).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
	const user = await getAuthUser();
	if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
	if (!xaiEnabled()) {
		return Response.json({ error: "voice_disabled" }, { status: 503 });
	}
	const body = (await req.json().catch(() => ({}))) as { text?: unknown };
	const text = typeof body.text === "string" ? body.text.trim() : "";
	if (!text) return Response.json({ error: "empty" }, { status: 400 });
	try {
		const audio = await xaiSpeak(text);
		return new Response(audio, {
			headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
		});
	} catch (err) {
		console.error("[peggy/tts]", err instanceof Error ? err.message : err);
		return Response.json({ error: "tts_failed" }, { status: 502 });
	}
}
