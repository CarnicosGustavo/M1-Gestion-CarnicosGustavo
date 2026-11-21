"use client";

import { cn } from "@finopenpos/ui/lib/utils";
import dynamic from "next/dynamic";
import { type ComponentType, useState } from "react";
import { MODULE_INFO } from "../tiles/fn-pages";
import type { ModulePage } from "../types";
import { OverlayFrame } from "./overlay-frame";

function Loading() {
	return (
		<p className="p-8 text-center text-muted-foreground text-sm">Cargando…</p>
	);
}

// Las pantallas del dashboard se montan tal cual dentro de la ventana
// sobrepuesta: misma lógica y mismos datos, sin salir de la báscula.
const Recetas = dynamic(
	() =>
		import("@/app/admin/inventory/recipes/page").then((m) => {
			const Recipes = m.default;
			return function RecetasEmbebidas() {
				return <Recipes />;
			};
		}),
	{ loading: Loading },
);
const Frio = dynamic(() => import("@/app/admin/cold-inventory/page"), {
	loading: Loading,
});
const Clientes = dynamic(() => import("@/app/admin/customers/page"), {
	loading: Loading,
});
const Precios = dynamic(() => import("@/app/admin/prices/page"), {
	loading: Loading,
});
const Cobranza = dynamic(() => import("@/app/admin/collections/page"), {
	loading: Loading,
});

/** Clientes junta precios por cliente y cobranza: una ventana, tres pestañas. */
const TABS: Record<
	ModulePage,
	Array<{ id: string; label: string; Page: ComponentType }>
> = {
	recetas: [{ id: "recetas", label: "Recetas", Page: Recetas }],
	frio: [{ id: "frio", label: "Inventario frío", Page: Frio }],
	clientes: [
		{ id: "clientes", label: "Clientes", Page: Clientes },
		{ id: "precios", label: "Precios", Page: Precios },
		{ id: "cobranza", label: "Cobranza", Page: Cobranza },
	],
};

export const MODULE_LABELS: Record<ModulePage, string> = {
	recetas: "Recetas",
	frio: "Inventario frío",
	clientes: "Clientes · precios · cobranza",
};

export function ModuleOverlay({
	page,
	demo,
	onClose,
}: {
	page: ModulePage;
	demo: boolean;
	onClose: () => void;
}) {
	const tabs = TABS[page];
	const [tabId, setTabId] = useState(tabs[0].id);
	const tab = tabs.find((t) => t.id === tabId) ?? tabs[0];
	const Page = tab.Page;
	return (
		<OverlayFrame
			title={MODULE_LABELS[page]}
			subtitle={`${MODULE_INFO[page].detail} · Esc regresa a la báscula`}
			onClose={onClose}
		>
			{tabs.length > 1 ? (
				<div
					role="tablist"
					aria-label={MODULE_LABELS[page]}
					className="sticky top-0 z-10 flex gap-1 border-border border-b bg-card/95 px-5 pt-3"
				>
					{tabs.map((t) => (
						<button
							key={t.id}
							type="button"
							role="tab"
							aria-selected={t.id === tab.id}
							onClick={() => setTabId(t.id)}
							className={cn(
								"-mb-px rounded-t-md border border-transparent px-4 py-2 font-semibold text-sm transition-colors",
								t.id === tab.id
									? "border-border border-b-card bg-card text-foreground"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{t.label}
						</button>
					))}
				</div>
			) : null}
			<div className="px-5 py-4">
				{demo ? (
					<p className="p-8 text-center text-muted-foreground text-sm">
						Vista previa sin base de datos: aquí se monta la pantalla real de{" "}
						{tab.label}.
					</p>
				) : (
					<Page />
				)}
			</div>
		</OverlayFrame>
	);
}
