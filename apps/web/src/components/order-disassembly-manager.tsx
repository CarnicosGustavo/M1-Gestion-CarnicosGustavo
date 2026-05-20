"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@finopenpos/ui/components/card";
import { Button } from "@finopenpos/ui/components/button";
import { Badge } from "@finopenpos/ui/components/badge";
import { 
  Loader2Icon, 
  ChevronRightIcon, 
  CheckCircle2Icon, 
  AlertTriangleIcon,
  ScissorsIcon,
  PackageIcon
} from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@finopenpos/ui/components/select";

interface OrderDisassemblyManagerProps {
  orderId: number;
  orderItems: any[];
  onSuccess?: () => void;
}

export function OrderDisassemblyManager({ orderId, orderItems, onSuccess }: OrderDisassemblyManagerProps) {
  const trpc = useTRPC();
  const t = useTranslations("orders");
  const tc = useTranslations("common");
  
  const [selectedStyle, setSelectedStyle] = useState<string>("AMERICANO");
  const [leaveWholeIds, setLeaveWholeIds] = useState<number[]>([]);
  
  // Estilos comunes (estos podrían venir de la DB en el futuro)
  const styles = [
    { value: "AMERICANO", label: "Americano" },
    { value: "NACIONAL LOMO", label: "Nacional Lomo" },
    { value: "NACIONAL ESPILOMO", label: "Nacional Espilomo" },
    { value: "POLINESIO", label: "Polinesio" },
  ];

  const { data: validation, isLoading: isValidating } = useQuery(
    trpc.orders.validateDisassemblyRecipes.queryOptions({
      orderId,
      transformationType: selectedStyle,
      productsToLeaveWhole: leaveWholeIds,
    })
  );

  const prepareMutation = useMutation(
    trpc.orders.prepareDisassemblyForOrder.mutationOptions({
      onSuccess: () => {
        toast.success("Despiece ejecutado correctamente");
        onSuccess?.();
      },
      onError: (error) => {
        toast.error(`Error al preparar despiece: ${error.message}`);
      },
    })
  );

  const toggleLeaveWhole = (id: number) => {
    setLeaveWholeIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const hasShortages = orderItems.some(
    (item) => item.status === "PENDIENTE_COMPRA" || 
              (item.product && item.product.stock_pieces < (item.quantity_pieces || 0))
  );

  if (!hasShortages) return null;

  return (
    <Card className="border-yellow-200 bg-yellow-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-yellow-900">
          <ScissorsIcon className="h-5 w-5" />
          {t("disassemblyManagement")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium text-yellow-900">
              Estilo de Despiece (Canal)
            </label>
            <Select value={selectedStyle} onValueChange={setSelectedStyle}>
              <SelectTrigger className="bg-white border-yellow-200">
                <SelectValue placeholder="Selecciona un estilo" />
              </SelectTrigger>
              <SelectContent>
                {styles.map((style) => (
                  <SelectItem key={style.value} value={style.value}>
                    {style.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="bg-yellow-600 hover:bg-yellow-700 text-white"
            onClick={() => prepareMutation.mutate({ 
              orderId, 
              transformationType: selectedStyle,
              productsToLeaveWhole: leaveWholeIds
            })}
            disabled={prepareMutation.isPending || !validation?.ok}
          >
            {prepareMutation.isPending ? (
              <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2Icon className="mr-2 h-4 w-4" />
            )}
            Ejecutar Despiece Automático
          </Button>
        </div>

        {isValidating ? (
          <div className="flex items-center gap-2 text-sm text-yellow-700">
            <Loader2Icon className="h-4 w-4 animate-spin" />
            Validando recetas para este estilo...
          </div>
        ) : validation ? (
          <div className="space-y-3">
            {!validation.ok && (
              <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-100">
                <AlertTriangleIcon className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Recetas incompletas</p>
                  <p className="mt-1">
                    No hay recetas suficientes para generar todos los productos faltantes con el estilo {selectedStyle}.
                  </p>
                </div>
              </div>
            )}

            <div className="rounded-md border border-yellow-200 bg-white overflow-hidden">
              <div className="bg-yellow-100/50 px-3 py-2 border-b border-yellow-200 flex items-center justify-between">
                <span className="text-xs font-bold text-yellow-900 uppercase tracking-wider">
                  Genera (al ejecutar)
                </span>
                {validation.canal && (
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                    Desde: {validation.canal.name}
                  </Badge>
                )}
              </div>
              <div className="divide-y divide-yellow-100">
                {validation.items.map((item, idx) => (
                  <div key={idx} className="px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <PackageIcon className="h-3.5 w-3.5 text-yellow-600" />
                        <span className="font-medium text-slate-700">{item.productName}</span>
                      </div>
                      <span className="font-bold text-yellow-700">+{item.demandPieces} pzas</span>
                    </div>
                    {item.path && item.path.length > 0 && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400 overflow-x-auto whitespace-nowrap pb-1">
                        {item.path.map((step, sIdx) => (
                          <span key={sIdx} className="flex items-center gap-1">
                            {sIdx > 0 && <ChevronRightIcon className="h-3 w-3" />}
                            <span className={sIdx === item.path!.length - 1 ? "text-yellow-600 font-medium" : ""}>
                              {step.parentName}
                            </span>
                            {sIdx < item.path!.length - 1 && (
                              <button
                                onClick={() => toggleLeaveWhole(step.childId)}
                                className={`px-1 rounded border transition-colors ${
                                  leaveWholeIds.includes(step.childId)
                                    ? "bg-red-100 border-red-200 text-red-700"
                                    : "bg-slate-100 border-slate-200 hover:bg-yellow-100 hover:border-yellow-200"
                                }`}
                                title={leaveWholeIds.includes(step.childId) ? "No despiezar (Dejar completo)" : "Haga clic para dejar completo"}
                              >
                                {leaveWholeIds.includes(step.childId) ? "Dejar completo" : "Separar"}
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.reason === "BLOQUEADO_POR_USUARIO" && (
                      <span className="text-[10px] text-red-500 font-medium italic">BLOQUEADO: Se dejará completo el paso intermedio.</span>
                    )}
                    {item.reason === "RECETA_INCOMPLETA" && (
                      <span className="text-[10px] text-red-500 font-medium">Sin receta para este estilo</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
