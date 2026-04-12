"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@finopenpos/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@finopenpos/ui/components/card";
import { ScissorsIcon, PackageIcon, CheckCircleIcon, ArrowRightIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@finopenpos/ui/components/select";
import { Input } from "@finopenpos/ui/components/input";
import { Label } from "@finopenpos/ui/components/label";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

const cuttingStyles = [
  "DESPIECE_NACIONAL",
  "DESPIECE_AMERICANO",
  "DESPIECE_POLINESIO",
  "DESPIECE_PIERNA",
  "DESPIECE_CABEZA",
  "DESPIECE_CUERO",
  "DESPIECE_ESPALDILLA",
  "DESPIECE_COSTILLAR",
];

export default function DisassemblyPage() {
  const trpc = useTRPC();
  const utils = trpc.useUtils();
  const t = useTranslations("pos");
  const tc = useTranslations("common");

  const [isClient, setIsClient] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string>("");
  const [selectedStyle, setSelectedStyle] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const { data: products = [], isLoading: isLoadingProducts } = useQuery(
    trpc.products.list.queryOptions()
  );

  const parentProducts = useMemo(() => 
    products.filter(p => p.is_parent_product), 
  [products]);

  const selectedParent = useMemo(() => 
    parentProducts.find(p => p.id === Number(selectedParentId)),
  [parentProducts, selectedParentId]);

  const transformationsQueryOptions = trpc.products.getTransformations.queryOptions({
    parentProductId: Number(selectedParentId || 0),
    transformationType: selectedStyle,
  });

  const { data: transformations = [], isLoading: isLoadingTransformations } = useQuery({
    ...transformationsQueryOptions,
    enabled: !!selectedParentId && !!selectedStyle,
  });

  const disassemblyMutation = trpc.products.processDisassembly.useMutation({
    onSuccess: () => {
      toast.success(t("disassemblySuccess"));
      setSelectedParentId("");
      setSelectedStyle("");
      setQuantity(1);
      utils.products.list.invalidate();
    },
    onError: (error) => {
      toast.error(t("disassemblyError") + ": " + error.message);
    }
  });

  const expectedPieces = (yieldQuantityPieces: unknown) => {
    const raw = Number(yieldQuantityPieces);
    const normalized = raw > 50 ? raw / 1000 : raw;
    return Math.round(normalized * quantity);
  };

  const expectedKg = (yieldWeightRatio: unknown) => {
    const parentWeight = selectedParent ? Number(selectedParent.stock_kg) : 0;
    const parentPieces = selectedParent ? selectedParent.stock_pieces : 0;
    const avgWeight = parentPieces > 0 ? parentWeight / parentPieces : 0;
    const raw = Number(yieldWeightRatio);
    const normalized = raw > 1 ? raw / 1000 : raw;
    return normalized * avgWeight * quantity;
  };

  const handleExecute = () => {
    if (!selectedParentId || !selectedStyle || quantity <= 0) return;
    disassemblyMutation.mutate({
      parentProductId: Number(selectedParentId),
      quantityToProcess: quantity,
      transformationType: selectedStyle as any,
    });
  };

  if (!isClient || isLoadingProducts) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ScissorsIcon className="w-6 h-6 text-primary" />
            <CardTitle>{t("disassembly")}</CardTitle>
          </div>
          <CardDescription>{t("disassemblyDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>{t("parentProduct")}</Label>
              <Select value={selectedParentId} onValueChange={setSelectedParentId}>
                <SelectTrigger>
                  <SelectValue placeholder={tc("search")} />
                </SelectTrigger>
                <SelectContent>
                  {parentProducts.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name} ({p.stock_pieces} {t("pieces")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("cuttingStyle")}</Label>
              <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                <SelectTrigger>
                  <SelectValue placeholder={tc("all")} />
                </SelectTrigger>
                <SelectContent>
                  {cuttingStyles.map(style => (
                    <SelectItem key={style} value={style}>
                      {style.replace("DESPIECE_", "")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("quantityToProcess")}</Label>
              <Input 
                type="number" 
                min={1} 
                max={selectedParent?.stock_pieces || 1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </div>
          </div>

          {transformations.length > 0 && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <PackageIcon className="w-5 h-5" />
                  {t("previewDisassembly")}
                </h3>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3 text-left font-medium">{t("childProduct")}</th>
                      <th className="p-3 text-left font-medium">{t("expectedQty")}</th>
                      <th className="p-3 text-left font-medium">{t("expectedWeight")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transformations.map((row: any) => (
                      <tr key={row.id} className="border-t">
                        <td className="p-3">{row.childProduct?.name ?? "-"}</td>
                        <td className="p-3">{expectedPieces(row.yield_quantity_pieces)}</td>
                        <td className="p-3">{expectedKg(row.yield_weight_ratio).toFixed(3)} kg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end pt-4">
                <Button 
                  size="lg" 
                  onClick={handleExecute}
                  disabled={disassemblyMutation.isPending || quantity > (selectedParent?.stock_pieces || 0)}
                >
                  {disassemblyMutation.isPending ? tc("loading") : (
                    <>
                      <CheckCircleIcon className="w-5 h-5 mr-2" />
                      {t("executeDisassembly")}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
