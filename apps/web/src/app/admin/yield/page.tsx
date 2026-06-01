"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@finopenpos/ui/components/card";
import { Button } from "@finopenpos/ui/components/button";
import { Input } from "@finopenpos/ui/components/input";
import { Label } from "@finopenpos/ui/components/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@finopenpos/ui/components/table";
import { PlusIcon, TrashIcon, SaveIcon, SparklesIcon } from "lucide-react";
import { cn } from "@finopenpos/ui/lib/utils";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type Row = {
	productName: string;
	pieces: string;
	kg: string;
	weighed: boolean;
	estKg?: string; // estimado explícito (cascada de despiece); si no, se calcula por avg
};

const DEFAULT_CONCEPTS = [
	"C/LOMO", "CABEZA", "CACHETE", "CODILLO", "CORBATA", "CUERO", "DESGRASE",
	"ESPALDILLA", "ESPILOMO", "ESPINAZO", "FILETE", "GRASA", "HUESO AMERICANO",
	"HUESO PELON", "JAMON", "JAMON C/G", "JAMON S/H", "LENGUA", "LOMO NACIONAL",
	"LOMO USA", "RECORTE DE MASCARA", "PAPADA", "PATAS", "PECHO", "PIERNA",
	"PULPA C/G", "PULPA DE ESPALDILLA", "RETAZO", "RINON",
];

const PROVIDERS = ["La Barca", "Valle"];

function blankRows(): Row[] {
	return DEFAULT_CONCEPTS.map((name) => ({ productName: name, pieces: "", kg: "", weighed: false }));
}

const fmt = (n: number) => `${n.toFixed(2)} kg`;

