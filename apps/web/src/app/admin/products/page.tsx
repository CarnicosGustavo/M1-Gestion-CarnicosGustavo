"use client";

import { Button } from "@finopenpos/ui/components/button";
import { Card, CardContent, CardHeader } from "@finopenpos/ui/components/card";
import {
	type Column,
	DataTable,
	type ExportColumn,
	TableActionButton,
	TableActions,
} from "@finopenpos/ui/components/data-table";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@finopenpos/ui/components/dialog";
import { Input } from "@finopenpos/ui/components/input";
import { Label } from "@finopenpos/ui/components/label";
import {
	type FilterOption,
	SearchFilter,
} from "@finopenpos/ui/components/search-filter";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@finopenpos/ui/components/select";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { FilePenIcon, PackageIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod/v4";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/router";
import { formatCurrency } from "@/lib/utils";

type Product = RouterOutputs["products"]["list"][number];

export default function Products() {
	const trpc = useTRPC();
	const t = useTranslations("products");
	const tc = useTranslations("common");
	const locale = useLocale();

	const productFormSchema = z.object({
		name: z.string().min(1, t("nameRequired")),
		description: z.string(),
		price_per_kg: z.number().min(0, t("priceMustBePositive")),
		in_stock: z.number().int().min(0, t("stockMustBeNonNegative")),
		is_parent_product: z.boolean().default(false),
		ncm: z.string(),
		cfop: z.string(),
		icms_cst: z.string(),
		pis_cst: z.string(),
		cofins_cst: z.string(),
		unit_of_measure: z.string(),
	});

	const typeFilterOptions: FilterOption[] = [
		{ label: tc("all"), value: "all" },
		{ label: "Piezas Padre", value: "parent" },
		{ label: "Productos Hijos", value: "child" },
	];

	const stockFilterOptions: FilterOption[] = [
		{ label: t("allStock"), value: "all" },
		{ label: t("inStock"), value: "in-stock", variant: "success" },
		{ label: t("outOfStock"), value: "out-of-stock", variant: "danger" },
	];

	const columns: Column<Product>[] = [
		{
			key: "name",
			header: t("product"),
			sortable: true,
			className: "font-medium",
		},
		{ key: "description", header: tc("description"), hideOnMobile: true },
		{
			key: "type",
			header: "Tipo",
			render: (row) => (
				<span
					className={`inline-flex items-center rounded-full px-2 py-1 font-medium text-xs ${row.is_parent_product ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"}`}
				>
					{row.is_parent_product ? "Padre" : "Hijo"}
				</span>
			),
		},
		{
			key: "price",
			header: tc("price"),
			sortable: true,
			accessorFn: (row) => Number(row.price_per_kg ?? 0),
			render: (row) => formatCurrency(Number(row.price_per_kg ?? 0), locale),
		},
		{ key: "in_stock", header: t("stock"), sortable: true },
	];

	const exportColumns: ExportColumn<Product>[] = [
		{ key: "name", header: tc("name"), getValue: (p) => p.name },
		{
			key: "description",
			header: tc("description"),
			getValue: (p) => p.description ?? "",
		},
		{
			key: "price",
			header: tc("price"),
			getValue: (p) => (Number(p.price_per_kg ?? 0) / 100).toFixed(2),
		},
		{ key: "in_stock", header: t("stock"), getValue: (p) => p.in_stock },
		{
			key: "type",
			header: "Tipo",
			getValue: (p) => (p.is_parent_product ? "Pieza Padre" : "Producto Hijo"),
		},
	];

	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [deleteId, setDeleteId] = useState<number | null>(null);
	const [searchTerm, setSearchTerm] = useState("");
	const [typeFilter, setTypeFilter] = useState("all");
	const [parentFilter, setParentFilter] = useState("all");
	const [stockFilter, setStockFilter] = useState("all");
	const [hierarchyParentId, setHierarchyParentId] = useState("all");

	useEffect(() => {
		if (typeFilter !== "child" && parentFilter !== "all") {
			setParentFilter("all");
		}
	}, [typeFilter, parentFilter]);

	useEffect(() => {
		if (hierarchyParentId !== "all") {
			if (typeFilter !== "all") setTypeFilter("all");
			if (parentFilter !== "all") setParentFilter("all");
		}
	}, [hierarchyParentId, parentFilter, typeFilter]);

	const listInput = useMemo(() => {
		if (hierarchyParentId !== "all")
			return {
				parentProductId: Number(hierarchyParentId),
				includeDescendants: true,
				includeSelf: true,
			};
		if (typeFilter === "parent") return { isParent: true as const };
		if (typeFilter === "child")
			return {
				isParent: false as const,
				parentProductId:
					parentFilter === "all" ? undefined : Number(parentFilter),
			};
		return undefined;
	}, [hierarchyParentId, typeFilter, parentFilter]);

	const productsQueryOptions = listInput
		? trpc.products.list.queryOptions(listInput)
		: trpc.products.list.queryOptions();

	const { data: products = [], isLoading } = useQuery(productsQueryOptions);
	const { data: parentProducts = [] } = useQuery(
		trpc.products.list.queryOptions({ isParent: true }),
	);

	const primaryParentButtons = useMemo(() => {
		const items = [
			{ key: "canal", label: "Canal de Cerdo", match: ["canal"] },
			{ key: "pierna", label: "Pierna de Cerdo", match: ["pierna"] },
			{ key: "espilomo", label: "Espilomo", match: ["espilomo"] },
			{ key: "paleta", label: "Paleta", match: ["paleta"] },
		] as const;

		const lower = (s: string) => s.toLowerCase();
		const findByAny = (needles: readonly string[]) =>
			parentProducts.find((p) =>
				needles.some((n) => lower(p.name).includes(lower(n))),
			);

		return items
			.map((x) => {
				const p = findByAny(x.match);
				return p ? { id: String(p.id), label: x.label, name: p.name } : null;
			})
			.filter(
				(x): x is { id: string; label: string; name: string } => x !== null,
			);
	}, [parentProducts]);

	const selectedHierarchyParentName = useMemo(() => {
		if (hierarchyParentId === "all") return null;
		const p = parentProducts.find((p) => String(p.id) === hierarchyParentId);
		return p?.name ?? null;
	}, [hierarchyParentId, parentProducts]);

	const parentFilterOptions = useMemo<FilterOption[]>(() => {
		const opts: FilterOption[] = [{ label: tc("all"), value: "all" }];
		parentProducts.forEach((p) => {
			opts.push({ label: p.name, value: String(p.id) });
		});
		return opts;
	}, [parentProducts, tc]);

	const isEditing = editingId !== null;
	const invalidateKeys = trpc.products.list.queryOptions().queryKey;

	const createMutation = useCrudMutation({
		mutationOptions: trpc.products.create.mutationOptions(),
		invalidateKeys,
		successMessage: t("created"),
		errorMessage: t("createError"),
		onSuccess: () => setIsDialogOpen(false),
	});

	const updateMutation = useCrudMutation({
		mutationOptions: trpc.products.update.mutationOptions(),
		invalidateKeys,
		successMessage: t("updated"),
		errorMessage: t("updateError"),
		onSuccess: () => setIsDialogOpen(false),
	});

	const deleteMutation = useCrudMutation({
		mutationOptions: trpc.products.delete.mutationOptions(),
		invalidateKeys,
		successMessage: t("deleted"),
		errorMessage: t("deleteError"),
	});

	const form = useForm({
		defaultValues: {
			name: "",
			description: "",
			price_per_kg: 0,
			in_stock: 0,
			is_parent_product: false,
			ncm: "",
			cfop: "",
			icms_cst: "",
			pis_cst: "",
			cofins_cst: "",
			unit_of_measure: "",
		},
		validators: {
			onSubmit: ({ value }) => {
				const res = productFormSchema.safeParse(value);
				if (!res.success)
					return res.error.errors.map((e) => e.message).join(", ");
				return undefined;
			},
		},
		onSubmit: ({ value }) => {
			const payload = {
				name: value.name,
				description: value.description || undefined,
				price_per_kg: Math.round(value.price_per_kg * 100),
				in_stock: value.in_stock,
				is_parent_product: value.is_parent_product,
				ncm: value.ncm || undefined,
				cfop: value.cfop || undefined,
				icms_cst: value.icms_cst || undefined,
				pis_cst: value.pis_cst || undefined,
				cofins_cst: value.cofins_cst || undefined,
				unit_of_measure: value.unit_of_measure || undefined,
			};
			if (isEditing) {
				updateMutation.mutate({ id: editingId, ...payload });
			} else {
				createMutation.mutate(payload);
			}
		},
	});

	const filteredProducts = useMemo(() => {
		return products.filter((p) => {
			if (typeFilter === "parent" && !p.is_parent_product) return false;
			if (typeFilter === "child" && p.is_parent_product) return false;
			if (stockFilter === "in-stock" && p.in_stock === 0) return false;
			if (stockFilter === "out-of-stock" && p.in_stock > 0) return false;
			return p.name.toLowerCase().includes(searchTerm.toLowerCase());
		});
	}, [products, typeFilter, stockFilter, searchTerm]);

	const openCreate = () => {
		setEditingId(null);
		form.reset();
		setIsDialogOpen(true);
	};

	const openEdit = (p: Product) => {
		setEditingId(p.id);
		form.reset();
		form.setFieldValue("name", p.name);
		form.setFieldValue("description", p.description ?? "");
		form.setFieldValue("price_per_kg", Number(p.price_per_kg ?? 0) / 100);
		form.setFieldValue("in_stock", p.in_stock);
		form.setFieldValue("is_parent_product", p.is_parent_product);
		form.setFieldValue("ncm", p.ncm ?? "");
		form.setFieldValue("cfop", p.cfop ?? "");
		form.setFieldValue("icms_cst", p.icms_cst ?? "");
		form.setFieldValue("pis_cst", p.pis_cst ?? "");
		form.setFieldValue("cofins_cst", p.cofins_cst ?? "");
		form.setFieldValue("unit_of_measure", p.unit_of_measure ?? "");
		setIsDialogOpen(true);
	};

	const handleDelete = () => {
		if (deleteId !== null) {
			deleteMutation.mutate({ id: deleteId });
			setIsDeleteOpen(false);
			setDeleteId(null);
		}
	};

	const actionsColumn: Column<Product> = {
		key: "actions",
		header: tc("actions"),
		render: (row) => (
			<TableActions>
				<TableActionButton
					onClick={() => openEdit(row)}
					icon={<FilePenIcon className="h-4 w-4" />}
					label={tc("edit")}
				/>
				<TableActionButton
					variant="danger"
					onClick={() => {
						setDeleteId(row.id);
						setIsDeleteOpen(true);
					}}
					icon={<TrashIcon className="h-4 w-4" />}
					label={tc("delete")}
				/>
			</TableActions>
		),
	};

	if (isLoading) {
		return (
			<Card className="flex flex-col gap-4 p-3 sm:gap-6 sm:p-6">
				<CardHeader className="p-0">
					<div className="flex items-center justify-between">
						<Skeleton className="h-10 w-48" />
						<Skeleton className="h-9 w-32" />
					</div>
				</CardHeader>
				<CardContent className="space-y-3 p-0">
					{Array.from({ length: 5 }).map((_, i) => (
						<div key={i} className="flex items-center gap-4">
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-4 w-48" />
							<Skeleton className="h-4 w-16" />
							<Skeleton className="h-4 w-12" />
							<Skeleton className="h-8 w-20" />
						</div>
					))}
				</CardContent>
			</Card>
		);
	}

	return (
		<>
			<Card className="flex flex-col gap-4 p-3 sm:gap-6 sm:p-6">
				<CardHeader className="p-0">
					<div className="flex flex-wrap gap-2 pb-3">
						<Button
							size="sm"
							variant={hierarchyParentId === "all" ? "default" : "outline"}
							onClick={() => setHierarchyParentId("all")}
						>
							Todos
						</Button>
						{primaryParentButtons.map((b) => (
							<Button
								key={b.id}
								size="sm"
								variant={hierarchyParentId === b.id ? "default" : "outline"}
								onClick={() => setHierarchyParentId(b.id)}
							>
								{b.label}
							</Button>
						))}
						{hierarchyParentId !== "all" && (
							<Button
								size="sm"
								variant="ghost"
								onClick={() => setHierarchyParentId("all")}
							>
								Limpiar
							</Button>
						)}
					</div>
					{selectedHierarchyParentName && (
						<div className="pb-3 text-muted-foreground text-sm">
							Mostrando familia (padre + descendientes) de:{" "}
							<span className="font-medium">{selectedHierarchyParentName}</span>
						</div>
					)}
					<SearchFilter
						search={searchTerm}
						onSearchChange={setSearchTerm}
						searchPlaceholder={t("searchPlaceholder")}
						filters={
							typeFilter === "child"
								? [
										{
											options: typeFilterOptions,
											value: typeFilter,
											onChange: setTypeFilter,
										},
										{
											options: parentFilterOptions,
											value: parentFilter,
											onChange: setParentFilter,
										},
										{
											options: stockFilterOptions,
											value: stockFilter,
											onChange: setStockFilter,
										},
									]
								: [
										{
											options: typeFilterOptions,
											value: typeFilter,
											onChange: setTypeFilter,
										},
										{
											options: stockFilterOptions,
											value: stockFilter,
											onChange: setStockFilter,
										},
									]
						}
					>
						<Button size="sm" onClick={openCreate}>
							<PlusIcon className="mr-2 h-4 w-4" />
							{t("addProduct")}
						</Button>
					</SearchFilter>
				</CardHeader>
				<CardContent className="p-0">
					<DataTable
						data={filteredProducts}
						columns={columns.concat(actionsColumn)}
						exportColumns={exportColumns}
						exportFilename="products"
						emptyMessage={t("noProducts")}
						emptyIcon={<PackageIcon className="h-8 w-8" />}
						defaultSort={[{ id: "name", desc: false }]}
					/>
				</CardContent>
			</Card>

			<Dialog
				open={isDialogOpen}
				onOpenChange={(open) => {
					if (!open) setIsDialogOpen(false);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{isEditing ? t("editProduct") : t("addNewProduct")}
						</DialogTitle>
						<DialogDescription>
							{isEditing ? t("editDescription") : t("addDescription")}
						</DialogDescription>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							form.handleSubmit();
						}}
					>
						<div className="grid gap-4 py-4">
							<form.Field name="name">
								{(field) => (
									<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label htmlFor="name" className="sm:text-right">
											{tc("name")}
										</Label>
										<div className="col-span-3">
											<Input
												id="name"
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
							<form.Field name="description">
								{(field) => (
									<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label htmlFor="description" className="sm:text-right">
											{tc("description")}
										</Label>
										<Input
											id="description"
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											className="col-span-3"
										/>
									</div>
								)}
							</form.Field>
							<form.Field name="price_per_kg">
								{(field) => (
									<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label htmlFor="price" className="sm:text-right">
											{tc("price")}
										</Label>
										<div className="col-span-3">
											<Input
												id="price"
												type="number"
												step="0.01"
												value={field.state.value}
												onChange={(e) =>
													field.handleChange(Number(e.target.value))
												}
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
							<form.Field name="in_stock">
								{(field) => (
									<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label htmlFor="in_stock" className="sm:text-right">
											{t("inStock")}
										</Label>
										<div className="col-span-3">
											<Input
												id="in_stock"
												type="number"
												value={field.state.value}
												onChange={(e) =>
													field.handleChange(Number(e.target.value))
												}
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
							<form.Field name="is_parent_product">
								{(field) => (
									<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label
											htmlFor="is_parent_product"
											className="sm:text-right"
										>
											¿Es Pieza Padre?
										</Label>
										<Select
											value={field.state.value ? "true" : "false"}
											onValueChange={(value) =>
												field.handleChange(value === "true")
											}
										>
											<SelectTrigger className="col-span-3">
												<SelectValue placeholder="Selecciona tipo de producto" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="true">
													Sí (Canal, Pierna, etc.)
												</SelectItem>
												<SelectItem value="false">
													No (Corte final / Producto Hijo)
												</SelectItem>
											</SelectContent>
										</Select>
									</div>
								)}
							</form.Field>
							{/* Fiscal Data */}
							<div className="mt-2 border-t pt-4">
								<p className="mb-1 font-medium text-sm">{t("fiscalData")}</p>
								<p className="mb-3 text-muted-foreground text-xs">
									{t("fiscalDataHint")}
								</p>
								<div className="grid grid-cols-3 gap-3">
									<form.Field name="ncm">
										{(field) => (
											<div className="space-y-1">
												<Label className="text-xs">{t("ncm")}</Label>
												<Input
													value={field.state.value}
													onChange={(e) => field.handleChange(e.target.value)}
													maxLength={8}
													placeholder="00000000"
													className="h-8 text-sm"
												/>
											</div>
										)}
									</form.Field>
									<form.Field name="cfop">
										{(field) => (
											<div className="space-y-1">
												<Label className="text-xs">{t("cfop")}</Label>
												<Input
													value={field.state.value}
													onChange={(e) => field.handleChange(e.target.value)}
													maxLength={4}
													placeholder="5102"
													className="h-8 text-sm"
												/>
											</div>
										)}
									</form.Field>
									<form.Field name="unit_of_measure">
										{(field) => (
											<div className="space-y-1">
												<Label className="text-xs">{t("unitOfMeasure")}</Label>
												<Input
													value={field.state.value}
													onChange={(e) => field.handleChange(e.target.value)}
													maxLength={6}
													placeholder="UN"
													className="h-8 text-sm"
												/>
											</div>
										)}
									</form.Field>
									<form.Field name="icms_cst">
										{(field) => (
											<div className="space-y-1">
												<Label className="text-xs">{t("icmsCst")}</Label>
												<Input
													value={field.state.value}
													onChange={(e) => field.handleChange(e.target.value)}
													maxLength={3}
													placeholder="00"
													className="h-8 text-sm"
												/>
											</div>
										)}
									</form.Field>
									<form.Field name="pis_cst">
										{(field) => (
											<div className="space-y-1">
												<Label className="text-xs">{t("pisCst")}</Label>
												<Input
													value={field.state.value}
													onChange={(e) => field.handleChange(e.target.value)}
													maxLength={2}
													placeholder="99"
													className="h-8 text-sm"
												/>
											</div>
										)}
									</form.Field>
									<form.Field name="cofins_cst">
										{(field) => (
											<div className="space-y-1">
												<Label className="text-xs">{t("cofinsCst")}</Label>
												<Input
													value={field.state.value}
													onChange={(e) => field.handleChange(e.target.value)}
													maxLength={2}
													placeholder="99"
													className="h-8 text-sm"
												/>
											</div>
										)}
									</form.Field>
								</div>
							</div>
						</div>
						<DialogFooter>
							<form.Subscribe selector={(state) => state.isSubmitting}>
								{(isSubmitting) => (
									<Button
										type="submit"
										disabled={
											isSubmitting ||
											createMutation.isPending ||
											updateMutation.isPending
										}
									>
										{isEditing ? t("updateProduct") : t("addProduct")}
									</Button>
								)}
							</form.Subscribe>
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
		</>
	);
}
