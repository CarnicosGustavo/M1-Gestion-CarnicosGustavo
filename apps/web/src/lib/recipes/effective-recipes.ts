/**
 * Recetas "efectivas" de un despiece.
 *
 * Una VARIANTE (`product_transformations.is_variant = true`, p. ej.
 * JAMON → JAMON C/G) es una presentación alternativa del mismo corte: solo se
 * obtiene con `products.convertToVariant`. Por eso los motores de despiece y
 * de proyección deben ignorarla; si no, al despiezar el padre también se suman
 * piezas a sus variantes.
 */
import { and, eq, inArray, type SQL } from "drizzle-orm";
import type { db } from "@/lib/db";
import { productTransformations } from "@/lib/db/schema";

type Db = typeof db;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

export type RecipeRow = typeof productTransformations.$inferSelect;

/**
 * Condición SQL para quedarse solo con recetas de despiece (sin variantes).
 * Con `includeVariants` devuelve `undefined` (drizzle lo ignora dentro de `and`).
 */
export function despieceRecipeFilter({
	includeVariants = false,
}: {
	includeVariants?: boolean;
} = {}): SQL | undefined {
	return includeVariants
		? undefined
		: eq(productTransformations.is_variant, false);
}

/** Para filtrar en memoria filas que ya traen `is_variant`. */
export function isDespieceRecipe(r: {
	is_variant?: boolean | null;
	isVariant?: boolean | null;
}) {
	return r.is_variant !== true && r.isVariant !== true;
}

/** Una receta por hijo: si hay duplicados gana la de id mayor. */
export function dedupeByChild<
	T extends { id: number; child_product_id: number },
>(rows: T[]) {
	const map = new Map<number, T>();
	for (const r of rows) {
		const prev = map.get(r.child_product_id);
		if (!prev || r.id > prev.id) map.set(r.child_product_id, r);
	}
	return map;
}

/**
 * Combina recetas `BASE` + el estilo elegido: si un hijo está en ambos gana la
 * del estilo. (Misma regla que ya usaban processDisassembly,
 * processDisassemblyPipeline y getTransformations.)
 */
export function buildEffectiveRecipes<
	T extends {
		id: number;
		child_product_id: number;
		transformation_type: string | null;
	},
>(rows: T[], selectedType: string): T[] {
	const base = rows.filter((r) => r.transformation_type === "BASE");
	if (selectedType === "BASE") return Array.from(dedupeByChild(base).values());
	const specific = rows.filter((r) => r.transformation_type === selectedType);
	const baseMap = dedupeByChild(base);
	for (const [k, v] of dedupeByChild(specific)) baseMap.set(k, v);
	return Array.from(baseMap.values());
}

/** Tipos de receta a consultar para un estilo. */
export function recipeTypesFor(
	selectedType: string,
	{ mixBase = true }: { mixBase?: boolean } = {},
) {
	if (selectedType === "BASE") return ["BASE"];
	return mixBase ? ["BASE", selectedType] : [selectedType];
}

/**
 * Recetas activas efectivas de `parentId` para el estilo `selectedType`.
 * - `mixBase=false`: no mezcla BASE (canales específicos).
 * - `includeVariants=false` (default): excluye variantes.
 */
export async function getEffectiveRecipes(
	executor: DbOrTx,
	parentId: number,
	selectedType: string,
	{
		includeVariants = false,
		mixBase = true,
	}: { includeVariants?: boolean; mixBase?: boolean } = {},
): Promise<RecipeRow[]> {
	const rows = await executor
		.select()
		.from(productTransformations)
		.where(
			and(
				eq(productTransformations.parent_product_id, parentId),
				inArray(
					productTransformations.transformation_type,
					recipeTypesFor(selectedType, { mixBase }),
				),
				eq(productTransformations.is_active, true),
				despieceRecipeFilter({ includeVariants }),
			),
		);
	return buildEffectiveRecipes(rows, selectedType);
}
