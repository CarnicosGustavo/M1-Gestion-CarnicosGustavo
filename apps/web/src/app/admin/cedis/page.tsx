"use client";

import { Button } from "@finopenpos/ui/components/button";
import { Input } from "@finopenpos/ui/components/input";
import { cn } from "@finopenpos/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SaveIcon, ScaleIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AntonellaSlot } from "@/components/antonella-slot";
import { useTRPC } from "@/lib/trpc/client";

type Mode = "canal" | "total";
interface SupState {
	id: number;
	supplier: string;
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
	const { data: dayRows } = useQuery(dayOpts);

	const [sups, setSups] = useState<SupState[]>([]);

	// Carga el estado local desde el servidor al cambiar de día
	useEffect(() => {
		if (!dayRows) return;
		setSups(
			dayRows.map((r) => ({
				id: r.id,
				supplier: r.supplier,
				enPieKg: r.enPieKg,
				costo: r.costo,
				mode: r.detail.mode as Mode,
				tara: r.detail.tara,
				weights: r.detail.weights,
				totalKg: r.detail.totalKg,
				totalCanales: r.detail.totalCanales,
			})),
		);
	}, [dayRows]);

	const saveMut = useMutation(
		trpc.yields.saveCedis.mutationOptions({
			onSuccess: () => {
				toast.success("Verificación CEDIS guardada");
				queryClient.invalidateQueries({ queryKey: dayOpts.queryKey });
			},
			onError: (e: any) => toast.error(e.message ?? "Error al guardar"),
		}),
	);

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
					No hay proveedores para este día. Captúralos primero en la{" "}
					<Link href="/admin/purchase" className="font-medium text-primary underline">
						Compra del día
					</Link>
					.
				</div>
			) : (
				<div className="space-y-3">
					{sups.map((s) => (
						<SupplierCard
							key={s.id}
							s={s}
							onPatch={(p) => patch(s.id, p)}
						/>
					))}
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
