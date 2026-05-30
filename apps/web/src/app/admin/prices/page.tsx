"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@finopenpos/ui/components/card";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@finopenpos/ui/components/table";
import { SaveIcon } from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

type PriceRow = {
	productId: number;
	productName: string;
	category: string | null;
	pricePerKg: string; // editable
	pricePerPiece: string; // editable
	hasCustomPrice: boolean;
};

export default function PricesPage() {
	const trpc = useTRPC();
	const [customerId, setCustomerId] = useState<string>("");
	const [search, setSearch] = useState("");
	const [rows, setRows] = useState<PriceRow[]>([]);

	const { data: customers } = useQuery(trpc.customers.list.queryOptions()) as {
		data: { id: number; name: string | null }[] | undefined;
	};

	const { data: prices, refetch } = useQuery({
		...trpc.customerPrices.getByCustomer.queryOptions({
			customerId: parseInt(customerId) || 0,
		}),
		enabled: !!customerId,
	});

	useEffect(() => {
		if (prices) {
			setRows(
				(prices as any[]).map((p) => ({
					productId: p.productId,
					productName: p.productName,
					category: p.category,
					pricePerKg: p.pricePerKg != null ? String(p.pricePerKg) : "",
					pricePerPiece: p.pricePerPiece != null ? String(p.pricePerPiece) : "",
					hasCustomPrice: p.hasCustomPrice,
				})),
			);
		}
	}, [prices]);

	const saveMutation = useMutation(
		trpc.customerPrices.bulkUpsert.mutationOptions({
			onSuccess: (res: any) => {
				toast.success(`Precios guardados (${res.saved} productos)`);
				refetch();
			},
			onError: (e: any) => toast.error(e.message ?? "Error al guardar"),
		}),
	);

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return rows;
		return rows.filter((r) => r.productName.toLowerCase().includes(q));
	}, [rows, search]);

	function updateRow(productId: number, patch: Partial<PriceRow>) {
		setRows((prev) =>
			prev.map((r) => (r.productId === productId ? { ...r, ...patch } : r)),
		);
	}

	function save() {
		if (!customerId) {
			toast.error("Selecciona un cliente");
			return;
		}
		const items = rows.map((r) => ({
			productId: r.productId,
			pricePerKg: r.pricePerKg.trim() ? parseFloat(r.pricePerKg) : null,
			pricePerPiece: r.pricePerPiece.trim() ? parseFloat(r.pricePerPiece) : null,
		}));
		saveMutation.mutate({ customerId: parseInt(customerId), items });
	}

	return (
		<div className="space-y-6 max-w-4xl">
			<div className="flex items-center justify-between gap-4 flex-wrap">
				<div>
					<h1 className="text-2xl font-bold">Precios por Cliente</h1>
					<p className="text-sm text-muted-foreground">
						Cada cliente guarda su propia lista de precios. Se usa al generar su pedido y ticket.
					</p>
				</div>
				<Button onClick={save} disabled={saveMutation.isPending || !customerId}>
					<SaveIcon className="w-4 h-4 mr-2" />
					{saveMutation.isPending ? "Guardando…" : "Guardar precios"}
				</Button>
			</div>

			<Card>
				<CardContent className="grid gap-4 sm:grid-cols-2 pt-6">
					<div className="space-y-1">
						<Label>Cliente</Label>
						<Select value={customerId} onValueChange={setCustomerId}>
							<SelectTrigger>
								<SelectValue placeholder="Selecciona un cliente" />
							</SelectTrigger>
							<SelectContent>
								{(customers ?? []).map((c) => (
									<SelectItem key={c.id} value={c.id.toString()}>
										{c.name ?? `Cliente #${c.id}`}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-1">
						<Label>Buscar producto</Label>
						<Input
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Ej. PIERNA, LOMO…"
							disabled={!customerId}
						/>
					</div>
				</CardContent>
			</Card>

			{customerId && (
				<Card>
					<CardHeader>
						<CardTitle>Lista de precios</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow className="bg-muted/50">
										<TableHead className="w-[50%]">Producto</TableHead>
										<TableHead className="text-center">Precio / Kg</TableHead>
										<TableHead className="text-center">Precio / Pieza</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filtered.map((r) => (
										<TableRow
											key={r.productId}
											className={r.hasCustomPrice ? "bg-green-50/40" : ""}
										>
											<TableCell className="font-medium">
												{r.productName}
												{r.category && (
													<span className="ml-2 text-xs text-muted-foreground">
														{r.category}
													</span>
												)}
											</TableCell>
											<TableCell>
												<Input
													type="number"
													value={r.pricePerKg}
													onChange={(e) =>
														updateRow(r.productId, { pricePerKg: e.target.value })
													}
													className="h-9 text-center"
													placeholder="—"
												/>
											</TableCell>
											<TableCell>
												<Input
													type="number"
													value={r.pricePerPiece}
													onChange={(e) =>
														updateRow(r.productId, { pricePerPiece: e.target.value })
													}
													className="h-9 text-center"
													placeholder="—"
												/>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
						<p className="mt-3 text-xs text-muted-foreground">
							Los renglones en verde tienen precio propio guardado para este cliente.
							Deja en blanco para usar el precio base del producto.
						</p>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
