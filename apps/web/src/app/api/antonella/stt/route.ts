import { handleSttPost } from "@/lib/ai/voice-routes";

// Antonella escucha: nota de voz (webm/opus o mp4 del navegador) → texto en español.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export const POST = handleSttPost;
