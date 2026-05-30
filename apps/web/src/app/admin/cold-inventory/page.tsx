"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@finopenpos/ui/components/card";
import { Button } from "@finopenpos/ui/components/button";
import { Input } from "@finopenpos/ui/components/input";
import { Label } from "@finopenpos/ui/components/label";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@finopenpos/ui/components/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@finopenpos/ui/components/table";
import { SnowflakeIcon, FlameIcon } from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type Dir = "toFrozen" | "toFresh";

export default function ColdInventoryPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const [dialog, setDialog] = useState<{
		dir: Dir;
		product: any;
	} | null>(null);
	const [kg, setKg] = useState("");
	const [pieces, setPieces] = useState("");

	const listKey = trpc.coldInventory.list.queryOptions().queryKey;
	const { data: items } = useQuery(trpc.coldInventory.list.queryOptions());

	const onDone = () => {
		setDialog(null);
		setKg("");
		setPieces("");
		queryClient.invalidateQueries({ queryKey: listKey });
	};

	const toFrozen = useMutation(
		trpc.coldInventory.toFrozen.mutationOptions({
			onSuccess: () => {
				toast.success("Enviado a inventario frío");
				onDone();
			},
			onError: (e: any) => toast.error(e.message ?? "Error"),
		}),
	);
	const toFresh = useMutation(
		trpc.coldInventory.toFresh.mutationOptions({
			onSuccess: () => {
				toast.success("Descongelado a inventario fresco");
				onDone();
			},
			onError: (e: any) => toast.error(e.message ?? "Error"),
		}),
	);

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		const list = (items ?? []) as any[];
		if (!q) return list;
		return list.filter((p) => p.name.toLowerCase().includes(q));
	}, [items, search]);

	function openDialog(dir: Dir, product: any) {
		setDialog({ dir, product });
		setKg("");
		setPieces("");
	}

	function confirm() {
		if (!dialog) return;
		const payload = {
			productId: dialog.product.id,
			kg: parseFloat(kg) || 0,
			pieces: parseInt(pieces) || 0,
		};
		if (payload.kg <= 0 && payload.pieces <= 0) {
			toast.error("Indica kg o piezas a transferir");
			return;
		}
		if (dialog.dir === "toFrozen") toFrozen.mutate(payload);
		else toFresh.mutate(payload);
	}

	return (
		<div className="space-y-6 max-w-5xl">
			<div>
				<h1 className="text-2xl font-bold">Inventario Frío</h1>
				<p className="text-sm text-muted-foreground">
					Solo el inventario fresco se vende. Lo que no se vende se envía a frío; para vender de
					frío, primero descongélalo a fresco.
				</p>
			</div>

			<div className="max-w-sm">
				<Label>Buscar producto</Label>
				<Input
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder="Ej. PIERNA, LOMO…"
				/>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Existencias</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow className="bg-muted/50">
									<TableHead className="w-[34%]">Producto</TableHead>
									<TableHead className="text-center">Fresco (kg / pz)</TableHead>
									<TableHead className="text-center">Frío (kg / pz)</TableHead>
									<TableHead className="text-center">Acciones</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filtered.length === 0 ? (
									<TableRow>
										<TableCell colSpan={4} className="text-center text-muted-foreground py-6">
											Sin existencias
										</TableCell>
									</TableRow>
								) : (
									filtered.map((p) => (
										<TableRow key={p.id}>
											<TableCell className="font-medium">{p.name}</TableCell>
											<TableCell className="text-center">
												{Number(p.stockKg).toFixed(2)} / {p.stockPieces}
											</TableCell>
											<TableCell className="text-center text-blue-700">
												{Number(p.stockKgFrozen).toFixed(2)} / {p.stockPiecesFrozen}
											</TableCell>
											<TableCell>
												<div className="flex justify-center gap-2">
													<Button
														variant="outline"
														size="sm"
														onClick={() => openDialog("toFrozen", p)}
													>
														<SnowflakeIcon className="w-4 h-4 mr-1 text-blue-600" />
														A frío
													</Button>
													<Button
														variant="outline"
														size="sm"
														onClick={() => openDialog("toFresh", p)}
													>
														<FlameIcon className="w-4 h-4 mr-1 text-orange-600" />
														A fresco
													</Button>
												</div>
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>

			{/* Dialog de transferencia */}
			<Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{dialog?.dir === "toFrozen" ? "Enviar a frío" : "Descongelar a fresco"} —{" "}
							{dialog?.product?.name}
						</DialogTitle>
					</DialogHeader>
					<div className="grid gap-4 py-2">
						<div className="text-xs text-muted-foreground">
							{dialog?.dir === "toFrozen"
								? `Disponible fresco: ${Number(dialog?.product?.stockKg).toFixed(2)} kg / ${dialog?.product?.stockPieces} pz`
								: `Disponible frío: ${Number(dialog?.product?.stockKgFrozen).toFixed(2)} kg / ${dialog?.product?.stockPiecesFrozen} pz`}
						</div>
						<div className="space-y-1">
							<Label>Kg a transferir</Label>
							<Input type="number" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="0.0" />
						</div>
						<div className="space-y-1">
							<Label>Piezas a transferir</Label>
							<Input
								type="number"
								value={pieces}
								onChange={(e) => setPieces(e.target.value)}
								placeholder="0"
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="secondary" onClick={() => setDialog(null)}>
							Cancelar
						</Button>
						<Button
							onClick={confirm}
							disabled={toFrozen.isPending || toFresh.isPending}
						>
							Confirmar
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
