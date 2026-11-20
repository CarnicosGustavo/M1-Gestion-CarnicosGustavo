"use client";

import { Button } from "@finopenpos/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@finopenpos/ui/components/card";
import { Input } from "@finopenpos/ui/components/input";
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
import { cn } from "@finopenpos/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BanknoteIcon, ReceiptTextIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
	initialLinePrice,
	lineChargeSubtotal,
} from "@/app/admin/checkout/checkout-logic";
import { TicketModal } from "@/components/ticket-modal";
import { useTRPC } from "@/lib/trpc/client";

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
	const { data: paymentMethods } = useQuery(
		trpc.paymentMethods.list.queryOptions(),
	) as {
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
			const ord = Number.parseInt(
				new URLSearchParams(window.location.search).get("order") ?? "",
				10,
			);
			if (
				Number.isFinite(ord) &&
				(ordersReady as any[]).some((o) => o.id === ord)
			) {
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
				next[it.id] = initialLinePrice(
					Number(it.quantityKg ?? 0),
					it.savedPriceKg,
					it.unitPrice,
				);
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
			const pieces = Number(it.quantityPieces) || 0;
			const price = Number.parseFloat(prices[it.id] || "0") || 0;
			return sum + lineChargeSubtotal(kg, pieces, price);
		}, 0);
	}, [selectedOrder, prices]);

	const hasInvalidChargeablePrice = useMemo(() => {
		if (!selectedOrder) return false;
		return selectedOrder.items.some((it: any) => {
			const kg = Number(it.quantityKg) || 0;
			const pieces = Number(it.quantityPieces) || 0;
			if (kg <= 0 && pieces <= 0) return false;
			const price = Number.parseFloat(prices[it.id] || "0") || 0;
			return !Number.isFinite(price) || price <= 0;
		});
	}, [selectedOrder, prices]);

	function cobrar() {
		if (!selectedOrder) return;
		const items = selectedOrder.items.map((it: any) => ({
			orderItemId: it.id,
			productId: it.productId,
			pricePerKg: Number.parseFloat(prices[it.id] || "0") || 0,
		}));
		chargeMut.mutate({
			orderId: selectedOrder.id,
			paymentType: payType,
			paymentMethodId:
				payType === "contado"
					? Number.parseInt(methodId) || undefined
					: undefined,
			items,
		});
	}

	const list = (ordersReady ?? []) as any[];

	return (
		<div className="mx-auto max-w-7xl">
			<div className="grid h-[calc(100vh-160px)] grid-cols-1 gap-6 lg:grid-cols-3">
				{/* Lista de pedidos listos para cobro */}
				<Card className="flex flex-col overflow-hidden lg:col-span-1">
					<CardHeader className="border-b bg-muted/50">
						<CardTitle className="flex items-center gap-2">
							<BanknoteIcon className="h-5 w-5" />
							Cola de Cobro
						</CardTitle>
						<CardDescription>{list.length} pedido(s) pesado(s)</CardDescription>
					</CardHeader>
					<CardContent className="flex-1 overflow-y-auto p-0">
						{list.length === 0 ? (
							<div className="p-8 text-center text-muted-foreground text-sm">
								No hay pedidos listos para cobro.
							</div>
						) : (
							<div className="divide-y">
								{list.map((o) => (
									<button
										type="button"
										key={o.id}
										onClick={() => setSelectedOrderId(o.id)}
										className={cn(
											"w-full p-4 text-left transition-colors hover:bg-accent",
											selectedOrderId === o.id && "bg-accent",
										)}
									>
										<div className="font-medium">
											#{o.id} – {o.customerName || "Consumidor Final"}
										</div>
										<div className="text-muted-foreground text-xs">
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
							<CardHeader className="border-b px-6 py-3">
								<CardTitle className="text-lg">
									{selectedOrder.customerName || "Consumidor Final"}
								</CardTitle>
								<CardDescription>Pedido #{selectedOrder.id}</CardDescription>
							</CardHeader>
							<CardContent className="flex-1 space-y-4 overflow-y-auto p-6">
								<div className="overflow-x-auto">
									<Table>
										<TableHeader>
											<TableRow className="bg-muted/50">
												<TableHead>Producto</TableHead>
												<TableHead className="text-center">Cantidad</TableHead>
												<TableHead className="w-[28%] text-center">
													Precio
												</TableHead>
												<TableHead className="text-right">Subtotal</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{selectedOrder.items.map((it: any) => {
												const kg = Number(it.quantityKg) || 0;
												const pieces = Number(it.quantityPieces) || 0;
												const price =
													Number.parseFloat(prices[it.id] || "0") || 0;
												const hasInvalidPrice =
													(kg > 0 || pieces > 0) &&
													(!Number.isFinite(price) || price <= 0);
												return (
													<TableRow key={it.id}>
														<TableCell className="font-medium">
															{it.productName}
														</TableCell>
														<TableCell className="text-center font-mono">
															{kg > 0 ? `${kg.toFixed(3)} kg` : `${pieces} pza`}
														</TableCell>
														<TableCell>
															<Input
																type="number"
																step="0.01"
																value={prices[it.id] ?? ""}
																onChange={(e) =>
																	setPrices((p) => ({
																		...p,
																		[it.id]: e.target.value,
																	}))
																}
																onFocus={(e) => e.currentTarget.select()}
																className={cn(
																	"h-9 text-center",
																	hasInvalidPrice &&
																		"border-red-500 text-red-600 focus-visible:ring-red-500",
																)}
																placeholder="0.00"
															/>
														</TableCell>
														<TableCell
															className={cn(
																"text-right font-semibold",
																hasInvalidPrice && "text-red-600",
															)}
														>
															{money(lineChargeSubtotal(kg, pieces, price))}
														</TableCell>
													</TableRow>
												);
											})}
										</TableBody>
									</Table>
								</div>

								<div className="flex justify-end">
									<div className="rounded-xl bg-slate-50 px-6 py-3 text-right">
										<div className="text-muted-foreground text-xs">Total</div>
										<div className="font-bold text-3xl">{money(total)}</div>
									</div>
								</div>
							</CardContent>

							{/* Footer cobro */}
							<div className="space-y-3 border-t p-4">
								<div className="grid grid-cols-2 gap-2">
									<button
										type="button"
										onClick={() => setPayType("contado")}
										className={cn(
											"rounded-lg border px-3 py-2 font-bold text-sm",
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
											"rounded-lg border px-3 py-2 font-bold text-sm",
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
									className="h-14 w-full bg-green-600 font-bold text-lg hover:bg-green-700"
									disabled={
										chargeMut.isPending ||
										total <= 0 ||
										hasInvalidChargeablePrice
									}
									onClick={cobrar}
								>
									<ReceiptTextIcon className="mr-2 h-5 w-5" />
									{chargeMut.isPending ? "Cobrando…" : `Cobrar ${money(total)}`}
								</Button>
								<p className="text-center text-[11px] text-muted-foreground">
									Al cobrar se guardan estos precios para el próximo pedido del
									cliente.
								</p>
							</div>
						</>
					) : (
						<div className="flex flex-1 flex-col items-center justify-center p-12 text-muted-foreground">
							<BanknoteIcon className="mb-6 h-24 w-24 opacity-10" />
							<h3 className="font-medium text-2xl">Cola de Cobro</h3>
							<p className="mt-2 max-w-md text-center">
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
