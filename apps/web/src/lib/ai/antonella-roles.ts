import type { UserRole } from "@finopenpos/api";

/**
 * P34-2 / P36-4: lista única de roles que pueden usar Antonella
 * (voz, /stt, /tts, chat, parseVoiceOrder, tecla 🎤 y el dock).
 * Default seguro: solo "admin" hasta que Beto confirme otros roles.
 */
export const ANTONELLA_ALLOWED_ROLES: readonly UserRole[] = ["admin"];

export function canUseAntonella(role: string | null | undefined): boolean {
	if (!role) return false;
	return ANTONELLA_ALLOWED_ROLES.includes(role as UserRole);
}
