"use client";

import { Button } from "@finopenpos/ui/components/button";
import { Input } from "@finopenpos/ui/components/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@finopenpos/ui/components/table";
import { cn } from "@finopenpos/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangleIcon,
	CheckIcon,
	PlusIcon,
	SaveIcon,
	ScaleIcon,
	XIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AntonellaSlot } from "@/components/antonella-slot";
import { useTRPC } from "@/lib/trpc/client";

type Mode = "canal" | "total";
interface SupState {
	id: number;
	supplier: string;
	americano: number;
	nacional: number;
	enPieKg: number;
	costo: number;
	mode: Mode;
	tara: number;
	weights: number[];
	totalKg: number;
	totalCanales: number;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmt = (n: number, d = 1) =>
	n.toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d });

function supKg(s: SupState) {
	return s.mode === "total"
		? s.totalKg
		: s.weights.reduce((a, b) => a + (Number(b) || 0), 0);
}
function supCount(s: SupState) {
	return s.mode === "total" ? s.totalCanales : s.weights.length;
}

export default function CedisPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [date, setDate] = useState(todayISO());

	const dayOpts = trpc.yields.cedisDay.queryOptions({ date });
	const { data: dayData } = useQuery(dayOpts);
	const weighedKg = dayData?.weighedKg ?? 0;

	const [sups, setSups] = useState<SupState[]>([]);

	// Carga el estado local desde el servidor al cambiar de día
	useEffect(() => {
		if (!dayData) return;
		setSups(
			dayData.rows.map((r) => ({
				id: r.id,
				supplier: r.supplier,
				americano: r.americano,
				nacional: r.nacional,
				enPieKg: r.enPieKg,
				costo: r.costo,
				mode: r.detail.mode as Mode,
				tara: r.detail.tara,
				weights: r.detail.weights,
				totalKg: r.detail.totalKg,
				totalCanales: r.detail.totalCanales,
			})),
		);
	}, [dayData]);

	const saveMut = useMutation(
		trpc.yields.saveCedis.mutationOptions({
			onSuccess: () => {
				toast.success("Verificación CEDIS guardada");
				queryClient.invalidateQueries({ queryKey: dayOpts.queryKey });
			},
			onError: (e: any) => toast.error(e.message ?? "Error al guardar"),
		}),
	);

	const [newSupplier, setNewSupplier] = useState("");
	const addSupplierMut = useMutation(
		trpc.yields.addCedisSupplier.mutationOptions({
			onSuccess: () => {
				toast.success("Proveedor agregado");
				setNewSupplier("");
				queryClient.invalidateQueries({ queryKey: dayOpts.queryKey });
			},
			onError: (e: any) => toast.error(e.message ?? "Error"),
		}),
	);
	const addSupplier = () => {
		const name = newSupplier.trim();
		if (!name) return;
		addSupplierMut.mutate({ date, supplier: name });
	};

	const patch = (id: number, p: Partial<SupState>) =>
		setSups((arr) => arr.map((s) => (s.id === id ? { ...s, ...p } : s)));

	// Totales / KPIs
	const totals = useMemo(() => {
		let count = 0;
		let kg = 0;
		let enPieKg = 0;
		let costo = 0;
		for (const s of sups) {
			count += supCount(s);
			kg += supKg(s);
			enPieKg += s.enPieKg;
			costo += s.costo;
		}
		const merma = enPieKg - kg;
		const mermaPct = enPieKg > 0 ? (merma / enPieKg) * 100 : 0;
		const precioReal = kg > 0 ? costo / kg : 0;
		return { count, kg, enPieKg, merma, mermaPct, precioReal };
	}, [sups]);

	const save = () =>
		saveMut.mutate({
			rows: sups.map((s) => ({
				id: s.id,
				mode: s.mode,
				tara: s.tara,
				weights: s.weights,
				totalKg: s.totalKg,
				totalCanales: s.totalCanales,
			})),
		});

	return (
		<div className="mx-auto max-w-5xl space-y-5">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="flex items-center gap-2 font-bold text-2xl">
						<ScaleIcon className="h-6 w-6 text-primary" />
						Verificación en CEDIS
					</h1>
					<p className="text-muted-foreground text-sm">
						Peso real de las medias canales al llegar. La diferencia contra el
						peso en pie de la{" "}
						<Link
							href="/admin/purchase"
							className="font-medium text-primary underline-offset-2 hover:underline"
						>
							Compra del día
						</Link>{" "}
						es la merma.
					</p>
				</div>
				<div className="flex items-end gap-2">
					<label className="text-xs text-muted-foreground">
						Día
						<Input
							type="date"
							value={date}
							onChange={(e) => setDate(e.target.value)}
							className="mt-1 h-9"
						/>
					</label>
					<Button onClick={save} disabled={saveMut.isPending || !sups.length}>
						<SaveIcon className="mr-1.5 h-4 w-4" />
						{saveMut.isPending ? "Guardando…" : "Guardar"}
					</Button>
				</div>
			</div>

			<AntonellaSlot
				data={{
					tone: totals.mermaPct > 12 ? "alerta" : "sugerencia",
					titulo: "Verificación CEDIS",
					texto:
						"Pesa cada media canal (le descuento la tara del cargador). Calculo la merma contra el peso en pie y el precio real por kilo del día.",
					acciones: ["¿Cuál es la merma normal?", "¿Precio real por kilo?"],
				}}
			/>

			{/* KPIs del día */}
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<Kpi label="medias pesadas" value={String(totals.count)} />
				<Kpi
					label="kg canal (real)"
					value={fmt(totals.kg, 0)}
					accent="primary"
				/>
				{totals.enPieKg > 0 && (
					<Kpi
						label={`merma (${fmt(Math.abs(totals.mermaPct), 0)}%)`}
						value={`−${fmt(Math.abs(totals.merma), 0)}`}
						accent="amber"
					/>
				)}
				{totals.precioReal > 0 && (
					<Kpi label="precio real / kg" value={`$${fmt(totals.precioReal, 1)}`} />
				)}
			</div>

			{/* Proveedores */}
			{sups.length === 0 ? (
				<div className="rounded-xl border bg-card p-8 text-center text-muted-foreground text-sm">
					No hay proveedores para este día. Agrégalos aquí abajo o captúralos en
					la{" "}
					<Link href="/admin/purchase" className="font-medium text-primary underline">
						Compra del día
					</Link>{" "}
					(así también se calcula la merma).
				</div>
			) : (
				<div className="space-y-3">
					{sups.map((s) => (
						<SupplierCard key={s.id} s={s} onPatch={(p) => patch(s.id, p)} />
					))}
				</div>
			)}

			{/* Agregar proveedor directo en CEDIS */}
			<div className="flex items-center gap-2 rounded-xl border border-dashed p-3">
				<Input
					value={newSupplier}
					onChange={(e) => setNewSupplier(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") addSupplier();
					}}
					placeholder="Nombre del proveedor (ej. Maldonado)"
					className="h-9 max-w-xs"
				/>
				<Button
					variant="outline"
					size="sm"
					onClick={addSupplier}
					disabled={!newSupplier.trim() || addSupplierMut.isPending}
				>
					<PlusIcon className="mr-1.5 h-4 w-4" />
					Agregar proveedor
				</Button>
			</div>

			{/* Lote del día: composición + valor/canal + reconciliación */}
			{sups.length > 0 && (
				<LoteDelDia sups={sups} totalKg={totals.kg} weighedKg={weighedKg} />
			)}
		</div>
	);
}

