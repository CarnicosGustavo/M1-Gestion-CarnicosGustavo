"use client";

import { use, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@finopenpos/ui/components/card";
import { Badge } from "@finopenpos/ui/components/badge";
import { Button } from "@finopenpos/ui/components/button";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@finopenpos/ui/components/table";
import {
	ArrowLeftIcon,
	PrinterIcon,
	FilePenIcon,
	TrashIcon,
	BanknoteIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { formatCurrency } from "@/lib/utils";
import { OrderDisassemblyManager } from "@/components/order-disassembly-manager";
import { TicketModal } from "@/components/ticket-modal";
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
import { Label } from "@finopenpos/ui/components/label";
import { Input } from "@finopenpos/ui/components/input";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { toast } from "sonner";

type OrderStatus = "completed" | "pending" | "cancelled";

// Mapea cualquier estado interno a etiqueta y color visible
function getStatusDisplay(status: string): { label: string; color: string } {
	switch (status) {
		case "COMPLETADA":
		case "completed":
			return { label: "Pagada", color: "text-green-600" };
		case "LISTA_PARA_COBRO":
			return { label: "Lista para cobro", color: "text-blue-600" };
		case "PROCESANDO_PAGO":
			return { label: "Procesando pago", color: "text-blue-600" };
		case "PENDIENTE_PESAJE":
			return { label: "Por pesar", color: "text-yellow-600" };
		case "PARCIAL_DISPONIBLE":
			return { label: "Parcial (falta comprar)", color: "text-orange-600" };
		case "cancelled":
			return { label: "Cancelada", color: "text-red-600" };
		default:
			return { label: "Pendiente", color: "text-yellow-600" };
	}
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = use(params);
	const orderId = parseInt(id);
	const router = useRouter();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { data: order, isLoading, refetch } = useQuery(trpc.orders.get.queryOptions({ id: orderId })) as { data: any; isLoading: boolean; refetch: any };
	const t = useTranslations("orders");
	const tc = useTranslations("common");
	const locale = useLocale();

	const [ticketOpen, setTicketOpen] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [payOpen, setPayOpen] = useState(false);
	const [payMethodId, setPayMethodId] = useState<string>("");
	const [editStatus, setEditStatus] = useState<OrderStatus>("pending");
	const [editTotal, setEditTotal] = useState("");

	const { data: paymentMethods } = useQuery(
		trpc.paymentMethods.list.queryOptions(),
	) as { data: { id: number; name: string }[] | undefined };

	const invalidateKey = trpc.orders.list.queryOptions().queryKey;

	const updateMutation = useMutation(
		trpc.orders.update.mutationOptions({
			onSuccess: () => {
				toast.success(t("updated"));
				setEditOpen(false);
				refetch();
				queryClient.invalidateQueries({ queryKey: invalidateKey });
			},
			onError: (err: any) => toast.error(err.message ?? t("updateError")),
		}),
	);

	const deleteMutation = useMutation(
		trpc.orders.delete.mutationOptions({
			onSuccess: () => {
				toast.success(t("deleted"));
				router.push("/admin/orders");
				queryClient.invalidateQueries({ queryKey: invalidateKey });
			},
			onError: (err: any) => toast.error(err.message ?? t("deleteError")),
		}),
	);

	const payMutation = useMutation(
		trpc.orders.completeOrderPayment.mutationOptions({
			onSuccess: () => {
				toast.success("Pedido liquidado y cobrado");
				setPayOpen(false);
				refetch();
				queryClient.invalidateQueries({ queryKey: invalidateKey });
			},
			onError: (err: any) =>
				toast.error(err.message ?? "No se pudo liquidar el pedido"),
		}),
	);

	const openPay = () => {
		setPayMethodId(paymentMethods?.[0]?.id?.toString() ?? "");
		setPayOpen(true);
	};

	const openEdit = () => {
		setEditStatus((order?.status ?? "pending") as OrderStatus);
		setEditTotal(order?.total_amount ? (order.total_amount / 100).toString() : "0");
		setEditOpen(true);
	};

	if (isLoading) {
		return (
			<div className="space-y-6 max-w-3xl">
				<Skeleton className="h-8 w-48" />
				<Card><CardContent className="p-6 space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</CardContent></Card>
			</div>
		);
	}

	if (!order) {
		return <div className="text-muted-foreground">{t("orderNotFound")}</div>;
	}

	const { label: statusLabel, color: statusColor } = getStatusDisplay(order.status);
	const canCharge = order.status === "LISTA_PARA_COBRO";

	return (
		<div className="space-y-6 max-w-3xl">
			{/* ── Cabecera ── */}
			<div className="flex items-center justify-between gap-4 flex-wrap">
				<div className="flex items-center gap-3">
					<Link href="/admin/orders">
						<Button variant="ghost" size="icon">
							<ArrowLeftIcon className="h-4 w-4" />
						</Button>
					</Link>
					<h1 className="text-2xl font-bold">
						{t("orderDetails")} #{order.id}
					</h1>
				</div>

				{/* Acciones */}
				<div className="flex items-center gap-2">
					{canCharge && (
						<Button
							size="sm"
							className="bg-green-600 hover:bg-green-700"
							onClick={openPay}
						>
							<BanknoteIcon className="w-4 h-4 mr-2" />
							Liquidar / Cobrar
						</Button>
					)}
					<Button variant="outline" size="sm" onClick={() => setTicketOpen(true)}>
						<PrinterIcon className="w-4 h-4 mr-2" />
						Imprimir Ticket
					</Button>
					<Button variant="outline" size="sm" onClick={openEdit}>
						<FilePenIcon className="w-4 h-4 mr-2" />
						{tc("edit")}
					</Button>
					<Button
						variant="destructive"
						size="sm"
						onClick={() => setDeleteOpen(true)}
					>
						<TrashIcon className="w-4 h-4 mr-2" />
						{tc("delete")}
					</Button>
				</div>
			</div>

			{/* ── Resumen del pedido ── */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle>{t("orderDetails")}</CardTitle>
						<div className="flex items-center gap-2">
							<span className={`font-semibold ${statusColor}`}>{statusLabel}</span>
							{order.requires_weighing && (
								<Badge variant="secondary" className="bg-yellow-100 text-yellow-900">
									Por Pesar
								</Badge>
							)}
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<dl className="grid gap-3 sm:grid-cols-2 text-sm">
						<div>
							<dt className="text-muted-foreground">{t("customer")}</dt>
							<dd className="font-medium">{order.customer?.name ?? "—"}</dd>
						</div>
						<div>
							<dt className="text-muted-foreground">{tc("total")}</dt>
							<dd className="text-lg font-bold">
								{formatCurrency(order.total_amount, locale)}
							</dd>
						</div>
						<div>
							<dt className="text-muted-foreground">{t("createdAt")}</dt>
							<dd>
								{order.created_at
									? new Date(order.created_at).toLocaleString()
									: "—"}
							</dd>
						</div>
						<div>
							<dt className="text-muted-foreground">Items</dt>
							<dd className="font-medium">
								{order.orderItems?.length ?? 0} productos
							</dd>
						</div>
						{order.notes && (
							<div className="sm:col-span-2">
								<dt className="text-muted-foreground">Notas</dt>
								<dd>{order.notes}</dd>
							</div>
						)}
						{order.delivery_address && (
							<div className="sm:col-span-2">
								<dt className="text-muted-foreground">Dirección</dt>
								<dd>{order.delivery_address}</dd>
							</div>
						)}
						{order.orderItems?.some((item: any) => item.status === "PENDIENTE_COMPRA") && (
							<div>
								<dt className="text-muted-foreground">⚠️ Pendiente de Compra</dt>
								<dd className="font-medium text-red-600">
									{order.orderItems.filter((item: any) => item.status === "PENDIENTE_COMPRA").length} items
								</dd>
							</div>
						)}
					</dl>
				</CardContent>
			</Card>

			<OrderDisassemblyManager
				orderId={orderId}
				orderItems={order.orderItems || []}
				onSuccess={() => refetch()}
			/>

			{/* ── Tabla de artículos ── */}
			{order.orderItems && order.orderItems.length > 0 && (
				<Card>
					<CardHeader><CardTitle>{t("items")}</CardTitle></CardHeader>
					<CardContent className="space-y-4">
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow className="bg-muted/50">
										<TableHead className="w-[35%]">{t("product")}</TableHead>
										<TableHead className="text-center">Piezas</TableHead>
										<TableHead className="text-center">Kg</TableHead>
										<TableHead className="text-right">Precio Unit.</TableHead>
										<TableHead className="text-right">{t("subtotal")}</TableHead>
										<TableHead className="text-center">{tc("status")}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{order.orderItems.map((item: any) => {
										const statusColor =
											item.status === "COMPLETADO" ? "text-green-600 bg-green-50" :
											item.status === "PESADO" ? "text-blue-600 bg-blue-50" :
											item.status === "PENDIENTE_PESAJE" ? "text-yellow-600 bg-yellow-50" :
											item.status === "PENDIENTE_COMPRA" ? "text-red-600 bg-red-50" :
											"text-gray-600 bg-gray-50";
										const statusLabel =
											item.status === "COMPLETADO" ? "Completado" :
											item.status === "PESADO" ? "Pesado" :
											item.status === "PENDIENTE_PESAJE" ? "Por Pesar" :
											item.status === "PENDIENTE_COMPRA" ? "Pendiente Compra" :
											item.status;
										return (
											<TableRow key={item.id}>
												<TableCell className="font-medium">
													{item.product?.name ?? item.product_name ?? `#${item.product_id}`}
												</TableCell>
												<TableCell className="text-center">{item.quantity_pieces ?? "—"}</TableCell>
												<TableCell className="text-center">{item.quantity_kg ?? "—"}</TableCell>
												<TableCell className="text-right">
													{formatCurrency(item.unit_price, locale)}
												</TableCell>
												<TableCell className="text-right font-semibold">
													{formatCurrency(item.subtotal, locale)}
												</TableCell>
												<TableCell className="text-center">
													<Badge className={`${statusColor} border-0`}>{statusLabel}</Badge>
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</div>

						{/* Consolidado */}
						<div className="border-t pt-4 mt-4">
							<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
								<div className="rounded-lg bg-slate-50 p-3">
									<p className="text-xs text-muted-foreground">Total Piezas</p>
									<p className="text-lg font-bold">
										{order.orderItems
											.filter((item: any) => item.status !== "PENDIENTE_COMPRA")
											.reduce((sum: number, item: any) => sum + (item.quantity_pieces || 0), 0)}
									</p>
								</div>
								<div className="rounded-lg bg-slate-50 p-3">
									<p className="text-xs text-muted-foreground">Total Kg</p>
									<p className="text-lg font-bold">
										{order.orderItems
											.filter((item: any) => item.status !== "PENDIENTE_COMPRA")
											.reduce((sum: number, item: any) => sum + (parseFloat(item.quantity_kg || 0)), 0)
											.toFixed(3)}
									</p>
								</div>
								<div className="rounded-lg bg-slate-50 p-3">
									<p className="text-xs text-muted-foreground">Items</p>
									<p className="text-lg font-bold">{order.orderItems.length}</p>
								</div>
								<div className="rounded-lg bg-slate-50 p-3">
									<p className="text-xs text-muted-foreground">Total</p>
									<p className="text-lg font-bold">
										{formatCurrency(order.total_amount, locale)}
									</p>
								</div>
							</div>
						</div>

						{order.orderItems.some((item: any) => item.status === "PENDIENTE_COMPRA") && (
							<div className="rounded-lg border border-red-200 bg-red-50 p-3">
								<p className="text-sm text-red-900 font-medium">
									⚠️{" "}
									{order.orderItems.filter((item: any) => item.status === "PENDIENTE_COMPRA").length}{" "}
									producto(s) pendiente de compra
								</p>
								<p className="text-xs text-red-800 mt-1">
									Estos items no están incluidos en el total. Deben ser adquiridos para completar la orden.
								</p>
							</div>
						)}
					</CardContent>
				</Card>
			)}

			{/* ── Modal de Ticket ── */}
			<TicketModal
				orderId={orderId}
				open={ticketOpen}
				onClose={() => setTicketOpen(false)}
			/>

			{/* ── Dialog de Edición ── */}
			<Dialog open={editOpen} onOpenChange={(o) => !o && setEditOpen(false)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("editOrder")} #{order.id}</DialogTitle>
					</DialogHeader>
					<div className="grid gap-4 py-2">
						<div className="space-y-1">
							<Label>{t("customer")}</Label>
							<Input value={order.customer?.name ?? "—"} disabled />
						</div>
						<div className="space-y-1">
							<Label>{tc("total")}</Label>
							<Input
								type="number"
								value={editTotal}
								onChange={(e) => setEditTotal(e.target.value)}
								onFocus={(e) => e.currentTarget.select()}
							/>
						</div>
						<div className="space-y-1">
							<Label>{tc("status")}</Label>
							<Select
								value={editStatus}
								onValueChange={(v) => setEditStatus(v as OrderStatus)}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="pending">{tc("pending")}</SelectItem>
									<SelectItem value="completed">{tc("completed")}</SelectItem>
									<SelectItem value="cancelled">{tc("cancelled")}</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
					<DialogFooter>
						<Button variant="secondary" onClick={() => setEditOpen(false)}>
							{tc("cancel")}
						</Button>
						<Button
							disabled={updateMutation.isPending}
							onClick={() =>
								updateMutation.mutate({
									id: orderId,
									total_amount: Math.round(parseFloat(editTotal) * 100),
									status: editStatus,
								})
							}
						>
							{tc("update")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* ── Confirmar eliminación ── */}
			<DeleteConfirmationDialog
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				onConfirm={() => deleteMutation.mutate({ id: orderId })}
				description={t("deleteMessage")}
			/>

			{/* ── Dialog de Cobro / Liquidación ── */}
			<Dialog open={payOpen} onOpenChange={(o) => !o && setPayOpen(false)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Liquidar pedido #{order.id}</DialogTitle>
					</DialogHeader>
					<div className="grid gap-4 py-2">
						<div className="rounded-lg bg-slate-50 p-3">
							<div className="text-xs text-muted-foreground">Total a cobrar</div>
							<div className="text-2xl font-bold">
								{formatCurrency(order.total_amount, locale)}
							</div>
						</div>
						<div className="space-y-1">
							<Label>Método de pago</Label>
							<Select value={payMethodId} onValueChange={setPayMethodId}>
								<SelectTrigger>
									<SelectValue placeholder="Selecciona método" />
								</SelectTrigger>
								<SelectContent>
									{(paymentMethods ?? []).map((pm) => (
										<SelectItem key={pm.id} value={pm.id.toString()}>
											{pm.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<p className="text-xs text-muted-foreground">
							Al liquidar se descuenta el inventario y se registra el cobro.
						</p>
					</div>
					<DialogFooter>
						<Button variant="secondary" onClick={() => setPayOpen(false)}>
							{tc("cancel")}
						</Button>
						<Button
							className="bg-green-600 hover:bg-green-700"
							disabled={payMutation.isPending || !payMethodId}
							onClick={() =>
								payMutation.mutate({
									orderId,
									paymentMethodId: parseInt(payMethodId),
								})
							}
						>
							{payMutation.isPending ? "Cobrando…" : "Confirmar cobro"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
