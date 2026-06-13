"use client";

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
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheckIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { AntonellaSlot } from "@/components/antonella-slot";
import { useTRPC } from "@/lib/trpc/client";

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmt = (n: number, d = 1) =>
	n.toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function CierrePage() {
	const trpc = useTRPC();
	const [date, setDate] = useState(todayISO());
	const { data } = useQuery(trpc.yields.cierre.queryOptions({ date }));

	const rows = data?.rows ?? [];

	// Agrupar por categoría
	const grouped = useMemo(() => {
		const m = new Map<string, typeof rows>();
		for (const r of rows) {
			const cat = r.category || "Otros";
			const arr = m.get(cat) ?? [];
			arr.push(r);
			m.set(cat, arr);
		}
		return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
	}, [rows]);

	const totals = useMemo(() => {
		const t = { entroPz: 0, entroKg: 0, salioPz: 0, salioKg: 0 };
		for (const r of rows) {
			t.entroPz += r.entroPz;
			t.entroKg += r.entroKg;
			t.salioPz += r.salioPz;
			t.salioKg += r.salioKg;
		}
		return t;
	}, [rows]);
	const quedoPz = totals.entroPz - totals.salioPz;
	const quedoKg = totals.entroKg - totals.salioKg;

	return (
		<div className="mx-auto max-w-5xl space-y-5">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="flex items-center gap-2 font-bold text-2xl">
						<ClipboardCheckIcon className="h-6 w-6 text-primary" />
						Cierre del día
					</h1>
					<p className="text-muted-foreground text-sm">
						Lo que entró (producido) menos lo que salió (vendido) es lo que
						quedó en inventario, por producto.
					</p>
				</div>
				<label className="text-xs text-muted-foreground">
					Día
					<Input
						type="date"
						value={date}
						onChange={(e) => setDate(e.target.value)}
						className="mt-1 h-9"
					/>
				</label>
			</div>

			<AntonellaSlot
				data={{
					tone: "sugerencia",
					titulo: "Cierre del día",
					texto:
						"Comparo lo producido vs lo vendido para decirte qué quedó en stock. Si algo no cuadra, te ayudo a encontrar dónde.",
					acciones: ["¿Qué quedó en stock hoy?", "¿Algo no cuadra?"],
				}}
			/>

			{/* Hero KPIs: Entró − Salió = Quedó */}
			<div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
				<HeroKpi
					label="Entró · producido"
					pz={totals.entroPz}
					kg={totals.entroKg}
				/>
				<Operator symbol="−" />
				<HeroKpi
					label="Salió · vendido"
					pz={totals.salioPz}
					kg={totals.salioKg}
				/>
				<Operator symbol="=" />
				<HeroKpi
					label="Quedó · stock"
					pz={quedoPz}
					kg={quedoKg}
					accent={quedoPz >= 0 && quedoKg >= 0 ? "green" : "red"}
				/>
			</div>

			{/* Tabla por categoría */}
			{rows.length === 0 ? (
				<div className="rounded-xl border bg-card p-8 text-center text-muted-foreground text-sm">
					Sin movimientos de producción o venta para este día.
				</div>
			) : (
				<div className="overflow-x-auto rounded-xl border">
					<Table>
						<TableHeader>
							<TableRow className="bg-muted/50">
								<TableHead className="min-w-[160px]">Producto</TableHead>
								<TableHead className="text-center">Entró (pz / kg)</TableHead>
								<TableHead className="text-center">Salió (pz / kg)</TableHead>
								<TableHead className="text-center">Quedó (pz / kg)</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{grouped.map(([cat, items]) => (
								<CategoryBlock key={cat} cat={cat} items={items} />
							))}
						</TableBody>
					</Table>
				</div>
			)}
		</div>
	);
}

function CategoryBlock({
	cat,
	items,
}: {
	cat: string;
	items: {
		productId: number;
		name: string;
		entroPz: number;
		entroKg: number;
		salioPz: number;
		salioKg: number;
	}[];
}) {
	return (
		<>
			<TableRow className="bg-muted/30">
				<TableCell
					colSpan={4}
					className="py-1.5 font-semibold text-[11px] text-muted-foreground uppercase tracking-wide"
				>
					{cat}
				</TableCell>
			</TableRow>
			{items.map((r) => {
				const qPz = r.entroPz - r.salioPz;
				const qKg = r.entroKg - r.salioKg;
				return (
					<TableRow key={r.productId}>
						<TableCell className="font-medium">{r.name}</TableCell>
						<TableCell className="text-center font-mono text-xs">
							{r.entroPz} / {fmt(r.entroKg)}
						</TableCell>
						<TableCell className="text-center font-mono text-xs text-muted-foreground">
							{r.salioPz} / {fmt(r.salioKg)}
						</TableCell>
						<TableCell
							className={cn(
								"text-center font-mono font-bold text-xs",
								qPz < 0 || qKg < 0 ? "text-red-600" : "text-[var(--cg-green)]",
							)}
						>
							{qPz} / {fmt(qKg)}
						</TableCell>
					</TableRow>
				);
			})}
		</>
	);
}

function HeroKpi({
	label,
	pz,
	kg,
	accent,
}: {
	label: string;
	pz: number;
	kg: number;
	accent?: "green" | "red";
}) {
	return (
		<div
			className={cn(
				"rounded-2xl border p-4 text-center",
				accent === "green" && "border-[var(--cg-green)]/30 bg-[var(--cg-green-wash)]",
				accent === "red" && "border-red-300 bg-red-50",
			)}
		>
			<div className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wide">
				{label}
			</div>
			<div
				className={cn(
					"mt-1 font-display text-3xl tabular-nums",
					accent === "green" && "text-[var(--cg-green)]",
					accent === "red" && "text-red-600",
				)}
			>
				{pz} pz
			</div>
			<div className="font-mono text-muted-foreground text-sm">{fmt(kg)} kg</div>
		</div>
	);
}

function Operator({ symbol }: { symbol: string }) {
	return (
		<div className="flex items-center justify-center font-display text-3xl text-muted-foreground/60">
			{symbol}
		</div>
	);
}
