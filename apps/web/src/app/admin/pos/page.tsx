"use client";

import { Button } from "@finopenpos/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@finopenpos/ui/components/card";
import { Combobox } from "@finopenpos/ui/components/combobox";
import { Input } from "@finopenpos/ui/components/input";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@finopenpos/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Loader2Icon,
	MinusIcon,
	PlusIcon,
	ReceiptTextIcon,
	SearchIcon,
	Trash2Icon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/router";
import { formatCurrency } from "@/lib/utils";

type Product = RouterOutputs["products"]["list"][number];
type POSProduct = Pick<
	Product,
	| "id"
	| "name"
	| "price_per_kg"
	| "price_per_piece"
	| "stock_pieces"
	| "stock_kg"
	| "is_sellable_by_weight"
	| "is_sellable_by_unit"
	| "default_sale_unit"
> & {
	category: string;
	quantityPieces: number;
	quantityKg: number | null;
	unitPricePerKg: number;
	unitPricePerPiece: number;
};

export default function POSPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { data: products = [], isLoading: loadingProducts } = useQuery(
		trpc.products.list.queryOptions(),
	);
	const { data: customers = [], isLoading: loadingCustomers } = useQuery(
		trpc.customers.list.queryOptions(),
	);
	const { data: paymentMethods = [], isLoading: loadingMethods } = useQuery(
		trpc.paymentMethods.list.queryOptions(),
	);
	const { data: priceLists = [], isLoading: loadingPriceLists } = useQuery(
		trpc.inventory.priceListsList.queryOptions(),
	);
	const t = useTranslations("pos");
	const tc = useTranslations("common");
	const tOrders = useTranslations("orders");
	const locale = useLocale();

	const loading =
		loadingProducts || loadingCustomers || loadingMethods || loadingPriceLists;

	const createOrderMutation = useMutation(
		trpc.orders.create.mutationOptions({
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
		}),
	);

	const [selectedProducts, setSelectedProducts] = useState<POSProduct[]>([]);
	const [paymentMethod, setPaymentMethod] = useState<{
		id: number;
		name: string;
	} | null>(null);
	const [selectedCustomer, setSelectedCustomer] = useState<{
		id: number;
		name: string;
	} | null>(null);
	const [productSearch, setProductSearch] = useState("");
	const [emitNfce, setEmitNfce] = useState(false);
	const [selectedPriceListId, setSelectedPriceListId] =
		useState<string>("base");

	const priceListItemsQuery = useQuery({
		...trpc.inventory.priceListItemsByList.queryOptions({
			priceListId: Number(selectedPriceListId),
		}),
		enabled: selectedPriceListId !== "base",
	});

	const priceOverrides = useMemo(() => {
		const map = new Map<number, { kg?: number; piece?: number }>();
		if (selectedPriceListId === "base") return map;
		for (const item of priceListItemsQuery.data ?? []) {
			const kg =
				item.unit_price_per_kg !== null ? Number(item.unit_price_per_kg) : null;
			const piece =
				item.unit_price_per_piece !== null
					? Number(item.unit_price_per_piece)
					: null;
			map.set(item.product_id, {
				kg: kg !== null && Number.isFinite(kg) ? kg : undefined,
				piece: piece !== null && Number.isFinite(piece) ? piece : undefined,
			});
		}
		return map;
	}, [priceListItemsQuery.data, selectedPriceListId]);

	const filteredProducts = useMemo(() => {
		if (!productSearch.trim()) return products;
		const q = productSearch.toLowerCase();
		return products.filter(
			(p) =>
				p.name.toLowerCase().includes(q) ||
				(p.category ?? "").toLowerCase().includes(q),
		);
	}, [products, productSearch]);

	const priceListOptions = useMemo(() => {
		return [
			{ id: "base", name: "Precio base" },
			...priceLists.map((l) => ({ id: String(l.id), name: l.name })),
		];
	}, [priceLists]);

	const handleSelectPriceList = (id: number | string) => {
		setSelectedPriceListId(String(id));
	};

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
					p.id === productId
						? { ...p, quantityPieces: p.quantityPieces + 1 }
						: p,
				),
			);
		} else {
			const override = priceOverrides.get(product.id);
			const baseKg = Number(product.price_per_kg) || 0;
			const basePiece = Number(product.price_per_piece) || 0;
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
					quantityKg: null,
					unitPricePerKg: override?.kg ?? baseKg,
					unitPricePerPiece: override?.piece ?? basePiece,
				},
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
			}),
		);
	};

	const handleSetQuantityPieces = (productId: number, value: number) => {
		setSelectedProducts((prev) =>
			prev.map((p) => {
				if (p.id !== productId) return p;
				const v = Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
				return { ...p, quantityPieces: v };
			}),
		);
	};

	const handleSetQuantityKg = (productId: number, value: number | null) => {
		setSelectedProducts((prev) =>
			prev.map((p) => {
				if (p.id !== productId) return p;
				if (value === null) return { ...p, quantityKg: null };
				const v = Number.isFinite(value) ? Math.max(0, value) : 0;
				return { ...p, quantityKg: v };
			}),
		);
	};

	const handleSetUnitPriceKg = (productId: number, value: number) => {
		setSelectedProducts((prev) =>
			prev.map((p) => {
				if (p.id !== productId) return p;
				const v = Number.isFinite(value) ? Math.max(0, value) : 0;
				return { ...p, unitPricePerKg: v };
			}),
		);
	};

	const handleSetUnitPricePiece = (productId: number, value: number) => {
		setSelectedProducts((prev) =>
			prev.map((p) => {
				if (p.id !== productId) return p;
				const v = Number.isFinite(value) ? Math.max(0, value) : 0;
				return { ...p, unitPricePerPiece: v };
			}),
		);
	};

	const handleRemoveProduct = (productId: number) => {
		setSelectedProducts(selectedProducts.filter((p) => p.id !== productId));
	};

	const total = selectedProducts.reduce((sum, p) => {
		if (p.quantityKg) {
			return sum + (p.unitPricePerKg || 0) * p.quantityKg;
		}
		if (p.quantityPieces) {
			return sum + (p.unitPricePerPiece || 0) * p.quantityPieces;
		}
		return sum;
	}, 0);

	const canCreate =
		selectedProducts.length > 0 &&
		selectedCustomer &&
		(paymentMethod ||
			selectedProducts.some((p) => p.is_sellable_by_weight && !p.quantityKg));

	const handleCreateOrder = () => {
		if (!canCreate) return;
		const customerId = selectedCustomer?.id;
		if (!customerId) return;

		// CAMBIO: En lugar de rechazar, clasificar productos por stock disponible
		const productsWithStock = [];
		const productsPendingPurchase = [];

		for (const p of selectedProducts) {
			const hasEnoughStock = p.quantityKg !== null
				? p.quantityKg <= Number(p.stock_kg)
				: p.quantityPieces <= p.stock_pieces;

			if (hasEnoughStock) {
				productsWithStock.push(p);
			} else {
				productsPendingPurchase.push(p);
			}
		}

		// Si hay productos sin stock, advertir al usuario
		if (productsPendingPurchase.length > 0) {
			const pendingNames = productsPendingPurchase.map(p => p.name).join(", ");
			toast.warning(
				`${productsPendingPurchase.length} producto(s) sin stock serán marcados como pendiente de compra: ${pendingNames}`
			);
		}

		// Crear orden con TODOS los productos (incluir ambas listas)
		createOrderMutation.mutate({
			customerId,
			paymentMethodId: paymentMethod?.id,
			items: selectedProducts.map((p) => ({
				productId: p.id,
				quantityPieces: p.quantityPieces,
				quantityKg: p.quantityKg ? Math.round(p.quantityKg * 1000) : undefined,
				unitPrice: p.quantityKg
					? Math.round((p.unitPricePerKg || 0) * 100)
					: Math.round((p.unitPricePerPiece || 0) * 100),
				// NUEVO: Indicar si este producto está pendiente de compra
				requiresPurchase: productsPendingPurchase.some(pp => pp.id === p.id),
			})),
		});
	};

	if (loading) {
		return (
			<div className="container mx-auto space-y-4 p-4">
				<Card>
					<CardHeader>
						<Skeleton className="h-6 w-32" />
					</CardHeader>
					<CardContent className="flex gap-4">
						<Skeleton className="h-10 flex-1" />
						<Skeleton className="h-10 flex-1" />
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<Skeleton className="h-6 w-24" />
					</CardHeader>
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
		<div className="mx-auto w-full max-w-4xl">
			<Card className="mb-4">
				<CardHeader>
					<CardTitle>{t("saleDetails")}</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-3 sm:flex-row sm:gap-4">
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
					<div className="flex-1">
						<Combobox
							items={priceListOptions}
							placeholder="Lista de precios"
							onSelect={handleSelectPriceList}
						/>
					</div>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>{t("products")}</CardTitle>
					<div className="!mt-4 flex flex-col gap-3 sm:flex-row">
						<div className="relative flex-1">
							<SearchIcon className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
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
								name: (() => {
									const override = priceOverrides.get(p.id);
									const price = p.is_sellable_by_weight
										? (override?.kg ?? Number(p.price_per_kg || 0))
										: (override?.piece ?? Number(p.price_per_piece || 0));
									return `${p.name} — ${formatCurrency(price * 100, locale)} (${p.stock_pieces} pzas / ${p.stock_kg} kg)`;
								})(),
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
										<TableHead className="hidden sm:table-cell">
											{tc("price")}
										</TableHead>
										<TableHead>{t("pieces")}</TableHead>
										<TableHead>{t("weight")}</TableHead>
										<TableHead>{tc("total")}</TableHead>
										<TableHead className="w-10" />
									</TableRow>
								</TableHeader>
								<TableBody>
									{selectedProducts.map((product) => {
										const price =
											product.quantityKg !== null
												? product.unitPricePerKg
												: product.unitPricePerPiece;
										return (
											<TableRow key={product.id}>
												<TableCell className="font-medium">
													{product.name}
												</TableCell>
												<TableCell className="hidden sm:table-cell">
													<div className="flex items-center gap-2">
														<Input
															type="number"
															step="0.01"
															className="w-28"
															value={String(price)}
															onChange={(e) => {
																const v = Number(e.target.value);
																if (product.quantityKg !== null)
																	handleSetUnitPriceKg(product.id, v);
																else handleSetUnitPricePiece(product.id, v);
															}}
														/>
														<span className="text-muted-foreground text-xs">
															{product.quantityKg !== null ? "/kg" : "/pza"}
														</span>
													</div>
												</TableCell>
												<TableCell>
													<div className="flex items-center gap-1">
														<Button
															size="icon"
															variant="outline"
															className="h-7 w-7"
															onClick={() =>
																handleQuantityChange(product.id, -1)
															}
															disabled={product.quantityPieces <= 1}
														>
															<MinusIcon className="h-3 w-3" />
														</Button>
														<Input
															type="number"
															className="h-7 w-16 text-center"
															value={String(product.quantityPieces)}
															onChange={(e) =>
																handleSetQuantityPieces(
																	product.id,
																	Number(e.target.value),
																)
															}
														/>
														<Button
															size="icon"
															variant="outline"
															className="h-7 w-7"
															onClick={() =>
																handleQuantityChange(product.id, 1)
															}
														>
															<PlusIcon className="h-3 w-3" />
														</Button>
													</div>
												</TableCell>
												<TableCell>
													{product.is_sellable_by_weight ? (
														<Input
															type="number"
															step="0.001"
															placeholder="kg"
															className="h-7 w-24"
															value={
																product.quantityKg === null
																	? ""
																	: String(product.quantityKg)
															}
															onChange={(e) => {
																const raw = e.target.value.trim();
																handleSetQuantityKg(
																	product.id,
																	raw ? Number(raw) : null,
																);
															}}
														/>
													) : (
														<span className="text-muted-foreground">—</span>
													)}
												</TableCell>
												<TableCell className="font-medium">
													{formatCurrency(
														(product.quantityKg !== null
															? product.quantityKg * price
															: product.quantityPieces * price) * 100,
														locale,
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
					<div className="mt-4 flex flex-col items-center justify-between gap-3 border-t pt-4 sm:flex-row">
						<div className="flex flex-col">
							<strong className="text-lg">
								{tc("total")}: {formatCurrency(total * 100, locale)}
							</strong>
							{selectedProducts.some(
								(p) => p.is_sellable_by_weight && !p.quantityKg,
							) && (
								<span className="font-medium text-orange-600 text-xs">
									{t("weighingPendingItems")}
								</span>
							)}
						</div>
						<div className="flex w-full items-center gap-3 sm:w-auto">
							<label className="flex cursor-pointer select-none items-center gap-2 text-sm">
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
								{createOrderMutation.isPending && (
									<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
								)}
								{selectedProducts.some(
									(p) => p.is_sellable_by_weight && !p.quantityKg,
								)
									? t("orderRequiresWeighing")
									: t("createOrder")}
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
