"use client";

import { Button } from "@finopenpos/ui/components/button";
import { Card, CardContent, CardHeader } from "@finopenpos/ui/components/card";
import {
	type Column,
	DataTable,
	TableActionButton,
	TableActions,
} from "@finopenpos/ui/components/data-table";
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
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	BookOpenIcon,
	CheckCircleIcon,
	FilePenIcon,
	PlusCircle,
	XCircleIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod/v4";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/router";

type Recipe = RouterOutputs["inventory"]["recipesList"][number];
type Product = RouterOutputs["products"]["list"][number];

export default function RecipesPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const tc = useTranslations("common");

	const [search, setSearch] = useState("");
	const [parentFilter, setParentFilter] = useState("all");
	const [typeFilter, setTypeFilter] = useState<
		"all" | "BASE" | "NACIONAL" | "AMERICANO" | "POLINESIO"
	>("all");
	const [statusFilter, setStatusFilter] = useState<"active" | "all">("active");
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [showAdvanced, setShowAdvanced] = useState(false);

	const listInput = useMemo(() => {
		return {
			parentProductId:
				parentFilter === "all" ? undefined : Number(parentFilter),
			transformationType: typeFilter === "all" ? undefined : typeFilter,
			includeInactive: statusFilter === "all",
		};
	}, [parentFilter, statusFilter, typeFilter]);

	const { data: allProducts = [], isLoading: isLoadingProducts } = useQuery(
		trpc.products.list.queryOptions(),
	);
	const { data: parentProducts = [] } = useQuery(
		trpc.products.list.queryOptions({ isParent: true }),
	);

	const recipesQueryOptions =
		trpc.inventory.recipesList.queryOptions(listInput);
	const {
		data: recipes = [],
		isLoading: isLoadingRecipes,
		error,
	} = useQuery(recipesQueryOptions);

	const filteredRecipes = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return recipes;
		return recipes.filter((r) => {
			return (
				r.parentProduct.name.toLowerCase().includes(q) ||
				r.childProduct.name.toLowerCase().includes(q) ||
				r.transformation_type.toLowerCase().includes(q)
			);
		});
	}, [recipes, search]);

	const isEditing = editingId !== null;

	const recipeFormSchema = z.object({
		parentProductId: z.number().int().positive(),
		childProductId: z.number().int().positive(),
		childName: z.string().min(1),
		transformationType: z.string().min(1),
		yieldQuantityPieces: z.number().min(0),
		yieldWeightRatio: z.number().min(0),
		isActive: z.boolean().default(true),
	});

	const upsertMutation = useMutation(
		trpc.inventory.recipesUpsert.mutationOptions({
			onSuccess: () => {
				toast.success("Receta guardada");
				queryClient.invalidateQueries({
					queryKey: trpc.inventory.recipesList.queryKey(),
				});
				setIsDialogOpen(false);
			},
			onError: (e) => toast.error(e.message),
		}),
	);

	const setActiveMutation = useMutation(
		trpc.inventory.recipesSetActive.mutationOptions({
			onSuccess: () => {
				toast.success("Actualizado");
				queryClient.invalidateQueries({
					queryKey: trpc.inventory.recipesList.queryKey(),
				});
			},
			onError: (e) => toast.error(e.message),
		}),
	);

	const form = useForm({
		defaultValues: {
			parentProductId: 0,
			childProductId: 0,
			childName: "",
			transformationType: "BASE",
			yieldQuantityPieces: 0,
			yieldWeightRatio: 0,
			isActive: true,
		},
		validators: {
			onSubmit: ({ value }) => {
				const res = recipeFormSchema.safeParse(value);
				if (!res.success) {
					const issues =
						(res.error as unknown as { issues?: Array<{ message: string }> })
							.issues ??
						(res.error as unknown as { errors?: Array<{ message: string }> })
							.errors ??
						[];
					return issues.map((e) => e.message).join(", ");
				}
				return undefined;
			},
		},
		onSubmit: ({ value }) => {
			upsertMutation.mutate({
				id: editingId ?? undefined,
				parentProductId: value.parentProductId,
				childProductId: value.childProductId,
				childName: value.childName,
				yieldQuantityPieces: value.yieldQuantityPieces,
				yieldWeightRatio: value.yieldWeightRatio,
				transformationType: value.transformationType,
				isActive: value.isActive,
			});
		},
	});

	const openCreate = () => {
		setEditingId(null);
		form.reset();
		setShowAdvanced(false);
		setIsDialogOpen(true);
	};

	const openEdit = (r: Recipe) => {
		setEditingId(r.id);
		form.reset();
		form.setFieldValue("parentProductId", r.parent_product_id);
		form.setFieldValue("childProductId", r.child_product_id);
		form.setFieldValue("childName", r.childProduct.name);
		form.setFieldValue("transformationType", r.transformation_type);
		form.setFieldValue("yieldQuantityPieces", Number(r.yield_quantity_pieces));
		form.setFieldValue("yieldWeightRatio", Number(r.yield_weight_ratio));
		form.setFieldValue("isActive", r.is_active);
		setShowAdvanced(Number(r.yield_weight_ratio) > 0);
		setIsDialogOpen(true);
	};

	const productOptions = useMemo(() => {
		return allProducts.slice().sort((a, b) => a.name.localeCompare(b.name));
	}, [allProducts]);

	const columns: Column<Recipe>[] = [
		{
			key: "parent",
			header: "Padre",
			sortable: true,
			accessorFn: (r) => r.parentProduct.name,
		},
		{
			key: "child",
			header: "Hijo",
			sortable: true,
			accessorFn: (r) => r.childProduct.name,
			className: "font-medium",
		},
		{
			key: "type",
			header: "Estilo",
			sortable: true,
			accessorFn: (r) => r.transformation_type,
		},
		{
			key: "pieces",
			header: "Piezas",
			sortable: true,
			accessorFn: (r) => Number(r.yield_quantity_pieces),
		},
		{
			key: "active",
			header: "Activa",
			accessorFn: (r) => (r.is_active ? "Sí" : "No"),
			render: (r) => (
				<div className="flex items-center gap-2">
					{r.is_active ? (
						<CheckCircleIcon className="h-4 w-4 text-green-600" />
					) : (
						<XCircleIcon className="h-4 w-4 text-red-600" />
					)}
					<span className="text-sm">{r.is_active ? "Sí" : "No"}</span>
				</div>
			),
		},
		{
			key: "actions",
			header: tc("actions"),
			headerClassName: "w-[140px]",
			render: (row) => (
				<TableActions>
					<TableActionButton
						onClick={() => openEdit(row)}
						icon={<FilePenIcon className="h-4 w-4" />}
						label={tc("edit")}
					/>
					<TableActionButton
						variant={row.is_active ? "danger" : "default"}
						onClick={() =>
							setActiveMutation.mutate({ id: row.id, isActive: !row.is_active })
						}
						icon={
							row.is_active ? (
								<XCircleIcon className="h-4 w-4" />
							) : (
								<CheckCircleIcon className="h-4 w-4" />
							)
						}
						label={row.is_active ? "Desactivar" : "Activar"}
					/>
				</TableActions>
			),
		},
	];

	if (isLoadingProducts || isLoadingRecipes) {
		return (
			<Card className="flex flex-col gap-6 p-6">
				<CardHeader className="p-0">
					<div className="flex items-center justify-between">
						<Skeleton className="h-5 w-32" />
						<Skeleton className="h-9 w-28" />
					</div>
				</CardHeader>
				<CardContent className="space-y-3 p-0">
					{Array.from({ length: 6 }).map((_, i) => (
						<div key={i} className="flex items-center justify-between">
							<Skeleton className="h-4 w-40" />
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
				<CardContent className="p-6">
					<p className="text-red-500">{error.message}</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="flex flex-col gap-4 p-3 sm:gap-6 sm:p-6">
			<CardHeader className="p-0">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2 text-muted-foreground">
						<BookOpenIcon className="h-5 w-5" />
						<span className="text-sm">{filteredRecipes.length} recetas</span>
					</div>
					<Button size="sm" onClick={openCreate}>
						<PlusCircle className="mr-2 h-4 w-4" />
						Nueva receta
					</Button>
				</div>
			</CardHeader>

			<CardContent className="p-0">
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
					<div className="space-y-1">
						<Label>Buscar</Label>
						<Input
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Buscar padre/hijo…"
						/>
					</div>

					<div className="space-y-1">
						<Label>Padre</Label>
						<Select value={parentFilter} onValueChange={setParentFilter}>
							<SelectTrigger>
								<SelectValue placeholder="Selecciona padre" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">Todos</SelectItem>
								{parentProducts.map((p: Product) => (
									<SelectItem key={p.id} value={String(p.id)}>
										{p.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-1">
						<Label>Estilo</Label>
						<div className="flex flex-wrap gap-2">
							{(
								["all", "BASE", "NACIONAL", "AMERICANO", "POLINESIO"] as const
							).map((v) => (
								<Button
									key={v}
									type="button"
									size="sm"
									variant={typeFilter === v ? "default" : "outline"}
									onClick={() => setTypeFilter(v)}
								>
									{v === "all" ? "Todos" : v}
								</Button>
							))}
						</div>
					</div>

					<div className="space-y-1">
						<Label>Estado</Label>
						<div className="flex gap-2">
							<Button
								type="button"
								size="sm"
								variant={statusFilter === "active" ? "default" : "outline"}
								onClick={() => setStatusFilter("active")}
							>
								Activas
							</Button>
							<Button
								type="button"
								size="sm"
								variant={statusFilter === "all" ? "default" : "outline"}
								onClick={() => setStatusFilter("all")}
							>
								Todas
							</Button>
						</div>
					</div>
				</div>

				<div className="mt-3 text-muted-foreground text-sm">
					Configura cuántas piezas salen por cada pieza padre. El peso se
					captura después en báscula (por defecto no estimamos kg).
				</div>
			</CardContent>

			<CardContent className="p-0">
				<DataTable
					data={filteredRecipes}
					columns={columns}
					emptyMessage="No hay recetas"
					emptyIcon={<BookOpenIcon className="h-8 w-8" />}
					defaultSort={[{ id: "parent", desc: false }]}
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
						<DialogTitle>
							{isEditing ? "Editar receta" : "Nueva receta"}
						</DialogTitle>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							form.handleSubmit();
						}}
					>
						<div className="grid gap-4 py-4">
							<form.Field name="parentProductId">
								{(field) => (
									<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label className="sm:text-right">Padre</Label>
										<Select
											value={field.state.value ? String(field.state.value) : ""}
											onValueChange={(value) =>
												field.handleChange(Number(value))
											}
										>
											<SelectTrigger className="col-span-3">
												<SelectValue placeholder="Selecciona padre" />
											</SelectTrigger>
											<SelectContent>
												{parentProducts.map((p: Product) => (
													<SelectItem key={p.id} value={String(p.id)}>
														{p.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}
							</form.Field>

							<form.Field name="childProductId">
								{(field) => (
									<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label className="sm:text-right">Hijo</Label>
										<Select
											value={field.state.value ? String(field.state.value) : ""}
											onValueChange={(value) =>
												field.handleChange(Number(value))
											}
										>
											<SelectTrigger className="col-span-3">
												<SelectValue placeholder="Selecciona hijo" />
											</SelectTrigger>
											<SelectContent>
												{productOptions.map((p: Product) => (
													<SelectItem key={p.id} value={String(p.id)}>
														{p.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}
							</form.Field>

							<form.Field name="childName">
								{(field) => (
									<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label className="sm:text-right">Nombre hijo</Label>
										<div className="col-span-3">
											<Input
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
												onBlur={field.handleBlur}
												placeholder="Ej. Codillo de pierna"
												error={
													field.state.meta.errors.length
														? String(field.state.meta.errors[0])
														: undefined
												}
											/>
										</div>
									</div>
								)}
							</form.Field>

							<form.Field name="transformationType">
								{(field) => (
									<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label className="sm:text-right">Estilo</Label>
										<Input
											className="col-span-3"
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											onBlur={field.handleBlur}
											placeholder="Ej. BASE / NACIONAL / AMERICANO / POLINESIO / DESPIECE_ESPALDILLA"
										/>
									</div>
								)}
							</form.Field>

							<form.Field name="yieldQuantityPieces">
								{(field) => (
									<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label className="sm:text-right">Piezas</Label>
										<div className="col-span-3">
											<Input
												type="number"
												value={String(field.state.value)}
												onChange={(e) =>
													field.handleChange(Number(e.target.value))
												}
												onBlur={field.handleBlur}
											/>
										</div>
									</div>
								)}
							</form.Field>

							<form.Field name="yieldWeightRatio">
								{(field) => (
									<>
										<div className="flex items-center justify-end">
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() => setShowAdvanced((v) => !v)}
											>
												{showAdvanced ? "Ocultar avanzado" : "Mostrar avanzado"}
											</Button>
										</div>
										{showAdvanced ? (
											<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
												<Label className="sm:text-right">
													Kg estimado (opcional)
												</Label>
												<div className="col-span-3">
													<Input
														type="number"
														value={String(field.state.value)}
														onChange={(e) =>
															field.handleChange(Number(e.target.value))
														}
														onBlur={field.handleBlur}
													/>
												</div>
											</div>
										) : null}
									</>
								)}
							</form.Field>

							<form.Field name="isActive">
								{(field) => (
									<div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
										<Label className="sm:text-right">Activa</Label>
										<Select
											value={field.state.value ? "true" : "false"}
											onValueChange={(value) =>
												field.handleChange(value === "true")
											}
										>
											<SelectTrigger className="col-span-3">
												<SelectValue placeholder="Selecciona" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="true">Sí</SelectItem>
												<SelectItem value="false">No</SelectItem>
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
							<form.Subscribe selector={(state) => state.isSubmitting}>
								{(isSubmitting) => (
									<Button
										type="submit"
										disabled={isSubmitting || upsertMutation.isPending}
									>
										{isEditing ? tc("update") : tc("create")}
									</Button>
								)}
							</form.Subscribe>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</Card>
	);
}
