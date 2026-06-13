"use client";

import { Button } from "@finopenpos/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@finopenpos/ui/components/card";
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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@finopenpos/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	PiggyBankIcon,
	PlusIcon,
	SaveIcon,
	ScaleIcon,
	TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

type Row = {
	key: string;
	supplier: string;
	canales: string;
	kg: string;
	precio: string;
	americano: string;
	nacional: string;
	verifCanales: string;
	verifKg: string;
};

const todayISO = () => {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
		d.getDate(),
	).padStart(2, "0")}`;
};

let _k = 0;
const newKey = () => `r${_k++}`;
function emptyRows(): Row[] {
	return [
		{
			key: newKey(),
			supplier: "La Barca",
			canales: "",
			kg: "",
			precio: "",
			americano: "",
			nacional: "",
			verifCanales: "",
			verifKg: "",
		},
		{
			key: newKey(),
			supplier: "Valle",
			canales: "",
			kg: "",
			precio: "",
			americano: "",
			nacional: "",
			verifCanales: "",
			verifKg: "",
		},
	];
}

const num = (s: string) => Number.parseFloat(s) || 0;
const intval = (s: string) => Number.parseInt(s, 10) || 0;

export default function PurchaseDayPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [date, setDate] = useState(todayISO());
	const [rows, setRows] = useState<Row[]>(emptyRows());

	const { data: savedDates = [] } = useQuery(
		trpc.yields.purchaseDates.queryOptions(),
	) as { data: string[] };

	const byDateOpts = trpc.yields.purchasesByDate.queryOptions({ date });
	const { data: dayRows } = useQuery(byDateOpts) as {
		data:
			| {
					supplier: string;
					canales: number;
					kg: number;
					precio: number;
					americano: number;
					nacional: number;
					verifCanales: number;
					verifKg: number;
			  }[]
			| undefined;
	};

	// Carga los renglones del día seleccionado (cuando cambia la fecha / datos)
	const loadedFor = useRef<string>("");
	useEffect(() => {
		if (dayRows === undefined) return;
		if (loadedFor.current === date) return;
		loadedFor.current = date;
		if (dayRows.length > 0) {
			setRows(
				dayRows.map((r) => ({
					key: newKey(),
					supplier: r.supplier,
					canales: r.canales ? String(r.canales) : "",
					kg: r.kg ? String(r.kg) : "",
					precio: r.precio ? String(r.precio) : "",
					americano: r.americano ? String(r.americano) : "",
					nacional: r.nacional ? String(r.nacional) : "",
					verifCanales: r.verifCanales ? String(r.verifCanales) : "",
					verifKg: r.verifKg ? String(r.verifKg) : "",
				})),
			);
		} else {
			setRows(emptyRows());
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [dayRows, date]);

	const saveMutation = useMutation(
		trpc.yields.savePurchases.mutationOptions({
			onSuccess: (d: any) => {
				toast.success(`Compra del día guardada (${d.count} proveedor(es))`);
				queryClient.invalidateQueries({
					queryKey: trpc.yields.purchaseDates.queryOptions().queryKey,
				});
				queryClient.invalidateQueries({
					queryKey: trpc.yields.purchasesByDate.queryOptions({ date }).queryKey,
				});
				queryClient.invalidateQueries({
					queryKey: trpc.yields.latestPurchase.queryOptions().queryKey,
				});
			},
			onError: (e: any) => toast.error(e.message ?? "Error al guardar"),
		}),
	);

	const totals = useMemo(() => {
		let canales = 0;
		let kg = 0;
		let costo = 0;
		let americano = 0;
		let nacional = 0;
		for (const r of rows) {
			const a = intval(r.americano);
			const n = intval(r.nacional);
			const k = num(r.kg);
			americano += a;
			nacional += n;
			canales += a + n; // el total de canales se deriva del tipo
			kg += k;
			costo += k * num(r.precio);
		}
		return {
			canales,
			kg,
			costo,
			americano,
			nacional,
			pesoCanal: canales > 0 ? kg / canales : 0,
			precioProm: kg > 0 ? costo / kg : 0,
		};
	}, [rows]);

	const patch = (key: string, p: Partial<Row>) =>
		setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...p } : r)));
	const addRow = () =>
		setRows((prev) => [
			...prev,
			{
				key: newKey(),
				supplier: "",
				canales: "",
				kg: "",
				precio: "",
				americano: "",
				nacional: "",
				verifCanales: "",
				verifKg: "",
			},
		]);
	const removeRow = (key: string) =>
		setRows((prev) => prev.filter((r) => r.key !== key));

	const startFresh = () => {
		if (
			rows.some((r) => r.canales || r.kg) &&
			!window.confirm(
				"¿Empezar la compra de este día en ceros? Se limpian los renglones (no se borra lo ya guardado hasta que guardes).",
			)
		)
			return;
		setRows(emptyRows());
		loadedFor.current = date; // evita que el efecto la recargue
	};

	const save = () => {
		saveMutation.mutate({
			date,
			rows: rows.map((r) => ({
				supplier: r.supplier,
				canales: intval(r.americano) + intval(r.nacional),
				kg: num(r.kg),
				precio: num(r.precio),
				americano: intval(r.americano),
				nacional: intval(r.nacional),
				verifCanales: intval(r.verifCanales),
				verifKg: num(r.verifKg),
			})),
		});
	};

	return (
		<div className="max-w-5xl space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="flex items-center gap-2 font-bold text-2xl">
						<PiggyBankIcon className="h-6 w-6 text-rose-600" />
						Compra del día
					</h1>
					<p className="text-muted-foreground text-sm">
						El día empieza aquí: registra la compra en pie de los cerdos por
						proveedor. Es la base para el rendimiento.
					</p>
				</div>
				<Button onClick={save} disabled={saveMutation.isPending}>
					<SaveIcon className="mr-2 h-4 w-4" />
					{saveMutation.isPending ? "Guardando…" : "Guardar compra del día"}
				</Button>
			</div>

			{/* Día de operación */}
			<Card>
				<CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
					<div className="space-y-1">
						<Label>Día de operación</Label>
						<Input
							type="date"
							value={date}
							onChange={(e) => setDate(e.target.value || todayISO())}
						/>
					</div>
					<div className="space-y-1">
						<Label>Días guardados</Label>
						<Select value="" onValueChange={(v) => v && setDate(v)}>
							<SelectTrigger>
								<SelectValue placeholder="Cargar un día anterior…" />
							</SelectTrigger>
							<SelectContent className="max-h-72">
								{savedDates.length === 0 ? (
									<SelectItem value="_none" disabled>
										Sin días guardados
									</SelectItem>
								) : (
									savedDates.map((d) => (
										<SelectItem key={d} value={d}>
											{d}
										</SelectItem>
									))
								)}
							</SelectContent>
						</Select>
					</div>
					<div className="flex items-end gap-2">
						<Button variant="outline" onClick={() => setDate(todayISO())}>
							Hoy
						</Button>
						<Button variant="outline" onClick={startFresh}>
							Empezar de ceros
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* KPIs */}
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
				<div className="rounded-lg border-2 border-rose-200 bg-rose-50 p-3">
					<p className="text-muted-foreground text-xs">🐷 Americanos</p>
					<p className="font-bold text-2xl text-rose-700">{totals.americano}</p>
				</div>
				<div className="rounded-lg border-2 border-emerald-200 bg-emerald-50 p-3">
					<p className="text-muted-foreground text-xs">🐷 Nacionales</p>
					<p className="font-bold text-2xl text-emerald-700">
						{totals.nacional}
					</p>
				</div>
				<div className="rounded-lg bg-slate-50 p-3">
					<p className="text-muted-foreground text-xs">Canales (total)</p>
					<p className="font-bold text-2xl">{totals.canales}</p>
				</div>
				<div className="rounded-lg bg-slate-50 p-3">
					<p className="text-muted-foreground text-xs">Kg en pie</p>
					<p className="font-bold text-2xl">
						{totals.kg.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
					</p>
				</div>
				<div className="rounded-lg bg-slate-50 p-3">
					<p className="text-muted-foreground text-xs">Kg / canal</p>
					<p className="font-bold text-2xl">{totals.pesoCanal.toFixed(1)}</p>
				</div>
			</div>

			{/* Tabla compra en pie */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<CardTitle>Compra en pie por proveedor</CardTitle>
					<Button variant="outline" size="sm" onClick={addRow}>
						<PlusIcon className="mr-2 h-4 w-4" />
						Agregar proveedor
					</Button>
				</CardHeader>
				<CardContent>
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow className="bg-muted/50">
									<TableHead className="min-w-[150px]">Proveedor</TableHead>
									<TableHead
										className="text-center text-rose-700"
										title="Cerdos americanos (canal completo ≈105 kg)"
									>
										🐷 Americanos
									</TableHead>
									<TableHead
										className="text-center text-emerald-700"
										title="Cerdos nacionales (→ 1 lado Lomo + 1 lado Espilomo)"
									>
										🐷 Nacionales
									</TableHead>
									<TableHead className="text-center">Canales</TableHead>
									<TableHead className="text-center">Kg en pie</TableHead>
									<TableHead className="text-center">$ / kg</TableHead>
									<TableHead className="text-center">Kg/canal</TableHead>
									<TableHead className="w-[5%]" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.map((r) => {
									const units = intval(r.americano) + intval(r.nacional);
									const pesoCanal = units > 0 ? num(r.kg) / units : 0;
									return (
										<TableRow key={r.key}>
											<TableCell>
												<Input
													value={r.supplier}
													onChange={(e) =>
														patch(r.key, { supplier: e.target.value })
													}
													className="h-9"
													placeholder="Proveedor"
												/>
											</TableCell>
											<TableCell>
												<Input
													type="number"
													value={r.americano}
													onChange={(e) =>
														patch(r.key, { americano: e.target.value })
													}
													className="h-9 text-center font-semibold text-rose-700"
													placeholder="0"
												/>
											</TableCell>
											<TableCell>
												<Input
													type="number"
													value={r.nacional}
													onChange={(e) =>
														patch(r.key, { nacional: e.target.value })
													}
													className="h-9 text-center font-semibold text-emerald-700"
													placeholder="0"
												/>
											</TableCell>
											<TableCell className="text-center font-bold text-sm">
												{units > 0 ? units : "—"}
											</TableCell>
											<TableCell>
												<Input
													type="number"
													step="0.001"
													value={r.kg}
													onChange={(e) => patch(r.key, { kg: e.target.value })}
													className="h-9 text-center"
													placeholder="0"
												/>
											</TableCell>
											<TableCell>
												<Input
													type="number"
													step="0.01"
													value={r.precio}
													onChange={(e) =>
														patch(r.key, { precio: e.target.value })
													}
													className="h-9 text-center"
													placeholder="0.00"
												/>
											</TableCell>
											<TableCell className="text-center font-medium text-muted-foreground text-sm">
												{pesoCanal > 0 ? pesoCanal.toFixed(1) : "—"}
											</TableCell>
											<TableCell className="text-center">
												<button
													type="button"
													onClick={() => removeRow(r.key)}
													className="text-muted-foreground hover:text-red-500"
												>
													<TrashIcon className="h-4 w-4" />
												</button>
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</div>
					<p className="mt-3 text-[11px] text-muted-foreground">
						Captura cuántos{" "}
						<strong className="text-rose-700">Americanos</strong> y{" "}
						<strong className="text-emerald-700">Nacionales</strong> compraste:
						de ahí salen los <strong>canales disponibles para Despiece</strong>{" "}
						(1 americano = 1 canal completo; 1 nacional = 1 lado Lomo + 1 lado
						Espilomo). El total de kg también alimenta el Rendimiento.
					</p>
				</CardContent>
			</Card>

			{/* Verificación en CEDIS — ahora en su propia pantalla */}
			<Card className="border-primary/20 bg-primary/5">
				<CardContent className="flex flex-wrap items-center justify-between gap-3 py-5">
					<div className="flex items-start gap-3">
						<ScaleIcon className="mt-0.5 h-5 w-5 text-primary" />
						<div>
							<p className="font-semibold text-sm">Verificación en CEDIS</p>
							<p className="text-muted-foreground text-xs">
								Al llegar los canales, pésalos canal por canal (con tara) para
								calcular la merma y el precio real por kilo.
							</p>
						</div>
					</div>
					<Button asChild>
						<Link href="/admin/cedis">Verificar en CEDIS →</Link>
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
