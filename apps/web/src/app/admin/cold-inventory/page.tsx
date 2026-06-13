"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@finopenpos/ui/components/card";
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

			{filtered.length === 0 ? (
				<Card>
					<CardContent className="py-10 text-center text-sm text-muted-foreground">
						Sin existencias
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{filtered.map((p) => (
						<Card key={p.id} className="p-4">
							<h3 className="mb-3 text-sm font-bold uppercase tracking-wide">
								{p.name}
							</h3>

							{/* Estado dual: Fresco (ámbar) | Frío (azul) — del diseño */}
							<div className="mb-4 grid grid-cols-2 gap-3">
								<div className="rounded-lg border border-cg-amber bg-cg-amber-wash p-3 text-center">
									<div className="text-[11px] text-muted-foreground">Fresco</div>
									<div className="text-xl font-bold text-cg-amber">
										{Number(p.stockKg).toFixed(1)}
									</div>
									<div className="text-[10px] text-muted-foreground">
										kg · {p.stockPieces} pz
									</div>
								</div>
								<div className="rounded-lg border border-cg-blue bg-cg-blue-wash p-3 text-center">
									<div className="text-[11px] text-muted-foreground">Frío</div>
									<div className="text-xl font-bold text-cg-blue">
										{Number(p.stockKgFrozen).toFixed(1)}
									</div>
									<div className="text-[10px] text-muted-foreground">
										kg · {p.stockPiecesFrozen} pz
									</div>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-2">
								<Button
									variant="outline"
									size="sm"
									className="border-cg-blue text-cg-blue hover:bg-cg-blue-wash"
									onClick={() => openDialog("toFrozen", p)}
								>
									<SnowflakeIcon className="mr-1 h-4 w-4" />
									A frío
								</Button>
								<Button
									variant="outline"
									size="sm"
									className="border-cg-amber text-cg-amber hover:bg-cg-amber-wash"
									onClick={() => openDialog("toFresh", p)}
								>
									<FlameIcon className="mr-1 h-4 w-4" />
									A fresco
								</Button>
							</div>
						</Card>
					))}
				</div>
			)}

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
