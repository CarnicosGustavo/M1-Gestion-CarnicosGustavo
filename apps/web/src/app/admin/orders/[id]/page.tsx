"use client";

import { use } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@finopenpos/ui/components/card";
import { Badge } from "@finopenpos/ui/components/badge";
import { Button } from "@finopenpos/ui/components/button";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@finopenpos/ui/components/table";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { formatCurrency } from "@/lib/utils";

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const orderId = parseInt(id);
  const trpc = useTRPC();
  const { data: order, isLoading } = useQuery(trpc.orders.get.queryOptions({ id: orderId })) as { data: any; isLoading: boolean };
  const t = useTranslations("orders");
  const tc = useTranslations("common");
  const locale = useLocale();

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

  const statusColor = order.status === "completed" ? "text-green-600" : order.status === "cancelled" ? "text-red-600" : "text-yellow-600";
  const statusLabel = order.status === "completed" ? tc("completed") : order.status === "cancelled" ? tc("cancelled") : tc("pending");

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href="/admin/orders">
          <Button variant="ghost" size="icon"><ArrowLeftIcon className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold">{t("orderDetails")} #{order.id}</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t("orderDetails")}</CardTitle>
            <div className="flex items-center gap-2">
              <span className={`font-semibold ${statusColor}`}>{statusLabel}</span>
              {order.requires_weighing && (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-900">Por Pesar</Badge>
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
              <dd className="text-lg font-bold">{formatCurrency(order.total_amount, locale)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("createdAt")}</dt>
              <dd>{order.created_at ? new Date(order.created_at).toLocaleString() : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Items</dt>
              <dd className="font-medium">{order.orderItems?.length ?? 0} productos</dd>
            </div>
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

      {order.orderItems && order.orderItems.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{t("items")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[35%]">{t("product")}</TableHead>
                    <TableHead className="text-center">{t("pieces")}</TableHead>
                    <TableHead className="text-center">Kg</TableHead>
                    <TableHead className="text-right">Precio Unit.</TableHead>
                    <TableHead className="text-right">{t("subtotal")}</TableHead>
                    <TableHead className="text-center">{t("status")}</TableHead>
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
                        <TableCell className="font-medium">{item.product?.name ?? `#${item.product_id}`}</TableCell>
                        <TableCell className="text-center">{item.quantity_pieces ?? "—"}</TableCell>
                        <TableCell className="text-center">{item.quantity_kg ?? "—"}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unit_price, locale)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(item.subtotal, locale)}</TableCell>
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
                    {(order.orderItems
                      .filter((item: any) => item.status !== "PENDIENTE_COMPRA")
                      .reduce((sum: number, item: any) => sum + (parseFloat(item.quantity_kg || 0)), 0)
                    ).toFixed(3)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-muted-foreground">Items</p>
                  <p className="text-lg font-bold">{order.orderItems.length}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-lg font-bold">{formatCurrency(order.total_amount, locale)}</p>
                </div>
              </div>
            </div>

            {/* Alerta si hay items PENDIENTE_COMPRA */}
            {order.orderItems.some((item: any) => item.status === "PENDIENTE_COMPRA") && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-900 font-medium">
                  ⚠️ {order.orderItems.filter((item: any) => item.status === "PENDIENTE_COMPRA").length} producto(s) pendiente de compra
                </p>
                <p className="text-xs text-red-800 mt-1">
                  Estos items no están incluidos en el total. Deben ser adquiridos para completar la orden.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
