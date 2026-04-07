"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@finopenpos/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@finopenpos/ui/components/table";
import { Combobox } from "@finopenpos/ui/components/combobox";
import { Button } from "@finopenpos/ui/components/button";
import { Input } from "@finopenpos/ui/components/input";
import { Badge } from "@finopenpos/ui/components/badge";
import { Loader2Icon, MinusIcon, PlusIcon, SearchIcon, Trash2Icon, ReceiptTextIcon } from "lucide-react";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { RouterOutputs } from "@/lib/trpc/router";
import { useTranslations, useLocale } from "next-intl";
import { formatCurrency } from "@/lib/utils";

type Product = RouterOutputs["products"]["list"][number];
type POSProduct = Pick<Product, "id" | "name" | "price_per_kg" | "price_per_piece" | "stock_pieces" | "stock_kg" | "is_sellable_by_weight" | "is_sellable_by_unit" | "default_sale_unit"> & { category: string; quantityPieces: number; quantityKg: number | null };

export default function POSPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: products = [], isLoading: loadingProducts } = useQuery(trpc.products.list.queryOptions());
  const { data: customers = [], isLoading: loadingCustomers } = useQuery(trpc.customers.list.queryOptions());
  const { data: paymentMethods = [], isLoading: loadingMethods } = useQuery(trpc.paymentMethods.list.queryOptions());
  const t = useTranslations("pos");
  const tc = useTranslations("common");
  const tOrders = useTranslations("orders");
  const locale = useLocale();

  const loading = loadingProducts || loadingCustomers || loadingMethods;

  const createOrderMutation = useMutation(trpc.orders.create.mutationOptions({
    onSuccess: (order) => {
      queryClient.invalidateQueries(trpc.orders.list.queryOptions());
      queryClient.invalidateQueries(trpc.products.list.queryOptions());
      
      if (order.status === "PENDIENTE_PESAJE") {
        toast.warning(t("orderRequiresWeighing"));
      } else {
        toast.success(tOrders("createdSuccessfully"));
      }
      
      setSelectedProducts([]);
      setSelectedCustomer(null);
      setPaymentMethod(null);
    },
    onError: (err) => toast.error(err.message || tOrders("createError")),
  }));

  const [selectedProducts, setSelectedProducts] = useState<POSProduct[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<{ id: number; name: string } | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: number; name: string } | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [emitNfce, setEmitNfce] = useState(false);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase();
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.category ?? "").toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  const handleSelectProduct = (productId: number | string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    
    // Validar stock dual
    if (product.stock_pieces <= 0 && product.stock_kg <= 0) {
      toast.error(t("outOfStock", { name: product.name }));
      return;
    }

    const existing = selectedProducts.find((p) => p.id === productId);
    if (existing) {
      setSelectedProducts(
        selectedProducts.map((p) =>
          p.id === productId ? { ...p, quantityPieces: p.quantityPieces + 1 } : p
        )
      );
    } else {
      setSelectedProducts([
        ...selectedProducts, 
        { 
          id: product.id, 
          name: product.name, 
          price_per_kg: product.price_per_kg,
          price_per_piece: product.price_per_piece,
          stock_pieces: product.stock_pieces,
          stock_kg: product.stock_kg,
          is_sellable_by_weight: product.is_sellable_by_weight,
          is_sellable_by_unit: product.is_sellable_by_unit,
          default_sale_unit: product.default_sale_unit,
          category: product.category ?? "", 
          quantityPieces: 1,
          quantityKg: null 
        }
      ]);
    }
  };

  const handleSelectCustomer = (customerId: number | string) => {
    const customer = customers.find((c) => c.id === customerId);
    if (customer) setSelectedCustomer(customer);
  };

  const handleSelectPaymentMethod = (paymentMethodId: number | string) => {
    const method = paymentMethods.find((pm) => pm.id === paymentMethodId);
    if (method) setPaymentMethod(method);
  };

  const handleQuantityChange = (productId: number, delta: number) => {
    setSelectedProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        const newQty = p.quantityPieces + delta;
        if (newQty <= 0) return p;
        return { ...p, quantityPieces: newQty };
      })
    );
  };

  const handleRemoveProduct = (productId: number) => {
    setSelectedProducts(selectedProducts.filter((p) => p.id !== productId));
  };

  const total = selectedProducts.reduce((sum, p) => {
    if (p.quantityKg) {
      return sum + (Number(p.price_per_kg) || 0) * p.quantityKg;
    }
    if (p.quantityPieces && p.price_per_piece) {
      return sum + Number(p.price_per_piece) * p.quantityPieces;
    }
    return sum;
  }, 0);

  const canCreate = selectedProducts.length > 0 && selectedCustomer && (paymentMethod || selectedProducts.some(p => p.is_sellable_by_weight && !p.quantityKg));

  const handleCreateOrder = () => {
    if (!canCreate) return;
    createOrderMutation.mutate({
      customerId: selectedCustomer!.id,
      paymentMethodId: paymentMethod?.id,
      items: selectedProducts.map((p) => ({
        productId: p.id,
        quantityPieces: p.quantityPieces,
        quantityKg: p.quantityKg ? Math.round(p.quantityKg * 1000) : undefined,
        unitPrice: p.quantityKg ? Math.round((Number(p.price_per_kg) || 0) * 100) : Math.round((Number(p.price_per_piece) || 0) * 100),
      })),
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 space-y-4">
        <Card>
          <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
          <CardContent className="flex gap-4">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-6 w-24" /></CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>{t("saleDetails")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1">
            <Combobox
              items={customers}
              placeholder={t("selectCustomer")}
              onSelect={handleSelectCustomer}
            />
          </div>
          <div className="flex-1">
            <Combobox
              items={paymentMethods}
              placeholder={t("selectPaymentMethod")}
              onSelect={handleSelectPaymentMethod}
            />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("products")}</CardTitle>
          <div className="flex flex-col sm:flex-row gap-3 !mt-4">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t("searchPlaceholder")}
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Combobox
              items={filteredProducts.map((p) => ({
                id: p.id,
                name: `${p.name} — ${formatCurrency(Number(p.price_per_kg || p.price_per_piece || 0) * 100, locale)} (${p.stock_pieces} pzas / ${p.stock_kg} kg)`,
              }))}
              placeholder={t("addProduct")}
              noSelect
              onSelect={handleSelectProduct}
            />
          </div>
        </CardHeader>
        <CardContent>
          {selectedProducts.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
              {t("selectProducts")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tc("name")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{tc("price")}</TableHead>
                    <TableHead>{t("pieces")}</TableHead>
                    <TableHead>{t("weight")}</TableHead>
                    <TableHead>{tc("total")}</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedProducts.map((product) => {
                    const price = product.quantityKg ? (Number(product.price_per_kg) || 0) : (Number(product.price_per_piece) || 0);
                    return (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell className="hidden sm:table-cell">{formatCurrency(price * 100, locale)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => handleQuantityChange(product.id, -1)}
                              disabled={product.quantityPieces <= 1}
                            >
                              <MinusIcon className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center tabular-nums">{product.quantityPieces}</span>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => handleQuantityChange(product.id, 1)}
                            >
                              <PlusIcon className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {product.is_sellable_by_weight ? (
                            product.quantityKg ? (
                              <Badge variant="success">{product.quantityKg} kg</Badge>
                            ) : (
                              <Badge variant="outline" className="text-orange-500 border-orange-200 bg-orange-50">
                                {t("pendingWeight")}
                              </Badge>
                            )
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {product.is_sellable_by_weight && !product.quantityKg ? (
                            <span className="text-muted-foreground italic">{t("pendingWeight")}</span>
                          ) : (
                            formatCurrency((product.quantityKg ? (product.quantityKg * price) : (product.quantityPieces * price)) * 100, locale)
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleRemoveProduct(product.id)}
                          >
                            <Trash2Icon className="h-4 w-4" />
                            <span className="sr-only">{tc("remove")}</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t pt-4">
            <div className="flex flex-col">
              <strong className="text-lg">{tc("total")}: {formatCurrency(total * 100, locale)}</strong>
              {selectedProducts.some(p => p.is_sellable_by_weight && !p.quantityKg) && (
                <span className="text-xs text-orange-600 font-medium">{t("weighingPendingItems")}</span>
              )}
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={emitNfce}
                  onChange={(e) => setEmitNfce(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <ReceiptTextIcon className="h-4 w-4 text-muted-foreground" />
                NFC-e
              </label>
              <Button
                onClick={handleCreateOrder}
                disabled={!canCreate || createOrderMutation.isPending}
                size="lg"
                className="flex-1 sm:flex-initial"
              >
                {createOrderMutation.isPending && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
                {selectedProducts.some(p => p.is_sellable_by_weight && !p.quantityKg) ? t("orderRequiresWeighing") : t("createOrder")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
