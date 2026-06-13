"use client";

import { env } from "@finopenpos/env/web";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase para el navegador (singleton).
 *
 * La autenticación de la app es Better-Auth, NO Supabase Auth — por eso este
 * cliente se usa solo para features de infraestructura de Supabase:
 *   - Realtime (suscripciones en vivo a cambios de tablas, ej. pedidos/pesaje)
 *   - Storage (subida/descarga de archivos, ej. fotos de productos)
 *
 * Usa la clave anónima (pública). Las operaciones siguen sujetas a las
 * políticas RLS configuradas en Supabase.
 */
let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
	const url = env.NEXT_PUBLIC_SUPABASE_URL;
	const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

	if (!url || !anonKey) {
		throw new Error(
			"Supabase no está configurado: define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.",
		);
	}

	if (browserClient) return browserClient;

	browserClient = createClient(url, anonKey, {
		auth: {
			// La sesión la maneja Better-Auth; el cliente Supabase no persiste sesión.
			persistSession: false,
			autoRefreshToken: false,
			detectSessionInUrl: false,
		},
	});

	return browserClient;
}

/** True si las variables públicas de Supabase están presentes. */
export function isSupabaseConfigured(): boolean {
	return Boolean(
		env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
	);
}
