import "server-only";

import { env as serverEnv } from "@finopenpos/env/server";
import { env as webEnv } from "@finopenpos/env/web";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase del lado del servidor (singleton).
 *
 * Usa la SERVICE ROLE KEY: omite RLS y tiene acceso total. Úsalo SOLO en
 * código de servidor (route handlers, server actions, procedimientos tRPC) —
 * nunca lo importes en componentes de cliente. El import "server-only" lo
 * garantiza en tiempo de compilación.
 *
 * El acceso transaccional al negocio sigue siendo vía Drizzle (`@/lib/db`).
 * Este cliente es para features de infraestructura de Supabase: emitir eventos
 * Realtime, Storage con privilegios, administración, etc.
 */
let serviceClient: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient {
	const url = webEnv.NEXT_PUBLIC_SUPABASE_URL;
	const serviceRoleKey = serverEnv.SUPABASE_SERVICE_ROLE_KEY;

	if (!url || !serviceRoleKey) {
		throw new Error(
			"Supabase (servidor) no está configurado: define NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.",
		);
	}

	if (serviceClient) return serviceClient;

	serviceClient = createClient(url, serviceRoleKey, {
		auth: {
			persistSession: false,
			autoRefreshToken: false,
		},
	});

	return serviceClient;
}

/** True si las variables de servidor de Supabase están presentes. */
export function isSupabaseServerConfigured(): boolean {
	return Boolean(
		webEnv.NEXT_PUBLIC_SUPABASE_URL && serverEnv.SUPABASE_SERVICE_ROLE_KEY,
	);
}