function LoteDelDia({
	sups,
	totalKg,
	weighedKg,
}: {
	sups: SupState[];
	totalKg: number;
	weighedKg: number;
}) {
	const totA = sups.reduce((s, x) => s + x.americano, 0);
	const totN = sups.reduce((s, x) => s + x.nacional, 0);
	const totCanales = totA + totN;
	const pesoCanal = totCanales > 0 ? totalKg / totCanales : 0;

	const dif = weighedKg - totalKg;
	const ok = totalKg > 0 && Math.abs(dif) / totalKg < 0.02;

	return (
		<div className="space-y-2 rounded-xl border bg-card p-4">
			<div className="flex flex-wrap items-end justify-between gap-2">
				<h2 className="font-bold text-base">Lote del día</h2>
				<p className="text-muted-foreground text-xs">
					Composición por tipo de canal y valor por canal. El peso real sale de
					la verificación de arriba.
				</p>
			</div>
			<div className="overflow-x-auto">
				<Table>
					<TableHeader>
						<TableRow className="bg-muted/50">
							<TableHead className="min-w-[140px]">Proveedor</TableHead>
							<TableHead className="text-center">Americano</TableHead>
							<TableHead className="text-center">Nacional</TableHead>
							<TableHead className="text-center">Canales</TableHead>
							<TableHead className="text-center">kg peso canal</TableHead>
							<TableHead
								className="text-center"
								title="costo de la compra ÷ canales"
							>
								valor / canal
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{sups.map((s) => {
							const canales = s.americano + s.nacional;
							const kg = supKg(s);
							const valorCanal = canales > 0 ? s.costo / canales : 0;
							return (
								<TableRow key={s.id}>
									<TableCell className="font-medium">{s.supplier}</TableCell>
									<TableCell className="text-center">
										{s.americano || "—"}
									</TableCell>
									<TableCell className="text-center">
										{s.nacional || "—"}
									</TableCell>
									<TableCell className="text-center font-semibold">
										{canales}
									</TableCell>
									<TableCell className="text-center font-mono text-xs">
										{kg > 0 ? fmt(kg, 1) : "—"}
									</TableCell>
									<TableCell className="text-center font-mono text-xs">
										{valorCanal > 0 ? `$${fmt(valorCanal, 0)}` : "—"}
									</TableCell>
								</TableRow>
							);
						})}
						<TableRow className="bg-muted/30 font-semibold">
							<TableCell>Total</TableCell>
							<TableCell className="text-center">{totA}</TableCell>
							<TableCell className="text-center">{totN}</TableCell>
							<TableCell className="text-center">{totCanales}</TableCell>
							<TableCell className="text-center font-mono text-xs">
								{fmt(totalKg, 0)} kg
							</TableCell>
							<TableCell className="text-center font-mono text-xs text-muted-foreground">
								{pesoCanal > 0 ? `${fmt(pesoCanal, 1)} kg/canal` : "—"}
							</TableCell>
						</TableRow>
					</TableBody>
				</Table>
			</div>

			{totalKg > 0 && weighedKg > 0 && (
				<div
					className={cn(
						"flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm",
						ok
							? "border-[var(--cg-green)]/30 bg-[var(--cg-green-wash)]"
							: "border-[var(--cg-amber)]/40 bg-[var(--cg-amber-wash)]",
					)}
				>
					{ok ? (
						<CheckIcon className="h-4 w-4 text-[var(--cg-green)]" />
					) : (
						<AlertTriangleIcon className="h-4 w-4 text-[var(--cg-amber)]" />
					)}
					<span>
						Peso canal <b>{fmt(totalKg, 0)} kg</b> vs piezas pesadas{" "}
						<b>{fmt(weighedKg, 0)} kg</b>
					</span>
					<span
						className={cn(
							"rounded-full px-2 py-0.5 font-bold text-white text-xs",
							ok ? "bg-[var(--cg-green)]" : "bg-[var(--cg-amber)]",
						)}
					>
						{ok
							? "cuadra"
							: dif < 0
								? `faltan ${fmt(Math.abs(dif), 0)} kg por pesar`
								: `sobran ${fmt(dif, 0)} kg`}
					</span>
				</div>
			)}
		</div>
	);
}

