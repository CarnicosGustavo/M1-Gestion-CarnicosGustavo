import { handleSttPost } from "@/lib/ai/voice-routes";

// Alias de compatibilidad de /api/antonella/stt.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export const POST = handleSttPost;
