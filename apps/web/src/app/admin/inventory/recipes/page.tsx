"use client";

import { Badge } from "@finopenpos/ui/components/badge";
import { Button } from "@finopenpos/ui/components/button";
import { Card, CardContent, CardHeader } from "@finopenpos/ui/components/card";
import {
	type Column,
	DataTable,
	TableActionButton,
	TableActions,
} from "@finopenpos/ui/components/data-table";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@finopenpos/ui/components/dialog";
import { Input } from "@finopenpos/ui/components/input";
import { Label } from "@finopenpos/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@finopenpos/ui/components/select";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import { cn } from "@finopenpos/ui/lib/utils";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	BookOpenIcon,
	CheckCircleIcon,
	FilePenIcon,
	InfoIcon,
	MaximizeIcon,
	PlusCircle,
	UploadIcon,
	XCircleIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod/v4";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/router";
import { formatCurrency } from "@/lib/utils";

type Recipe = RouterOutputs["inventory"]["recipesList"][number];
type Product = RouterOutputs["products"]["list"][number];

export default function RecipesPage({
	configurator = false,
}: {
	configurator?: boolean;
} = {}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const tc = useTranslations("common");
	const locale = useLocale();

	const [viewMode, setViewMode] = useState<"table" | "map" | "board">(
		configurator ? "board" : "table",
	);
	const [showHelp, setShowHelp] = useState(false);
	const [search, setSearch] = useState("");
	const [parentFilter, setParentFilter] = useState("all");
	const [typeFilter, setTypeFilter] = useState<
		| "all"
		| "BASE"
		| "NACIONAL"
		| "AMERICANO"
		| "POLINESIO"
		| "NACIONAL_LOMO"
		| "NACIONAL_ESPILOMO"
	>("all");
	const [statusFilter, setStatusFilter] = useState<"active" | "all">("active");
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [showAdvanced, setShowAdvanced] = useState(false);

	const [mapStyle, setMapStyle] = useState<string>("AMERICANO");

	const listInput = useMemo(() => {
		return {
			parentProductId:
				parentFilter === "all" ? undefined : Number(parentFilter),
			transformationType: typeFilter === "all" ? undefined : typeFilter,
			includeInactive: statusFilter === "all",
		};
	}, [parentFilter, statusFilter, typeFilter]);

	const { data: allProducts = [], isLoading: isLoadingProducts } = useQuery(
		trpc.products.list.queryOptions(),
	);
	const { data: parentProducts = [] } = useQuery(
		trpc.products.list.queryOptions({ isParent: true }),
	);

	const recipesQueryOptions =
		trpc.inventory.recipesList.queryOptions(listInput);
	const {
		data: recipes = [],
		isLoading: isLoadingRecipes,
		error,
	} = useQuery(recipesQueryOptions);

	const { data: mapRecipes = [] } = useQuery(
		trpc.inventory.recipesList.queryOptions({
			includeInactive: false,
		}),
	);

	const filteredRecipes = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return recipes;
		return recipes.filter((r) => {
			return (
				r.parentProduct.name.toLowerCase().includes(q) ||
				r.childProduct.name.toLowerCase().includes(q) ||
				r.transformation_type.toLowerCase().includes(q)
			);
		});
	}, [recipes, search]);

	const duplicateCounts = useMemo(() => {
		const m = new Map<string, number>();
		for (const r of filteredRecipes) {
			const key = `${r.parent_product_id}:${r.child_product_id}:${r.transformation_type}`;
			m.set(key, (m.get(key) ?? 0) + 1);
		}
		return m;
	}, [filteredRecipes]);

	const duplicateGroupsCount = useMemo(() => {
		let n = 0;
		for (const c of duplicateCounts.values()) if (c > 1) n += 1;
		return n;
	}, [duplicateCounts]);

	const isEditing = editingId !== null;

	const normalizeProductName = useCallback((name: string) => {
		return name
			.toLowerCase()
			.replace(/^\s*[a-z]{2}\d+(?:\.\d+)?\s*-\s*/i, "")
			.trim();
	}, []);

	const findBestProductByName = useCallback(
		(inputName: string) => {
			const q = normalizeProductName(inputName);
			if (!q) return null;

			let best: Product | null = null;
			let bestScore = Number.POSITIVE_INFINITY;

			for (const p of allProducts) {
				const n = normalizeProductName(p.name);
				if (!n) continue;

				let score = Number.POSITIVE_INFINITY;
				if (n === q) score = 0;
				else if (n.includes(q)) score = 5 + (n.length - q.length) / 1000;
				else if (q.includes(n)) score = 10 + (q.length - n.length) / 1000;

				if (score < bestScore) {
					best = p;
					bestScore = score;
				}
			}

			return bestScore !== Number.POSITIVE_INFINITY ? best : null;
		},
		[allProducts, normalizeProductName],
	);

	const recipeFormSchema = z.object({
		parentProductId: z.number().int().positive(),
		childProductId: z.number().int().positive(),
		childName: z.string().optional(),
		transformationType: z.string().min(1),
		yieldQuantityPieces: z.number().min(0),
		yieldWeightPercentage: z.number().min(0).max(100),
		isActive: z.boolean().default(true),
	});

	const upsertMutation = useMutation(
		trpc.inventory.recipesUpsert.mutationOptions({
			onSuccess: () => {
				toast.success("Receta guardada");
				queryClient.invalidateQueries({
					queryKey: trpc.inventory.recipesList.queryKey(),
				});
				setIsDialogOpen(false);
			},
			onError: (e) => toast.error(e.message),
		}),
	);

	// Importar el JSON exportado por el Configurador Visual (standalone)
	const importFileRef = useRef<HTMLInputElement>(null);
	const importMutation = useMutation(
		trpc.inventory.recipesImport.mutationOptions({
			onSuccess: (d: any) => {
				toast.success(
					`Recetas configuradas: ${d.total} transformaciones (${d.inserted} nuevas, ${d.updated} actualizadas, ${d.deactivated} desactivadas).`,
				);
				if (d.missing?.length) {
					toast.warning(
						`Productos del archivo no encontrados en el catálogo (omitidos): ${d.missing.join(", ")}`,
						{ duration: 12000 },
					);
				}
				queryClient.invalidateQueries({
					queryKey: trpc.inventory.recipesList.queryKey(),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.products.list.queryKey(),
				});
			},
			onError: (e: any) => toast.error(e.message ?? "Error al importar"),
		}),
	);

	const handleImportFile = async (file: File) => {
		try {
			const data = JSON.parse(await file.text());
			const okShape =
				data &&
				(Array.isArray(data.canales) || Array.isArray(data.ramificaciones));
			if (!okShape) {
				toast.error(
					'El archivo no tiene el formato del configurador (se esperan "canales" y "ramificaciones").',
				);
				return;
			}
			const total =
				(data.canales ?? []).reduce(
					(n: number, c: any) => n + (c.piezas?.length ?? 0),
					0,
				) +
				(data.ramificaciones ?? []).reduce(
					(n: number, b: any) => n + (b.subpiezas?.length ?? 0),
					0,
				);
			if (
				!window.confirm(
					`Importar ${total} transformaciones del configurador?\n\n• Las recetas del archivo se crean o actualizan (match por nombre de producto).\n• Las recetas que NO estén en el archivo quedarán INACTIVAS (recuperables en el filtro "Todas").\n• También se actualizan los pesos de referencia (canal y piezas).`,
				)
			)
				return;
			importMutation.mutate(data);
		} catch {
			toast.error("No se pudo leer el archivo JSON.");
		}
	};

	const setActiveMutation = useMutation(
		trpc.inventory.recipesSetActive.mutationOptions({
			onSuccess: () => {
				toast.success("Actualizado");
				queryClient.invalidateQueries({
					queryKey: trpc.inventory.recipesList.queryKey(),
				});
			},
			onError: (e) => toast.error(e.message),
		}),
	);

	const form = useForm({
		defaultValues: {
			parentProductId: 0,
			childProductId: 0,
			childName: "",
			transformationType: "BASE",
			yieldQuantityPieces: 0,
			yieldWeightPercentage: 0,
			isActive: true,
		},
		validators: {
			onSubmit: ({ value }) => {
				const res = recipeFormSchema.safeParse(value);
				if (!res.success) {
					const issues =
						(res.error as unknown as { issues?: Array<{ message: string }> })
							.issues ??
						(res.error as unknown as { errors?: Array<{ message: string }> })
							.errors ??
						[];
					return issues.map((e) => e.message).join(", ");
				}
				return undefined;
			},
		},
		onSubmit: ({ value }) => {
			const child = allProducts.find((p) => p.id === value.childProductId);
			const proposedChildName = (value.childName ?? "").trim();
			const shouldRenameChild =
				isEditing &&
				!!child &&
				proposedChildName.length > 0 &&
				proposedChildName !== child.name;

			upsertMutation.mutate({
				id: editingId ?? undefined,
				parentProductId: value.parentProductId,
				childProductId: value.childProductId,
				childName: shouldRenameChild ? proposedChildName : undefined,
				yieldQuantityPieces: value.yieldQuantityPieces,
				yieldWeightRatio: value.yieldWeightPercentage / 100, // Convert percentage to ratio
				transformationType: value.transformationType,
				isActive: value.isActive,
			});
		},
	});

	const openCreate = () => {
		setEditingId(null);
		form.reset();
		setShowAdvanced(false);
		setIsDialogOpen(true);
	};

	const openEdit = (r: Recipe) => {
		setEditingId(r.id);
		form.reset();
		form.setFieldValue("parentProductId", r.parent_product_id);
		form.setFieldValue("childProductId", r.child_product_id);
		form.setFieldValue("childName", r.childProduct.name);
		form.setFieldValue("transformationType", r.transformation_type);
		form.setFieldValue("yieldQuantityPieces", Number(r.yield_quantity_pieces));
		form.setFieldValue(
			"yieldWeightPercentage",
			Number(r.yield_weight_ratio) * 100,
		);
		form.setFieldValue("isActive", r.is_active);
		setShowAdvanced(Number(r.yield_weight_ratio) > 0);
		setIsDialogOpen(true);
	};

	// Abre el diálogo de nueva receta con padre + hijo prellenados (drag & drop)
	const openCreateChild = (
		parentId: number,
		transformationType: string | undefined,
		child: { id: number; name: string },
	) => {
		setEditingId(null);
		form.reset();
		form.setFieldValue("parentProductId", parentId);
		form.setFieldValue("childProductId", child.id);
		form.setFieldValue("childName", child.name);
		if (transformationType)
			form.setFieldValue("transformationType", transformationType);
		setShowAdvanced(true);
		setIsDialogOpen(true);
	};

	// Producto arrastrado (chip huérfano) y celda resaltada al arrastrar
	const [draggedChild, setDraggedChild] = useState<{
		id: number;
		name: string;
	} | null>(null);
	const [dropParentId, setDropParentId] = useState<number | null>(null);
	// Hijo resaltado: soltar aquí crea un despiece de 2º nivel (esa pieza es el padre)
	const [dropOntoChildId, setDropOntoChildId] = useState<number | null>(null);

	const clearDrag = useCallback(() => {
		setDraggedChild(null);
		setDropParentId(null);
		setDropOntoChildId(null);
	}, []);

	const productOptions = useMemo(() => {
		return allProducts.slice().sort((a, b) => a.name.localeCompare(b.name));
	}, [allProducts]);

	// IDs de productos que participan en alguna receta (como padre o como hijo)
	const productsWithRecipe = useMemo(() => {
		const s = new Set<number>();
		for (const r of mapRecipes) {
			s.add(r.parent_product_id);
			s.add(r.child_product_id);
		}
		return s;
	}, [mapRecipes]);

	// Productos que NO participan en ninguna receta y NO están clasificados como
	// compra de proveedor ni duplicado (informativo)
	const productsWithoutRecipe = useMemo(
		() =>
			productOptions.filter(
				(p) =>
					!productsWithRecipe.has(p.id) &&
					p.category !== "Compra" &&
					p.category !== "Duplicado",
			),
		[productOptions, productsWithRecipe],
	);

	const classifyOrphanMut = useMutation(
		trpc.products.classifyOrphan.mutationOptions({
			onSuccess: (_d: any, vars: any) => {
				toast.success(
					vars.action === "purchased"
						? "Marcado como compra de proveedor"
						: "Marcado como duplicado",
				);
				queryClient.invalidateQueries({
					queryKey: trpc.products.list.queryKey(),
				});
			},
			onError: (e: any) => toast.error(e.message ?? "Error"),
		}),
	);

	const mapTypes = useMemo(() => {
		const types = new Set<string>();
		for (const r of mapRecipes) types.add(r.transformation_type);
		const arr = Array.from(types).sort((a, b) => a.localeCompare(b));
		return arr.length ? arr : ["BASE", "AMERICANO"];
	}, [mapRecipes]);

	const mapProductById = useMemo(() => {
		const m = new Map<number, Product>();
		for (const p of allProducts) m.set(p.id, p);
		return m;
	}, [allProducts]);

	const mapByParentId = useMemo(() => {
		const byParent = new Map<number, Map<string, Recipe[]>>();
		for (const r of mapRecipes) {
			const byType =
				byParent.get(r.parent_product_id) ?? new Map<string, Recipe[]>();
			byType.set(r.transformation_type, [
				...(byType.get(r.transformation_type) ?? []),
				r,
			]);
			byParent.set(r.parent_product_id, byType);
		}
		return byParent;
	}, [mapRecipes]);

	const canalRootId = useMemo(() => {
		const normalize = (name: string) =>
			name
				.toLowerCase()
				.replace(/^\s*[a-z]{2}\d+\s*-\s*/i, "")
				.trim();
		const candidates = parentProducts.filter((p) =>
			normalize(p.name).includes("canal"),
		);
		if (!candidates.length) return null;
		return candidates.slice().sort((a, b) => {
			const ac = mapByParentId.get(a.id)?.size ?? 0;
			const bc = mapByParentId.get(b.id)?.size ?? 0;
			if (ac !== bc) return bc - ac;
			return a.id - b.id;
		})[0].id;
	}, [mapByParentId, parentProducts]);

	const getAvgKgPerPiece = (p: Product) => {
		const pieces = Number(p.stock_pieces);
		const kg = Number(p.stock_kg);
		if (!Number.isFinite(pieces) || pieces <= 0) return 0;
		if (!Number.isFinite(kg) || kg <= 0) return 0;
		return kg / pieces;
	};

	const renderMapTree = useMemo(() => {
		if (!canalRootId) return null;
		const style = mapStyle;
		const typesToApply = style === "BASE" ? ["BASE"] : ["BASE", style];

		const renderNode = (
			parentId: number,
			depth: number,
			visited: Set<number>,
		) => {
			if (visited.has(parentId)) return null;
			visited.add(parentId);
			const byType = mapByParentId.get(parentId);
			if (!byType) return null;

			const aggregated = new Map<
				number,
				{ childId: number; name: string; pieces: number }
			>();
			for (const t of typesToApply) {
				for (const r of byType.get(t) ?? []) {
					const childId = r.child_product_id;
					const childName = r.childProduct?.name ?? `#${childId}`;
					const pieces = Number(r.yield_quantity_pieces);
					const prev = aggregated.get(childId);
					aggregated.set(childId, {
						childId,
						name: childName,
						pieces:
							(prev?.pieces ?? 0) + (Number.isFinite(pieces) ? pieces : 0),
					});
				}
			}

			const children = Array.from(aggregated.values()).sort((a, b) =>
				a.name.localeCompare(b.name),
			);
			if (!children.length) return null;

			return (
				<div className={depth === 0 ? "" : "ml-4 border-l pl-4"}>
					{children.map((c) => {
						const childProduct = mapProductById.get(c.childId);
						const isParent = childProduct?.is_parent_product === true;
						const avgKg = childProduct ? getAvgKgPerPiece(childProduct) : 0;
						return (
							<div key={`${parentId}-${c.childId}`} className="py-1">
								<div className="flex items-center justify-between gap-3">
									<div className="min-w-0 truncate font-medium">{c.name}</div>
									<div className="shrink-0 text-muted-foreground text-xs">
										{c.pieces.toFixed(3)} pzas
										{avgKg > 0 ? ` | ~${avgKg.toFixed(3)} kg/pza` : ""}
									</div>
								</div>
								{isParent
									? renderNode(c.childId, depth + 1, new Set(visited))
									: null}
							</div>
						);
					})}
				</div>
			);
		};

		const rootName = mapProductById.get(canalRootId)?.name ?? "CANAL";
		return (
			<div className="space-y-3">
				<div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
					<span className="font-semibold">Raíz:</span> {rootName} |{" "}
					<span className="font-semibold">Estilo:</span> {style} (BASE + estilo)
				</div>
				{renderNode(canalRootId, 0, new Set()) ?? (
					<div className="text-muted-foreground text-sm">
						No hay recetas para este estilo desde CANAL.
					</div>
				)}
			</div>
		);
	}, [canalRootId, mapByParentId, mapProductById, mapStyle]);

	// --- CONFIGURADOR (TABLERO) ---
	// Edición inline: captura en KG y el % se deriva del peso de referencia.
	const quickUpdateMut = useMutation(
		trpc.inventory.recipesQuickUpdate.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries({
					queryKey: trpc.inventory.recipesList.queryKey(),
				}),
			onError: (e: any) => toast.error(e.message ?? "Error"),
		}),
	);
	const refWeightMut = useMutation(
		trpc.inventory.setRefWeight.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.inventory.recipesList.queryKey(),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.products.list.queryKey(),
				});
			},
			onError: (e: any) => toast.error(e.message ?? "Error"),
		}),
	);
	const [boardExpanded, setBoardExpanded] = useState<Record<string, boolean>>(
		{},
	);

	// 1er nivel: tarjeta por estilo de canal (sus piezas directas)
	const boardStyles = useMemo(() => {
		const byType = new Map<string, Recipe[]>();
		for (const r of mapRecipes) {
			if (r.transformation_type === "BASE") continue;
			const arr = byType.get(r.transformation_type) ?? [];
			arr.push(r);
			byType.set(r.transformation_type, arr);
		}
		return [...byType.entries()]
			.map(([type, rows]) => ({
				type,
				parentId: rows[0]?.parent_product_id ?? 0,
				parent: rows[0]?.parentProduct?.name ?? "",
				canalW: Number(rows[0]?.parentProduct?.avg_weight ?? 0) || 0,
				rows: rows
					.slice()
					.sort((a, b) =>
						a.childProduct.name.localeCompare(b.childProduct.name),
					),
			}))
			.sort((a, b) => a.type.localeCompare(b.type));
	}, [mapRecipes]);

	// BASE agrupado por id de pieza padre (para ramificar inline)
	const baseByParentId = useMemo(() => {
		const m = new Map<number, Recipe[]>();
		for (const r of mapRecipes) {
			if (r.transformation_type !== "BASE") continue;
			const arr = m.get(r.parent_product_id) ?? [];
			arr.push(r);
			m.set(r.parent_product_id, arr);
		}
		for (const arr of m.values())
			arr.sort((a, b) =>
				a.childProduct.name.localeCompare(b.childProduct.name),
			);
		return m;
	}, [mapRecipes]);

	// Σ de % (solo despiece; las variantes no suman) + merma
	const SumBadge = ({ rows, refW }: { rows: Recipe[]; refW: number }) => {
		const sumPct =
			rows
				.filter((r) => !r.is_variant)
				.reduce((s, r) => s + Number(r.yield_weight_ratio), 0) * 100;
		const kgSum = refW > 0 ? (sumPct / 100) * refW : 0;
		const over = sumPct > 100.5;
		const merma = Math.max(0, 100 - sumPct);
		return (
			<div
				className={cn(
					"mt-1.5 flex flex-wrap items-center gap-2 rounded-md px-2 py-1 font-semibold text-[11px]",
					over ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700",
				)}
			>
				<span>Σ {sumPct.toFixed(1)}%</span>
				{refW > 0 && (
					<span className="font-normal">
						{kgSum.toFixed(2)} / {refW.toFixed(2)} kg
					</span>
				)}
				<span className="font-normal">
					{over ? "⚠ excede el peso" : `merma ${merma.toFixed(1)}%`}
				</span>
			</div>
		);
	};

	// Peso de referencia editable de un producto ("pesa X kg")
	const RefWeightControl = ({
		productId,
		kg,
		label,
	}: {
		productId: number;
		kg: number;
		label: string;
	}) => (
		<label className="flex items-center gap-1 text-[11px] text-muted-foreground">
			{label}
			<Input
				key={`${productId}:${kg}`}
				type="number"
				step="0.01"
				defaultValue={kg > 0 ? String(Math.round(kg * 100) / 100) : ""}
				placeholder="0"
				className="h-6 w-16 px-1 text-center text-[11px]"
				onBlur={(e) => {
					const n = Number.parseFloat(e.target.value) || 0;
					if (Math.abs(n - kg) > 0.004)
						refWeightMut.mutate({ productId, kg: n });
				}}
				onKeyDown={(e) =>
					e.key === "Enter" && (e.target as HTMLInputElement).blur()
				}
			/>
			kg
		</label>
	);

	// Renglón editable de una receta (nivel 1 o ramificación)
	const recipeRow = (r: Recipe, refW: number, ancestors: number[]) => {
		const ratio = Number(r.yield_weight_ratio);
		const pieces = Number(r.yield_quantity_pieces);
		const kg = refW > 0 ? ratio * refW : 0;
		const pct = ratio * 100;
		const kids = baseByParentId.get(r.child_product_id) ?? [];
		const canExpand =
			kids.length > 0 && !ancestors.includes(r.child_product_id);
		const ekey = `b${r.id}`;
		const expanded = !!boardExpanded[ekey] && canExpand;
		return (
			<div key={r.id}>
				<div
					className={cn(
						"flex items-center gap-1.5 rounded-md px-1 py-1",
						r.is_variant && "bg-amber-50/60",
					)}
				>
					<button
						type="button"
						disabled={!canExpand}
						onClick={() =>
							setBoardExpanded((s) => ({ ...s, [ekey]: !s[ekey] }))
						}
						className={cn(
							"flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs",
							canExpand
								? "text-foreground hover:bg-muted"
								: "text-muted-foreground/30",
						)}
						title={canExpand ? "Ver/editar su despiece" : undefined}
					>
						{expanded ? "▾" : "▸"}
					</button>
					<button
						type="button"
						onClick={() => openEdit(r)}
						className="min-w-0 flex-1 truncate text-left font-medium text-sm hover:underline"
						title="Editar receta a detalle"
					>
						{r.childProduct.name}
						{kids.length > 0 && (
							<span className="ml-1 text-[10px] text-blue-600">
								⑂{kids.length}
							</span>
						)}
					</button>
					<button
						type="button"
						onClick={() =>
							quickUpdateMut.mutate({ id: r.id, isVariant: !r.is_variant })
						}
						className={cn(
							"shrink-0 rounded px-1.5 py-0.5 font-bold text-[10px]",
							r.is_variant
								? "bg-amber-100 text-amber-800"
								: "bg-muted text-muted-foreground hover:bg-muted/80",
						)}
						title="Despiece: suma al peso del padre · Variante: alternativa, no suma (ej. JAMON vs JAMON S/H)"
					>
						{r.is_variant ? "Variante" : "Despiece"}
					</button>
					<div className="flex shrink-0 items-center overflow-hidden rounded-md border">
						<button
							type="button"
							className="px-1.5 py-0.5 text-xs hover:bg-muted"
							onClick={() =>
								quickUpdateMut.mutate({
									id: r.id,
									yieldQuantityPieces: Math.max(0, pieces - 1),
								})
							}
						>
							−
						</button>
						<span className="min-w-[1.4rem] text-center font-bold text-xs">
							{pieces}
						</span>
						<button
							type="button"
							className="px-1.5 py-0.5 text-xs hover:bg-muted"
							onClick={() =>
								quickUpdateMut.mutate({
									id: r.id,
									yieldQuantityPieces: pieces + 1,
								})
							}
						>
							+
						</button>
					</div>
					<div className="flex shrink-0 items-center gap-0.5">
						<Input
							key={`${r.id}:${kg.toFixed(2)}`}
							type="number"
							step="0.01"
							defaultValue={kg > 0 ? kg.toFixed(2) : ""}
							placeholder="kg"
							disabled={refW <= 0}
							title={
								refW <= 0
									? "Define primero el peso de referencia del padre"
									: "Peso real de esta pieza; el % se calcula solo"
							}
							className="h-7 w-20 px-1 text-right text-xs"
							onBlur={(e) => {
								const n = Number.parseFloat(e.target.value) || 0;
								if (refW > 0) {
									const nr = n / refW;
									if (Math.abs(nr - ratio) > 0.00005)
										quickUpdateMut.mutate({ id: r.id, yieldWeightRatio: nr });
								}
							}}
							onKeyDown={(e) =>
								e.key === "Enter" && (e.target as HTMLInputElement).blur()
							}
						/>
						<span className="text-[10px] text-muted-foreground">kg</span>
					</div>
					<span
						className={cn(
							"w-14 shrink-0 text-right font-bold text-xs",
							r.is_variant ? "text-amber-700" : "text-blue-600",
						)}
					>
						{pct.toFixed(1)}%
					</span>
				</div>
				{expanded && (
					<div
						className={cn(
							"mt-1 mb-2 ml-5 rounded-lg border border-l-2 border-l-blue-400 bg-muted/20 p-2",
							dropTarget === `branch:${r.id}` && "ring-2 ring-blue-400",
						)}
						onDragOver={(e) => {
							if (draggedChild) {
								e.preventDefault();
								e.stopPropagation();
								setDropTarget(`branch:${r.id}`);
							}
						}}
						onDragLeave={() =>
							setDropTarget((t) => (t === `branch:${r.id}` ? null : t))
						}
						onDrop={(e) => {
							e.preventDefault();
							e.stopPropagation();
							if (draggedChild)
								dropCreate(r.child_product_id, "BASE", draggedChild);
							clearDrag();
							setDropTarget(null);
						}}
					>
						<div className="mb-1 flex flex-wrap items-center justify-between gap-2">
							<span className="font-semibold text-[11px] text-muted-foreground">
								Despiece de {r.childProduct.name}
								{draggedChild && (
									<span className="ml-2 font-normal text-blue-600">
										· suelta aquí para agregar sub-pieza
									</span>
								)}
							</span>
							<RefWeightControl
								productId={r.child_product_id}
								kg={Number(r.childProduct.avg_weight ?? 0) || 0}
								label="pesa"
							/>
						</div>
						{kids.map((k) =>
							recipeRow(k, Number(r.childProduct.avg_weight ?? 0) || 0, [
								...ancestors,
								r.child_product_id,
							]),
						)}
						<SumBadge
							rows={kids}
							refW={Number(r.childProduct.avg_weight ?? 0) || 0}
						/>
					</div>
				)}
			</div>
		);
	};

	// --- Paleta + drag & drop + acentos + modo enfoque ---
	const STYLE_ACCENTS: Record<string, string> = {
		AMERICANO: "#e11d48",
		NACIONAL_LOMO: "#16a34a",
		NACIONAL_ESPILOMO: "#0d9488",
		POLINESIO: "#ea580c",
	};
	const accentFor = (t: string) => STYLE_ACCENTS[t] ?? "#2563eb";
	const CAT_COLORS: Record<string, string> = {
		Canales: "#e11d48",
		Lomos: "#dc2626",
		Jamones: "#d97706",
		Cueros: "#ea580c",
		Pulpas: "#db2777",
		Visceras: "#9333ea",
		Huesos: "#78716c",
		Otros: "#0d9488",
		General: "#64748b",
		Compra: "#16a34a",
		Duplicado: "#9ca3af",
	};
	const PALETTE_ORDER = [
		"Canales",
		"Lomos",
		"Jamones",
		"Cueros",
		"Pulpas",
		"Visceras",
		"Huesos",
		"Otros",
		"General",
		"Compra",
		"Duplicado",
	];

	const [paletteQuery, setPaletteQuery] = useState("");
	const [focusedType, setFocusedType] = useState<string | null>(null);
	const [dropTarget, setDropTarget] = useState<string | null>(null);

	// Uso por producto: en qué estilos sale (1er nivel) y de qué piezas (BASE)
	const styleUseByChild = useMemo(() => {
		const m = new Map<number, { type: string }[]>();
		for (const r of mapRecipes) {
			if (r.transformation_type === "BASE") continue;
			const arr = m.get(r.child_product_id) ?? [];
			if (!arr.some((x) => x.type === r.transformation_type))
				arr.push({ type: r.transformation_type });
			m.set(r.child_product_id, arr);
		}
		return m;
	}, [mapRecipes]);
	const parentUseByChild = useMemo(() => {
		const m = new Map<number, string[]>();
		for (const r of mapRecipes) {
			if (r.transformation_type !== "BASE") continue;
			const arr = m.get(r.child_product_id) ?? [];
			if (!arr.includes(r.parentProduct.name)) arr.push(r.parentProduct.name);
			m.set(r.child_product_id, arr);
		}
		return m;
	}, [mapRecipes]);

	const paletteGroups = useMemo(() => {
		const q = paletteQuery.trim().toLowerCase();
		const g = new Map<string, Product[]>();
		for (const p of productOptions) {
			if (q && !p.name.toLowerCase().includes(q)) continue;
			const cat =
				p.category && PALETTE_ORDER.includes(p.category) ? p.category : "Otros";
			const arr = g.get(cat) ?? [];
			arr.push(p);
			g.set(cat, arr);
		}
		return g;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [productOptions, paletteQuery]);

	// Crear receta al soltar un producto (en estilo o en ramificación)
	const dropCreate = (
		parentProductId: number,
		transformationType: string,
		child: { id: number; name: string },
	) => {
		if (child.id === parentProductId) return;
		upsertMutation.mutate({
			parentProductId,
			childProductId: child.id,
			yieldQuantityPieces: 1,
			yieldWeightRatio: 0,
			transformationType,
			isActive: true,
		});
	};

	const PaletteChip = ({ p }: { p: Product }) => {
		const styles = styleUseByChild.get(p.id) ?? [];
		const parents = parentUseByChild.get(p.id) ?? [];
		const isSupplier = p.category === "Compra";
		const orphan = !isSupplier && styles.length === 0 && parents.length === 0;
		return (
			<div
				draggable
				onDragStart={(e) => {
					setDraggedChild({ id: p.id, name: p.name });
					e.dataTransfer.effectAllowed = "copy";
				}}
				onDragEnd={clearDrag}
				className="cursor-grab rounded-lg border bg-background px-2 py-1.5 hover:border-foreground/30 active:cursor-grabbing"
				title="Arrastra a un estilo o a una ramificación"
			>
				<div className="flex items-center gap-1.5">
					<span
						className="h-2 w-2 shrink-0 rounded-full"
						style={{
							background: CAT_COLORS[p.category ?? "Otros"] ?? "#64748b",
						}}
					/>
					<span className="min-w-0 flex-1 truncate font-semibold text-xs">
						{p.name}
					</span>
					{p.avg_weight_per_piece_kg != null &&
						Number(p.avg_weight_per_piece_kg) > 0 && (
							<span className="shrink-0 text-[9px] text-muted-foreground">
								{Number(p.avg_weight_per_piece_kg)}kg
							</span>
						)}
				</div>
				{(styles.length > 0 || parents.length > 0 || orphan || isSupplier) && (
					<div className="mt-0.5 flex flex-wrap gap-0.5">
						{styles.map((s) => (
							<span
								key={s.type}
								className="rounded border px-1 font-bold text-[8px] leading-3"
								style={{
									color: accentFor(s.type),
									borderColor: accentFor(s.type),
								}}
							>
								{s.type.replace("NACIONAL_", "N·")}
							</span>
						))}
						{parents.map((n) => (
							<span
								key={n}
								className="rounded bg-muted px-1 font-semibold text-[8px] text-muted-foreground leading-3"
							>
								⑂ {n}
							</span>
						))}
						{isSupplier && (
							<span className="rounded bg-green-50 px-1 font-bold text-[8px] text-green-700 leading-3">
								proveedor
							</span>
						)}
						{orphan && (
							<span className="rounded bg-amber-50 px-1 font-bold text-[8px] text-amber-700 leading-3">
								sin ubicar
							</span>
						)}
					</div>
				)}
			</div>
		);
	};

	const styleCard = (s: (typeof boardStyles)[number], focus: boolean) => {
		const accent = accentFor(s.type);
		const dkey = `style:${s.type}`;
		return (
			<div
				key={s.type}
				className={cn(
					"overflow-hidden rounded-xl border bg-card",
					dropTarget === dkey && "ring-2 ring-offset-1",
				)}
				style={
					dropTarget === dkey
						? ({ ["--tw-ring-color" as any]: accent } as any)
						: undefined
				}
				onDragOver={(e) => {
					if (draggedChild) {
						e.preventDefault();
						setDropTarget(dkey);
					}
				}}
				onDragLeave={() => setDropTarget((t) => (t === dkey ? null : t))}
				onDrop={(e) => {
					e.preventDefault();
					if (draggedChild) dropCreate(s.parentId, s.type, draggedChild);
					clearDrag();
					setDropTarget(null);
				}}
			>
				<div className="h-1 w-full" style={{ background: accent }} />
				<div className="p-3">
					<div className="mb-2 flex flex-wrap items-center justify-between gap-2">
						<div className="flex min-w-0 items-center gap-2">
							<div className="min-w-0">
								<div className="truncate font-bold">{s.parent || s.type}</div>
								<span
									className="rounded border px-1 font-bold text-[9px] uppercase tracking-wide"
									style={{ color: accent, borderColor: accent }}
								>
									{s.type}
								</span>
								<span className="ml-1 text-[10px] text-muted-foreground">
									{s.rows.length} piezas
								</span>
							</div>
						</div>
						<div className="flex items-center gap-2">
							<RefWeightControl
								productId={s.parentId}
								kg={s.canalW}
								label="Peso del canal"
							/>
							<Button
								variant="outline"
								size="sm"
								className="h-7 px-2 text-xs"
								onClick={() =>
									openCreateChild(s.parentId, s.type, { id: 0, name: "" })
								}
							>
								<PlusCircle className="mr-1 h-3.5 w-3.5" />
								Pieza
							</Button>
							<button
								type="button"
								className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
								title={
									focus ? "Volver al tablero" : "Editar a detalle (enfoque)"
								}
								onClick={() => setFocusedType(focus ? null : s.type)}
							>
								{focus ? "✕" : "⤢"}
							</button>
						</div>
					</div>
					<div className="divide-y">
						{s.rows.map((r) => recipeRow(r, s.canalW, [s.parentId]))}
					</div>
					{draggedChild && (
						<div
							className="mt-1 rounded-md border-2 border-dashed px-2 py-1.5 text-center font-semibold text-[11px] text-muted-foreground"
							style={{ borderColor: accent }}
						>
							Suelta aquí para agregar {draggedChild.name} a {s.type}
						</div>
					)}
					<SumBadge rows={s.rows} refW={s.canalW} />
				</div>
			</div>
		);
	};

	const renderBoard = () => {
		const focused = focusedType
			? boardStyles.find((s) => s.type === focusedType)
			: null;
		return (
			<div className="flex gap-4">
				{/* Paleta de productos */}
				<aside className="hidden w-60 shrink-0 lg:block">
					<div className="sticky top-16 rounded-xl border bg-card">
						<div className="border-b p-2.5">
							<div className="font-bold text-sm">Productos</div>
							<p className="text-[10px] text-muted-foreground">
								Arrastra a un estilo o a una ramificación abierta.
							</p>
							<Input
								value={paletteQuery}
								onChange={(e) => setPaletteQuery(e.target.value)}
								placeholder="Buscar pieza…"
								className="mt-1.5 h-7 text-xs"
							/>
						</div>
						<div className="max-h-[70vh] space-y-2 overflow-y-auto p-2">
							{PALETTE_ORDER.map((cat) => {
								const items = paletteGroups.get(cat);
								if (!items || items.length === 0) return null;
								return (
									<div key={cat}>
										<div className="mb-1 flex items-center gap-1.5 px-0.5">
											<span
												className="h-2 w-2 rounded-full"
												style={{ background: CAT_COLORS[cat] }}
											/>
											<span className="font-bold text-[10px] text-muted-foreground uppercase tracking-wide">
												{cat}
											</span>
											<span className="text-[10px] text-muted-foreground/60">
												{items.length}
											</span>
										</div>
										<div className="space-y-1">
											{items.map((p) => (
												<PaletteChip key={p.id} p={p} />
											))}
										</div>
									</div>
								);
							})}
						</div>
					</div>
				</aside>

				{/* Tablero / enfoque */}
				<div className="min-w-0 flex-1 space-y-3">
					{focused ? (
						<>
							<div className="flex flex-wrap gap-1.5">
								{boardStyles.map((s) => (
									<button
										key={s.type}
										type="button"
										onClick={() => setFocusedType(s.type)}
										className={cn(
											"flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold text-xs",
											s.type === focusedType
												? "bg-foreground text-background"
												: "text-muted-foreground hover:bg-muted",
										)}
									>
										<span
											className="h-2 w-2 rounded-full"
											style={{ background: accentFor(s.type) }}
										/>
										{s.type}
										<span className="text-[9px] opacity-60">
											{s.rows.length}
										</span>
									</button>
								))}
							</div>
							{styleCard(focused, true)}
						</>
					) : (
						<div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
							{boardStyles.map((s) => styleCard(s, false))}
						</div>
					)}
					<p className="text-[11px] text-muted-foreground">
						Escribe los <b>kg</b> reales y el % se calcula respecto al peso del
						padre. <b>Despiece</b> suma; <b>Variante</b> es alternativa (no
						suma). ▸ ramifica una pieza; arrastra productos desde la paleta; ⤢
						edita un estilo en pantalla completa.
					</p>
				</div>
			</div>
		);
	};

	const columns: Column<Recipe>[] = [
		{
			key: "parent",
			header: "Padre",
			sortable: true,
			accessorFn: (r) => r.parentProduct.name,
			render: (r) => (
				<div
					onDragOver={(e) => {
						if (draggedChild) {
							e.preventDefault();
							setDropParentId(r.parent_product_id);
						}
					}}
					onDragLeave={() => setDropParentId(null)}
					onDrop={(e) => {
						e.preventDefault();
						if (draggedChild && draggedChild.id !== r.parent_product_id) {
							openCreateChild(
								r.parent_product_id,
								r.transformation_type,
								draggedChild,
							);
						}
						clearDrag();
					}}
					className={cn(
						"-mx-2 -my-1 rounded px-2 py-1 transition-colors",
						draggedChild && "ring-1 ring-amber-300 ring-dashed",
						dropParentId === r.parent_product_id &&
							"bg-amber-100 ring-amber-500",
					)}
					title={
						draggedChild
							? `Soltar para hacer ${draggedChild.name} hijo de ${r.parentProduct.name}`
							: undefined
					}
				>
					{r.parentProduct.name}
				</div>
			),
		},
		{
			key: "child",
			header: "Hijo",
			sortable: true,
			accessorFn: (r) => r.childProduct.name,
			className: "font-medium",
			render: (r) => {
				const key = `${r.parent_product_id}:${r.child_product_id}:${r.transformation_type}`;
				const dup = duplicateCounts.get(key) ?? 0;
				return (
					<div
						onDragOver={(e) => {
							if (draggedChild && draggedChild.id !== r.child_product_id) {
								e.preventDefault();
								setDropOntoChildId(r.child_product_id);
							}
						}}
						onDragLeave={() => setDropOntoChildId(null)}
						onDrop={(e) => {
							e.preventDefault();
							if (draggedChild && draggedChild.id !== r.child_product_id) {
								// Soltar sobre el hijo = despiece de 2º nivel:
								// esta pieza (el hijo de la fila) pasa a ser el PADRE
								// y el arrastrado su sub-pieza (receta BASE).
								openCreateChild(r.child_product_id, "BASE", draggedChild);
							}
							clearDrag();
						}}
						className={cn(
							"-mx-2 -my-1 flex items-center gap-2 rounded px-2 py-1 transition-colors",
							draggedChild &&
								draggedChild.id !== r.child_product_id &&
								"ring-1 ring-dashed ring-sky-300",
							dropOntoChildId === r.child_product_id &&
								"bg-sky-100 ring-sky-500",
						)}
						title={
							draggedChild
								? `Soltar para que ${draggedChild.name} salga del despiece de ${r.childProduct.name} (2º nivel, BASE)`
								: undefined
						}
					>
						<span className="truncate">{r.childProduct.name}</span>
						{dup > 1 ? (
							<Badge
								variant="outline"
								className="border-amber-300 bg-amber-50 text-amber-900"
							>
								DUP x{dup}
							</Badge>
						) : null}
					</div>
				);
			},
		},
		{
			key: "type",
			header: "Estilo",
			sortable: true,
			accessorFn: (r) => r.transformation_type,
		},
		{
			key: "pieces",
			header: "Piezas",
			sortable: true,
			accessorFn: (r) => Number(r.yield_quantity_pieces),
		},
		{
			key: "rendimiento",
			header: "% peso est.",
			sortable: true,
			accessorFn: (r) => Number(r.yield_weight_ratio) * 100,
			render: (r) => {
				const percentage = (Number(r.yield_weight_ratio) * 100).toFixed(1);
				return <span className="font-medium text-blue-600">{percentage}%</span>;
			},
		},
		{
			key: "suggested_price",
			header: "Precio Sug.",
			render: (r) => {
				const ratio = Number(r.yield_weight_ratio);
				if (ratio <= 0) return <span className="text-muted-foreground">-</span>;

				// Buscar el precio del padre
				const parent = allProducts.find((p) => p.id === r.parent_product_id);
				if (!parent || !parent.price_per_kg)
					return <span className="text-muted-foreground">-</span>;

				const parentPrice = Number(parent.price_per_kg);
				// El precio sugerido es el costo del padre distribuido por rendimiento
				// Nota: Esta es una estimación simple. En la realidad el precio sugerido
				// suele ser mayor para compensar mermas.
				const suggested = parentPrice / ratio;
				return (
					<div className="flex flex-col">
						<span className="font-bold text-green-700 text-xs">
							{formatCurrency(suggested * 100, locale)}
						</span>
						<span className="text-[9px] text-muted-foreground leading-none">
							Est. base rendimiento
						</span>
					</div>
				);
			},
		},
		{
			key: "active",
			header: "Activa",
			accessorFn: (r) => (r.is_active ? "Sí" : "No"),
			render: (r) => (
				<div className="flex items-center gap-2">
					{r.is_active ? (
						<CheckCircleIcon className="h-4 w-4 text-green-600" />
					) : (
						<XCircleIcon className="h-4 w-4 text-red-600" />
					)}
					<span className="text-sm">{r.is_active ? "Sí" : "No"}</span>
				</div>
			),
		},
		{
			key: "actions",
			header: tc("actions"),
			headerClassName: "w-[140px]",
			render: (row) => (
				<TableActions>
					<TableActionButton
						onClick={() => openEdit(row)}
						icon={<FilePenIcon className="h-4 w-4" />}
						label={tc("edit")}
					/>
					<TableActionButton
						variant={row.is_active ? "danger" : "default"}
						onClick={() =>
							setActiveMutation.mutate({ id: row.id, isActive: !row.is_active })
						}
						icon={
							row.is_active ? (
								<XCircleIcon className="h-4 w-4" />
							) : (
								<CheckCircleIcon className="h-4 w-4" />
							)
						}
						label={row.is_active ? "Desactivar" : "Activar"}
					/>
				</TableActions>
			),
		},
	];

	if (isLoadingProducts || isLoadingRecipes) {
		return (
			<Card className="flex flex-col gap-6 p-6">
				<CardHeader className="p-0">
					<div className="flex items-center justify-between">
						<Skeleton className="h-5 w-32" />
						<Skeleton className="h-9 w-28" />
					</div>
				</CardHeader>
				<CardContent className="space-y-3 p-0">
					{Array.from({ length: 6 }).map((_, i) => (
						<div key={i} className="flex items-center justify-between">
							<Skeleton className="h-4 w-40" />
							<Skeleton className="h-8 w-24" />
						</div>
					))}
				</CardContent>
			</Card>
		);
	}

	if (error) {
		return (
			<Card>
				<CardContent className="p-6">
					<p className="text-red-500">{error.message}</p>
				</CardContent>
			</Card>
		);
	}

	const saving =
		quickUpdateMut.isPending ||
		refWeightMut.isPending ||
		upsertMutation.isPending ||
		setActiveMutation.isPending;

	return (
		<Card className="flex flex-col gap-4 p-3 sm:gap-6 sm:p-6">
			<CardHeader className="p-0">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex items-center gap-2 text-muted-foreground">
						<BookOpenIcon className="h-5 w-5" />
						{configurator ? (
							<span className="font-bold text-base text-foreground">
								Configurador de Despiece
							</span>
						) : null}
						<span className="text-sm">{filteredRecipes.length} recetas</span>
						{duplicateGroupsCount > 0 ? (
							<span className="text-amber-700 text-xs">
								{duplicateGroupsCount} grupo(s) duplicado(s)
							</span>
						) : null}
						{/* Indicador de autoguardado en vivo */}
						<span
							className={cn(
								"flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-[11px]",
								saving
									? "bg-amber-50 text-amber-700"
									: "bg-green-50 text-green-700",
							)}
							title="Los cambios se guardan solos en la base de datos"
						>
							<span
								className={cn(
									"h-1.5 w-1.5 rounded-full",
									saving ? "bg-amber-500" : "bg-green-500",
								)}
							/>
							{saving ? "Guardando…" : "Guardado"}
						</span>
						<button
							type="button"
							onClick={() => setShowHelp((v) => !v)}
							className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
							title="Qué es una receta y por qué es el núcleo del sistema"
						>
							<InfoIcon className="h-3.5 w-3.5" />
							{showHelp ? "Ocultar ayuda" : "¿Qué es esto?"}
						</button>
					</div>
					<div className="flex items-center gap-2">
						{!configurator && (
							<>
								<div className="inline-flex overflow-hidden rounded-lg border">
									{(["table", "board", "map"] as const).map((v) => (
										<button
											key={v}
											type="button"
											onClick={() => setViewMode(v)}
											className={cn(
												"px-3 py-1.5 font-semibold text-xs transition-colors",
												viewMode === v
													? "bg-primary text-primary-foreground"
													: "bg-background text-muted-foreground hover:bg-muted",
											)}
										>
											{v === "table"
												? "Tabla"
												: v === "board"
													? "Tablero"
													: "Mapa"}
										</button>
									))}
								</div>
								<Button
									size="sm"
									variant="outline"
									onClick={() =>
										window.open("/admin/configurador", "_blank", "noopener")
									}
									title="Abre el configurador a pantalla completa en otra ventana"
								>
									<MaximizeIcon className="mr-2 h-4 w-4" />
									Configurador
								</Button>
							</>
						)}
						<Button
							size="sm"
							variant="outline"
							disabled={importMutation.isPending}
							onClick={() => importFileRef.current?.click()}
							title="Importa el JSON exportado por el Configurador Visual de Despiece"
						>
							<UploadIcon className="mr-2 h-4 w-4" />
							{importMutation.isPending ? "Importando…" : "Importar"}
						</Button>
						<input
							ref={importFileRef}
							type="file"
							accept=".json,application/json"
							className="hidden"
							onChange={(e) => {
								const f = e.target.files?.[0];
								if (f) handleImportFile(f);
								e.target.value = "";
							}}
						/>
						<Button size="sm" onClick={openCreate}>
							<PlusCircle className="mr-2 h-4 w-4" />
							Nueva receta
						</Button>
					</div>
				</div>
			</CardHeader>

			{showHelp && (
				<CardContent className="pt-0">
					<div className="overflow-hidden rounded-xl border bg-gradient-to-br from-primary/5 to-transparent">
						<div className="border-b bg-muted/40 px-4 py-3">
							<h3 className="flex items-center gap-2 font-bold text-sm">
								<BookOpenIcon className="h-4 w-4 text-primary" />
								Las recetas son el corazón del sistema
							</h3>
							<p className="mt-1 text-muted-foreground text-xs leading-relaxed">
								Una <strong>receta</strong> define cómo se{" "}
								<strong>despieza un canal</strong> (medio cerdo) en sus piezas y{" "}
								<strong>qué porcentaje del peso</strong> es cada una. Es el dato
								medular: a partir de aquí el sistema calcula todo lo demás. Si la
								receta está bien configurada, el resto funciona solo.
							</p>
						</div>

						{/* Flujo: de la receta sale todo */}
						<div className="grid gap-3 p-4 md:grid-cols-[auto_1fr] md:items-center">
							<div className="flex items-center justify-center gap-1 rounded-lg border bg-background px-3 py-2 text-center">
								<div>
									<div className="font-bold text-sm">🐷 CANAL</div>
									<div className="text-[11px] text-muted-foreground">
										se despieza en piezas
										<br />
										con su % de peso
									</div>
								</div>
								<span className="px-2 text-2xl text-muted-foreground">→</span>
							</div>
							<div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
								{[
									{
										icon: "✂️",
										t: "Despiece",
										d: "Guía el corte: qué piezas y cuántas salen de cada canal.",
									},
									{
										icon: "📦",
										t: "Proyección de pedidos",
										d: "Estima piezas y kg disponibles según lo que vas a despiezar.",
									},
									{
										icon: "📊",
										t: "Rendimiento",
										d: "Compara el % estimado contra el peso real pesado del día.",
									},
									{
										icon: "💲",
										t: "Precio sugerido",
										d: "Base para calcular el costo y precio de cada pieza.",
									},
								].map((x) => (
									<div
										key={x.t}
										className="rounded-lg border bg-background p-2.5"
									>
										<div className="text-base">{x.icon}</div>
										<div className="mt-0.5 font-semibold text-xs">{x.t}</div>
										<div className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
											{x.d}
										</div>
									</div>
								))}
							</div>
						</div>

						{/* Las 3 vistas son la misma información */}
						<div className="border-t bg-muted/30 px-4 py-3">
							<p className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wide">
								Tres formas de ver la misma información
							</p>
							<div className="mt-1.5 grid gap-2 text-xs sm:grid-cols-3">
								<div>
									<span className="font-semibold">📋 Tabla</span> — lista
									editable, fila por fila. Buena para revisar y filtrar.
								</div>
								<div>
									<span className="font-semibold">🗂️ Tablero / Configurador</span>{" "}
									— visual, capturas en kg y arrastras piezas. La forma más
									intuitiva.
								</div>
								<div>
									<span className="font-semibold">🌳 Mapa</span> — árbol de
									despiece (padre → hijos) para ver la jerarquía completa.
								</div>
							</div>
							<p className="mt-2 text-[11px] text-muted-foreground">
								Las tres leen y guardan en la <strong>misma tabla</strong> de
								recetas: lo que cambias en una se refleja en las otras al
								instante.
							</p>
						</div>
					</div>
				</CardContent>
			)}

			<CardContent className="p-0">
				{viewMode === "board" ? (
					<p className="text-muted-foreground text-sm">
						Tablero de recetas: cada tarjeta es un estilo de canal (1er nivel) o
						una pieza con sub-despiece (2º nivel). El % es la parte del peso del
						padre; Σ es la suma. Toca una pieza para editar su receta.
					</p>
				) : viewMode === "map" ? (
					<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
						<div className="space-y-1">
							<Label>Estilo (Mapa)</Label>
							<Select value={mapStyle} onValueChange={setMapStyle}>
								<SelectTrigger>
									<SelectValue placeholder="Selecciona" />
								</SelectTrigger>
								<SelectContent>
									{mapTypes.map((t) => (
										<SelectItem key={t} value={t}>
											{t}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="md:col-span-2">
							<div className="text-muted-foreground text-sm">
								Organigrama jerárquico desde CANAL. Suma rendimientos duplicados
								y muestra la receta efectiva (BASE + estilo).
							</div>
						</div>
					</div>
				) : (
					<>
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
							<div className="space-y-1">
								<Label>Buscar</Label>
								<Input
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									placeholder="Buscar padre/hijo…"
								/>
							</div>

							<div className="space-y-1">
								<Label>Padre</Label>
								<Select value={parentFilter} onValueChange={setParentFilter}>
									<SelectTrigger>
										<SelectValue placeholder="Selecciona padre" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">Todos</SelectItem>
										{parentProducts.map((p: Product) => (
											<SelectItem key={p.id} value={String(p.id)}>
												{p.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-1">
								<Label>Estilo</Label>
								<div className="flex flex-wrap gap-2">
									{(
										[
											"all",
											"BASE",
											"AMERICANO",
											"NACIONAL_LOMO",
											"NACIONAL_ESPILOMO",
											"POLINESIO",
										] as const
									).map((v) => (
										<Button
											key={v}
											type="button"
											size="sm"
											variant={typeFilter === v ? "default" : "outline"}
											onClick={() => setTypeFilter(v)}
										>
											{v === "all"
												? "Todos"
												: v.replace("NACIONAL_", "").replace("_", " ")}
										</Button>
									))}
								</div>
							</div>

							<div className="space-y-1">
								<Label>Estado</Label>
								<div className="flex gap-2">
									<Button
										type="button"
										size="sm"
										variant={statusFilter === "active" ? "default" : "outline"}
										onClick={() => setStatusFilter("active")}
									>
										Activas
									</Button>
									<Button
										type="button"
										size="sm"
										variant={statusFilter === "all" ? "default" : "outline"}
										onClick={() => setStatusFilter("all")}
									>
										Todas
									</Button>
								</div>
							</div>
						</div>

						<div className="mt-3 text-muted-foreground text-sm">
							Configura el rendimiento de cada pieza. El sistema estima el peso
							basándose en el porcentaje de rendimiento (%) configurado por
							estilo de canal.
						</div>
					</>
				)}
			</CardContent>

			{/* Banner de huérfanos: redundante con la paleta del Tablero, así que
			    solo se muestra en las vistas Tabla/Mapa. */}
			{viewMode !== "board" && productsWithoutRecipe.length > 0 && (
				<CardContent className="pt-0">
					<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 text-xs">
						<span className="font-bold">
							{productsWithoutRecipe.length} producto(s) sin receta
						</span>{" "}
						(no salen de ningún despiece ni se despiezan). Es normal para piezas
						finales. Arrastra un producto sobre la tabla:{" "}
						<strong>sobre un PADRE</strong> → será hijo de ese padre (mismo
						estilo); <strong>sobre un HIJO</strong> → saldrá del despiece de esa
						pieza (2º nivel, receta BASE).
						<div className="mt-1 flex flex-wrap gap-1">
							{productsWithoutRecipe.map((p) => (
								<span
									key={p.id}
									draggable
									onDragStart={() =>
										setDraggedChild({ id: p.id, name: p.name })
									}
									onDragEnd={clearDrag}
									className="cursor-grab rounded bg-amber-100 px-1.5 py-0.5 font-medium hover:bg-amber-200 active:cursor-grabbing"
									title="Arrástrame sobre un PADRE (será su hijo) o sobre un HIJO (saldrá de su despiece, 2º nivel)"
								>
									{p.name}
								</span>
							))}
						</div>
						{/* Zonas de drop alternativas */}
						<div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
							<div
								onDragOver={(e) => draggedChild && e.preventDefault()}
								onDrop={(e) => {
									e.preventDefault();
									if (draggedChild)
										classifyOrphanMut.mutate({
											productId: draggedChild.id,
											action: "purchased",
										});
									clearDrag();
								}}
								className={cn(
									"rounded-lg border-2 border-dashed p-3 text-center font-semibold text-xs transition-colors",
									draggedChild
										? "border-green-400 bg-green-50 text-green-800"
										: "border-border text-muted-foreground",
								)}
							>
								📦 Producto de proveedor (compra)
								<div className="font-normal">
									Manteca, lomo ahumado, chicharrón…
								</div>
							</div>
							<div
								onDragOver={(e) => draggedChild && e.preventDefault()}
								onDrop={(e) => {
									e.preventDefault();
									if (draggedChild)
										classifyOrphanMut.mutate({
											productId: draggedChild.id,
											action: "duplicate",
										});
									clearDrag();
								}}
								className={cn(
									"rounded-lg border-2 border-dashed p-3 text-center font-semibold text-xs transition-colors",
									draggedChild
										? "border-red-400 bg-red-50 text-red-800"
										: "border-border text-muted-foreground",
								)}
							>
								🗑️ Repetido / duplicado
								<div className="font-normal">
									Ej. Máscara vs Máscara Completa
								</div>
							</div>
						</div>
					</div>
				</CardContent>
			)}

			<CardContent className="p-0">
				{viewMode === "map" ? (
					<div className="rounded-md border p-4">{renderMapTree}</div>
				) : viewMode === "board" ? (
					renderBoard()
				) : (
					<DataTable
						data={filteredRecipes}
						columns={columns}
						emptyMessage="No hay recetas"
						emptyIcon={<BookOpenIcon className="h-8 w-8" />}
						defaultSort={[{ id: "parent", desc: false }]}
					/>
				)}
			</CardContent>

			<Dialog
				open={isDialogOpen}
				onOpenChange={(open) => {
					if (!open) setIsDialogOpen(false);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{isEditing ? "Editar receta" : "Nueva receta"}
						</DialogTitle>
					</DialogHeader>
					<div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-blue-900 text-xs leading-relaxed">
						Una <strong>receta</strong> dice qué pieza (hijo) sale al despiezar
						un producto (padre) y en qué proporción.
						<br />• <strong>Piezas</strong>: cuántas salen de 1 padre (ej. 2
						piernas por canal).
						<br />• <strong>Rendimiento %</strong>: qué parte del peso del padre
						es esta pieza. La suma de todas las piezas de un padre debería
						acercarse a 100%.
						<br />• <strong>Estilo</strong>: AMERICANO / NACIONAL_LOMO /
						NACIONAL_ESPILOMO (despiece del canal) · BASE (despiece de una
						pieza, ej. PIERNA→JAMÓN).
					</div>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							const v = form.state.values;
							const parentId = Number(v.parentProductId) || 0;
							let childId = Number(v.childProductId) || 0;

							if (parentId <= 0) {
								toast.error("Selecciona un producto padre");
								return;
							}

							if (childId <= 0) {
								const guess = findBestProductByName(v.childName ?? "");
								if (guess) {
									childId = guess.id;
									form.setFieldValue("childProductId", childId);
									form.setFieldValue("childName", guess.name);
									toast.success(`Hijo detectado: ${guess.name}`);
								} else {
									toast.error(
										"Selecciona un producto hijo (o escribe el nombre exacto de un producto existente)",
									);
									return;
								}
							}

							form.handleSubmit();
						}}
					>
						<div className="grid gap-4 py-4">
							<form.Field name="parentProductId">
								{(field) => (
									<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label className="sm:text-right">Padre</Label>
										<Select
											value={field.state.value ? String(field.state.value) : ""}
											onValueChange={(value) =>
												field.handleChange(Number(value))
											}
										>
											<SelectTrigger className="col-span-3">
												<SelectValue placeholder="Selecciona padre" />
											</SelectTrigger>
											<SelectContent className="max-h-72 overflow-y-auto">
												{productOptions.map((p: Product) => (
													<SelectItem key={p.id} value={String(p.id)}>
														{p.name}
														{!productsWithRecipe.has(p.id) && (
															<span className="ml-2 text-[10px] text-amber-600">
																(sin receta)
															</span>
														)}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}
							</form.Field>

							<form.Field name="childProductId">
								{(field) => (
									<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label className="sm:text-right">Hijo</Label>
										<Select
											value={field.state.value ? String(field.state.value) : ""}
											onValueChange={(value) => {
												const id = Number(value);
												field.handleChange(id);
												const p = allProducts.find((x) => x.id === id);
												if (p) form.setFieldValue("childName", p.name);
											}}
										>
											<SelectTrigger className="col-span-3">
												<SelectValue placeholder="Selecciona hijo" />
											</SelectTrigger>
											<SelectContent className="max-h-72 overflow-y-auto">
												{productOptions.map((p: Product) => (
													<SelectItem key={p.id} value={String(p.id)}>
														{p.name}
														{!productsWithRecipe.has(p.id) && (
															<span className="ml-2 text-[10px] text-amber-600">
																(sin receta)
															</span>
														)}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}
							</form.Field>

							<form.Field name="childName">
								{(field) => (
									<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label className="sm:text-right">Nombre hijo</Label>
										<div className="col-span-3">
											<Input
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
												onBlur={field.handleBlur}
												placeholder="Escribe para buscar (ej. Hueso / Pulpa de espaldilla)"
												error={
													field.state.meta.errors.length
														? String(field.state.meta.errors[0])
														: undefined
												}
											/>
										</div>
									</div>
								)}
							</form.Field>

							<form.Field name="transformationType">
								{(field) => (
									<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label className="sm:text-right">Estilo</Label>
										<Input
											className="col-span-3"
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											onBlur={field.handleBlur}
											placeholder="Ej. BASE / NACIONAL / AMERICANO / POLINESIO / DESPIECE_ESPALDILLA"
										/>
									</div>
								)}
							</form.Field>

							<form.Field name="yieldQuantityPieces">
								{(field) => (
									<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label className="sm:text-right">Piezas</Label>
										<div className="col-span-3">
											<Input
												type="number"
												step="0.5"
												value={String(field.state.value)}
												onChange={(e) =>
													field.handleChange(Number(e.target.value))
												}
												onBlur={field.handleBlur}
											/>
											<div className="mt-1 text-[10px] text-muted-foreground">
												Cuántas de esta pieza salen de 1 padre (ej. 2 piernas
												por canal).
											</div>
										</div>
									</div>
								)}
							</form.Field>

							<form.Field name="yieldWeightPercentage">
								{(field) => (
									<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label className="font-semibold text-blue-600 sm:text-right">
											% peso est.
										</Label>
										<div className="col-span-3 flex items-center gap-2">
											<Input
												type="number"
												step="0.01"
												value={String(field.state.value)}
												onChange={(e) =>
													field.handleChange(Number(e.target.value))
												}
												onBlur={field.handleBlur}
												placeholder="Ej. 15.5"
											/>
											<span className="text-muted-foreground text-sm">%</span>
										</div>
										<div className="col-span-3 col-start-2 text-[10px] text-muted-foreground">
											% del peso del padre que representa esta pieza
											(composición, no rendimiento de valor).
										</div>
									</div>
								)}
							</form.Field>

							<form.Field name="isActive">
								{(field) => (
									<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label className="sm:text-right">Activa</Label>
										<Select
											value={field.state.value ? "true" : "false"}
											onValueChange={(value) =>
												field.handleChange(value === "true")
											}
										>
											<SelectTrigger className="col-span-3">
												<SelectValue placeholder="Selecciona" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="true">Sí</SelectItem>
												<SelectItem value="false">No</SelectItem>
											</SelectContent>
										</Select>
									</div>
								)}
							</form.Field>
						</div>

						<DialogFooter>
							<Button
								variant="secondary"
								onClick={() => setIsDialogOpen(false)}
							>
								{tc("cancel")}
							</Button>
							<form.Subscribe selector={(state) => state.isSubmitting}>
								{(isSubmitting) => (
									<Button
										type="submit"
										disabled={isSubmitting || upsertMutation.isPending}
									>
										{isEditing ? tc("update") : tc("create")}
									</Button>
								)}
							</form.Subscribe>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</Card>
	);
}
