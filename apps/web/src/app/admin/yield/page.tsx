"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@finopenpos/ui/components/card";
import { Button } from "@finopenpos/ui/components/button";
import { Input } from "@finopenpos/ui/components/input";
import { Label } from "@finopenpos/ui/components/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@finopenpos/ui/components/table";
import { PlusIcon, TrashIcon, SaveIcon } from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type Row = {
	productName: string;
	pieces: string;
	kg: string;
	weighed: boolean;
};

// Conceptos estándar de la hoja de despiece (se pueden agregar/quitar)
const DEFAULT_CONCEPTS = [
	"C/LOMO", "CABEZA", "CACHETE", "CODILLO", "CORBATA", "CUERO", "DESGRASE",
	"ESPALDILLA", "ESPILOMO", "ESPINAZO", "FILETE", "GRASA", "HUESO AMERICANO",
	"HUESO PELON", "JAMON", "JAMON C/G", "JAMON S/H", "LENGUA", "LOMO NACIONAL",
	"LOMO USA", "RECORTE DE MASCARA", "PAPADA", "PATAS", "PECHO", "PIERNA",
	"PULPA C/G", "PULPA DE ESPALDILLA", "RETAZO", "RINON",
];

function blankRows(): Row[] {
	return DEFAULT_CONCEPTS.map((name) => ({
		productName: name,
		pieces: "",
		kg: "",
		weighed: false,
	}));
}

export default function YieldPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const [numCanales, setNumCanales] = useState("");
	const [kgComprado, setKgComprado] = useState("");
	const [notes, setNotes] = useState("");
	const [rows, setRows] = useState<Row[]>(blankRows());

	const { data: sheets } = useQuery(trpc.yields.list.queryOptions());

	const createMutation = useMutation(
		trpc.yields.create.mutationOptions({
			onSuccess: () => {
				toast.success("Hoja de rendimiento guardada");
				setRows(blankRows());
				setNumCanales("");
				setKgComprado("");
				setNotes("");
				queryClient.invalidateQueries({
					queryKey: trpc.yields.list.queryOptions().queryKey,
				});
			},
			onError: (e: any) => toast.error(e.message ?? "Error al guardar"),
		}),
	);

	const totals = useMemo(() => {
		const totalPiezas = rows.reduce((a, r) => a + (parseInt(r.pieces) || 0), 0);
		const totalKg = rows.reduce((a, r) => a + (parseFloat(r.kg) || 0), 0);
		const comprado = parseFloat(kgComprado) || 0;
		const rendimiento = comprado > 0 ? (totalKg / comprado) * 100 : 0;
		return { totalPiezas, totalKg, rendimiento };
	}, [rows, kgComprado]);

	function updateRow(idx: number, patch: Partial<Row>) {
		setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
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
						Captura piezas y kg conforme despiezas los canales para medir el rendimiento.
					</p>
				</div>
				<Button onClick={save} disabled={createMutation.isPending}>
					<SaveIcon className="w-4 h-4 mr-2" />
					{createMutation.isPending ? "Guardando…" : "Guardar hoja"}
				</Button>
			</div>

			{/* Cabecera */}
			<Card>
				<CardContent className="grid gap-4 sm:grid-cols-3 pt-6">
					<div className="space-y-1">
						<Label>No. de canales</Label>
						<Input
							type="number"
							value={numCanales}
							onChange={(e) => setNumCanales(e.target.value)}
							placeholder="Ej. 10"
						/>
					</div>
					<div className="space-y-1">
						<Label>Kg comprado (total cerdos)</Label>
						<Input
							type="number"
							value={kgComprado}
							onChange={(e) => setKgComprado(e.target.value)}
							placeholder="Ej. 1150"
						/>
					</div>
					<div className="space-y-1">
						<Label>Notas</Label>
						<Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
					</div>
				</CardContent>
			</Card>

			{/* Tabla de captura */}
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
									<TableHead className="w-[40%]">Concepto</TableHead>
									<TableHead className="text-center w-[18%]">Piezas</TableHead>
									<TableHead className="text-center w-[22%]">Kg</TableHead>
									<TableHead className="text-center w-[12%]">Pesado</TableHead>
									<TableHead className="w-[8%]" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.map((r, idx) => (
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
										<TableCell>
											<Input
												type="number"
												value={r.kg}
												onChange={(e) => updateRow(idx, { kg: e.target.value })}
												className="h-9 text-center"
												placeholder="0.0"
											/>
										</TableCell>
										<TableCell className="text-center">
											<input
												type="checkbox"
												checked={r.weighed}
												onChange={(e) => updateRow(idx, { weighed: e.target.checked })}
												className="h-5 w-5 accent-green-600"
											/>
										</TableCell>
										<TableCell className="text-center">
											<button
												type="button"
												onClick={() => removeRow(idx)}
												className="text-muted-foreground hover:text-red-500"
												aria-label="Quitar"
											>
												<TrashIcon className="w-4 h-4" />
											</button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>

					{/* Totales */}
					<div className="mt-4 grid grid-cols-3 gap-4 border-t pt-4">
						<div className="rounded-lg bg-slate-50 p-3">
							<p className="text-xs text-muted-foreground">Total piezas</p>
							<p className="text-lg font-bold">{totals.totalPiezas}</p>
						</div>
						<div className="rounded-lg bg-slate-50 p-3">
							<p className="text-xs text-muted-foreground">Total kg piezas</p>
							<p className="text-lg font-bold">{totals.totalKg.toFixed(2)} kg</p>
						</div>
						<div className="rounded-lg bg-blue-50 p-3">
							<p className="text-xs text-muted-foreground">Rendimiento</p>
							<p className="text-lg font-bold text-blue-700">
								{totals.rendimiento.toFixed(1)}%
							</p>
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
										<TableHead className="text-center">Canales</TableHead>
										<TableHead className="text-center">Kg comprado</TableHead>
										<TableHead className="text-center">Kg piezas</TableHead>
										<TableHead className="text-center">Rendimiento</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{sheets.map((s: any) => (
										<TableRow key={s.id}>
											<TableCell>{s.sheetDate ?? "—"}</TableCell>
											<TableCell className="text-center">{s.numCanales}</TableCell>
											<TableCell className="text-center">{Number(s.kgComprado).toFixed(1)}</TableCell>
											<TableCell className="text-center">{Number(s.totalKg).toFixed(1)}</TableCell>
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
