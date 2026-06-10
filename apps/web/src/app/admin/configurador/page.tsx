"use client";

import RecipesPage from "../inventory/recipes/page";

// Configurador de Despiece a pantalla completa (se abre en otra ventana).
// Reutiliza el Tablero de Recetas, que guarda en vivo en Supabase.
export default function ConfiguradorPage() {
	return (
		<div className="min-h-screen bg-muted/30 p-3 sm:p-5">
			<RecipesPage configurator />
		</div>
	);
}
