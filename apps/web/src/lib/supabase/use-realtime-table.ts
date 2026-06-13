"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useEffect, useRef } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "./client";

type ChangeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

interface UseRealtimeTableOptions {
	/** Nombre de la tabla en el esquema public (ej. "orders", "order_items"). */
	table: string;
	/** Evento a escuchar. Por defecto "*" (todos). */
	event?: ChangeEvent;
	/** Filtro Postgres opcional, ej. "status=eq.PENDIENTE_PESAJE". */
	filter?: string;
	/** Se ejecuta en cada cambio recibido. */
	onChange: (
		payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
	) => void;
	/** Desactiva la suscripción sin desmontar el componente. */
	enabled?: boolean;
}

/**
 * Suscribe a cambios en tiempo real de una tabla de Supabase Postgres.
 *
 * Requiere que la tabla esté añadida a la publicación de Realtime en Supabase
 * (Database → Replication). Si Supabase no está configurado, el hook es un
 * no-op silencioso, de modo que la app funciona igual sin las credenciales.
 *
 * Uso típico — refrescar pedidos pendientes de pesaje en vivo:
 *
 *   const trpc = useTRPC();
 *   const queryClient = useQueryClient();
 *   useRealtimeTable({
 *     table: "orders",
 *     onChange: () =>
 *       queryClient.invalidateQueries({
 *         queryKey: trpc.orders.getPendingWeighingOrders.queryOptions().queryKey,
 *       }),
 *   });
 */
export function useRealtimeTable({
	table,
	event = "*",
	filter,
	onChange,
	enabled = true,
}: UseRealtimeTableOptions): void {
	// Guardamos el callback en un ref para no re-suscribir en cada render.
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	useEffect(() => {
		if (!enabled || !isSupabaseConfigured()) return;

		const supabase = getSupabaseBrowserClient();
		const channel = supabase
			.channel(`realtime:${table}:${filter ?? "all"}`)
			.on(
				"postgres_changes",
				{ event, schema: "public", table, ...(filter ? { filter } : {}) },
				(payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
					onChangeRef.current(payload);
				},
			)
			.subscribe();

		return () => {
			void supabase.removeChannel(channel);
		};
	}, [table, event, filter, enabled]);
}
