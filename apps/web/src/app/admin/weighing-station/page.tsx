"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@finopenpos/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@finopenpos/ui/components/card";
import { ScaleIcon, CheckCircleIcon, ChevronRightIcon, MessageSquareIcon } from "lucide-react";
import { Input } from "@finopenpos/ui/components/input";
import { Label } from "@finopenpos/ui/components/label";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@finopenpos/ui/components/badge";
import { formatCurrency } from "@/lib/utils";

export default function WeighingStationPage() {
  const trpc = useTRPC();
  const t = useTranslations("pos");
  const tc = useTranslations("common");
  const locale = useLocale();

  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [actualWeight, setActualWeight] = useState<string>("");

  const { data: orders = [], isLoading: isLoadingOrders, refetch: refetchOrders } = useQuery(
    trpc.orders.getPendingWeighingOrders.queryOptions()
  );

  const selectedOrder = useMemo(() => 
    orders.find(o => o.id === selectedOrderId),
  [orders, selectedOrderId]);

  const nextItem = useMemo(() => 
    selectedOrder?.orderItems?.find(item => item.status === "PENDIENTE_PESAJE"),
  [selectedOrder]);

  // Si la orden seleccionada ya no tiene items pendientes, deseleccionarla
  useEffect(() => {
    if (selectedOrderId && !nextItem && !isLoadingOrders) {
      setSelectedOrderId(null);
    }
  }, [nextItem, selectedOrderId, isLoadingOrders]);

  const updateWeightMutation = useMutation(
    trpc.orders.updateOrderItemWeight.mutationOptions({
      onSuccess: () => {
        toast.success(t("weighed"));
        setActualWeight("");
        refetchOrders();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );

  const handleRegisterWeight = () => {
    if (!nextItem || !actualWeight || parseFloat(actualWeight) <= 0) return;
    updateWeightMutation.mutate({
      orderItemId: nextItem.id,
      actualWeightKg: Math.round(parseFloat(actualWeight) * 1000),
    });
  };

  if (isLoadingOrders) {
    return <Skeleton className="h-[600px] w-full" />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto h-[calc(100vh-120px)]">
      {/* Sidebar: Pendientes */}
      <Card className="lg:col-span-1 overflow-hidden flex flex-col">
        <CardHeader className="bg-muted/50 border-b">
          <CardTitle className="flex items-center gap-2">
            <ScaleIcon className="w-5 h-5" />
            {t("weighingStation")}
          </CardTitle>
          <CardDescription>
            {orders.length} {t("orders").toLowerCase()} {tc("pending").toLowerCase()}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-y-auto flex-1">
          {orders.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <CheckCircleIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>{tc("noItemFound")}</p>
            </div>
          ) : (
            <div className="divide-y">
              {orders.map(order => (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                  className={`w-full text-left p-4 hover:bg-accent transition-colors flex items-center justify-between group ${
                    selectedOrderId === order.id ? "bg-accent" : ""
                  }`}
                >
                  <div className="space-y-1">
                    <div className="font-medium flex items-center gap-2">
                      #{order.id} - {order.customer?.name || "Consumidor Final"}
                      {order.whatsapp_message_id && (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">
                          <MessageSquareIcon className="w-3 h-3 mr-1" />
                          WhatsApp
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {order.orderItems.length} {t("items").toLowerCase()} {t("pendingWeight").toLowerCase()}
                    </div>
                  </div>
                  <ChevronRightIcon className={`w-5 h-5 text-muted-foreground transition-transform ${
                    selectedOrderId === order.id ? "translate-x-1" : "opacity-0 group-hover:opacity-100"
                  }`} />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main: Captura de Peso */}
      <Card className="lg:col-span-2 overflow-hidden flex flex-col">
        {selectedOrder && nextItem ? (
          <>
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle>{selectedOrder.customer?.name || "Consumidor Final"}</CardTitle>
                  <CardDescription>{t("orderId")}: #{selectedOrder.id}</CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{tc("total")}</div>
                  <div className="text-2xl font-bold">{formatCurrency(selectedOrder.total_amount, locale)}</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col items-center justify-center p-12 space-y-12 text-center">
              <div className="space-y-4">
                <div className="text-sm font-medium text-primary uppercase tracking-widest">{t("nextItem")}</div>
                <h2 className="text-5xl font-extrabold tracking-tight">
                  {nextItem.quantity_pieces} {nextItem.product?.name}
                </h2>
                <p className="text-muted-foreground text-lg">
                  {nextItem.product?.category}
                </p>
              </div>

              <div className="w-full max-w-sm space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="weight" className="text-xl font-semibold">{t("actualWeight")}</Label>
                  <div className="relative">
                    <Input
                      id="weight"
                      type="number"
                      step="0.001"
                      autoFocus
                      value={actualWeight}
                      onChange={(e) => setActualWeight(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleRegisterWeight()}
                      className="text-6xl h-32 text-center font-mono font-bold rounded-2xl border-4 focus-visible:ring-offset-4"
                      placeholder="0.000"
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 text-4xl font-bold text-muted-foreground pointer-events-none">
                      kg
                    </div>
                  </div>
                </div>

                <Button 
                  size="lg" 
                  className="w-full h-20 text-2xl font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all"
                  onClick={handleRegisterWeight}
                  disabled={updateWeightMutation.isPending || !actualWeight || parseFloat(actualWeight) <= 0}
                >
                  {updateWeightMutation.isPending ? tc("loading") : (
                    <>
                      <ScaleIcon className="w-8 h-8 mr-3" />
                      {t("registerWeight")}
                    </>
                  )}
                </Button>
              </div>

              <div className="flex gap-2">
                {selectedOrder.orderItems.map((item, i) => (
                  <div 
                    key={item.id} 
                    className={`w-3 h-3 rounded-full ${
                      item.id === nextItem.id ? "bg-primary animate-pulse" : 
                      item.status === "PESADO" ? "bg-green-500" : "bg-muted"
                    }`}
                  />
                ))}
              </div>
            </CardContent>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-12">
            <ScaleIcon className="w-24 h-24 mb-6 opacity-10" />
            <h3 className="text-2xl font-medium">{t("weighingStationDescription")}</h3>
            <p className="max-w-md text-center mt-2">
              Selecciona una orden de la lista de pendientes para comenzar a registrar el peso de los productos.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
