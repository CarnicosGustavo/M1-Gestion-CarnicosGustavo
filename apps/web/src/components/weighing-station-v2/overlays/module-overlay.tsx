"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
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
const PAGES: Record<ModulePage, ComponentType> = {
	recetas: dynamic(
		() =>
			import("@/app/admin/inventory/recipes/page").then((m) => {
				const Recipes = m.default;
				return function RecetasEmbebidas() {
					return <Recipes />;
				};
			}),
		{ loading: Loading },
	),
	frio: dynamic(() => import("@/app/admin/cold-inventory/page"), {
		loading: Loading,
	}),
	precios: dynamic(() => import("@/app/admin/prices/page"), {
		loading: Loading,
	}),
	clientes: dynamic(() => import("@/app/admin/customers/page"), {
		loading: Loading,
	}),
	cobranza: dynamic(() => import("@/app/admin/collections/page"), {
		loading: Loading,
	}),
};

export const MODULE_LABELS: Record<ModulePage, string> = {
	recetas: "Recetas",
	frio: "Inventario frío",
	precios: "Precios",
	clientes: "Clientes",
	cobranza: "Cobranza",
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
	const Page = PAGES[page];
	return (
		<OverlayFrame
			title={MODULE_LABELS[page]}
			subtitle={`${MODULE_INFO[page].detail} · Esc regresa a la báscula`}
			onClose={onClose}
		>
			<div className="px-5 py-4">
				{demo ? (
					<p className="p-8 text-center text-muted-foreground text-sm">
						Vista previa sin base de datos: aquí se monta la pantalla real de{" "}
						{MODULE_LABELS[page]}.
					</p>
				) : (
					<Page />
				)}
			</div>
		</OverlayFrame>
	);
}
