import { handleScaleIngest } from "@/lib/scale/ingest";

// Recibe lecturas de básculas físicas (gateway ESP32). Ver docs/scale-ingest.md.
// Sin sesión: se autentica con token por dispositivo (proxy.ts lo deja pasar).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
	try {
		return await handleScaleIngest(req);
	} catch (err) {
		console.error(
			"[scale/ingest] error",
			err instanceof Error ? err.message : "unknown",
		);
		return new Response(JSON.stringify({ error: "internal_error" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}
