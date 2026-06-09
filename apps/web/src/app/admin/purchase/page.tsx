"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@finopenpos/ui/components/card";
import { Button } from "@finopenpos/ui/components/button";
import { Input } from "@finopenpos/ui/components/input";
import { Label } from "@finopenpos/ui/components/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@finopenpos/ui/components/table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@finopenpos/ui/components/select";
import { PlusIcon, TrashIcon, SaveIcon, PiggyBankIcon } from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
		{ key: newKey(), supplier: "La Barca", canales: "", kg: "", precio: "", americano: "", nacional: "", verifCanales: "", verifKg: "" },
		{ key: newKey(), supplier: "Valle", canales: "", kg: "", precio: "", americano: "", nacional: "", verifCanales: "", verifKg: "" },
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
			const c = intval(r.canales);
			const k = num(r.kg);
			canales += c;
			kg += k;
			costo += k * num(r.precio);
			americano += intval(r.americano);
			nacional += intval(r.nacional);
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
			{ key: newKey(), supplier: "", canales: "", kg: "", precio: "", americano: "", nacional: "", verifCanales: "", verifKg: "" },
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
				canales: intval(r.canales),
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
		<div className="space-y-6 max-w-5xl">
			<div className="flex items-center justify-between gap-4 flex-wrap">
				<div>
					<h1 className="flex items-center gap-2 text-2xl font-bold">
						<PiggyBankIcon className="h-6 w-6 text-rose-600" />
						Compra del día
					</h1>
					<p className="text-sm text-muted-foreground">
						El día empieza aquí: registra la compra en pie de los cerdos por
						proveedor. Es la base para el rendimiento.
					</p>
				</div>
				<Button onClick={save} disabled={saveMutation.isPending}>
					<SaveIcon className="w-4 h-4 mr-2" />
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
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<div className="rounded-lg bg-slate-50 p-3">
					<p className="text-xs text-muted-foreground">Canales en pie</p>
					<p className="text-2xl font-bold">{totals.canales}</p>
				</div>
				<div className="rounded-lg bg-rose-50 p-3">
					<p className="text-xs text-muted-foreground">Kg en pie</p>
					<p className="text-2xl font-bold text-rose-700">
						{totals.kg.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
					</p>
				</div>
				<div className="rounded-lg bg-slate-50 p-3">
					<p className="text-xs text-muted-foreground">Kg / canal</p>
					<p className="text-2xl font-bold">{totals.pesoCanal.toFixed(1)}</p>
				</div>
				<div className="rounded-lg bg-slate-50 p-3">
					<p className="text-xs text-muted-foreground">Precio prom / kg</p>
					<p className="text-2xl font-bold">
						{totals.precioProm > 0 ? `$${totals.precioProm.toFixed(2)}` : "—"}
					</p>
				</div>
			</div>

			{/* Tabla compra en pie */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<CardTitle>Compra en pie por proveedor</CardTitle>
					<Button variant="outline" size="sm" onClick={addRow}>
						<PlusIcon className="w-4 h-4 mr-2" />
						Agregar proveedor
					</Button>
				</CardHeader>
				<CardContent>
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow className="bg-muted/50">
									<TableHead className="min-w-[150px]">Proveedor</TableHead>
									<TableHead className="text-center">Canales</TableHead>
									<TableHead className="text-center">Kg en pie</TableHead>
									<TableHead className="text-center">$ / kg</TableHead>
									<TableHead className="text-center" title="Composición: canales americanos">Amer.</TableHead>
									<TableHead className="text-center" title="Composición: canales nacionales">Nac.</TableHead>
									<TableHead className="text-center">Kg/canal</TableHead>
									<TableHead className="w-[5%]" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.map((r) => {
									const pesoCanal =
										intval(r.canales) > 0 ? num(r.kg) / intval(r.canales) : 0;
									return (
										<TableRow key={r.key}>
											<TableCell>
												<Input
													value={r.supplier}
													onChange={(e) => patch(r.key, { supplier: e.target.value })}
													className="h-9"
													placeholder="Proveedor"
												/>
											</TableCell>
											<TableCell>
												<Input
													type="number"
													value={r.canales}
													onChange={(e) => patch(r.key, { canales: e.target.value })}
													className="h-9 text-center"
													placeholder="0"
												/>
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
													onChange={(e) => patch(r.key, { precio: e.target.value })}
													className="h-9 text-center"
													placeholder="0.00"
												/>
											</TableCell>
											<TableCell>
												<Input
													type="number"
													value={r.americano}
													onChange={(e) => patch(r.key, { americano: e.target.value })}
													className="h-9 text-center"
													placeholder="0"
												/>
											</TableCell>
											<TableCell>
												<Input
													type="number"
													value={r.nacional}
													onChange={(e) => patch(r.key, { nacional: e.target.value })}
													className="h-9 text-center"
													placeholder="0"
												/>
											</TableCell>
											<TableCell className="text-center text-sm font-medium text-muted-foreground">
												{pesoCanal > 0 ? pesoCanal.toFixed(1) : "—"}
											</TableCell>
											<TableCell className="text-center">
												<button
													type="button"
													onClick={() => removeRow(r.key)}
													className="text-muted-foreground hover:text-red-500"
												>
													<TrashIcon className="w-4 h-4" />
												</button>
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</div>
					<p className="mt-3 text-[11px] text-muted-foreground">
						"Amer./Nac." son la composición por tipo de canal (opcional). El total
						de canales y kg alimenta el módulo de Rendimiento.
					</p>
				</CardContent>
			</Card>

			{/* Verificación en CEDIS (peso real recibido al llegar) */}
			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-base">Verificación en CEDIS</CardTitle>
					<p className="text-xs text-muted-foreground">
						Al llegar los canales, pésalos y registra lo realmente recibido. La
						diferencia contra la compra es la merma.
					</p>
				</CardHeader>
				<CardContent>
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow className="bg-muted/50">
									<TableHead className="min-w-[150px]">Proveedor</TableHead>
									<TableHead className="text-center">Comprado (kg)</TableHead>
									<TableHead className="text-center">Canales recibidos</TableHead>
									<TableHead className="text-center">Kg recibidos</TableHead>
									<TableHead className="text-center">Merma</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows
									.filter((r) => r.supplier.trim() || r.canales || r.kg)
									.map((r) => {
										const compradoKg = num(r.kg);
										const recibido = num(r.verifKg);
										const merma = compradoKg > 0 && recibido > 0 ? compradoKg - recibido : 0;
										const mermaPct =
											compradoKg > 0 && recibido > 0 ? (merma / compradoKg) * 100 : 0;
										return (
											<TableRow key={r.key}>
												<TableCell className="font-medium">
													{r.supplier || "—"}
												</TableCell>
												<TableCell className="text-center text-muted-foreground">
													{compradoKg > 0 ? compradoKg.toFixed(0) : "—"}
												</TableCell>
												<TableCell>
													<Input
														type="number"
														value={r.verifCanales}
														onChange={(e) => patch(r.key, { verifCanales: e.target.value })}
														className="h-9 text-center"
														placeholder={r.canales || "0"}
													/>
												</TableCell>
												<TableCell>
													<Input
														type="number"
														step="0.001"
														value={r.verifKg}
														onChange={(e) => patch(r.key, { verifKg: e.target.value })}
														className="h-9 text-center"
														placeholder="0"
													/>
												</TableCell>
												<TableCell className="text-center text-sm font-medium">
													{recibido > 0 && compradoKg > 0 ? (
														<span className={merma > 0 ? "text-orange-600" : "text-green-600"}>
															{merma > 0 ? "-" : "+"}
															{Math.abs(merma).toFixed(1)} kg ({mermaPct.toFixed(1)}%)
														</span>
													) : (
														<span className="text-muted-foreground">—</span>
													)}
												</TableCell>
											</TableRow>
										);
									})}
							</TableBody>
						</Table>
					</div>
					<p className="mt-3 text-[11px] text-muted-foreground">
						Si registras los kg recibidos, el Rendimiento usa ese peso (real del
						CEDIS) como base en lugar del comprado.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
