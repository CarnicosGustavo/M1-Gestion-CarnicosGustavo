import { handleTtsPost } from "@/lib/ai/voice-routes";

// Antonella habla: texto → MP3 con la voz de x.ai (Ara).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export const POST = handleTtsPost;
