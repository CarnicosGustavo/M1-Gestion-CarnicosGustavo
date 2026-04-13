"use client";

import { useMemo, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod/v4";
import { Button } from "@finopenpos/ui/components/button";
import { Card, CardContent, CardHeader } from "@finopenpos/ui/components/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@finopenpos/ui/components/dialog";
import { Input } from "@finopenpos/ui/components/input";
import { Label } from "@finopenpos/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@finopenpos/ui/components/select";
import { SearchFilter, type FilterOption } from "@finopenpos/ui/components/search-filter";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import { DataTable, TableActions, TableActionButton, type Column } from "@finopenpos/ui/components/data-table";
import { PlusCircle, FilePenIcon, CheckCircleIcon, XCircleIcon, BookOpenIcon } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
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
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const listInput = useMemo(() => {
    return {
      parentProductId: parentFilter === "all" ? undefined : Number(parentFilter),
      transformationType: typeFilter === "all" ? undefined : typeFilter,
      includeInactive: statusFilter === "all",
    };
  }, [parentFilter, statusFilter, typeFilter]);

  const { data: allProducts = [], isLoading: isLoadingProducts } = useQuery(trpc.products.list.queryOptions());
  const { data: parentProducts = [] } = useQuery(trpc.products.list.queryOptions({ isParent: true }));

  const recipesQueryOptions = trpc.inventory.recipesList.queryOptions(listInput);
  const { data: recipes = [], isLoading: isLoadingRecipes, error } = useQuery(recipesQueryOptions);

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

  const transformationTypeOptions = useMemo<FilterOption[]>(() => {
    const types = Array.from(new Set(recipes.map((r) => r.transformation_type))).sort((a, b) => a.localeCompare(b));
    return [{ label: tc("all"), value: "all" }, ...types.map((x) => ({ label: x, value: x }))];
  }, [recipes, tc]);

  const parentOptions = useMemo<FilterOption[]>(() => {
    const opts: FilterOption[] = [{ label: tc("all"), value: "all" }];
    parentProducts.forEach((p) => opts.push({ label: p.name, value: String(p.id) }));
    return opts;
  }, [parentProducts, tc]);

  const statusOptions: FilterOption[] = useMemo(() => {
    return [
      { label: "Activas", value: "active" },
      { label: "Todas", value: "all" },
    ];
  }, []);

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
        queryClient.invalidateQueries({ queryKey: trpc.inventory.recipesList.queryKey() });
        setIsDialogOpen(false);
      },
      onError: (e) => toast.error(e.message),
    })
  );

  const setActiveMutation = useMutation(
    trpc.inventory.recipesSetActive.mutationOptions({
      onSuccess: () => {
        toast.success("Actualizado");
        queryClient.invalidateQueries({ queryKey: trpc.inventory.recipesList.queryKey() });
      },
      onError: (e) => toast.error(e.message),
    })
  );

  const form = useForm({
    defaultValues: {
      parentProductId: 0,
      childProductId: 0,
      childName: "",
      transformationType: "",
      yieldQuantityPieces: 0,
      yieldWeightRatio: 0,
      isActive: true,
    },
    validators: {
      onSubmit: ({ value }) => {
        const res = recipeFormSchema.safeParse(value);
        if (!res.success) return res.error.errors.map((e) => e.message).join(", ");
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
    setIsDialogOpen(true);
  };

  const productOptions = useMemo(() => {
    return allProducts.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [allProducts]);

  const columns: Column<Recipe>[] = [
    { key: "parent", header: "Padre", sortable: true, getValue: (r) => r.parentProduct.name },
    { key: "child", header: "Hijo", sortable: true, getValue: (r) => r.childProduct.name, className: "font-medium" },
    { key: "type", header: "Estilo", sortable: true, getValue: (r) => r.transformation_type },
    { key: "pieces", header: "Piezas", sortable: true, getValue: (r) => String(r.yield_quantity_pieces) },
    { key: "ratio", header: "Ratio Kg", sortable: true, getValue: (r) => String(r.yield_weight_ratio) },
    {
      key: "active",
      header: "Activa",
      getValue: (r) => (r.is_active ? "Sí" : "No"),
      render: (r) => (
        <div className="flex items-center gap-2">
          {r.is_active ? <CheckCircleIcon className="w-4 h-4 text-green-600" /> : <XCircleIcon className="w-4 h-4 text-red-600" />}
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
          <TableActionButton onClick={() => openEdit(row)} icon={<FilePenIcon className="w-4 h-4" />} label={tc("edit")} />
          <TableActionButton
            variant={row.is_active ? "danger" : "default"}
            onClick={() => setActiveMutation.mutate({ id: row.id, isActive: !row.is_active })}
            icon={row.is_active ? <XCircleIcon className="w-4 h-4" /> : <CheckCircleIcon className="w-4 h-4" />}
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
        <CardContent className="p-0 space-y-3">
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
            <BookOpenIcon className="w-5 h-5" />
            <span className="text-sm">
              {filteredRecipes.length} recetas
            </span>
          </div>
          <Button size="sm" onClick={openCreate}>
            <PlusCircle className="w-4 h-4 mr-2" />
            Nueva receta
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <SearchFilter
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar padre/hijo/estilo…"
          filters={[
            { options: parentOptions, value: parentFilter, onChange: setParentFilter },
            { options: transformationTypeOptions, value: typeFilter, onChange: setTypeFilter },
            { options: statusOptions, value: statusFilter, onChange: setStatusFilter },
          ]}
        />
      </CardContent>

      <CardContent className="p-0">
        <DataTable
          data={filteredRecipes}
          columns={columns}
          emptyMessage="No hay recetas"
          emptyIcon={<BookOpenIcon className="w-8 h-8" />}
          defaultSort={[{ id: "parent", desc: false }]}
        />
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) setIsDialogOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar receta" : "Nueva receta"}</DialogTitle>
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
                  <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
                    <Label className="sm:text-right">Padre</Label>
                    <Select
                      value={field.state.value ? String(field.state.value) : ""}
                      onValueChange={(value) => field.handleChange(Number(value))}
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
                  <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
                    <Label className="sm:text-right">Hijo</Label>
                    <Select
                      value={field.state.value ? String(field.state.value) : ""}
                      onValueChange={(value) => field.handleChange(Number(value))}
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
                  <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
                    <Label className="sm:text-right">Nombre hijo</Label>
                    <div className="col-span-3">
                      <Input
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        placeholder="Ej. Codillo de pierna"
                        error={field.state.meta.errors.length ? String(field.state.meta.errors[0]) : undefined}
                      />
                    </div>
                  </div>
                )}
              </form.Field>

              <form.Field name="transformationType">
                {(field) => (
                  <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
                    <Label className="sm:text-right">Estilo</Label>
                    <div className="col-span-3">
                      <Input
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        placeholder="Nacional / Americano / Polinesio"
                        error={field.state.meta.errors.length ? String(field.state.meta.errors[0]) : undefined}
                      />
                    </div>
                  </div>
                )}
              </form.Field>

              <form.Field name="yieldQuantityPieces">
                {(field) => (
                  <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
                    <Label className="sm:text-right">Piezas</Label>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        value={String(field.state.value)}
                        onChange={(e) => field.handleChange(Number(e.target.value))}
                        onBlur={field.handleBlur}
                      />
                    </div>
                  </div>
                )}
              </form.Field>

              <form.Field name="yieldWeightRatio">
                {(field) => (
                  <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
                    <Label className="sm:text-right">Ratio Kg</Label>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        value={String(field.state.value)}
                        onChange={(e) => field.handleChange(Number(e.target.value))}
                        onBlur={field.handleBlur}
                      />
                    </div>
                  </div>
                )}
              </form.Field>

              <form.Field name="isActive">
                {(field) => (
                  <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
                    <Label className="sm:text-right">Activa</Label>
                    <Select
                      value={field.state.value ? "true" : "false"}
                      onValueChange={(value) => field.handleChange(value === "true")}
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
              <Button variant="secondary" onClick={() => setIsDialogOpen(false)}>
                {tc("cancel")}
              </Button>
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <Button type="submit" disabled={isSubmitting || upsertMutation.isPending}>
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
