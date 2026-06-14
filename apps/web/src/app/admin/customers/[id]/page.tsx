"use client";

import { use, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@finopenpos/ui/components/card";
import { Button } from "@finopenpos/ui/components/button";
import { Badge } from "@finopenpos/ui/components/badge";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@finopenpos/ui/components/table";
import { Input } from "@finopenpos/ui/components/input";
import { Label } from "@finopenpos/ui/components/label";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@finopenpos/ui/components/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@finopenpos/ui/components/select";
import {
	ArrowLeftIcon,
	PhoneIcon,
	MapPinIcon,
	ReceiptTextIcon,
	TagIcon,
	HandCoinsIcon,
	PrinterIcon,
	BanknoteIcon,
	CheckIcon,
} from "lucide-react";
import Link from "next/link";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import { TicketModal } from "@/components/ticket-modal";
import { PaymentReceiptModal } from "@/components/payment-receipt-modal";

const money = (cents: number) =>
	(cents / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

function statusLabel(s: string): { label: string; color: string } {
	switch (s) {
		case "COMPLETADA":
		case "completed":
			return { label: "Pagada", color: "bg-green-100 text-green-800" };
		case "LISTA_PARA_COBRO":
			return { label: "Lista para cobro", color: "bg-blue-100 text-blue-800" };
		case "PENDIENTE_PESAJE":
			return { label: "Por pesar", color: "bg-yellow-100 text-yellow-800" };
		case "cancelled":
			return { label: "Cancelada", color: "bg-red-100 text-red-800" };
		default:
			return { label: "Pendiente", color: "bg-gray-100 text-gray-700" };
	}
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = use(params);
	const customerId = parseInt(id);
	const trpc = useTRPC();
	const [ticketOrderId, setTicketOrderId] = useState<number | null>(null);
	const [receiptPaymentId, setReceiptPaymentId] = useState<number | null>(null);
	const [abonarOpen, setAbonarOpen] = useState(false);
	const [montoAbono, setMontoAbono] = useState("");
	const [metodoAbono, setMetodoAbono] = useState("efectivo");
	const [notaAbono, setNotaAbono] = useState("");

	useEffect(() => {
		if (abonarOpen) {
			setMontoAbono("");
			setMetodoAbono("efectivo");
			setNotaAbono("");
		}
	}, [abonarOpen]);

	const queryClient = useQueryClient();
	const { data, isLoading } = useQuery(
		trpc.customers.getDetail.queryOptions({ id: customerId }),
	) as { data: any; isLoading: boolean };

	const { data: statement } = useQuery(
		trpc.collections.getStatement.queryOptions({ customerId }),
	) as { data: any };

	const detailKey = trpc.customers.getDetail.queryOptions({
		id: customerId,
	}).queryKey;
	const statementKey = trpc.collections.getStatement.queryOptions({
		customerId,
	}).queryKey;

	const abonarMutation = useCrudMutation({
		mutationOptions: trpc.collections.addPayment.mutationOptions(),
		invalidateKeys: statementKey,
		successMessage: "Abono registrado",
		errorMessage: "No se pudo registrar el abono",
		onSuccess: (res: any) => {
			queryClient.invalidateQueries({ queryKey: detailKey });
			setAbonarOpen(false);
			if (res?.id) setReceiptPaymentId(res.id);
		},
	});

	if (isLoading) {
		return (
			<div className="space-y-6 max-w-4xl">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-32 w-full" />
			</div>
		);
	}
	if (!data) {
		return <div className="text-muted-foreground">Cliente no encontrado</div>;
	}

	const c = data.customer;
	const waPhone = (c.whatsappPhone ?? c.phone ?? "").replace(/[^\d]/g, "");

	return (
		<div className="space-y-6 max-w-4xl">
			{/* Cabecera */}
			<div className="flex items-center justify-between gap-4 flex-wrap">
				<div className="flex items-center gap-3">
					<Link href="/admin/customers">
						<Button variant="ghost" size="icon">
							<ArrowLeftIcon className="h-4 w-4" />
						</Button>
					</Link>
					<div>
						<h1 className="text-2xl font-bold">{c.name ?? `Cliente #${c.id}`}</h1>
						<div className="flex items-center gap-3 text-sm text-muted-foreground">
							{c.phone && (
								<span className="flex items-center gap-1">
									<PhoneIcon className="w-3 h-3" /> {c.phone}
								</span>
							)}
							{c.address && (
								<span className="flex items-center gap-1">
									<MapPinIcon className="w-3 h-3" /> {c.address}
								</span>
							)}
						</div>
					</div>
				</div>
				<div className="flex gap-2">
					{waPhone && (
						<a href={`https://wa.me/${waPhone}`} target="_blank" rel="noreferrer">
							<Button variant="outline" className="border-[#25D366] text-[#1da851]">
								WhatsApp
							</Button>
						</a>
					)}
					<Link href="/admin/prices">
						<Button variant="outline">
							<TagIcon className="w-4 h-4 mr-2" />
							Precios
						</Button>
					</Link>
					<Button onClick={() => setAbonarOpen(true)}>
						<BanknoteIcon className="w-4 h-4 mr-2" />
						Abonar
					</Button>
				</div>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<Card>
					<CardContent className="pt-6">
						<p className="text-xs text-muted-foreground">Pedidos</p>
						<p className="text-2xl font-bold">{data.totalOrders}</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<p className="text-xs text-muted-foreground">Total comprado</p>
						<p className="text-2xl font-bold">{money(data.totalSpent)}</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<p className="text-xs text-muted-foreground">Saldo por cobrar</p>
						<p className={`text-2xl font-bold ${data.balance > 0 ? "text-red-600" : ""}`}>
							{data.balance.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<p className="text-xs text-muted-foreground">Precios propios</p>
						<p className="text-2xl font-bold">{data.customPriceCount}</p>
					</CardContent>
				</Card>
			</div>

			{data.balance > 0 && (
				<Card
					onClick={() => setAbonarOpen(true)}
					className="border-red-200 bg-red-50 hover:bg-red-100 transition-colors cursor-pointer"
				>
					<CardContent className="pt-6 flex items-center justify-between gap-3">
						<span className="flex items-center gap-3">
							<HandCoinsIcon className="w-5 h-5 text-red-600" />
							<span className="text-sm font-medium text-red-900">
								Este cliente tiene saldo pendiente. Registra un abono.
							</span>
						</span>
						<Button size="sm" variant="outline" className="border-red-300 text-red-700">
							<BanknoteIcon className="w-4 h-4 mr-2" />
							Abonar
						</Button>
					</CardContent>
				</Card>
			)}

			{/* Pedidos */}
			<Card>
				<CardHeader>
					<CardTitle>Pedidos</CardTitle>
				</CardHeader>
				<CardContent>
					{data.orders.length === 0 ? (
						<div className="text-sm text-muted-foreground py-6 text-center">
							Este cliente aún no tiene pedidos.
						</div>
					) : (
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow className="bg-muted/50">
										<TableHead>Pedido</TableHead>
										<TableHead>Fecha</TableHead>
										<TableHead className="text-right">Total</TableHead>
										<TableHead className="text-center">Estado</TableHead>
										<TableHead className="text-center">Ticket</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.orders.map((o: any) => {
										const st = statusLabel(o.status);
										return (
											<TableRow key={o.id}>
												<TableCell className="font-medium">
													<Link href={`/admin/orders/${o.id}`} className="hover:underline">
														#{o.id}
													</Link>
												</TableCell>
												<TableCell>
													{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "—"}
												</TableCell>
												<TableCell className="text-right font-semibold">
													{money(o.totalAmount)}
												</TableCell>
												<TableCell className="text-center">
													<Badge className={`${st.color} border-0`}>{st.label}</Badge>
												</TableCell>
												<TableCell className="text-center">
													<Button
														variant="ghost"
														size="sm"
														onClick={() => setTicketOrderId(o.id)}
													>
														<ReceiptTextIcon className="w-4 h-4" />
													</Button>
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Movimientos de cobranza (cargos y abonos) */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<CardTitle>Movimientos de cobranza</CardTitle>
				</CardHeader>
				<CardContent>
					{!statement || statement.ledger.length === 0 ? (
						<div className="text-sm text-muted-foreground py-6 text-center">
							Sin movimientos de cobranza.
						</div>
					) : (
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow className="bg-muted/50">
										<TableHead>Fecha</TableHead>
										<TableHead>Concepto</TableHead>
										<TableHead className="text-right">Cargo</TableHead>
										<TableHead className="text-right">Abono</TableHead>
										<TableHead className="text-center">Recibo</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{statement.ledger.map((l: any, i: number) => (
										<TableRow key={i}>
											<TableCell>{l.fecha ?? "—"}</TableCell>
											<TableCell>{l.concepto}</TableCell>
											<TableCell className="text-right">
												{l.cargo > 0
													? l.cargo.toLocaleString("es-MX", {
															style: "currency",
															currency: "MXN",
														})
													: ""}
											</TableCell>
											<TableCell className="text-right text-green-700">
												{l.abono > 0
													? l.abono.toLocaleString("es-MX", {
															style: "currency",
															currency: "MXN",
														})
													: ""}
											</TableCell>
											<TableCell className="text-center">
												{l.tipo === "abono" ? (
													<Button
														variant="ghost"
														size="sm"
														title="Re-imprimir recibo de abono"
														onClick={() => setReceiptPaymentId(l.id)}
													>
														<PrinterIcon className="w-4 h-4" />
													</Button>
												) : l.orderId ? (
													<Button
														variant="ghost"
														size="sm"
														title="Recibo de compra (ticket)"
														onClick={() => setTicketOrderId(l.orderId)}
													>
														<PrinterIcon className="w-4 h-4" />
													</Button>
												) : null}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Ticket reimprimible */}
			{ticketOrderId && (
				<TicketModal
					orderId={ticketOrderId}
					open={!!ticketOrderId}
					onClose={() => setTicketOrderId(null)}
				/>
			)}

			{/* Recibo de abono */}
			{receiptPaymentId && (
				<PaymentReceiptModal
					customerId={customerId}
					customerName={c.name ?? null}
					paymentId={receiptPaymentId}
					open={!!receiptPaymentId}
					onClose={() => setReceiptPaymentId(null)}
				/>
			)}

			{/* Registrar abono — del diseño (AbonarModal) */}
			<Dialog open={abonarOpen} onOpenChange={setAbonarOpen}>
				<DialogContent className="sm:max-w-[520px]">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<BanknoteIcon className="h-5 w-5 text-primary" />
							Registrar abono
						</DialogTitle>
					</DialogHeader>
					<p className="-mt-2 text-sm text-muted-foreground">
						Cliente:{" "}
						<span className="font-medium text-foreground">
							{c.name ?? `Cliente #${c.id}`}
						</span>
						{" · "}Saldo actual:{" "}
						<span className="font-medium text-foreground">
							{data.balance.toLocaleString("es-MX", {
								style: "currency",
								currency: "MXN",
							})}
						</span>
					</p>
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-1.5">
							<Label htmlFor="abono-monto">Monto</Label>
							<Input
								id="abono-monto"
								type="number"
								min="0"
								step="0.01"
								inputMode="decimal"
								placeholder="0.00"
								value={montoAbono}
								onChange={(e) => setMontoAbono(e.target.value)}
								onFocus={(e) => e.currentTarget.select()}
							/>
						</div>
						<div className="space-y-1.5">
							<Label>Método</Label>
							<Select value={metodoAbono} onValueChange={setMetodoAbono}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="efectivo">Efectivo</SelectItem>
									<SelectItem value="cheque">Cheque</SelectItem>
									<SelectItem value="transferencia">Transferencia</SelectItem>
									<SelectItem value="otro">Otro</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="abono-nota">Nota (opcional)</Label>
						<textarea
							id="abono-nota"
							value={notaAbono}
							onChange={(e) => setNotaAbono(e.target.value)}
							placeholder="Ej: Referencia de transferencia, número de cheque..."
							className="min-h-[80px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
						/>
					</div>
					<div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
						<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Nuevo saldo
						</span>
						<span className="text-xl font-bold text-red-600">
							{(data.balance - (Number.parseFloat(montoAbono) || 0)).toLocaleString(
								"es-MX",
								{ style: "currency", currency: "MXN" },
							)}
						</span>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setAbonarOpen(false)}>
							Cancelar
						</Button>
						<Button
							disabled={
								!(Number.parseFloat(montoAbono) > 0) || abonarMutation.isPending
							}
							onClick={() =>
								abonarMutation.mutate({
									customerId,
									amount: Number.parseFloat(montoAbono),
									method: metodoAbono,
									notes: notaAbono || undefined,
								})
							}
						>
							<CheckIcon className="mr-2 h-4 w-4" />
							{abonarMutation.isPending ? "Registrando..." : "Registrar abono"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
