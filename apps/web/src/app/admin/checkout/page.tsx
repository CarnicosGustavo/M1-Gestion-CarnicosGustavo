"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@finopenpos/ui/components/card";
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
import { BanknoteIcon, ReceiptTextIcon } from "lucide-react";
import { cn } from "@finopenpos/ui/lib/utils";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { TicketModal } from "@/components/ticket-modal";

const money = (n: number) =>
	n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function CheckoutPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
	const [prices, setPrices] = useState<Record<number, string>>({});
	const [payType, setPayType] = useState<"contado" | "credito">("contado");
	const [methodId, setMethodId] = useState<string>("");
	const [ticketOrderId, setTicketOrderId] = useState<number | null>(null);

	const readyKey = trpc.orders.getReadyToCharge.queryOptions().queryKey;
	const { data: ordersReady } = useQuery({
		...trpc.orders.getReadyToCharge.queryOptions(),
		refetchInterval: 10000,
	});
	const { data: paymentMethods } = useQuery(trpc.paymentMethods.list.queryOptions()) as {
		data: { id: number; name: string }[] | undefined;
	};

	const selectedOrder = useMemo(
		() => (ordersReady ?? []).find((o: any) => o.id === selectedOrderId) as any,
		[ordersReady, selectedOrderId],
	);

	// Pre-selecciona el pedido si viene en la URL (?order=N), p. ej. desde el
	// botón flotante de la estación de pesaje. Solo una vez.
	const appliedUrlRef = useRef(false);
	useEffect(() => {
		if (appliedUrlRef.current || !ordersReady) return;
		try {
			const ord = parseInt(
				new URLSearchParams(window.location.search).get("order") ?? "",
				10,
			);
			if (Number.isFinite(ord) && (ordersReady as any[]).some((o) => o.id === ord)) {
				setSelectedOrderId(ord);
				appliedUrlRef.current = true;
			}
		} catch {
			/* noop */
		}
	}, [ordersReady]);

	// Precarga los precios al abrir un pedido: precio guardado del cliente o el del item
	useEffect(() => {
		if (selectedOrder) {
			const next: Record<number, string> = {};
			for (const it of selectedOrder.items) {
				const saved = it.savedPriceKg != null ? Number(it.savedPriceKg) : null;
				const current = it.unitPrice != null ? Number(it.unitPrice) / 100 : null;
				const val = saved ?? current ?? 0;
				next[it.id] = val > 0 ? String(val) : "";
			}
			setPrices(next);
			setMethodId(paymentMethods?.[0]?.id?.toString() ?? "");
			setPayType("contado");
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedOrderId]);

	const chargeMut = useMutation(
		trpc.orders.priceAndCharge.mutationOptions({
			onSuccess: (_data: any, variables: any) => {
				toast.success("Pedido cobrado y precios actualizados");
				// Abre el ticket inmediatamente (imprimir / enviar por WhatsApp)
				setTicketOrderId(variables.orderId);
				setSelectedOrderId(null);
				queryClient.invalidateQueries({ queryKey: readyKey });
			},
			onError: (e: any) => toast.error(e.message ?? "Error al cobrar"),
		}),
	);

	const total = useMemo(() => {
		if (!selectedOrder) return 0;
		return selectedOrder.items.reduce((sum: number, it: any) => {
			const kg = Number(it.quantityKg) || 0;
			const price = parseFloat(prices[it.id] || "0") || 0;
			return sum + kg * price;
		}, 0);
	}, [selectedOrder, prices]);

	function cobrar() {
		if (!selectedOrder) return;
		const items = selectedOrder.items.map((it: any) => ({
			orderItemId: it.id,
			productId: it.productId,
			pricePerKg: parseFloat(prices[it.id] || "0") || 0,
		}));
		chargeMut.mutate({
			orderId: selectedOrder.id,
			paymentType: payType,
			paymentMethodId: payType === "contado" ? parseInt(methodId) || undefined : undefined,
			items,
		});
	}

	const list = (ordersReady ?? []) as any[];

	return (
		<div className="mx-auto max-w-7xl">
			<div className="grid h-[calc(100vh-160px)] grid-cols-1 gap-6 lg:grid-cols-3">
				{/* Lista de pedidos listos para cobro */}
				<Card className="flex flex-col overflow-hidden lg:col-span-1">
					<CardHeader className="bg-muted/50 border-b">
						<CardTitle className="flex items-center gap-2">
							<BanknoteIcon className="w-5 h-5" />
							Cola de Cobro
						</CardTitle>
						<CardDescription>{list.length} pedido(s) pesado(s)</CardDescription>
					</CardHeader>
					<CardContent className="p-0 overflow-y-auto flex-1">
						{list.length === 0 ? (
							<div className="p-8 text-center text-muted-foreground text-sm">
								No hay pedidos listos para cobro.
							</div>
						) : (
							<div className="divide-y">
								{list.map((o) => (
									<button
										key={o.id}
										onClick={() => setSelectedOrderId(o.id)}
										className={cn(
											"w-full text-left p-4 hover:bg-accent transition-colors",
											selectedOrderId === o.id && "bg-accent",
										)}
									>
										<div className="font-medium">
											#{o.id} – {o.customerName || "Consumidor Final"}
										</div>
										<div className="text-xs text-muted-foreground">
											{o.items.length} producto(s)
										</div>
									</button>
								))}
							</div>
						)}
					</CardContent>
				</Card>

				{/* Detalle de cobro */}
				<Card className="flex flex-col overflow-hidden lg:col-span-2">
					{selectedOrder ? (
						<>
							<CardHeader className="border-b py-3 px-6">
								<CardTitle className="text-lg">
									{selectedOrder.customerName || "Consumidor Final"}
								</CardTitle>
								<CardDescription>Pedido #{selectedOrder.id}</CardDescription>
							</CardHeader>
							<CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
								<div className="overflow-x-auto">
									<Table>
										<TableHeader>
											<TableRow className="bg-muted/50">
												<TableHead>Producto</TableHead>
												<TableHead className="text-center">Kg</TableHead>
												<TableHead className="text-center w-[28%]">Precio / Kg</TableHead>
												<TableHead className="text-right">Subtotal</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{selectedOrder.items.map((it: any) => {
												const kg = Number(it.quantityKg) || 0;
												const price = parseFloat(prices[it.id] || "0") || 0;
												return (
													<TableRow key={it.id}>
														<TableCell className="font-medium">{it.productName}</TableCell>
														<TableCell className="text-center font-mono">
															{kg.toFixed(3)}
														</TableCell>
														<TableCell>
															<Input
																type="number"
																step="0.01"
																value={prices[it.id] ?? ""}
																onChange={(e) =>
																	setPrices((p) => ({ ...p, [it.id]: e.target.value }))
																}
																onFocus={(e) => e.currentTarget.select()}
																className="h-9 text-center"
																placeholder="0.00"
															/>
														</TableCell>
														<TableCell className="text-right font-semibold">
															{money(kg * price)}
														</TableCell>
													</TableRow>
												);
											})}
										</TableBody>
									</Table>
								</div>

								<div className="flex justify-end">
									<div className="rounded-xl bg-slate-50 px-6 py-3 text-right">
										<div className="text-xs text-muted-foreground">Total</div>
										<div className="text-3xl font-bold">{money(total)}</div>
									</div>
								</div>
							</CardContent>

							{/* Footer cobro */}
							<div className="border-t p-4 space-y-3">
								<div className="grid grid-cols-2 gap-2">
									<button
										type="button"
										onClick={() => setPayType("contado")}
										className={cn(
											"rounded-lg border px-3 py-2 text-sm font-bold",
											payType === "contado"
												? "border-green-600 bg-green-50 text-green-700"
												: "border-border",
										)}
									>
										Contado
									</button>
									<button
										type="button"
										onClick={() => setPayType("credito")}
										className={cn(
											"rounded-lg border px-3 py-2 text-sm font-bold",
											payType === "credito"
												? "border-orange-500 bg-orange-50 text-orange-700"
												: "border-border",
										)}
									>
										Crédito
									</button>
								</div>
								{payType === "contado" && (
									<Select value={methodId} onValueChange={setMethodId}>
										<SelectTrigger>
											<SelectValue placeholder="Método de pago" />
										</SelectTrigger>
										<SelectContent>
											{(paymentMethods ?? []).map((pm) => (
												<SelectItem key={pm.id} value={pm.id.toString()}>
													{pm.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
								<Button
									className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700"
									disabled={chargeMut.isPending || total <= 0}
									onClick={cobrar}
								>
									<ReceiptTextIcon className="w-5 h-5 mr-2" />
									{chargeMut.isPending ? "Cobrando…" : `Cobrar ${money(total)}`}
								</Button>
								<p className="text-center text-[11px] text-muted-foreground">
									Al cobrar se guardan estos precios para el próximo pedido del cliente.
								</p>
							</div>
						</>
					) : (
						<div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-12">
							<BanknoteIcon className="w-24 h-24 mb-6 opacity-10" />
							<h3 className="text-2xl font-medium">Cola de Cobro</h3>
							<p className="max-w-md text-center mt-2">
								Selecciona un pedido ya pesado para fijar precios y cobrar.
							</p>
						</div>
					)}
				</Card>
			</div>

			{/* Ticket: se abre automáticamente al cobrar (imprimir / WhatsApp) */}
			{ticketOrderId && (
				<TicketModal
					orderId={ticketOrderId}
					open={!!ticketOrderId}
					onClose={() => setTicketOrderId(null)}
				/>
			)}
		</div>
	);
}