export default function YieldPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const [numCanales, setNumCanales] = useState("");
	const [kgComprado, setKgComprado] = useState("");
	const [supplier, setSupplier] = useState("");
	const [notes, setNotes] = useState("");
	const [rows, setRows] = useState<Row[]>(blankRows());
	// Cantidad de canales por tipo para la proyección (productId → string)
	const [canalQty, setCanalQty] = useState<Record<number, string>>({});

	const { data: products = [] } = useQuery(trpc.products.list.queryOptions()) as { data: any[] };
	const { data: sheets } = useQuery(trpc.yields.list.queryOptions());
	const { data: providerStats } = useQuery(trpc.yields.byProvider.queryOptions());
	const { data: canales = [] } = useQuery(trpc.yields.canales.queryOptions()) as {
		data: { id: number; name: string; avgWeight: number }[];
	};
	const { data: latestPurchase } = useQuery(trpc.yields.latestPurchase.queryOptions()) as {
		data: { numMedias: number; kgComprado: number; supplier: string | null } | null | undefined;
	};

	// Auto-rellena la cabecera con la última compra de canales (una sola vez)
	const filledRef = useRef(false);
	useEffect(() => {
		if (filledRef.current || !latestPurchase) return;
		filledRef.current = true;
		if (!numCanales) setNumCanales(String(latestPurchase.numMedias ?? ""));
		if (!kgComprado) setKgComprado(String(latestPurchase.kgComprado ?? ""));
		if (!supplier && latestPurchase.supplier) setSupplier(latestPurchase.supplier);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [latestPurchase]);

	// Mapa nombre (mayúsculas) → peso promedio por pieza
	const avgByName = useMemo(() => {
		const m = new Map<string, number>();
		for (const p of products) {
			const w = p.avg_weight_per_piece_kg != null ? Number(p.avg_weight_per_piece_kg) : 0;
			if (w > 0) m.set(String(p.name).trim().toUpperCase(), w);
		}
		return m;
	}, [products]);

	const estKgFor = (name: string, pieces: number) =>
		(avgByName.get(name.trim().toUpperCase()) ?? 0) * pieces;

	// Estimado de un renglón: usa el override de cascada si existe, si no avg×piezas
	const rowEst = (r: Row, pz: number) =>
		r.estKg != null && r.estKg !== ""
			? parseFloat(r.estKg) || 0
			: estKgFor(r.productName, pz);

	// Proyecta las piezas del despiece a partir de los canales seleccionados
	const [projecting, setProjecting] = useState(false);
	async function projectFromDespiece() {
		const seleccion = canales
			.map((c) => ({
				canalProductId: c.id,
				numCanales: parseInt(canalQty[c.id] ?? "") || 0,
			}))
			.filter((c) => c.numCanales > 0);
		if (seleccion.length === 0) {
			toast.error("Indica cuántos canales de cada tipo se despiezaron");
			return;
		}
		setProjecting(true);
		try {
			const res = (await queryClient.fetchQuery(
				trpc.yields.projectFromCanales.queryOptions({ canales: seleccion }),
			)) as {
				leaves: { productName: string; pieces: number; kgEstimado: number }[];
				totalKgEstimado: number;
			};
			if (!res.leaves.length) {
				toast.error("No hay recetas activas para esos canales");
				return;
			}
			setRows(
				res.leaves
					.slice()
					.sort((a, b) => a.productName.localeCompare(b.productName))
					.map((l) => ({
						productName: l.productName,
						pieces: String(l.pieces),
						kg: "",
						weighed: false,
						estKg: String(l.kgEstimado),
					})),
			);
			// Rellena cabecera: total de canales y kg estimado comprado
			const totalCanales = seleccion.reduce((a, c) => a + c.numCanales, 0);
			setNumCanales(String(totalCanales));
			if (!kgComprado) {
				const kgTotal = seleccion.reduce((a, c) => {
					const w = canales.find((x) => x.id === c.canalProductId)?.avgWeight ?? 60;
					return a + c.numCanales * w;
				}, 0);
				setKgComprado(String(Math.round(kgTotal)));
			}
			toast.success(
				`Proyectadas ${res.leaves.length} piezas · ${res.totalKgEstimado.toFixed(1)} kg estimados`,
			);
		} catch (e: any) {
			toast.error(e?.message ?? "Error al proyectar");
		} finally {
			setProjecting(false);
		}
	}

	const createMutation = useMutation(
		trpc.yields.create.mutationOptions({
			onSuccess: () => {
				toast.success("Hoja de rendimiento guardada");
				setRows(blankRows());
				setNumCanales("");
				setKgComprado("");
				setSupplier("");
				setNotes("");
				queryClient.invalidateQueries({ queryKey: trpc.yields.list.queryOptions().queryKey });
				queryClient.invalidateQueries({ queryKey: trpc.yields.byProvider.queryOptions().queryKey });
			},
			onError: (e: any) => toast.error(e.message ?? "Error al guardar"),
		}),
	);

	const totals = useMemo(() => {
		let piezas = 0, estimado = 0, real = 0;
		for (const r of rows) {
			const pz = parseInt(r.pieces) || 0;
			piezas += pz;
			estimado += rowEst(r, pz);
			real += parseFloat(r.kg) || 0;
		}
		const comprado = parseFloat(kgComprado) || 0;
		return {
			piezas,
			estimado,
			real,
			diferencia: real - estimado,
			rendimiento: comprado > 0 ? (real / comprado) * 100 : 0,
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [rows, kgComprado, avgByName]);

	function updateRow(idx: number, patch: Partial<Row>) {
		setRows((prev) =>
			prev.map((r, i) => {
				if (i !== idx) return r;
				const next = { ...r, ...patch };
				// Si cambia el nombre, el estimado de cascada deja de ser válido
				if (patch.productName !== undefined) next.estKg = undefined;
				// Si cambian las piezas, reescala el estimado de cascada proporcionalmente
				if (patch.pieces !== undefined && r.estKg) {
					const oldPz = parseInt(r.pieces) || 0;
					const newPz = parseInt(patch.pieces) || 0;
					next.estKg =
						oldPz > 0 ? String((parseFloat(r.estKg) / oldPz) * newPz) : r.estKg;
				}
				return next;
			}),
		);
	}
	function addRow() {
		setRows((prev) => [...prev, { productName: "", pieces: "", kg: "", weighed: false }]);
	}
	function removeRow(idx: number) {
		setRows((prev) => prev.filter((_, i) => i !== idx));
	}

	function save() {
		const items = rows
			.filter((r) => r.productName.trim() && (r.pieces || r.kg))
			.map((r, idx) => ({
				productName: r.productName.trim(),
				pieces: parseInt(r.pieces) || 0,
				kgTotal: parseFloat(r.kg) || 0,
				weighed: r.weighed,
				sortOrder: idx,
			}));
		if (items.length === 0) {
			toast.error("Agrega al menos un renglón con piezas o kg");
			return;
		}
		createMutation.mutate({
			numCanales: parseInt(numCanales) || 0,
			kgComprado: parseFloat(kgComprado) || 0,
			supplier: supplier || undefined,
			notes: notes || undefined,
			items,
		});
	}

	return (
		<div className="space-y-6 max-w-5xl">
			<div className="flex items-center justify-between gap-4 flex-wrap">
				<div>
					<h1 className="text-2xl font-bold">Rendimiento de Despiece</h1>
					<p className="text-sm text-muted-foreground">
						Compara el peso estimado vs el real para medir el rendimiento por proveedor.
					</p>
				</div>
				<Button onClick={save} disabled={createMutation.isPending}>
					<SaveIcon className="w-4 h-4 mr-2" />
					{createMutation.isPending ? "Guardando…" : "Guardar hoja"}
				</Button>
			</div>

			{/* Comparativa por proveedor */}
			{providerStats && providerStats.length > 0 && (
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-base">Rendimiento por proveedor</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid gap-3 sm:grid-cols-2">
							{(providerStats as any[]).map((p) => (
								<div key={p.supplier} className="rounded-lg border p-3">
									<div className="flex items-center justify-between">
										<span className="font-bold">{p.supplier}</span>
										<span className="text-2xl font-bold text-blue-700">
											{Number(p.rendimiento).toFixed(1)}%
										</span>
									</div>
									<div className="mt-1 text-xs text-muted-foreground">
										{p.canales} canales · comprado {Number(p.kgComprado).toFixed(0)} kg · real{" "}
										{Number(p.kgReal).toFixed(0)} kg · {p.hojas} hoja(s)
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Proyección desde despiece */}
			{canales.length > 0 && (
				<Card className="border-blue-200 bg-blue-50/40">
					<CardHeader className="pb-2">
						<CardTitle className="flex items-center gap-2 text-base">
							<SparklesIcon className="h-4 w-4 text-blue-600" />
							Proyectar piezas desde el despiece
						</CardTitle>
						<p className="text-xs text-muted-foreground">
							Indica cuántos canales de cada tipo se despiezaron. Se calculan
							automáticamente las piezas resultantes y su peso estimado (incluye
							el 2º nivel de despiece).
						</p>
					</CardHeader>
					<CardContent>
						<div className="flex flex-wrap items-end gap-3">
							{canales.map((c) => (
								<div key={c.id} className="space-y-1">
									<Label className="text-xs">{c.name}</Label>
									<Input
										type="number"
										min={0}
										value={canalQty[c.id] ?? ""}
										onChange={(e) =>
											setCanalQty((prev) => ({ ...prev, [c.id]: e.target.value }))
										}
										placeholder="0"
										className="h-9 w-28"
									/>
								</div>
							))}
							<Button
								onClick={projectFromDespiece}
								disabled={projecting}
								className="bg-blue-600 hover:bg-blue-700"
							>
								<SparklesIcon className="mr-2 h-4 w-4" />
								{projecting ? "Proyectando…" : "Proyectar piezas"}
							</Button>
						</div>
						<p className="mt-2 text-[11px] text-muted-foreground">
							Para nacional: cada cerdo se despieza en su lado lomo y su lado
							espinazo (espilomo), captúralos por separado.
						</p>
					</CardContent>
				</Card>
			)}

			{/* Cabecera */}
			<Card>
				<CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-6">
					<div className="space-y-1">
						<Label>No. de medias canal</Label>
						<Input type="number" value={numCanales} onChange={(e) => setNumCanales(e.target.value)} placeholder="Ej. 10" />
						{latestPurchase && (
							<p className="text-[10px] text-blue-600">Auto: última compra ({latestPurchase.numMedias})</p>
						)}
					</div>
					<div className="space-y-1">
						<Label>Kg comprado (total)</Label>
						<Input type="number" value={kgComprado} onChange={(e) => setKgComprado(e.target.value)} placeholder="Ej. 1150" />
						{latestPurchase && (
							<p className="text-[10px] text-blue-600">Auto: última compra ({Number(latestPurchase.kgComprado).toFixed(0)} kg)</p>
						)}
					</div>
					<div className="space-y-1">
						<Label>Proveedor</Label>
						<div className="flex gap-2">
							{PROVIDERS.map((prov) => (
								<button
									key={prov}
									type="button"
									onClick={() => setSupplier(prov)}
									className={cn(
										"flex-1 rounded-lg border px-2 py-2 text-xs font-bold",
										supplier === prov ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted",
									)}
								>
									{prov}
								</button>
							))}
						</div>
					</div>
					<div className="space-y-1">
						<Label>Notas</Label>
						<Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
					</div>
				</CardContent>
			</Card>

			{/* Tabla */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<CardTitle>Piezas</CardTitle>
					<Button variant="outline" size="sm" onClick={addRow}>
						<PlusIcon className="w-4 h-4 mr-2" />
						Agregar pieza
					</Button>
				</CardHeader>
				<CardContent>
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow className="bg-muted/50">
									<TableHead className="w-[30%]">Concepto</TableHead>
									<TableHead className="text-center">Piezas</TableHead>
									<TableHead className="text-center">Peso est.</TableHead>
									<TableHead className="text-center">Peso real</TableHead>
									<TableHead className="text-center">Dif.</TableHead>
									<TableHead className="w-[5%]" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.map((r, idx) => {
									const pz = parseInt(r.pieces) || 0;
									const est = rowEst(r, pz);
									const real = parseFloat(r.kg) || 0;
									const dif = real - est;
									return (
										<TableRow key={idx} className={r.weighed ? "bg-green-50/50" : ""}>
											<TableCell>
												<Input
													value={r.productName}
													onChange={(e) => updateRow(idx, { productName: e.target.value })}
													className="h-9"
												/>
											</TableCell>
											<TableCell>
												<Input
													type="number"
													value={r.pieces}
													onChange={(e) => updateRow(idx, { pieces: e.target.value })}
													className="h-9 text-center"
													placeholder="0"
												/>
											</TableCell>
											<TableCell className="text-center text-sm text-blue-600 font-medium">
												{est > 0 ? est.toFixed(2) : "—"}
											</TableCell>
											<TableCell>
												<Input
													type="number"
													value={r.kg}
													onChange={(e) => updateRow(idx, { kg: e.target.value })}
													className="h-9 text-center"
													placeholder="0.0"
												/>
											</TableCell>
											<TableCell
												className={cn(
													"text-center text-sm font-medium",
													real > 0 ? (dif >= 0 ? "text-green-600" : "text-red-600") : "text-muted-foreground",
												)}
											>
												{real > 0 ? `${dif >= 0 ? "+" : ""}${dif.toFixed(2)}` : "—"}
											</TableCell>
											<TableCell className="text-center">
												<button type="button" onClick={() => removeRow(idx)} className="text-muted-foreground hover:text-red-500">
													<TrashIcon className="w-4 h-4" />
												</button>
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</div>

					{/* Totales */}
					<div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-5">
						<div className="rounded-lg bg-slate-50 p-3">
							<p className="text-xs text-muted-foreground">Total piezas</p>
							<p className="text-lg font-bold">{totals.piezas}</p>
						</div>
						<div className="rounded-lg bg-blue-50 p-3">
							<p className="text-xs text-muted-foreground">Estimado</p>
							<p className="text-lg font-bold text-blue-700">{fmt(totals.estimado)}</p>
						</div>
						<div className="rounded-lg bg-slate-50 p-3">
							<p className="text-xs text-muted-foreground">Real</p>
							<p className="text-lg font-bold">{fmt(totals.real)}</p>
						</div>
						<div className="rounded-lg bg-slate-50 p-3">
							<p className="text-xs text-muted-foreground">Diferencia</p>
							<p className={cn("text-lg font-bold", totals.diferencia >= 0 ? "text-green-600" : "text-red-600")}>
								{totals.diferencia >= 0 ? "+" : ""}
								{totals.diferencia.toFixed(2)} kg
							</p>
						</div>
						<div className="rounded-lg bg-green-50 p-3">
							<p className="text-xs text-muted-foreground">Rendimiento</p>
							<p className="text-lg font-bold text-green-700">{totals.rendimiento.toFixed(1)}%</p>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Hojas recientes */}
			{sheets && sheets.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>Hojas recientes</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow className="bg-muted/50">
										<TableHead>Fecha</TableHead>
										<TableHead>Proveedor</TableHead>
										<TableHead className="text-center">Canales</TableHead>
										<TableHead className="text-center">Comprado</TableHead>
										<TableHead className="text-center">Real</TableHead>
										<TableHead className="text-center">Rendimiento</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{(sheets as any[]).map((s) => (
										<TableRow key={s.id}>
											<TableCell>{s.sheetDate ?? "—"}</TableCell>
											<TableCell>{s.supplier ?? "—"}</TableCell>
											<TableCell className="text-center">{s.numCanales}</TableCell>
											<TableCell className="text-center">{Number(s.kgComprado).toFixed(0)}</TableCell>
											<TableCell className="text-center">{Number(s.totalKg).toFixed(0)}</TableCell>
											<TableCell className="text-center font-semibold text-blue-700">
												{Number(s.rendimiento).toFixed(1)}%
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
