"use client";

import { Badge } from "@finopenpos/ui/components/badge";
import { Button } from "@finopenpos/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@finopenpos/ui/components/card";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@finopenpos/ui/components/dialog";
import { Input } from "@finopenpos/ui/components/input";
import { Label } from "@finopenpos/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@finopenpos/ui/components/select";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
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
	ArrowLeftIcon,
	BanknoteIcon,
	FilePenIcon,
	PlusIcon,
	PrinterIcon,
	TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { use, useState } from "react";
import { toast } from "sonner";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { OrderDisassemblyManager } from "@/components/order-disassembly-manager";
import { TicketModal } from "@/components/ticket-modal";
import { useTRPC } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";

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

export default function OrderDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const orderId = Number.parseInt(id);
	const router = useRouter();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const {
		data: order,
		isLoading,
		refetch,
	} = useQuery(trpc.orders.get.queryOptions({ id: orderId })) as {
		data: any;
		isLoading: boolean;
		refetch: any;
	};
	const { data: productsList } = useQuery(
		trpc.products.list.queryOptions(),
	) as {
		data:
			| {
					id: number;
					name: string;
					price_per_kg?: number | string | null;
					avg_weight_per_piece_kg?: number | string | null;
			  }[]
			| undefined;
	};
	const { data: customersList } = useQuery(
		trpc.customers.list.queryOptions(),
	) as {
		data: { id: number; name: string | null }[] | undefined;
	};
	const t = useTranslations("orders");
	const tc = useTranslations("common");
	const locale = useLocale();

	const [ticketOpen, setTicketOpen] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [payOpen, setPayOpen] = useState(false);
	const [payMethodId, setPayMethodId] = useState<string>("");
	const [payType, setPayType] = useState<"contado" | "credito">("contado");
	const [editStatus, setEditStatus] = useState<string>("pending");
	const [editCustomerId, setEditCustomerId] = useState<string>("");
	const [editNotes, setEditNotes] = useState("");
	// Renglones editables del pedido
	type EditItem = {
		key: string;
		productId: number | null;
		productName: string;
		pieces: string;
		kg: string;
		price: string; // pesos por kg/pieza
	};
	const [editItems, setEditItems] = useState<EditItem[]>([]);

	const { data: paymentMethods } = useQuery(
		trpc.paymentMethods.list.queryOptions(),
	) as { data: { id: number; name: string }[] | undefined };

	const invalidateKey = trpc.orders.list.queryOptions().queryKey;

	const replaceItemsMutation = useMutation(
		trpc.orders.replaceItems.mutationOptions({
			onSuccess: (data: any) => {
				if (data?.adjustedCredit > 0)
					toast.success("Pedido actualizado y cuenta por cobrar ajustada");
				else if (data?.adjustedSale > 0)
					toast.success("Pedido actualizado y venta ajustada");
				else toast.success("Pedido actualizado");
				setEditOpen(false);
				refetch();
				queryClient.invalidateQueries({ queryKey: invalidateKey });
			},
			onError: (err: any) => toast.error(err.message ?? "No se pudo guardar"),
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

	const creditMutation = useMutation(
		trpc.orders.completeOrderOnCredit.mutationOptions({
			onSuccess: () => {
				toast.success("Pedido dejado a crédito (cuenta por cobrar)");
				setPayOpen(false);
				refetch();
				queryClient.invalidateQueries({ queryKey: invalidateKey });
			},
			onError: (err: any) =>
				toast.error(err.message ?? "No se pudo dejar a crédito"),
		}),
	);

	const convertCreditMutation = useMutation(
		trpc.orders.convertToCredit.mutationOptions({
			onSuccess: () => {
				toast.success("Pedido pasado a crédito (cuenta por cobrar)");
				refetch();
				queryClient.invalidateQueries({ queryKey: invalidateKey });
			},
			onError: (err: any) =>
				toast.error(err.message ?? "No se pudo pasar a crédito"),
		}),
	);

	const openPay = () => {
		setPayMethodId(paymentMethods?.[0]?.id?.toString() ?? "");
		setPayType("contado");
		setPayOpen(true);
	};

	const openEdit = () => {
		setEditStatus(order?.status ?? "pending");
		setEditCustomerId(order?.customer_id ? String(order.customer_id) : "");
		setEditNotes(order?.notes ?? "");
		setEditItems(
			(order?.orderItems ?? []).map((it: any, idx: number) => ({
				key: `it-${it.id ?? idx}`,
				productId: it.product_id ?? null,
				productName: it.product?.name ?? it.product_name ?? "",
				pieces: it.quantity_pieces != null ? String(it.quantity_pieces) : "",
				kg: it.quantity_kg != null ? String(it.quantity_kg) : "",
				price: it.unit_price != null ? String(Number(it.unit_price) / 100) : "",
			})),
		);
		setEditOpen(true);
	};

	// Helpers del editor de renglones
	const addEditItem = () =>
		setEditItems((prev) => [
			...prev,
			{
				key: `new-${prev.length}-${prev.reduce((a, b) => a + b.key.length, 0)}`,
				productId: null,
				productName: "",
				pieces: "",
				kg: "",
				price: "",
			},
		]);
	const removeEditItem = (key: string) =>
		setEditItems((prev) => prev.filter((r) => r.key !== key));
	const patchEditItem = (key: string, patch: Partial<EditItem>) =>
		setEditItems((prev) =>
			prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
		);
	// Al elegir un producto, fija nombre y precio sugerido (precio/kg del catálogo)
	const pickProduct = (key: string, productId: number) => {
		const p = (productsList ?? []).find((x) => x.id === productId);
		if (!p) return;
		patchEditItem(key, {
			productId,
			productName: p.name,
			price:
				p.price_per_kg != null && Number(p.price_per_kg) > 0
					? String(Number(p.price_per_kg))
					: undefined,
		});
	};
	const editSubtotal = (r: EditItem) => {
		const kg = Number.parseFloat(r.kg) || 0;
		const pieces = Number.parseInt(r.pieces) || 0;
		const price = Number.parseFloat(r.price) || 0;
		return (kg > 0 ? kg : pieces) * price;
	};
	const editTotalPesos = editItems.reduce((s, r) => s + editSubtotal(r), 0);

	const saveFullEdit = () => {
		const items = editItems
			.filter((r) => r.productName.trim())
			.map((r) => ({
				productId: r.productId,
				productName: r.productName.trim(),
				quantityPieces: Number.parseInt(r.pieces) || 0,
				quantityKg: Number.parseFloat(r.kg) || 0,
				unitPrice: Number.parseFloat(r.price) || 0,
			}));
		const allowed = [
			"COMPLETADA",
			"pending",
			"cancelled",
			"PENDIENTE_PESAJE",
			"LISTA_PARA_COBRO",
		];
		replaceItemsMutation.mutate({
			orderId,
			customerId: editCustomerId ? Number.parseInt(editCustomerId) : null,
			notes: editNotes || undefined,
			status: allowed.includes(editStatus) ? (editStatus as any) : undefined,
			items,
		});
	};

	if (isLoading) {
		return (
			<div className="max-w-3xl space-y-6">
				<Skeleton className="h-8 w-48" />
				<Card>
					<CardContent className="space-y-4 p-6">
						{Array.from({ length: 4 }).map((_, i) => (
							<Skeleton key={i} className="h-6 w-full" />
						))}
					</CardContent>
				</Card>
			</div>
		);
	}

	if (!order) {
		return <div className="text-muted-foreground">{t("orderNotFound")}</div>;
	}

	// Pesaje de producción: no es una venta, va directo a inventario
	const isProduction = order.notes === "Pesaje de producción";
	const base = getStatusDisplay(order.status);
	const statusLabel = isProduction ? "Producción → inventario" : base.label;
	const statusColor = isProduction ? "text-purple-600" : base.color;
	const canCharge = order.status === "LISTA_PARA_COBRO" && !isProduction;

	// Estimación de costo de items aún no pesados (piezas × peso promedio × precio/kg)
	const avgWeightMap = new Map<number, number>();
	for (const p of productsList ?? []) {
		const w =
			p.avg_weight_per_piece_kg != null ? Number(p.avg_weight_per_piece_kg) : 0;
		if (w > 0) avgWeightMap.set(p.id, w);
	}
	let estimatedExtra = 0; // centavos estimados de items sin pesar
	let hasEstimate = false;
	for (const item of order.orderItems ?? []) {
		const sinPesar =
			(!item.quantity_kg || Number(item.quantity_kg) === 0) &&
			item.status !== "PENDIENTE_COMPRA" &&
			item.quantity_pieces > 0;
		if (sinPesar) {
			const avg = avgWeightMap.get(item.product_id) ?? 0;
			if (avg > 0) {
				const estKg = item.quantity_pieces * avg;
				// unit_price está en centavos por kg
				estimatedExtra += estKg * Number(item.unit_price || 0);
				hasEstimate = true;
			}
		}
	}
	const estimatedTotal = Number(order.total_amount || 0) + estimatedExtra;

	return (
		<div className="max-w-3xl space-y-6">
			{/* ── Cabecera ── */}
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div className="flex items-center gap-3">
					<Link href="/admin/orders">
						<Button variant="ghost" size="icon">
							<ArrowLeftIcon className="h-4 w-4" />
						</Button>
					</Link>
					<h1 className="font-bold text-2xl">
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
							<BanknoteIcon className="mr-2 h-4 w-4" />
							Liquidar / Cobrar
						</Button>
					)}
					{order.status === "COMPLETADA" && !isProduction && (
						<Button
							size="sm"
							variant="outline"
							className="border-orange-400 text-orange-700 hover:bg-orange-50"
							disabled={convertCreditMutation.isPending}
							onClick={() => convertCreditMutation.mutate({ orderId })}
						>
							<BanknoteIcon className="mr-2 h-4 w-4" />
							Pasar a crédito
						</Button>
					)}
					<Button
						variant="outline"
						size="sm"
						onClick={() => setTicketOpen(true)}
					>
						<PrinterIcon className="mr-2 h-4 w-4" />
						Imprimir Ticket
					</Button>
					<Button variant="outline" size="sm" onClick={openEdit}>
						<FilePenIcon className="mr-2 h-4 w-4" />
						{tc("edit")}
					</Button>
					<Button
						variant="destructive"
						size="sm"
						onClick={() => setDeleteOpen(true)}
					>
						<TrashIcon className="mr-2 h-4 w-4" />
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
							<span className={`font-semibold ${statusColor}`}>
								{statusLabel}
							</span>
							{order.requires_weighing && (
								<Badge
									variant="secondary"
									className="bg-yellow-100 text-yellow-900"
								>
									Por Pesar
								</Badge>
							)}
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<dl className="grid gap-3 text-sm sm:grid-cols-2">
						<div>
							<dt className="text-muted-foreground">{t("customer")}</dt>
							<dd className="font-medium">{order.customer?.name ?? "—"}</dd>
						</div>
						<div>
							<dt className="text-muted-foreground">{tc("total")}</dt>
							<dd className="font-bold text-lg">
								{formatCurrency(order.total_amount, locale)}
							</dd>
						</div>
						{hasEstimate && (
							<div>
								<dt className="text-muted-foreground">
									Total estimado (sin pesar)
								</dt>
								<dd className="font-bold text-blue-700 text-lg">
									~ {formatCurrency(Math.round(estimatedTotal), locale)}
								</dd>
								<p className="mt-0.5 text-[11px] text-muted-foreground">
									Calculado con peso promedio por pieza. El total real sale al
									pesar.
								</p>
							</div>
						)}
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
						{order.orderItems?.some(
							(item: any) => item.status === "PENDIENTE_COMPRA",
						) && (
							<div>
								<dt className="text-muted-foreground">⚠️ Pendiente de Compra</dt>
								<dd className="font-medium text-red-600">
									{
										order.orderItems.filter(
											(item: any) => item.status === "PENDIENTE_COMPRA",
										).length
									}{" "}
									items
								</dd>
							</div>
						)}
					</dl>
				</CardContent>
			</Card>

			<OrderDisassemblyManager
				orderId={orderId}
				orderStatus={order.status}
				orderItems={order.orderItems || []}
				onSuccess={() => refetch()}
			/>

			{/* ── Tabla de artículos ── */}
			{order.orderItems && order.orderItems.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>{t("items")}</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow className="bg-muted/50">
										<TableHead className="w-[35%]">{t("product")}</TableHead>
										<TableHead className="text-center">Piezas</TableHead>
										<TableHead className="text-center">Kg</TableHead>
										<TableHead className="text-right">Precio Unit.</TableHead>
										<TableHead className="text-right">
											{t("subtotal")}
										</TableHead>
										<TableHead className="text-center">
											{tc("status")}
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{order.orderItems.map((item: any) => {
										const statusColor =
											item.status === "COMPLETADO"
												? "text-green-600 bg-green-50"
												: item.status === "PESADO"
													? "text-blue-600 bg-blue-50"
													: item.status === "PENDIENTE_PESAJE"
														? "text-yellow-600 bg-yellow-50"
														: item.status === "PENDIENTE_COMPRA"
															? "text-red-600 bg-red-50"
															: "text-gray-600 bg-gray-50";
										const statusLabel =
											item.status === "COMPLETADO"
												? "Completado"
												: item.status === "PESADO"
													? "Pesado"
													: item.status === "PENDIENTE_PESAJE"
														? "Por Pesar"
														: item.status === "PENDIENTE_COMPRA"
															? "Pendiente Compra"
															: item.status;
										return (
											<TableRow key={item.id}>
												<TableCell className="font-medium">
													{item.product?.name ??
														item.product_name ??
														`#${item.product_id}`}
												</TableCell>
												<TableCell className="text-center">
													{item.quantity_pieces ?? "—"}
												</TableCell>
												<TableCell className="text-center">
													{item.quantity_kg ?? "—"}
												</TableCell>
												<TableCell className="text-right">
													{formatCurrency(item.unit_price, locale)}
												</TableCell>
												<TableCell className="text-right font-semibold">
													{formatCurrency(item.subtotal, locale)}
												</TableCell>
												<TableCell className="text-center">
													<Badge className={`${statusColor} border-0`}>
														{statusLabel}
													</Badge>
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</div>

						{/* Consolidado */}
						<div className="mt-4 border-t pt-4">
							<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
								<div className="rounded-lg bg-slate-50 p-3">
									<p className="text-muted-foreground text-xs">Total Piezas</p>
									<p className="font-bold text-lg">
										{order.orderItems
											.filter((item: any) => item.status !== "PENDIENTE_COMPRA")
											.reduce(
												(sum: number, item: any) =>
													sum + (item.quantity_pieces || 0),
												0,
											)}
									</p>
								</div>
								<div className="rounded-lg bg-slate-50 p-3">
									<p className="text-muted-foreground text-xs">Total Kg</p>
									<p className="font-bold text-lg">
										{order.orderItems
											.filter((item: any) => item.status !== "PENDIENTE_COMPRA")
											.reduce(
												(sum: number, item: any) =>
													sum + Number.parseFloat(item.quantity_kg || 0),
												0,
											)
											.toFixed(3)}
									</p>
								</div>
								<div className="rounded-lg bg-slate-50 p-3">
									<p className="text-muted-foreground text-xs">Items</p>
									<p className="font-bold text-lg">{order.orderItems.length}</p>
								</div>
								<div className="rounded-lg bg-slate-50 p-3">
									<p className="text-muted-foreground text-xs">Total</p>
									<p className="font-bold text-lg">
										{formatCurrency(order.total_amount, locale)}
									</p>
								</div>
							</div>
						</div>

						{order.orderItems.some(
							(item: any) => item.status === "PENDIENTE_COMPRA",
						) && (
							<div className="rounded-lg border border-red-200 bg-red-50 p-3">
								<p className="font-medium text-red-900 text-sm">
									⚠️{" "}
									{
										order.orderItems.filter(
											(item: any) => item.status === "PENDIENTE_COMPRA",
										).length
									}{" "}
									producto(s) pendiente de compra
								</p>
								<p className="mt-1 text-red-800 text-xs">
									Estos items no están incluidos en el total. Deben ser
									adquiridos para completar la orden.
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

			{/* ── Dialog de Edición completa ── */}
			<Dialog open={editOpen} onOpenChange={(o) => !o && setEditOpen(false)}>
				<DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Editar pedido #{order.id}</DialogTitle>
					</DialogHeader>

					{order.status === "COMPLETADA" && (
						<div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-orange-900 text-xs">
							Este pedido ya está cobrado. Al guardar, el nuevo total se
							reflejará automáticamente en la venta (contado) o en la cuenta por
							cobrar (crédito).
						</div>
					)}

					<div className="grid gap-4 py-2 sm:grid-cols-2">
						<div className="space-y-1">
							<Label>{t("customer")}</Label>
							<Select value={editCustomerId} onValueChange={setEditCustomerId}>
								<SelectTrigger>
									<SelectValue placeholder="Consumidor Final" />
								</SelectTrigger>
								<SelectContent className="max-h-72">
									{(customersList ?? []).map((c) => (
										<SelectItem key={c.id} value={String(c.id)}>
											{c.name ?? `Cliente #${c.id}`}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1">
							<Label>{tc("status")}</Label>
							<Select value={editStatus} onValueChange={setEditStatus}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="pending">Pendiente</SelectItem>
									<SelectItem value="PENDIENTE_PESAJE">Por pesar</SelectItem>
									<SelectItem value="LISTA_PARA_COBRO">
										Lista para cobro
									</SelectItem>
									<SelectItem value="COMPLETADA">Pagada</SelectItem>
									<SelectItem value="cancelled">Cancelada</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					{/* Editor de renglones */}
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<Label>Productos del pedido</Label>
							<Button variant="outline" size="sm" onClick={addEditItem}>
								<PlusIcon className="mr-1 h-4 w-4" />
								Agregar
							</Button>
						</div>
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow className="bg-muted/50">
										<TableHead className="min-w-[180px]">Producto</TableHead>
										<TableHead className="w-[90px] text-center">
											Piezas
										</TableHead>
										<TableHead className="w-[100px] text-center">Kg</TableHead>
										<TableHead className="w-[110px] text-center">
											$/Kg o pza
										</TableHead>
										<TableHead className="w-[110px] text-right">
											Subtotal
										</TableHead>
										<TableHead className="w-[40px]" />
									</TableRow>
								</TableHeader>
								<TableBody>
									{editItems.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={6}
												className="py-4 text-center text-muted-foreground"
											>
												Sin productos. Usa "Agregar".
											</TableCell>
										</TableRow>
									) : (
										editItems.map((r) => (
											<TableRow key={r.key}>
												<TableCell>
													<Select
														value={r.productId ? String(r.productId) : ""}
														onValueChange={(v) =>
															pickProduct(r.key, Number.parseInt(v))
														}
													>
														<SelectTrigger className="h-9">
															<SelectValue
																placeholder={r.productName || "Selecciona"}
															/>
														</SelectTrigger>
														<SelectContent className="max-h-72">
															{(productsList ?? []).map((p) => (
																<SelectItem key={p.id} value={String(p.id)}>
																	{p.name}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												</TableCell>
												<TableCell>
													<Input
														type="number"
														value={r.pieces}
														onChange={(e) =>
															patchEditItem(r.key, { pieces: e.target.value })
														}
														className="h-9 text-center"
														placeholder="0"
													/>
												</TableCell>
												<TableCell>
													<Input
														type="number"
														step="0.001"
														value={r.kg}
														onChange={(e) =>
															patchEditItem(r.key, { kg: e.target.value })
														}
														className="h-9 text-center"
														placeholder="0.000"
													/>
												</TableCell>
												<TableCell>
													<Input
														type="number"
														step="0.01"
														value={r.price}
														onChange={(e) =>
															patchEditItem(r.key, { price: e.target.value })
														}
														className="h-9 text-center"
														placeholder="0.00"
													/>
												</TableCell>
												<TableCell className="text-right font-semibold">
													{formatCurrency(
														Math.round(editSubtotal(r) * 100),
														locale,
													)}
												</TableCell>
												<TableCell>
													<button
														type="button"
														onClick={() => removeEditItem(r.key)}
														className="text-muted-foreground hover:text-red-500"
													>
														<TrashIcon className="h-4 w-4" />
													</button>
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</div>
						<div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2">
							<span className="text-muted-foreground text-sm">
								Total{" "}
								{editItems.some((r) => !r.kg || Number.parseFloat(r.kg) === 0)
									? "(estimado, faltan kg por pesar)"
									: ""}
							</span>
							<span className="font-bold text-xl">
								{formatCurrency(Math.round(editTotalPesos * 100), locale)}
							</span>
						</div>
						<p className="text-[11px] text-muted-foreground">
							Renglones sin Kg quedan "por pesar" y el pedido vuelve a la
							estación de pesaje.
						</p>
					</div>

					<div className="space-y-1">
						<Label>Notas</Label>
						<Input
							value={editNotes}
							onChange={(e) => setEditNotes(e.target.value)}
							placeholder="Opcional"
						/>
					</div>

					<DialogFooter>
						<Button variant="secondary" onClick={() => setEditOpen(false)}>
							{tc("cancel")}
						</Button>
						<Button
							disabled={replaceItemsMutation.isPending}
							onClick={saveFullEdit}
						>
							{replaceItemsMutation.isPending ? "Guardando…" : "Guardar pedido"}
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
							<div className="text-muted-foreground text-xs">
								Total a cobrar
							</div>
							<div className="font-bold text-2xl">
								{formatCurrency(order.total_amount, locale)}
							</div>
						</div>
						{/* Tipo de cobro */}
						<div className="space-y-1">
							<Label>Tipo de cobro</Label>
							<div className="grid grid-cols-2 gap-2">
								<button
									type="button"
									onClick={() => setPayType("contado")}
									className={`rounded-lg border px-3 py-2 font-bold text-sm ${
										payType === "contado"
											? "border-green-600 bg-green-50 text-green-700"
											: "border-black/15 text-cg-black"
									}`}
								>
									Contado
								</button>
								<button
									type="button"
									onClick={() => setPayType("credito")}
									className={`rounded-lg border px-3 py-2 font-bold text-sm ${
										payType === "credito"
											? "border-orange-500 bg-orange-50 text-orange-700"
											: "border-black/15"
									}`}
								>
									Crédito
								</button>
							</div>
						</div>

						{payType === "contado" && (
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
						)}
						<p className="text-muted-foreground text-xs">
							{payType === "contado"
								? "Al liquidar se descuenta el inventario y se registra el cobro."
								: "Se descuenta el inventario y el total queda como cuenta por cobrar en Cobranza."}
						</p>
					</div>
					<DialogFooter>
						<Button variant="secondary" onClick={() => setPayOpen(false)}>
							{tc("cancel")}
						</Button>
						{payType === "contado" ? (
							<Button
								className="bg-green-600 hover:bg-green-700"
								disabled={payMutation.isPending || !payMethodId}
								onClick={() =>
									payMutation.mutate({
										orderId,
										paymentMethodId: Number.parseInt(payMethodId),
									})
								}
							>
								{payMutation.isPending ? "Cobrando…" : "Confirmar cobro"}
							</Button>
						) : (
							<Button
								className="bg-orange-600 hover:bg-orange-700"
								disabled={creditMutation.isPending}
								onClick={() => creditMutation.mutate({ orderId })}
							>
								{creditMutation.isPending ? "Guardando…" : "Dejar a crédito"}
							</Button>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
