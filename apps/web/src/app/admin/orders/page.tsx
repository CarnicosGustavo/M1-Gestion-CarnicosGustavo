"use client";

import { useMemo, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod/v4";
import { Card, CardContent, CardHeader } from "@finopenpos/ui/components/card";
import {
	FilePenIcon,
	TrashIcon,
	EyeIcon,
	ShoppingCartIcon,
} from "lucide-react";
import { Button } from "@finopenpos/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@finopenpos/ui/components/dialog";
import { Input } from "@finopenpos/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@finopenpos/ui/components/select";
import { Label } from "@finopenpos/ui/components/label";
import { Combobox } from "@finopenpos/ui/components/combobox";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@finopenpos/ui/components/table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import {
	DataTable,
	TableActions,
	TableActionButton,
	type Column,
	type ExportColumn,
} from "@finopenpos/ui/components/data-table";
import {
	SearchFilter,
	type FilterOption,
} from "@finopenpos/ui/components/search-filter";
import type { RouterOutputs } from "@/lib/trpc/router";
import { useTranslations, useLocale } from "next-intl";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

type Order = RouterOutputs["orders"]["list"][number];
type OrderStatus = "completed" | "pending" | "cancelled";

type ProductRow = RouterOutputs["products"]["list"][number];
type CustomerRow = RouterOutputs["customers"]["list"][number];
type PaymentMethodRow = RouterOutputs["paymentMethods"]["list"][number];

type OrderDraftItem = {
	id: number;
	name: string;
	stock_pieces: number;
	stock_kg: string | number;
	is_sellable_by_weight: boolean;
	is_sellable_by_unit: boolean;
	price_per_kg?: string | number | null;
	price_per_piece?: string | number | null;
	quantityPieces: number;
	quantityKg: number | null;
	unitPricePerKg: number;
	unitPricePerPiece: number;
};

export default function OrdersPage() {
	const trpc = useTRPC();
	const router = useRouter();
	const {
		data: orders = [],
		isLoading,
		error,
	} = useQuery(trpc.orders.list.queryOptions());
	const { data: customers = [] } = useQuery(trpc.customers.list.queryOptions());
	const { data: products = [] } = useQuery(trpc.products.list.queryOptions());
	const { data: paymentMethods = [] } = useQuery(
		trpc.paymentMethods.list.queryOptions(),
	);
	const t = useTranslations("orders");
	const tc = useTranslations("common");
	const locale = useLocale();

	const orderEditSchema = z.object({
		total: z.string().min(1, t("totalRequired")),
		status: z.enum(["completed", "pending", "cancelled"]),
	});

	const statusFilterOptions: FilterOption[] = [
		{ label: tc("all"), value: "all" },
		{ label: tc("completed"), value: "completed", variant: "success" },
		{ label: tc("pending"), value: "pending", variant: "warning" },
		{ label: tc("cancelled"), value: "cancelled", variant: "danger" },
	];

	const tableColumns: Column<Order>[] = [
		{ key: "id", header: t("orderId"), sortable: true },
		{
			key: "customer",
			header: t("customer"),
			sortable: true,
			accessorFn: (row) => row.customer?.name ?? "",
			render: (row) => row.customer?.name ?? "",
		},
		{
			key: "total_amount",
			header: tc("total"),
			sortable: true,
			accessorFn: (row) => row.total_amount,
			render: (row) => formatCurrency(row.total_amount, locale),
		},
		{
			key: "status",
			header: tc("status"),
			sortable: true,
			render: (row) => {
				const s = row.status ?? "pending";
				const color =
					s === "completed"
						? "text-green-600"
						: s === "cancelled"
							? "text-red-600"
							: "text-yellow-600";
				const label =
					s === "completed"
						? tc("completed")
						: s === "cancelled"
							? tc("cancelled")
							: tc("pending");
				return <span className={color}>{label}</span>;
			},
		},
		{
			key: "created_at",
			header: tc("date"),
			sortable: true,
			hideOnMobile: true,
			accessorFn: (row) =>
				row.created_at ? new Date(row.created_at).getTime() : 0,
			render: (row) =>
				row.created_at ? new Date(row.created_at).toLocaleDateString() : "",
		},
	];

	const exportColumns: ExportColumn<Order>[] = [
		{ key: "id", header: t("orderId"), getValue: (o) => o.id },
		{
			key: "customer",
			header: t("customer"),
			getValue: (o) => o.customer?.name ?? "",
		},
		{
			key: "total",
			header: tc("total"),
			getValue: (o) => (o.total_amount / 100).toFixed(2),
		},
		{
			key: "status",
			header: tc("status"),
			getValue: (o) => o.status ?? "pending",
		},
		{
			key: "date",
			header: tc("date"),
			getValue: (o) =>
				o.created_at ? new Date(o.created_at).toLocaleDateString() : "",
		},
	];

	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [deleteId, setDeleteId] = useState<number | null>(null);
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");
	const [editCustomerName, setEditCustomerName] = useState("");

	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [draftCustomer, setDraftCustomer] = useState<CustomerRow | null>(null);
	const [draftPayment, setDraftPayment] = useState<PaymentMethodRow | null>(
		null,
	);
	const [draftNotes, setDraftNotes] = useState("");
	const [draftItems, setDraftItems] = useState<OrderDraftItem[]>([]);

	const invalidateKeys = trpc.orders.list.queryOptions().queryKey;

	const createMutation = useCrudMutation({
		mutationOptions: trpc.orders.create.mutationOptions(),
		invalidateKeys,
		successMessage: "Pedido creado",
		errorMessage: "Error al crear pedido",
		onSuccess: (data) => {
			setIsCreateOpen(false);
			setDraftCustomer(null);
			setDraftPayment(null);
			setDraftNotes("");
			setDraftItems([]);
			router.push(`/admin/orders/${(data as any).id}`);
		},
	});

	const updateMutation = useCrudMutation({
		mutationOptions: trpc.orders.update.mutationOptions(),
		invalidateKeys,
		successMessage: t("updated"),
		errorMessage: t("updateError"),
		onSuccess: () => setIsDialogOpen(false),
	});

	const deleteMutation = useCrudMutation({
		mutationOptions: trpc.orders.delete.mutationOptions(),
		invalidateKeys,
		successMessage: t("deleted"),
		errorMessage: t("deleteError"),
	});

	const form = useForm({
		defaultValues: { total: "", status: "pending" as OrderStatus },
		validators: {
			onSubmit: ({ value }) => {
				const res = orderEditSchema.safeParse(value);
				if (!res.success)
					return res.error.errors.map((e) => e.message).join(", ");
				return undefined;
			},
		},
		onSubmit: ({ value }) => {
			if (editingId !== null) {
				updateMutation.mutate({
					id: editingId,
					total_amount: Math.round(parseFloat(value.total) * 100),
					status: value.status,
				});
			}
		},
	});

	const filteredOrders = useMemo(() => {
		return orders.filter((o) => {
			if (statusFilter !== "all" && o.status !== statusFilter) return false;
			const q = searchTerm.toLowerCase();
			return (
				(o.customer?.name ?? "").toLowerCase().includes(q) ||
				o.id.toString().includes(searchTerm)
			);
		});
	}, [orders, statusFilter, searchTerm]);

	const openEdit = (o: Order) => {
		setEditingId(o.id);
		setEditCustomerName(o.customer?.name ?? "");
		form.reset();
		form.setFieldValue("total", (o.total_amount / 100).toString());
		form.setFieldValue("status", (o.status ?? "pending") as OrderStatus);
		setIsDialogOpen(true);
	};

	const handleDelete = () => {
		if (deleteId !== null) {
			deleteMutation.mutate({ id: deleteId });
			setIsDeleteOpen(false);
			setDeleteId(null);
		}
	};

	const draftTotal = useMemo(() => {
		return draftItems.reduce((sum, p) => {
			if (p.quantityKg !== null && p.quantityKg > 0) {
				return sum + (p.unitPricePerKg || 0) * p.quantityKg;
			}
			if (p.quantityPieces > 0) {
				return sum + (p.unitPricePerPiece || 0) * p.quantityPieces;
			}
			return sum;
		}, 0);
	}, [draftItems]);

	const addDraftProduct = (id: number) => {
		const p = products.find((x) => x.id === id);
		if (!p) return;
		setDraftItems((prev) => {
			if (prev.some((x) => x.id === p.id)) return prev;
			const unitPriceKg = Number(p.price_per_kg ?? 0);
			const unitPricePiece = Number(p.price_per_piece ?? 0);
			return [
				...prev,
				{
					id: p.id,
					name: p.name,
					stock_pieces: p.stock_pieces,
					stock_kg: p.stock_kg,
					is_sellable_by_weight: p.is_sellable_by_weight,
					is_sellable_by_unit: p.is_sellable_by_unit,
					price_per_kg: p.price_per_kg ?? null,
					price_per_piece: p.price_per_piece ?? null,
					quantityPieces: p.is_sellable_by_unit ? 1 : 0,
					quantityKg: p.is_sellable_by_weight ? null : null,
					unitPricePerKg: Number.isFinite(unitPriceKg) ? unitPriceKg : 0,
					unitPricePerPiece: Number.isFinite(unitPricePiece)
						? unitPricePiece
						: 0,
				},
			];
		});
	};

	const updateDraftQtyPieces = (id: number, v: number) => {
		setDraftItems((prev) =>
			prev.map((p) =>
				p.id === id
					? {
							...p,
							quantityPieces: Math.max(0, Math.floor(v)),
							quantityKg: null,
						}
					: p,
			),
		);
	};

	const updateDraftQtyKg = (id: number, v: number | null) => {
		setDraftItems((prev) =>
			prev.map((p) =>
				p.id === id
					? {
							...p,
							quantityKg: v === null ? null : Math.max(0, v),
							quantityPieces: 0,
						}
					: p,
			),
		);
	};

	const updateDraftUnitPriceKg = (id: number, v: number) => {
		setDraftItems((prev) =>
			prev.map((p) =>
				p.id === id ? { ...p, unitPricePerKg: Math.max(0, v) } : p,
			),
		);
	};

	const updateDraftUnitPricePiece = (id: number, v: number) => {
		setDraftItems((prev) =>
			prev.map((p) =>
				p.id === id ? { ...p, unitPricePerPiece: Math.max(0, v) } : p,
			),
		);
	};

	const removeDraftItem = (id: number) => {
		setDraftItems((prev) => prev.filter((p) => p.id !== id));
	};

	const submitDraft = () => {
		if (!draftCustomer) return;
		if (!draftItems.length) return;

		const pendingPurchase: number[] = [];
		for (const p of draftItems) {
			const stockKg = Number(p.stock_kg);
			const hasEnoughStock =
				p.quantityKg !== null && p.quantityKg > 0
					? p.quantityKg <= stockKg
					: p.quantityPieces <= p.stock_pieces;
			if (!hasEnoughStock) pendingPurchase.push(p.id);
		}

		if (pendingPurchase.length) {
			const names = draftItems
				.filter((x) => pendingPurchase.includes(x.id))
				.map((x) => x.name)
				.join(", ");
			toast.warning(
				`${pendingPurchase.length} producto(s) sin stock serán marcados como pendiente de compra: ${names}`,
			);
		}

		createMutation.mutate({
			customerId: draftCustomer.id,
			paymentMethodId: draftPayment?.id,
			notes: draftNotes || undefined,
			items: draftItems.map((p) => ({
				productId: p.id,
				quantityPieces: p.quantityKg === null ? p.quantityPieces : undefined,
				quantityKg:
					p.quantityKg !== null && p.quantityKg > 0
						? Math.round(p.quantityKg * 1000)
						: undefined,
				unitPrice:
					p.quantityKg !== null
						? Math.round((p.unitPricePerKg || 0) * 100)
						: Math.round((p.unitPricePerPiece || 0) * 100),
				requiresPurchase: pendingPurchase.includes(p.id),
			})),
		});
	};

	const actionsColumn: Column<Order> = {
		key: "actions",
		header: tc("actions"),
		render: (row) => (
			<TableActions>
				<TableActionButton
					onClick={() => openEdit(row)}
					icon={<FilePenIcon className="w-4 h-4" />}
					label={tc("edit")}
				/>
				<TableActionButton
					variant="danger"
					onClick={() => {
						setDeleteId(row.id);
						setIsDeleteOpen(true);
					}}
					icon={<TrashIcon className="w-4 h-4" />}
					label={tc("delete")}
				/>
				<Link
					href={`/admin/orders/${row.id}`}
					prefetch={false}
					onClick={(e) => e.stopPropagation()}
				>
					<Button size="icon" variant="ghost">
						<EyeIcon className="w-4 h-4" />
						<span className="sr-only">{tc("view")}</span>
					</Button>
				</Link>
			</TableActions>
		),
	};

	if (isLoading) {
		return (
			<Card className="flex flex-col gap-6 p-6">
				<CardHeader className="p-0">
					<div className="flex items-center justify-between">
						<Skeleton className="h-10 w-48" />
						<Skeleton className="h-9 w-32" />
					</div>
				</CardHeader>
				<CardContent className="p-0 space-y-3">
					{Array.from({ length: 5 }).map((_, i) => (
						<div key={i} className="flex items-center gap-4">
							<Skeleton className="h-4 w-12" />
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-4 w-20" />
							<Skeleton className="h-4 w-20" />
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-8 w-24" />
						</div>
					))}
				</CardContent>
			</Card>
		);
	}

	if (error) {
		return (
			<Card>
				<CardContent>
					<p className="text-red-500">{error.message}</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="flex flex-col gap-4 p-3 sm:gap-6 sm:p-6">
			<CardHeader className="p-0">
				<div className="flex items-center justify-between gap-3">
					<div className="min-w-0 flex-1">
						<SearchFilter
							search={searchTerm}
							onSearchChange={setSearchTerm}
							searchPlaceholder={t("searchPlaceholder")}
							filters={[
								{
									options: statusFilterOptions,
									value: statusFilter,
									onChange: setStatusFilter,
								},
							]}
						/>
					</div>
					<Button onClick={() => setIsCreateOpen(true)}>Nuevo pedido</Button>
				</div>
			</CardHeader>
			<CardContent className="p-0">
				<DataTable
					data={filteredOrders}
					columns={[...tableColumns, actionsColumn]}
					exportColumns={exportColumns}
					exportFilename="orders"
					emptyMessage={t("noOrders")}
					emptyIcon={<ShoppingCartIcon className="w-8 h-8" />}
					defaultSort={[{ id: "created_at", desc: true }]}
				/>
			</CardContent>

			<Dialog
				open={isDialogOpen}
				onOpenChange={(open) => {
					if (!open) setIsDialogOpen(false);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("editOrder")}</DialogTitle>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							form.handleSubmit();
						}}
					>
						<div className="grid gap-4 py-4">
							<div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
								<Label htmlFor="customerName">{t("customer")}</Label>
								<Input
									id="customerName"
									value={editCustomerName}
									disabled
									className="col-span-3"
								/>
							</div>
							<form.Field name="total">
								{(field) => (
									<div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
										<Label htmlFor="total">{tc("total")}</Label>
										<div className="col-span-3">
											<Input
												id="total"
												type="number"
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
												onBlur={field.handleBlur}
												error={
													field.state.meta.errors.length > 0
														? field.state.meta.errors
																.map((e) => e?.message ?? e)
																.join(", ")
														: undefined
												}
											/>
										</div>
									</div>
								)}
							</form.Field>
							<form.Field name="status">
								{(field) => (
									<div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
										<Label htmlFor="status">{tc("status")}</Label>
										<Select
											value={field.state.value}
											onValueChange={(value) =>
												field.handleChange(value as OrderStatus)
											}
										>
											<SelectTrigger id="status" className="col-span-3">
												<SelectValue placeholder={t("selectStatus")} />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="completed">
													{tc("completed")}
												</SelectItem>
												<SelectItem value="pending">{tc("pending")}</SelectItem>
												<SelectItem value="cancelled">
													{tc("cancelled")}
												</SelectItem>
											</SelectContent>
										</Select>
									</div>
								)}
							</form.Field>
						</div>
						<DialogFooter>
							<Button
								variant="secondary"
								onClick={() => setIsDialogOpen(false)}
							>
								{tc("cancel")}
							</Button>
							<Button type="submit" disabled={updateMutation.isPending}>
								{t("updateOrder")}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<DeleteConfirmationDialog
				open={isDeleteOpen}
				onOpenChange={setIsDeleteOpen}
				onConfirm={handleDelete}
				description={t("deleteMessage")}
			/>

			<Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
				<DialogContent className="max-w-3xl">
					<DialogHeader>
						<DialogTitle>Nuevo pedido</DialogTitle>
					</DialogHeader>
					<div className="grid gap-4">
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
							<div className="sm:col-span-1">
								<Label>Cliente</Label>
								<Combobox
									items={customers.map((c) => ({ id: c.id, name: c.name }))}
									placeholder="Selecciona cliente"
									onSelect={(id) =>
										setDraftCustomer(customers.find((c) => c.id === id) ?? null)
									}
								/>
							</div>
							<div className="sm:col-span-1">
								<Label>Método de pago</Label>
								<Combobox
									items={paymentMethods.map((m) => ({
										id: m.id,
										name: m.name,
									}))}
									placeholder="Opcional"
									onSelect={(id) =>
										setDraftPayment(
											paymentMethods.find((m) => m.id === id) ?? null,
										)
									}
								/>
							</div>
							<div className="sm:col-span-1">
								<Label>Notas</Label>
								<Input
									value={draftNotes}
									onChange={(e) => setDraftNotes(e.target.value)}
								/>
							</div>
						</div>

						<div>
							<Label>Agregar producto</Label>
							<Combobox
								items={products.map((p: ProductRow) => ({
									id: p.id,
									name: `${p.name} — ${p.stock_pieces} pzas / ${p.stock_kg} kg`,
								}))}
								placeholder="Buscar producto"
								noSelect
								onSelect={addDraftProduct}
							/>
						</div>

						{draftItems.length ? (
							<div className="overflow-x-auto rounded-md border">
								<Table>
									<TableHeader>
										<TableRow className="bg-muted/50">
											<TableHead>Producto</TableHead>
											<TableHead className="w-[140px]">Piezas</TableHead>
											<TableHead className="w-[160px]">Kg</TableHead>
											<TableHead className="w-[160px]">Precio</TableHead>
											<TableHead className="w-[140px]">Subtotal</TableHead>
											<TableHead className="w-[60px]" />
										</TableRow>
									</TableHeader>
									<TableBody>
										{draftItems.map((p) => {
											const usingKg = p.quantityKg !== null;
											const subtotal =
												usingKg && p.quantityKg
													? p.quantityKg * (p.unitPricePerKg || 0)
													: p.quantityPieces * (p.unitPricePerPiece || 0);
											return (
												<TableRow key={p.id}>
													<TableCell className="font-medium">
														{p.name}
													</TableCell>
													<TableCell>
														<Input
															type="number"
															min="0"
															step="1"
															value={usingKg ? 0 : p.quantityPieces || 0}
															onChange={(e) =>
																updateDraftQtyPieces(
																	p.id,
																	Number.parseInt(e.target.value || "0", 10) ||
																		0,
																)
															}
															disabled={!p.is_sellable_by_unit || usingKg}
														/>
													</TableCell>
													<TableCell>
														<Input
															type="number"
															min="0"
															step="0.001"
															value={p.quantityKg ?? ""}
															onChange={(e) => {
																const raw = e.target.value;
																updateDraftQtyKg(
																	p.id,
																	raw === ""
																		? null
																		: Number.parseFloat(raw) || 0,
																);
															}}
															disabled={!p.is_sellable_by_weight}
															placeholder={
																p.is_sellable_by_weight ? "Ej: 1.250" : "—"
															}
														/>
													</TableCell>
													<TableCell>
														<Input
															type="number"
															min="0"
															step="0.01"
															value={
																usingKg ? p.unitPricePerKg : p.unitPricePerPiece
															}
															onChange={(e) => {
																const v =
																	Number.parseFloat(e.target.value || "0") || 0;
																if (usingKg) updateDraftUnitPriceKg(p.id, v);
																else updateDraftUnitPricePiece(p.id, v);
															}}
														/>
													</TableCell>
													<TableCell className="text-right font-semibold">
														{formatCurrency(Math.round(subtotal * 100), locale)}
													</TableCell>
													<TableCell className="text-right">
														<Button
															size="icon"
															variant="ghost"
															onClick={() => removeDraftItem(p.id)}
														>
															<TrashIcon className="h-4 w-4" />
														</Button>
													</TableCell>
												</TableRow>
											);
										})}
									</TableBody>
								</Table>
							</div>
						) : (
							<div className="text-muted-foreground text-sm">
								Agrega productos para comenzar.
							</div>
						)}

						<div className="flex items-center justify-between">
							<div className="text-sm text-muted-foreground">
								Total:{" "}
								<span className="font-semibold">
									{formatCurrency(Math.round(draftTotal * 100), locale)}
								</span>
							</div>
							<div className="flex gap-2">
								<Button
									variant="secondary"
									onClick={() => setIsCreateOpen(false)}
								>
									Cancelar
								</Button>
								<Button
									onClick={submitDraft}
									disabled={
										!draftCustomer ||
										draftItems.length === 0 ||
										createMutation.isPending
									}
								>
									{createMutation.isPending ? "Creando..." : "Crear pedido"}
								</Button>
							</div>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</Card>
	);
}
