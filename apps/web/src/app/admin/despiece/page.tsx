"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@finopenpos/ui/components/card";
import { Button } from "@finopenpos/ui/components/button";
import { Input } from "@finopenpos/ui/components/input";
import { Label } from "@finopenpos/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@finopenpos/ui/components/select";
import {
	ShoppingCartIcon,
	ScissorsIcon,
	GitBranchIcon,
	ArrowRightIcon,
	CheckCircle2Icon,
} from "lucide-react";
import { cn } from "@finopenpos/ui/lib/utils";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type Tab = "comprar" | "despiezar" | "recetas";

export default function DespiecePage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [tab, setTab] = useState<Tab>("comprar");

	const { data: products = [] } = useQuery(trpc.products.list.queryOptions()) as {
		data: any[];
	};
	const productsKey = trpc.products.list.queryOptions().queryKey;
	const invalidateProducts = () =>
		queryClient.invalidateQueries({ queryKey: productsKey });

	// ── Productos padre (despiezables) ──
	const parents = useMemo(
		() => products.filter((p) => p.is_parent_product),
		[products],
	);

	// ───────────────────────── TAB 1: COMPRAR ─────────────────────────
	const [qtyAmericano, setQtyAmericano] = useState("");
	const [qtyNacional, setQtyNacional] = useState("");
	const [totalWeight, setTotalWeight] = useState("");
	const [pricePerKg, setPricePerKg] = useState("");
	const [supplier, setSupplier] = useState("");
	const [purchaseResult, setPurchaseResult] = useState<any | null>(null);

	const purchaseMut = useMutation(
		trpc.products.registerChannelPurchase.mutationOptions({
			onSuccess: (data: any) => {
				toast.success(`Compra registrada: ${data.totalPieces} medias canal`);
				setPurchaseResult(data);
				setQtyAmericano("");
				setQtyNacional("");
				setTotalWeight("");
				invalidateProducts();
			},
			onError: (e: any) => toast.error(e.message ?? "Error al registrar compra"),
		}),
	);

	const registrarCompra = () => {
		const a = parseInt(qtyAmericano) || 0;
		const n = parseInt(qtyNacional) || 0;
		const w = parseFloat(totalWeight) || 0;
		if (a <= 0 && n <= 0) {
			toast.error("Indica cuántos cerdos americanos o nacionales");
			return;
		}
		if (w <= 0) {
			toast.error("Indica el peso total");
			return;
		}
		purchaseMut.mutate({
			purchaseMode: "CANAL_COMPLETO",
			qtyAmericano: a,
			qtyNacional: n,
			totalWeightKg: w,
			pricePerKg: parseFloat(pricePerKg) || undefined,
			supplier: supplier || undefined,
		});
	};

	// ───────────────────────── TAB 2: DESPIEZAR ─────────────────────────
	const [parentId, setParentId] = useState<string>("");
	const [ttype, setTtype] = useState<string>("");
	const [qtyProcess, setQtyProcess] = useState("1");

	const selectedParent = useMemo(
		() => parents.find((p) => String(p.id) === parentId),
		[parents, parentId],
	);

	const ttypesQuery = useQuery({
		...trpc.products.getAvailableTransformationTypes.queryOptions({
			parentProductId: parseInt(parentId) || 0,
		}),
		enabled: !!parentId,
	});

	const treeQuery = useQuery({
		...trpc.products.getTransformations.queryOptions({
			parentProductId: parseInt(parentId) || 0,
			transformationType: ttype || undefined,
		}),
		enabled: !!parentId && !!ttype,
	});

	const disassembleMut = useMutation(
		trpc.products.processDisassembly.mutationOptions({
			onSuccess: () => {
				toast.success("Despiece procesado");
				invalidateProducts();
			},
			onError: (e: any) => toast.error(e.message ?? "Error al despiezar"),
		}),
	);

	const despiezar = () => {
		if (!parentId || !ttype) {
			toast.error("Selecciona producto y tipo de despiece");
			return;
		}
		disassembleMut.mutate({
			parentProductId: parseInt(parentId),
			quantityToProcess: parseInt(qtyProcess) || 1,
			transformationType: ttype,
		});
	};

	const tabs: { id: Tab; label: string; icon: any }[] = [
		{ id: "comprar", label: "1. Comprar canales", icon: ShoppingCartIcon },
		{ id: "despiezar", label: "2. Despiezar", icon: ScissorsIcon },
		{ id: "recetas", label: "3. Recetas (árbol)", icon: GitBranchIcon },
	];

	return (
		<div className="mx-auto max-w-5xl space-y-6">
			<div>
				<h1 className="text-2xl font-bold">Despiece</h1>
				<p className="text-sm text-muted-foreground">
					Compra canales → quedan piezas en inventario → despiézalas en sus partes cuando las necesites.
				</p>
			</div>

			{/* Tabs */}
			<div className="flex gap-2 border-b">
				{tabs.map((tb) => (
					<button
						key={tb.id}
						onClick={() => setTab(tb.id)}
						className={cn(
							"flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors",
							tab === tb.id
								? "border-primary text-primary"
								: "border-transparent text-muted-foreground hover:text-foreground",
						)}
					>
						<tb.icon className="w-4 h-4" />
						{tb.label}
					</button>
				))}
			</div>

			{/* ───── TAB 1: COMPRAR ───── */}
			{tab === "comprar" && (
				<div className="grid gap-6 md:grid-cols-2">
					<Card>
						<CardHeader>
							<CardTitle>Registrar compra de canales</CardTitle>
							<CardDescription>
								Cuántos cerdos compraste y su peso total. Quedan como medias canal en inventario.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid grid-cols-2 gap-3">
								<div className="space-y-1">
									<Label>Cerdos Americanos</Label>
									<Input
										type="number"
										value={qtyAmericano}
										onChange={(e) => setQtyAmericano(e.target.value)}
										placeholder="0"
									/>
									<p className="text-[11px] text-muted-foreground">→ 2 medias iguales c/u</p>
								</div>
								<div className="space-y-1">
									<Label>Cerdos Nacionales</Label>
									<Input
										type="number"
										value={qtyNacional}
										onChange={(e) => setQtyNacional(e.target.value)}
										placeholder="0"
									/>
									<p className="text-[11px] text-muted-foreground">→ 1 lado Lomo + 1 Espilomo</p>
								</div>
							</div>
							<div className="grid grid-cols-2 gap-3">
								<div className="space-y-1">
									<Label>Peso total (kg)</Label>
									<Input
										type="number"
										value={totalWeight}
										onChange={(e) => setTotalWeight(e.target.value)}
										placeholder="Ej. 110"
									/>
								</div>
								<div className="space-y-1">
									<Label>Precio por kilo ($)</Label>
									<Input
										type="number"
										value={pricePerKg}
										onChange={(e) => setPricePerKg(e.target.value)}
										placeholder="Ej. 55"
									/>
								</div>
							</div>
							<div className="space-y-1">
								<Label>Proveedor (opcional)</Label>
								<Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
							</div>
							<Button
								className="w-full"
								disabled={purchaseMut.isPending}
								onClick={registrarCompra}
							>
								{purchaseMut.isPending ? "Registrando…" : "Registrar compra"}
							</Button>
						</CardContent>
					</Card>

					{/* Resultado */}
					<Card>
						<CardHeader>
							<CardTitle>Resultado</CardTitle>
							<CardDescription>Piezas que entraron al inventario</CardDescription>
						</CardHeader>
						<CardContent>
							{!purchaseResult ? (
								<div className="text-sm text-muted-foreground py-8 text-center">
									Aquí verás las medias canal generadas tras registrar la compra.
								</div>
							) : (
								<div className="space-y-3">
									<div className="rounded-lg bg-green-50 p-3 text-sm">
										<div className="flex items-center gap-2 font-bold text-green-700">
											<CheckCircle2Icon className="w-4 h-4" />
											{purchaseResult.totalPieces} medias canal · {purchaseResult.totalKg} kg
										</div>
									</div>
									<div className="space-y-1">
										{(purchaseResult.allocations ?? []).map((a: any) => (
											<div
												key={a.productId}
												className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
											>
												<span className="font-medium">{a.product}</span>
												<span className="text-muted-foreground">
													+{a.addedPieces} pz · stock {a.newStock}
												</span>
											</div>
										))}
									</div>
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			)}

			{/* ───── TAB 2: DESPIEZAR ───── */}
			{tab === "despiezar" && (
				<div className="grid gap-6 md:grid-cols-2">
					<Card>
						<CardHeader>
							<CardTitle>Despiezar una pieza padre</CardTitle>
							<CardDescription>
								Convierte un canal o pieza en sus partes. Descuenta el padre y suma los hijos.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-1">
								<Label>Producto a despiezar</Label>
								<Select
									value={parentId}
									onValueChange={(v) => {
										setParentId(v);
										setTtype("");
									}}
								>
									<SelectTrigger>
										<SelectValue placeholder="Selecciona un padre" />
									</SelectTrigger>
									<SelectContent>
										{parents.map((p) => (
											<SelectItem key={p.id} value={String(p.id)}>
												{p.name} ({p.stock_pieces} pz)
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{parentId && (
								<div className="space-y-1">
									<Label>Tipo de despiece</Label>
									<Select value={ttype} onValueChange={setTtype}>
										<SelectTrigger>
											<SelectValue placeholder="Selecciona tipo" />
										</SelectTrigger>
										<SelectContent>
											{(ttypesQuery.data ?? []).map((tt: string) => (
												<SelectItem key={tt} value={tt}>
													{tt}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							)}

							<div className="space-y-1">
								<Label>Cuántas piezas procesar</Label>
								<Input
									type="number"
									value={qtyProcess}
									onChange={(e) => setQtyProcess(e.target.value)}
									min="1"
								/>
								{selectedParent && (
									<p className="text-[11px] text-muted-foreground">
										Disponibles: {selectedParent.stock_pieces} piezas
									</p>
								)}
							</div>

							<Button
								className="w-full"
								disabled={disassembleMut.isPending || !parentId || !ttype}
								onClick={despiezar}
							>
								<ScissorsIcon className="w-4 h-4 mr-2" />
								{disassembleMut.isPending ? "Despiezando…" : "Despiezar"}
							</Button>
						</CardContent>
					</Card>

					{/* Vista previa de qué genera */}
					<Card>
						<CardHeader>
							<CardTitle>Qué vas a obtener</CardTitle>
							<CardDescription>
								{selectedParent ? selectedParent.name : "Selecciona un producto"} →
							</CardDescription>
						</CardHeader>
						<CardContent>
							{!parentId || !ttype ? (
								<div className="text-sm text-muted-foreground py-8 text-center">
									Selecciona producto y tipo para ver las piezas que genera.
								</div>
							) : (treeQuery.data ?? []).length === 0 ? (
								<div className="text-sm text-muted-foreground py-8 text-center">
									Este producto no tiene receta para ese tipo.
								</div>
							) : (
								<div className="space-y-2">
									{(treeQuery.data ?? []).map((tr: any) => {
										const qty = parseInt(qtyProcess) || 1;
										const pieces = Number(tr.yield_quantity_pieces) * qty;
										const ratioPct = (Number(tr.yield_weight_ratio) * 100).toFixed(0);
										return (
											<div
												key={tr.id}
												className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
											>
												<ArrowRightIcon className="w-4 h-4 text-primary shrink-0" />
												<span className="font-medium flex-1">
													{tr.childProduct?.name ?? `#${tr.child_product_id}`}
												</span>
												<span className="text-muted-foreground">
													{pieces % 1 === 0 ? pieces : pieces.toFixed(1)} pz · {ratioPct}% peso
												</span>
											</div>
										);
									})}
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			)}

			{/* ───── TAB 3: RECETAS (ÁRBOL) ───── */}
			{tab === "recetas" && (
				<div className="space-y-4">
					<p className="text-sm text-muted-foreground">
						Mapa de despiece: de cada pieza padre salen estas partes. Referencia visual.
					</p>
					<div className="grid gap-4 md:grid-cols-2">
						{parents.map((p) => (
							<RecipeTreeCard key={p.id} parent={p} />
						))}
					</div>
				</div>
			)}
		</div>
	);
}

// Tarjeta de árbol de recetas para un padre (muestra sus hijos)
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
			map.get(k)!.push(t);
		}
		return map;
	}, [tree]);

	if (tree.length === 0) return null;

	return (
		<Card>
			<CardHeader className="py-3">
				<CardTitle className="text-base flex items-center gap-2">
					<GitBranchIcon className="w-4 h-4 text-primary" />
					{parent.name}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{[...byType.entries()].map(([type, items]) => (
					<div key={type}>
						<div className="text-[11px] font-bold uppercase text-muted-foreground mb-1">
							{type}
						</div>
						<div className="space-y-1">
							{items.map((t) => (
								<div key={t.id} className="flex items-center gap-2 text-sm pl-2">
									<span className="text-primary">└</span>
									<span className="flex-1">{t.childProduct?.name ?? `#${t.child_product_id}`}</span>
									<span className="text-xs text-muted-foreground">
										{Number(t.yield_quantity_pieces)} pz · {(Number(t.yield_weight_ratio) * 100).toFixed(0)}%
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