function Kpi({
	label,
	value,
	accent,
}: {
	label: string;
	value: string;
	accent?: "primary" | "amber";
}) {
	return (
		<div
			className={cn(
				"rounded-xl border p-3",
				accent === "primary" && "border-primary/30 bg-primary/5",
				accent === "amber" && "border-[var(--cg-amber)]/30 bg-[var(--cg-amber-wash)]",
			)}
		>
			<div
				className={cn(
					"font-display text-2xl tabular-nums",
					accent === "primary" && "text-primary",
					accent === "amber" && "text-[var(--cg-amber)]",
				)}
			>
				{value}
			</div>
			<div className="text-[11px] text-muted-foreground">{label}</div>
		</div>
	);
}

function SupplierCard({
	s,
	onPatch,
}: {
	s: SupState;
	onPatch: (p: Partial<SupState>) => void;
}) {
	const [text, setText] = useState("");
	const kg = supKg(s);
	const merma = s.enPieKg - kg;
	const mermaPct = s.enPieKg > 0 ? (1 - kg / s.enPieKg) * 100 : 0;
	const grossNum = Number.parseFloat((text || "").replace(",", "."));
	const netPreview = !Number.isNaN(grossNum)
		? Math.round((grossNum - s.tara) * 100) / 100
		: null;

	const addWeight = () => {
		const g = Number.parseFloat((text || "").replace(",", "."));
		if (Number.isNaN(g)) return;
		const net = Math.round((g - s.tara) * 100) / 100;
		if (net > 0) {
			onPatch({ weights: [...s.weights, net] });
			setText("");
		}
	};
	const removeWeight = (i: number) =>
		onPatch({ weights: s.weights.filter((_, idx) => idx !== i) });

	return (
		<div className="rounded-xl border bg-card p-3.5">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<span className="flex items-center gap-2 font-bold">
					<span className="h-2.5 w-2.5 rounded-full bg-primary" />
					{s.supplier || "—"}
				</span>
				{/* Modo */}
				<div className="flex overflow-hidden rounded-lg border text-xs">
					{(["canal", "total"] as Mode[]).map((m) => (
						<button
							key={m}
							type="button"
							onClick={() => onPatch({ mode: m })}
							className={cn(
								"px-3 py-1.5 font-semibold transition-colors",
								s.mode === m
									? "bg-primary text-primary-foreground"
									: "text-muted-foreground hover:bg-muted",
							)}
						>
							{m === "canal" ? "Canal × canal" : "Peso total"}
						</button>
					))}
				</div>
				{s.mode === "canal" && (
					<label
						className="flex items-center gap-1.5 text-xs text-muted-foreground"
						title="Peso del cargador que se descuenta de cada lectura"
					>
						Tara cargador
						<Input
							type="number"
							step="0.01"
							value={s.tara || ""}
							onChange={(e) => onPatch({ tara: Number(e.target.value) || 0 })}
							placeholder="0"
							className="h-8 w-20 text-center"
						/>
						kg
					</label>
				)}
				<span className="text-muted-foreground text-xs">
					<b className="text-foreground">{supCount(s)}</b>{" "}
					{supCount(s) === 1 ? "media" : "medias"} ·{" "}
					<b className="text-foreground">{fmt(kg, 1)}</b> kg canal
					{s.enPieKg > 0 && kg > 0 && (
						<span className="ml-1 text-[var(--cg-amber)]">
							merma {fmt(merma, 0)} kg ({fmt(mermaPct, 0)}%)
						</span>
					)}
				</span>
			</div>

			{s.mode === "canal" ? (
				<div className="mt-3">
					<div className="flex items-center gap-2">
						<Input
							inputMode="decimal"
							placeholder={s.tara > 0 ? "+ peso báscula (bruto)" : "+ kg de una media canal"}
							value={text}
							onChange={(e) => setText(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") addWeight();
							}}
							onBlur={addWeight}
							className="h-9 max-w-xs"
						/>
						{s.tara > 0 && netPreview != null ? (
							<span className="text-muted-foreground text-xs">
								{fmt(grossNum)} − {fmt(s.tara)} ={" "}
								<b className={netPreview > 0 ? "text-foreground" : "text-red-600"}>
									{fmt(netPreview)}
								</b>{" "}
								kg media canal
							</span>
						) : (
							<span className="text-muted-foreground text-xs">
								{s.tara > 0
									? "se descuenta la tara — Enter para agregar"
									: "Enter para agregar"}
							</span>
						)}
					</div>
					<div className="mt-2 flex flex-wrap gap-1.5">
						{s.weights.length === 0 && (
							<span className="text-muted-foreground text-xs">
								Aún sin medias canales pesadas.
							</span>
						)}
						{s.weights.map((w, i) => (
							<span
								key={`${i}-${w}`}
								className="inline-flex items-center gap-1 rounded-full border bg-secondary px-2 py-1 font-mono text-xs"
							>
								<span className="text-muted-foreground">{i + 1}.</span>
								{fmt(w)}
								<button
									type="button"
									onClick={() => removeWeight(i)}
									aria-label="quitar"
									className="text-muted-foreground hover:text-red-600"
								>
									<XIcon className="h-3 w-3" />
								</button>
							</span>
						))}
					</div>
				</div>
			) : (
				<div className="mt-3 flex flex-wrap gap-4">
					<label className="text-xs text-muted-foreground">
						Peso total recibido
						<div className="mt-1 flex items-center gap-1">
							<Input
								type="number"
								step="0.001"
								value={s.totalKg || ""}
								onChange={(e) => onPatch({ totalKg: Number(e.target.value) || 0 })}
								placeholder="0"
								className="h-9 w-32"
							/>
							kg
						</div>
					</label>
					<label className="text-xs text-muted-foreground">
						Canales recibidas
						<Input
							type="number"
							value={s.totalCanales || ""}
							onChange={(e) =>
								onPatch({ totalCanales: Number.parseInt(e.target.value, 10) || 0 })
							}
							placeholder="0"
							className="mt-1 h-9 w-24"
						/>
					</label>
				</div>
			)}
		</div>
	);
}
