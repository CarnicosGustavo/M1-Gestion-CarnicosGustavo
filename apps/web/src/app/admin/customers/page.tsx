"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useForm } from "@tanstack/react-form";
import { z } from "zod/v4";
import { Card, CardContent, CardHeader } from "@finopenpos/ui/components/card";
import { PlusCircle, FilePenIcon, TrashIcon, UsersIcon, Wallet, HandCoins } from "lucide-react";
import { cn } from "@finopenpos/ui/lib/utils";
import { Button } from "@finopenpos/ui/components/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@finopenpos/ui/components/dialog";
import { Input } from "@finopenpos/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@finopenpos/ui/components/select";
import { Label } from "@finopenpos/ui/components/label";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import { DataTable, TableActions, TableActionButton, type Column, type ExportColumn } from "@finopenpos/ui/components/data-table";
import { SearchFilter, type FilterOption } from "@finopenpos/ui/components/search-filter";
import type { RouterOutputs } from "@/lib/trpc/router";
import { useTranslations } from "next-intl";

type Customer = RouterOutputs["customers"]["list"][number];

export default function CustomersPage() {
  const trpc = useTRPC();
  const { data: customers = [], isLoading, error } = useQuery(trpc.customers.list.queryOptions());
  const { data: accounts = [] } = useQuery(trpc.collections.listAccounts.queryOptions()) as {
    data: { customerId: number; balance: number; creditLimit: number; termsDays: number }[];
  };
  const { data: priceLists = [] } = useQuery(
    trpc.inventory.priceListsList.queryOptions(),
  );
  const t = useTranslations("customers");
  const tc = useTranslations("common");

  // Mapa cliente → saldo por cobrar (para mostrarlo en la lista)
  const balanceByCustomer = useMemo(() => {
    const m = new Map<number, number>();
    for (const a of accounts) m.set(a.customerId, a.balance);
    return m;
  }, [accounts]);

  // Mapa cliente → límite de crédito (para precargar al editar)
  const creditByCustomer = useMemo(() => {
    const m = new Map<number, { creditLimit: number; termsDays: number }>();
    for (const a of accounts)
      m.set(a.customerId, { creditLimit: a.creditLimit, termsDays: a.termsDays });
    return m;
  }, [accounts]);

  const customerFormSchema = z.object({
    name: z.string().min(1, t("nameRequired")),
    contact_name: z.string(),
    email: z.string().email(t("invalidEmail")),
    whatsapp_phone: z.string(),
    address: z.string(),
    notes: z.string(),
    status: z.enum(["active", "inactive"]),
  });

  const statusFilterOptions: FilterOption[] = [
    { label: tc("all"), value: "all" },
    { label: tc("active"), value: "active", variant: "success" },
    { label: tc("inactive"), value: "inactive", variant: "danger" },
  ];

  const tableColumns: Column<Customer>[] = [
    {
      key: "name",
      header: tc("name"),
      sortable: true,
      className: "font-medium",
      render: (row) => (
        <Link
          href={`/admin/customers/${row.id}`}
          className="text-primary hover:underline font-medium"
        >
          {row.name ?? `Cliente #${row.id}`}
        </Link>
      ),
    },
    { key: "phone", header: tc("phone"), hideOnMobile: true },
    {
      key: "balance",
      header: "Saldo",
      sortable: true,
      accessorFn: (row) => balanceByCustomer.get(row.id) ?? 0,
      render: (row) => {
        const bal = balanceByCustomer.get(row.id) ?? 0;
        if (bal <= 0.001)
          return <span className="text-muted-foreground">—</span>;
        return (
          <span className="font-semibold text-red-600">
            {bal.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
          </span>
        );
      },
    },
    {
      key: "status",
      header: tc("status"),
      sortable: true,
      hideOnMobile: true,
      render: (row) => (
        <span className={row.status === "active" ? "text-green-600" : "text-muted-foreground"}>
          {row.status === "active" ? tc("active") : tc("inactive")}
        </span>
      ),
    },
  ];

  const exportColumns: ExportColumn<Customer>[] = [
    { key: "name", header: tc("name"), getValue: (c) => c.name },
    { key: "email", header: tc("email"), getValue: (c) => c.email },
    { key: "phone", header: tc("phone"), getValue: (c) => c.phone ?? "" },
    { key: "status", header: tc("status"), getValue: (c) => c.status ?? "active" },
  ];

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const isEditing = editingId !== null;
  const invalidateKeys = trpc.customers.list.queryOptions().queryKey;

  const createMutation = useCrudMutation({
    mutationOptions: trpc.customers.create.mutationOptions(),
    invalidateKeys,
    successMessage: t("created"),
    errorMessage: t("createError"),
    onSuccess: () => setIsDialogOpen(false),
  });

  const updateMutation = useCrudMutation({
    mutationOptions: trpc.customers.update.mutationOptions(),
    invalidateKeys,
    successMessage: t("updated"),
    errorMessage: t("updateError"),
    onSuccess: () => setIsDialogOpen(false),
  });

  const deleteMutation = useCrudMutation({
    mutationOptions: trpc.customers.delete.mutationOptions(),
    invalidateKeys,
    successMessage: t("deleted"),
    errorMessage: t("deleteError"),
  });

  const form = useForm({
    defaultValues: {
      name: "",
      contact_name: "",
      email: "",
      whatsapp_phone: "",
      address: "",
      notes: "",
      status: "active" as "active" | "inactive",
      sale_type: "contado" as "contado" | "credito",
      credit_limit: "",
      price_list_id: "none",
    },
    validators: {
      onSubmit: ({ value }) => {
        const res = customerFormSchema.safeParse(value);
        if (!res.success) return res.error.errors.map((e) => e.message).join(", ");
        return undefined;
      },
    },
    onSubmit: ({ value }) => {
      const wa = value.whatsapp_phone || undefined;
      const payload = {
        name: value.name,
        contact_name: value.contact_name || undefined,
        email: value.email,
        // WhatsApp es el identificador principal; el telefono se mantiene igual
        whatsapp_phone: wa,
        phone: wa,
        address: value.address || undefined,
        notes: value.notes || undefined,
        status: value.status,
        price_list_id:
          value.price_list_id && value.price_list_id !== "none"
            ? Number(value.price_list_id)
            : null,
      };
      // Crédito: solo se envía el límite si el cliente es a crédito.
      const credit =
        value.sale_type === "credito"
          ? { credit_limit: Number.parseFloat(value.credit_limit || "0") || 0 }
          : {};
      if (isEditing) {
        updateMutation.mutate({ id: editingId, ...payload, ...credit });
      } else {
        createMutation.mutate({ ...payload, ...credit });
      }
    },
  });

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      const q = searchTerm.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.phone ?? "").includes(searchTerm);
    });
  }, [customers, statusFilter, searchTerm]);

  const openCreate = () => {
    setEditingId(null);
    form.reset();
    setIsDialogOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditingId(c.id);
    form.reset();
    form.setFieldValue("name", c.name ?? "");
    form.setFieldValue("contact_name", (c as any).contact_name ?? "");
    form.setFieldValue("email", c.email ?? "");
    form.setFieldValue(
      "whatsapp_phone",
      (c as any).whatsapp_phone ?? c.phone ?? "",
    );
    form.setFieldValue("address", (c as any).address ?? "");
    form.setFieldValue("notes", (c as any).notes ?? "");
    form.setFieldValue("status", (c.status ?? "active") as "active" | "inactive");
    const cred = creditByCustomer.get(c.id);
    const hasCredit = !!cred && cred.creditLimit > 0;
    form.setFieldValue("sale_type", hasCredit ? "credito" : "contado");
    form.setFieldValue("credit_limit", hasCredit ? String(cred?.creditLimit) : "");
    form.setFieldValue(
      "price_list_id",
      c.price_list_id != null ? String(c.price_list_id) : "none",
    );
    setIsDialogOpen(true);
  };

  const handleDelete = () => {
    if (deleteId !== null) {
      deleteMutation.mutate({ id: deleteId });
      setIsDeleteOpen(false);
      setDeleteId(null);
    }
  };

  const actionsColumn: Column<Customer> = {
    key: "actions",
    header: tc("actions"),
    render: (row) => (
      <TableActions>
        <TableActionButton onClick={() => openEdit(row)} icon={<FilePenIcon className="w-4 h-4" />} label={tc("edit")} />
        <TableActionButton variant="danger" onClick={() => { setDeleteId(row.id); setIsDeleteOpen(true); }} icon={<TrashIcon className="w-4 h-4" />} label={tc("delete")} />
      </TableActions>
    ),
  };

  if (isLoading) {
    return (
      <Card className="flex flex-col gap-6 p-6">
        <CardHeader className="p-0"><div className="flex items-center justify-between"><Skeleton className="h-10 w-48" /><Skeleton className="h-9 w-32" /></div></CardHeader>
        <CardContent className="p-0 space-y-3">{Array.from({ length: 5 }).map((_, i) => (<div key={i} className="flex items-center gap-4"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-40" /><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-16" /><Skeleton className="h-8 w-20" /></div>))}</CardContent>
      </Card>
    );
  }

  if (error) { return <Card><CardContent><p className="text-red-500">{error.message}</p></CardContent></Card>; }

  return (
    <Card className="flex flex-col gap-4 p-3 sm:gap-6 sm:p-6">
      <CardHeader className="p-0">
        <SearchFilter
          search={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder={t("searchPlaceholder")}
          filters={[{ options: statusFilterOptions, value: statusFilter, onChange: setStatusFilter }]}
        >
          <Button size="sm" onClick={openCreate}><PlusCircle className="w-4 h-4 mr-2" />{t("addCustomer")}</Button>
        </SearchFilter>
      </CardHeader>
      <CardContent className="p-0">
        <DataTable
          data={filteredCustomers}
          columns={[...tableColumns, actionsColumn]}
          exportColumns={exportColumns}
          exportFilename="customers"
          emptyMessage={t("noCustomers")}
          emptyIcon={<UsersIcon className="w-8 h-8" />}
          defaultSort={[{ id: "name", desc: false }]}
        />
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) setIsDialogOpen(false); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{isEditing ? t("editCustomer") : t("createCustomer")}</DialogTitle></DialogHeader>
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
                  <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
                    <Label htmlFor="name">Nombre del negocio</Label>
                    <div className="col-span-3">
                      <Input id="name" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} placeholder="Ej. Carnicería Balderas" error={field.state.meta.errors.length > 0 ? field.state.meta.errors.map(e => e?.message ?? e).join(", ") : undefined} />
                    </div>
                  </div>
                )}
              </form.Field>
              <form.Field name="contact_name">
                {(field) => (
                  <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
                    <Label htmlFor="contact_name">Responsable</Label>
                    <Input id="contact_name" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} className="col-span-3" placeholder="Nombre de contacto" />
                  </div>
                )}
              </form.Field>
              <form.Field name="whatsapp_phone">
                {(field) => (
                  <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
                    <Label htmlFor="whatsapp_phone">WhatsApp</Label>
                    <div className="col-span-3">
                      <Input id="whatsapp_phone" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder="Tel. de WhatsApp (identificador principal)" />
                    </div>
                  </div>
                )}
              </form.Field>
              <form.Field name="email">
                {(field) => (
                  <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
                    <Label htmlFor="email">Correo</Label>
                    <div className="col-span-3">
                      <Input id="email" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} error={field.state.meta.errors.length > 0 ? field.state.meta.errors.map(e => e?.message ?? e).join(", ") : undefined} />
                    </div>
                  </div>
                )}
              </form.Field>
              <form.Field name="address">
                {(field) => (
                  <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
                    <Label htmlFor="address">Dirección</Label>
                    <Input id="address" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} className="col-span-3" placeholder="Zona / dirección de entrega" />
                  </div>
                )}
              </form.Field>
              <form.Field name="notes">
                {(field) => (
                  <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
                    <Label htmlFor="notes">Notas</Label>
                    <Input id="notes" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} className="col-span-3" placeholder="Notas del cliente" />
                  </div>
                )}
              </form.Field>
              <form.Field name="status">
                {(field) => (
                  <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
                    <Label htmlFor="status">{tc("status")}</Label>
                    <Select value={field.state.value} onValueChange={(value) => field.handleChange(value as "active" | "inactive")}>
                      <SelectTrigger id="status" className="col-span-3"><SelectValue placeholder={t("selectStatus")} /></SelectTrigger>
                      <SelectContent><SelectItem value="active">{tc("active")}</SelectItem><SelectItem value="inactive">{tc("inactive")}</SelectItem></SelectContent>
                    </Select>
                  </div>
                )}
              </form.Field>

              {/* Lista de precios — del diseño (NuevoClienteModal) */}
              <form.Field name="price_list_id">
                {(field) => (
                  <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
                    <Label htmlFor="price_list_id">Lista de precios</Label>
                    <Select
                      value={field.state.value}
                      onValueChange={(v) => field.handleChange(v)}
                    >
                      <SelectTrigger id="price_list_id" className="col-span-3">
                        <SelectValue placeholder="Sin lista (precios base)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin lista (precios base)</SelectItem>
                        {priceLists.map((pl) => (
                          <SelectItem key={pl.id} value={String(pl.id)}>
                            {pl.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </form.Field>

              {/* Tipo de venta + límite de crédito — del diseño (NuevoClienteModal) */}
              <form.Field name="sale_type">
                {(field) => (
                  <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
                    <Label>Tipo de venta</Label>
                    <div className="col-span-3 flex gap-2">
                      {([
                        ["contado", "Contado", Wallet],
                        ["credito", "Crédito", HandCoins],
                      ] as const).map(([id, lab, Ic]) => {
                        const on = field.state.value === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => field.handleChange(id)}
                            className={cn(
                              "flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-bold transition-colors",
                              on
                                ? "border-primary bg-[var(--cg-red-wash)] text-primary"
                                : "border-border text-foreground hover:bg-muted",
                            )}
                          >
                            <Ic className="h-4 w-4" />
                            {lab}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </form.Field>
              <form.Subscribe selector={(s) => s.values.sale_type}>
                {(saleType) =>
                  saleType === "credito" ? (
                    <form.Field name="credit_limit">
                      {(field) => (
                        <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
                          <Label htmlFor="credit_limit">Límite de crédito</Label>
                          <div className="col-span-3">
                            <div className="relative">
                              <Input
                                id="credit_limit"
                                type="number"
                                min="0"
                                value={field.state.value}
                                onChange={(e) => field.handleChange(e.target.value)}
                                placeholder="0"
                                className="pr-12"
                              />
                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                                MXN
                              </span>
                            </div>
                            <p className="mt-1.5 text-xs text-muted-foreground">
                              iAntonella te avisará al acercarse al límite o al vencer un saldo.
                            </p>
                          </div>
                        </div>
                      )}
                    </form.Field>
                  ) : null
                }
              </form.Subscribe>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setIsDialogOpen(false)}>{tc("cancel")}</Button>
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <Button type="submit" disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}>
                    {isEditing ? t("updateCustomer") : t("addCustomer")}
                  </Button>
                )}
              </form.Subscribe>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen} onConfirm={handleDelete} description={t("deleteMessage")} />
    </Card>
  );
}
