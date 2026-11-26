"use client";

import { AntonellaProvider } from "@/components/antonella-dock";
import { PesajeStation } from "@/components/weighing-station-v2/pesaje-station";

/** Igual que /admin/weighing-station/v2: pantalla completa, sin menú ni cabecera. */
export function PesajePreviewClient() {
	return (
		<div className="flex h-screen w-full flex-col overflow-hidden bg-background p-1.5">
			<AntonellaProvider userRole="admin">
				<PesajeStation demo />
			</AntonellaProvider>
		</div>
	);
}
