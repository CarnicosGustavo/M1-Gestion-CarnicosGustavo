"use client";

import { Button } from "@finopenpos/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@finopenpos/ui/components/card";
import { cn } from "@finopenpos/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	GitBranchIcon,
	MinusIcon,
	PackageIcon,
	PlusIcon,
	ScissorsIcon,
	ShoppingCartIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

type Tab = "despiezar" | "recetas";

const TYPE_ACCENT: Record<string, string> = {
	AMERICANO: "#e11d48",
	NACIONAL_LOMO: "#16a34a",
	NACIONAL_ESPILOMO: "#0d9488",
	POLINESIO: "#ea580c",
};
const accentFor = (t: string) => TYPE_ACCENT[t] ?? "#2563eb";

// "CANAL NACIONAL LADO LOMO" -> "Nacional · Lomo"
const shortCanal = (name: string) =>
	name
		.replace(/^CANAL\s+/i, "")
		.replace(/NACIONAL\s+LADO\s+/i, "Nacional · ")
		.replace(/^AMERICANO$/i, "Americano")
		.trim();

export default function DespiecePage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [tab, setTab] = useState<Tab>("despiezar");

	const panelOpts = trpc.yields.despiecePanel.queryOptions();
	const { data: panel } = useQuery(panelOpts);
	const canales = panel?.canales ?? [];
	const recipes = panel?.recipes ?? [];
	const subRecipes = panel?.subRecipes ?? [];
	const demand = panel?.demandByProduct ?? {};

	const productsKey = trpc.products.list.queryOptions().queryKey;
	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: panelOpts.queryKey });
		queryClient.invalidateQueries({ queryKey: productsKey });
	};

	const disassembleMut = useMutation(
		trpc.products.processDisassembly.mutationOptions({
			onSuccess: () => {
				toast.success("Despiece procesado");
				invalidate();
			},
			onError: (e: any) => toast.error(e.message ?? "Error al despiezar"),
		}),
	);

	// ── Demanda total por canal (para badge "tiene pedidos") ──
	const demandByCanal = useMemo(() => {
		const m = new Map<number, number>();
		for (const r of recipes) {
			const d = demand[r.childId]?.pieces ?? 0;
			if (d > 0) m.set(r.parentId, (m.get(r.parentId) ?? 0) + d);
		}
		return m;
	}, [recipes, demand]);

	// Auto-selecciona el primer canal con stock o con pedidos
	const [selectedId, setSelectedId] = useState<number | null>(null);
	useEffect(() => {
		if (selectedId != null || canales.length === 0) return;
		const withDemand = canales.find(
			(c) => (demandByCanal.get(c.canalProductId) ?? 0) > 0,
		);
		const withStock = canales.find((c) => c.stockPieces > 0);
		setSelectedId((withDemand ?? withStock ?? canales[0]).canalProductId);
	}, [canales, demandByCanal, selectedId]);

	const sel = canales.find((c) => c.canalProductId === selectedId) ?? null;

	// Piezas del canal seleccionado, con capacidad y demanda
	const pieces = useMemo(() => {
		if (!sel) return [];
		return recipes
			.filter((r) => r.parentId === sel.canalProductId)
			.map((r) => ({
				...r,
				demand: demand[r.childId]?.pieces ?? 0,
				capacity: sel.stockPieces * r.pieces, // si despiezo todo el stock
			}))
			.sort(
				(a, b) => b.demand - a.demand || a.childName.localeCompare(b.childName),
			);
	}, [sel, recipes, demand]);

	// Canales sugeridos = los necesarios para cubrir la pieza más pedida
	const suggested = useMemo(() => {
		if (!sel) return 0;
		let need = 0;
		for (const p of pieces) {
			if (p.demand > 0 && p.pieces > 0)
				need = Math.max(need, Math.ceil(p.demand / p.pieces));
		}
		return Math.min(need, sel.stockPieces);
	}, [pieces, sel]);

	const [qty, setQty] = useState(1);
	// Al cambiar de canal, propone la cantidad sugerida (o 1)
	useEffect(() => {
		setQty(Math.max(1, Math.min(suggested || 1, sel?.stockPieces ?? 1)));
	}, [suggested, sel]);

	// Card de pieza expandida (toda la información de esa pieza)
	const [expandedId, setExpandedId] = useState<number | null>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: colapsar el detalle al cambiar de canal es intencional
	useEffect(() => setExpandedId(null), [selectedId]);

	const maxQty = sel?.stockPieces ?? 0;
	const clampedQty = Math.max(1, Math.min(qty, Math.max(1, maxQty)));

	const ejecutar = () => {
		if (!sel || !sel.type) {
			toast.error("Este canal no tiene receta configurada");
			return;
		}
		disassembleMut.mutate({
			parentProductId: sel.canalProductId,
			quantityToProcess: clampedQty,
			transformationType: sel.type,
			entryMode: false,
		});
	};

	const totalDemandPieces = Object.values(demand).reduce(
		(a, d) => a + d.pieces,
		0,
	);

	return (
		<div className="mx-auto max-w-6xl space-y-5">
			<div className="flex flex-wrap items-end justify-between gap-2">
				<div>
					<h1 className="font-bold text-2xl">Despiece</h1>
					<p className="text-muted-foreground text-sm">
						Los canales vienen de la{" "}
						<Link
							href="/admin/purchase"
							className="font-medium text-primary underline-offset-2 hover:underline"
						>
							Compra del día
						</Link>
						. Elige un tipo y despiézalo según lo que se pidió.
					</p>
				</div>
				<div className="flex gap-2">
					{(
						[
							{ id: "despiezar", label: "Despiezar", icon: ScissorsIcon },
							{ id: "recetas", label: "Recetas (árbol)", icon: GitBranchIcon },
						] as const
					).map((tb) => (
						<button
							key={tb.id}
							type="button"
							onClick={() => setTab(tb.id)}
							className={cn(
								"flex items-center gap-2 rounded-lg border px-3 py-1.5 font-semibold text-sm transition-colors",
								tab === tb.id
									? "border-primary bg-primary text-primary-foreground"
									: "border-border text-muted-foreground hover:bg-muted",
							)}
						>
							<tb.icon className="h-4 w-4" />
							{tb.label}
						</button>
					))}
				</div>
			</div>

			{tab === "despiezar" && (
				<>
					{/* Banner de demanda (modo automático) */}
					{totalDemandPieces > 0 && (
						<div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
							<div className="flex items-center gap-2 font-bold text-blue-800 text-sm">
								<PackageIcon className="h-4 w-4" />
								Pedidos pendientes: {totalDemandPieces} piezas por producir
							</div>
							<p className="mt-0.5 text-blue-700/80 text-xs">
								Los canales con pedidos están marcados ●. Al elegir uno, te
								sugiero cuántos despiezar para cubrir la demanda.
							</p>
						</div>
					)}

					{/* Cards de canales disponibles */}
					{canales.length === 0 ? (
						<EmptyCanales />
					) : (
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
							{canales.map((c) => {
								const accent = accentFor(c.type);
								const hasStock = c.stockPieces > 0;
								const dem = demandByCanal.get(c.canalProductId) ?? 0;
								const active = c.canalProductId === selectedId;
								return (
									<button
										key={c.canalProductId}
										type="button"
										onClick={() => setSelectedId(c.canalProductId)}
										className={cn(
											"relative overflow-hidden rounded-xl border bg-card p-3 text-left transition-all",
											active
												? "ring-2 ring-offset-1"
												: "hover:border-foreground/30",
											!hasStock && "opacity-60",
										)}
										style={
											active
												? ({ ["--tw-ring-color" as any]: accent } as any)
												: undefined
										}
									>
										<div
											className="-mx-3 -mt-3 mb-2 h-1.5"
											style={{ background: accent }}
										/>
										<div className="flex items-start justify-between gap-1">
											<span className="font-bold text-sm leading-tight">
												{shortCanal(c.name)}
											</span>
											{dem > 0 && (
												<span
													className="shrink-0 rounded-full bg-blue-100 px-1.5 py-0.5 font-bold text-[10px] text-blue-700"
													title={`${dem} piezas pedidas de este canal`}
												>
													● {dem}
												</span>
											)}
										</div>
										<div className="mt-1 flex items-end gap-1">
											<span
												className="font-extrabold text-2xl tabular-nums leading-none"
												style={{ color: hasStock ? accent : undefined }}
											>
												{c.stockPieces}
											</span>
											<span className="mb-0.5 text-[11px] text-muted-foreground">
												disponibles
											</span>
										</div>
										<div className="mt-0.5 text-[10px] text-muted-foreground">
											{c.avgWeight > 0 ? `${c.avgWeight} kg c/u` : "—"}
										</div>
									</button>
								);
							})}
						</div>
					)}

					{/* Detalle del canal seleccionado */}
					{sel && (
						<Card>
							<CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
								<div>
									<CardTitle className="text-base">
										{shortCanal(sel.name)} — qué obtienes y qué se pidió
									</CardTitle>
									<p className="text-muted-foreground text-xs">
										Capacidad = con los {sel.stockPieces} canales disponibles ·
										Pedidas = demanda viva de pedidos.
									</p>
								</div>

								{/* Control de cantidad + ejecutar */}
								<div className="flex items-center gap-3">
									<div className="text-right">
										<div className="text-[10px] text-muted-foreground uppercase">
											Canales a despiezar
										</div>
										{suggested > 0 && (
											<div className="text-[10px] text-blue-600">
												sugerido: {suggested}
											</div>
										)}
									</div>
									<div className="flex items-center rounded-lg border">
										<button
											type="button"
											className="px-2 py-1.5 hover:bg-muted disabled:opacity-40"
											disabled={clampedQty <= 1}
											onClick={() => setQty((q) => Math.max(1, q - 1))}
										>
											<MinusIcon className="h-4 w-4" />
										</button>
										<span className="w-10 text-center font-bold tabular-nums">
											{clampedQty}
										</span>
										<button
											type="button"
											className="px-2 py-1.5 hover:bg-muted disabled:opacity-40"
											disabled={clampedQty >= maxQty}
											onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
										>
											<PlusIcon className="h-4 w-4" />
										</button>
									</div>
									<Button
										disabled={
											disassembleMut.isPending || maxQty <= 0 || !sel.type
										}
										onClick={ejecutar}
									>
										<ScissorsIcon className="mr-2 h-4 w-4" />
										{disassembleMut.isPending
											? "Despiezando…"
											: `Despiezar ${clampedQty}`}
									</Button>
								</div>
							</CardHeader>
							<CardContent>
								{maxQty <= 0 && (
									<div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-amber-800 text-xs">
										No hay canales de este tipo en inventario. Regístralos en{" "}
										<Link
											href="/admin/purchase"
											className="font-semibold underline"
										>
											Compra del día
										</Link>
										.
									</div>
								)}
								{pieces.length === 0 ? (
									<p className="py-6 text-center text-muted-foreground text-sm">
										Este canal no tiene receta. Configúrala en el{" "}
										<Link
											href="/admin/configurador"
											className="font-semibold underline"
										>
											Configurador
										</Link>
										.
									</p>
								) : (
									<div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
										{pieces.map((p) => (
											<PieceCard
												key={p.childId}
												piece={p}
												demandKg={demand[p.childId]?.kg ?? 0}
												qty={clampedQty}
												canalAvgWeight={sel.avgWeight}
												canalStock={sel.stockPieces}
												accent={accentFor(sel.type)}
												expanded={expandedId === p.childId}
												onToggle={() =>
													setExpandedId((cur) =>
														cur === p.childId ? null : p.childId,
													)
												}
												allSubRecipes={subRecipes}
												onChanged={invalidate}
											/>
										))}
									</div>
								)}
							</CardContent>
						</Card>
					)}
				</>
			)}

			{tab === "recetas" && <RecetasArbol />}
		</div>
	);
}

