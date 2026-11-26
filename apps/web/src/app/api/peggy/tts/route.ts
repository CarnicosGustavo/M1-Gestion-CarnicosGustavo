import { handleTtsPost } from "@/lib/ai/voice-routes";

// Alias de compatibilidad de /api/antonella/tts.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export const POST = handleTtsPost;