type SubRecipe = {
	parentId: number;
	childId: number;
	childName: string;
	pieces: number;
	ratio: number;
	isVariant: boolean;
	childStockPieces: number;
	childStockKg: number;
};

type PieceInfo = {
	childId: number;
	childName: string;
	pieces: number;
	ratio: number;
	childAvgWeight: number;
	childStockPieces: number;
	childStockKg: number;
	demand: number;
	capacity: number;
};

// Card de pieza: compacta en el grid; al presionarla se expande a lo ancho con
// todo el detalle (pedidos, stock, capacidad, producción y sub-despieces).
function PieceCard({
	piece: p,
	demandKg,
	qty,
	canalAvgWeight,
	canalStock,
	accent,
	expanded,
	onToggle,
	allSubRecipes,
	onChanged,
}: {
	piece: PieceInfo;
	demandKg: number;
	qty: number;
	canalAvgWeight: number;
	canalStock: number;
	accent: string;
	expanded: boolean;
	onToggle: () => void;
	allSubRecipes: SubRecipe[];
	onChanged: () => void;
}) {
	const producePieces = qty * p.pieces;
	const produceKg = qty * canalAvgWeight * p.ratio;
	const covers = p.demand > 0 && producePieces >= p.demand;
	const missing = Math.max(0, p.demand - p.childStockPieces);

	// Hijos directos de esta pieza: variantes (especificación del mismo corte)
	// vs sub-despiece (la pieza se corta en otras)
	const direct = allSubRecipes.filter((s) => s.parentId === p.childId);
	const directVariants = direct.filter((s) => s.isVariant);
	const directCuts = direct.filter((s) => !s.isVariant);
	const variantsOf = (productId: number) =>
		allSubRecipes.filter((s) => s.parentId === productId && s.isVariant);

	if (!expanded) {
		return (
			<button
				type="button"
				onClick={onToggle}
				className={cn(
					"rounded-xl border bg-card p-2.5 text-left transition-all hover:border-foreground/30 hover:shadow-sm",
					p.demand > 0 && "border-blue-200 bg-blue-50/40",
				)}
				title="Toca para ver todo el detalle de esta pieza"
			>
				<div className="flex items-start justify-between gap-1">
					<span className="min-w-0 truncate font-bold text-sm">
						{p.childName}
					</span>
					<span className="shrink-0 text-[10px] text-muted-foreground">▸</span>
				</div>
				<div className="mt-0.5 text-[10px] text-muted-foreground">
					{p.pieces} pz/canal · {(p.ratio * 100).toFixed(1)}%
				</div>
				<div className="mt-1.5 flex items-center justify-between gap-1">
					{p.demand > 0 ? (
						<span
							className={cn(
								"rounded-full px-1.5 py-0.5 font-bold text-[10px]",
								covers
									? "bg-green-100 text-green-700"
									: "bg-blue-100 text-blue-700",
							)}
						>
							{p.demand} pedidas
						</span>
					) : (
						<span className="text-[10px] text-muted-foreground">
							sin pedidos
						</span>
					)}
					<span className="font-bold text-xs tabular-nums">
						+{producePieces} pz
					</span>
				</div>
			</button>
		);
	}

	return (
		<div
			className="col-span-2 overflow-hidden rounded-xl border-2 bg-card sm:col-span-3 lg:col-span-4"
			style={{ borderColor: accent }}
		>
			{/* Encabezado expandido */}
			<button
				type="button"
				onClick={onToggle}
				className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/40"
			>
				<div>
					<span className="font-extrabold text-lg">{p.childName}</span>
					<span className="ml-2 text-muted-foreground text-xs">
						{p.pieces} pz por canal · {(p.ratio * 100).toFixed(1)}% del peso
					</span>
				</div>
				<span className="text-muted-foreground text-xs">▾ cerrar</span>
			</button>

			{/* Métricas clave */}
			<div className="grid grid-cols-2 gap-2 px-4 pb-3 lg:grid-cols-4">
				<div className="rounded-lg bg-blue-50 p-2.5">
					<p className="text-[10px] text-blue-700/70 uppercase">
						📋 En pedidos
					</p>
					<p className="font-bold text-blue-700 text-xl tabular-nums">
						{p.demand} pz
					</p>
					<p className="text-[10px] text-blue-700/70">
						{demandKg > 0 ? `${demandKg.toFixed(1)} kg pedidos` : "—"}
					</p>
				</div>
				<div className="rounded-lg bg-slate-50 p-2.5">
					<p className="text-[10px] text-muted-foreground uppercase">
						🧊 En stock (ya despiezadas)
					</p>
					<p className="font-bold text-xl tabular-nums">
						{p.childStockPieces} pz
					</p>
					<p className="text-[10px] text-muted-foreground">
						{p.childStockKg > 0 ? `${p.childStockKg.toFixed(1)} kg` : "—"}
					</p>
				</div>
				<div className="rounded-lg bg-slate-50 p-2.5">
					<p className="text-[10px] text-muted-foreground uppercase">
						✂️ Disponibles por despiece
					</p>
					<p className="font-bold text-xl tabular-nums">
						hasta {p.capacity} pz
					</p>
					<p className="text-[10px] text-muted-foreground">
						de {canalStock} canales en inventario
					</p>
				</div>
				<div
					className={cn(
						"rounded-lg p-2.5",
						covers ? "bg-green-50" : "bg-amber-50",
					)}
				>
					<p
						className={cn(
							"text-[10px] uppercase",
							covers ? "text-green-700/70" : "text-amber-700/70",
						)}
					>
						➕ Con {qty} canal(es)
					</p>
					<p
						className={cn(
							"font-bold text-xl tabular-nums",
							covers ? "text-green-700" : "text-amber-700",
						)}
					>
						+{producePieces} pz
					</p>
					<p
						className={cn(
							"text-[10px]",
							covers ? "text-green-700/70" : "text-amber-700/70",
						)}
					>
						{produceKg > 0 ? `~${produceKg.toFixed(1)} kg · ` : ""}
						{p.demand === 0
							? "sin pedidos que cubrir"
							: covers
								? "cubre el pedido ✓"
								: `faltarían ${p.demand - producePieces} pz`}
					</p>
				</div>
			</div>

			{/* Estado vs pedido */}
			{p.demand > 0 && (
				<div className="px-4 pb-3">
					<div
						className={cn(
							"rounded-lg border p-2.5 text-xs",
							missing <= 0
								? "border-green-200 bg-green-50 text-green-800"
								: "border-blue-200 bg-blue-50 text-blue-800",
						)}
					>
						{missing <= 0 ? (
							<>
								El stock actual ({p.childStockPieces} pz) ya cubre las{" "}
								{p.demand} pedidas — no necesitas despiezar para esta pieza.
							</>
						) : (
							<>
								Faltan <strong>{missing} pz</strong> para cubrir el pedido (
								{p.demand} pedidas − {p.childStockPieces} en stock). Con{" "}
								{p.pieces} pz por canal necesitas despiezar{" "}
								<strong>
									{Math.ceil(missing / Math.max(1, p.pieces))} canal(es)
								</strong>
								.
							</>
						)}
					</div>
				</div>
			)}

			{/* Variantes directas de esta pieza (especificaciones del mismo corte) */}
			{directVariants.length > 0 && (
				<div className="border-t bg-purple-50/40 px-4 py-3">
					<p className="font-semibold text-[11px] text-purple-700 uppercase tracking-wide">
						Variantes de {p.childName} — produce con tu especificación
					</p>
					<p className="text-[11px] text-muted-foreground">
						Convierte piezas de {p.childName} (stock: {p.childStockPieces} pz) a
						la presentación pedida.
					</p>
					<div className="mt-1.5 space-y-1">
						{directVariants.map((v) => (
							<VariantRow
								key={`${v.parentId}:${v.childId}`}
								variant={v}
								baseProductId={p.childId}
								baseName={p.childName}
								onChanged={onChanged}
							/>
						))}
					</div>
				</div>
			)}

			{/* Sub-despiece (la pieza se corta en otras) con sus variantes anidadas */}
			<div className="border-t bg-muted/30 px-4 py-3">
				<p className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wide">
					Sub-despiece de {p.childName}
				</p>
				{directCuts.length === 0 && directVariants.length === 0 ? (
					<p className="mt-1 text-muted-foreground text-xs">
						Esta es una pieza final (no se despieza a su vez). Puedes cambiarlo
						en el{" "}
						<Link
							href="/admin/configurador"
							className="font-semibold underline"
							target="_blank"
						>
							Configurador
						</Link>
						.
					</p>
				) : directCuts.length === 0 ? (
					<p className="mt-1 text-muted-foreground text-xs">
						No se corta en otras piezas (solo tiene variantes, arriba).
					</p>
				) : (
					<div className="mt-1.5 space-y-1.5">
						{directCuts.map((s) => {
							const nested = variantsOf(s.childId);
							return (
								<div
									key={`${s.parentId}:${s.childId}`}
									className="rounded-md border bg-background"
								>
									<div className="flex items-center gap-2 px-2 py-1.5 text-xs">
										<span className="text-primary">└</span>
										<span className="min-w-0 flex-1 truncate font-medium">
											{s.childName}
										</span>
										<span className="shrink-0 text-muted-foreground">
											stock {s.childStockPieces} pz
										</span>
										<span className="shrink-0 text-muted-foreground">
											{s.pieces} pz · {(s.ratio * 100).toFixed(0)}%
										</span>
									</div>
									{nested.length > 0 && (
										<div className="space-y-1 border-t bg-purple-50/40 px-2 py-1.5">
											<p className="font-semibold text-[10px] text-purple-700 uppercase">
												Variantes de {s.childName} (stock base:{" "}
												{s.childStockPieces} pz)
											</p>
											{nested.map((v) => (
												<VariantRow
													key={`${v.parentId}:${v.childId}`}
													variant={v}
													baseProductId={s.childId}
													baseName={s.childName}
													onChanged={onChanged}
												/>
											))}
										</div>
									)}
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}

// Renglón de variante: nombre, stock, cuántas producir con esa especificación
function VariantRow({
	variant: v,
	baseProductId,
	baseName,
	onChanged,
}: {
	variant: SubRecipe;
	baseProductId: number;
	baseName: string;
	onChanged: () => void;
}) {
	const trpc = useTRPC();
	const [qty, setQty] = useState("");

	const convertMut = useMutation(
		trpc.products.convertToVariant.mutationOptions({
			onSuccess: () => {
				toast.success(
					`${qty} pz de ${baseName} producidas como ${v.childName}`,
				);
				setQty("");
				onChanged();
			},
			onError: (e: any) => toast.error(e.message ?? "Error al convertir"),
		}),
	);

	const n = Number.parseInt(qty, 10) || 0;
	return (
		<div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-xs">
			<span className="rounded bg-purple-100 px-1 font-bold text-[9px] text-purple-700">
				VAR
			</span>
			<span className="min-w-0 flex-1 truncate font-medium">{v.childName}</span>
			<span
				className="shrink-0 text-muted-foreground"
				title="Stock actual de esta variante"
			>
				stock {v.childStockPieces} pz
			</span>
			<span className="shrink-0 text-muted-foreground">
				{(v.ratio * 100).toFixed(0)}%
			</span>
			<input
				type="number"
				min="1"
				value={qty}
				onChange={(e) => setQty(e.target.value)}
				placeholder="pz"
				className="h-7 w-14 rounded-md border bg-background px-1.5 text-center text-xs"
			/>
			<Button
				size="sm"
				variant="outline"
				className="h-7 px-2 text-[11px]"
				disabled={n <= 0 || convertMut.isPending}
				onClick={() =>
					convertMut.mutate({
						baseProductId,
						variantProductId: v.childId,
						pieces: n,
					})
				}
			>
				{convertMut.isPending ? "…" : "Producir"}
			</Button>
		</div>
	);
}

function EmptyCanales() {
	return (
		<Card>
			<CardContent className="flex flex-col items-center gap-3 py-10 text-center">
				<ShoppingCartIcon className="h-10 w-10 text-muted-foreground/50" />
				<div className="text-muted-foreground text-sm">
					No hay canales en inventario todavía.
				</div>
				<Button asChild>
					<Link href="/admin/purchase">Registrar la compra del día</Link>
				</Button>
			</CardContent>
		</Card>
	);
}

// ───── Recetas (árbol) — referencia visual ─────
function RecetasArbol() {
	const trpc = useTRPC();
	const { data: products = [] } = useQuery(
		trpc.products.list.queryOptions(),
	) as { data: any[] };
	const parents = useMemo(
		() => products.filter((p) => p.is_parent_product),
		[products],
	);
	return (
		<div className="space-y-4">
			<p className="text-muted-foreground text-sm">
				Mapa de despiece: de cada pieza padre salen estas partes. Referencia
				visual.
			</p>
			<div className="grid gap-4 md:grid-cols-2">
				{parents.map((p) => (
					<RecipeTreeCard key={p.id} parent={p} />
				))}
			</div>
		</div>
	);
}

function RecipeTreeCard({ parent }: { parent: any }) {
	const trpc = useTRPC();
	const { data: tree = [] } = useQuery(
		trpc.products.getTransformations.queryOptions({
			parentProductId: parent.id,
		}),
	) as { data: any[] };

	const byType = useMemo(() => {
		const map = new Map<string, any[]>();
		for (const t of tree) {
			const k = t.transformation_type ?? "BASE";
			if (!map.has(k)) map.set(k, []);
			map.get(k)?.push(t);
		}
		return map;
	}, [tree]);

	if (tree.length === 0) return null;

	return (
		<Card>
			<CardHeader className="py-3">
				<CardTitle className="flex items-center gap-2 text-base">
					<GitBranchIcon className="h-4 w-4 text-primary" />
					{parent.name}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{[...byType.entries()].map(([type, items]) => (
					<div key={type}>
						<div className="mb-1 font-bold text-[11px] text-muted-foreground uppercase">
							{type}
						</div>
						<div className="space-y-1">
							{items.map((t) => (
								<div
									key={t.id}
									className="flex items-center gap-2 pl-2 text-sm"
								>
									<span className="text-primary">└</span>
									<span className="flex-1">
										{t.childProduct?.name ?? `#${t.child_product_id}`}
									</span>
									<span className="text-muted-foreground text-xs">
										{Number(t.yield_quantity_pieces)} pz ·{" "}
										{(Number(t.yield_weight_ratio) * 100).toFixed(0)}%
									</span>
								</div>
							))}
						</div>
					</div>
				))}
			</CardContent>
		</Card>
	);
}
