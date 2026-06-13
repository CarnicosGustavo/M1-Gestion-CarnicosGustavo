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
import { AntonellaSlot } from "@/components/antonella-slot";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Loader2Icon,
	MinusIcon,
	PlusIcon,
	ReceiptTextIcon,
	ScissorsIcon,
	SearchIcon,
	Trash2Icon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/router";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@finopenpos/ui/lib/utils";

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

// Availability badge — color-coded per the design system
type AvailStatus = "stock" | "despiece" | "pesaje" | "faltante";

function AvailBadge({
	status,
	small,
}: { status: AvailStatus; small?: boolean }) {
	const config: Record<AvailStatus, { label: string; cls: string }> = {
		stock: {
			label: "Stock",
			cls: "bg-[var(--cg-green-wash)] text-[var(--cg-green)]",
		},
		despiece: {
			label: "Despiece",
			cls: "bg-[var(--cg-blue-wash)] text-[var(--cg-blue)]",
		},
		pesaje: {
			label: "Por pesar",
			cls: "bg-[var(--cg-amber-wash)] text-[var(--cg-amber)]",
		},
		faltante: {
			label: "Faltante",
			cls: "bg-[var(--cg-red-wash)] text-primary",
		},
	};
	const { label, cls } = config[status];
	return (
		<span
			className={cn(
				"inline-flex shrink-0 rounded-full font-bold uppercase tracking-[0.04em]",
				small ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[10px]",
				cls,
			)}
		>
			{label}
		</span>
	);
}

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
	const { data: availability = [] } = useQuery(
		trpc.products.availabilityMap.queryOptions(),
	) as {
		data: {
			productId: number;
			stockPieces: number;
			stockKg: number;
			derivable: boolean;
		}[];
	};

	const availMap = useMemo(() => {
		const m = new Map<
			number,
			{ stockPieces: number; stockKg: number; derivable: boolean }
		>();
		for (const a of availability) m.set(a.productId, a);
		return m;
	}, [availability]);

	// Clasifica cada producto del pedido: en stock / vía despiece / faltante
	const classify = (p: {
		id: number;
		quantityKg: number | null;
		quantityPieces: number;
		stock_kg: number | string;
		stock_pieces: number;
	}): "stock" | "despiece" | "faltante" => {
		const direct =
			p.quantityKg !== null
				? p.quantityKg <= Number(p.stock_kg)
				: p.quantityPieces <= p.stock_pieces;
		if (direct) return "stock";
		return availMap.get(p.id)?.derivable ? "despiece" : "faltante";
	};

	// Availability status for catalog cards (uses availMap, not cart state)
	const catalogAvail = (product: Product): AvailStatus => {
		const a = availMap.get(product.id);
		if (!a) return product.is_sellable_by_weight ? "pesaje" : "faltante";
		if (a.stockPieces > 0 || a.stockKg > 0) return "stock";
		if (a.derivable) return "despiece";
		if (product.is_sellable_by_weight) return "pesaje";
		return "faltante";
	};

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

	// Precios propios del cliente seleccionado (tienen prioridad sobre lista/base)
	const customerPricesQuery = useQuery({
		...trpc.customerPrices.getByCustomer.queryOptions({
			customerId: selectedCustomer?.id ?? 0,
		}),
		enabled: !!selectedCustomer,
	});

	const customerPriceMap = useMemo(() => {
		const map = new Map<number, { kg?: number; piece?: number }>();
		for (const item of (customerPricesQuery.data ?? []) as any[]) {
			if (!item.hasCustomPrice) continue;
			const kg = item.pricePerKg != null ? Number(item.pricePerKg) : null;
			const piece =
				item.pricePerPiece != null ? Number(item.pricePerPiece) : null;
			map.set(item.productId, {
				kg: kg != null && Number.isFinite(kg) ? kg : undefined,
				piece: piece != null && Number.isFinite(piece) ? piece : undefined,
			});
		}
		return map;
	}, [customerPricesQuery.data]);

	// Resuelve el precio de un producto: cliente > lista > base
	const resolvePrice = (productId: number, baseKg: number, basePiece: number) => {
		const cust = customerPriceMap.get(productId);
		const list = priceOverrides.get(productId);
		return {
			kg: cust?.kg ?? list?.kg ?? baseKg,
			piece: cust?.piece ?? list?.piece ?? basePiece,
		};
	};

	// Re-precia los productos en el carrito cuando cambian los precios del cliente o la lista
	useEffect(() => {
		setSelectedProducts((prev) => {
			let changed = false;
			const next = prev.map((p) => {
				const price = resolvePrice(
					p.id,
					Number(p.price_per_kg) || 0,
					Number(p.price_per_piece) || 0,
				);
				if (
					price.kg !== p.unitPricePerKg ||
					price.piece !== p.unitPricePerPiece
				) {
					changed = true;
					return {
						...p,
						unitPricePerKg: price.kg,
						unitPricePerPiece: price.piece,
					};
				}
				return p;
			});
			return changed ? next : prev;
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [customerPriceMap, priceOverrides]);

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
			const baseKg = Number(product.price_per_kg) || 0;
			const basePiece = Number(product.price_per_piece) || 0;
			const price = resolvePrice(product.id, baseKg, basePiece);
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
					unitPricePerKg: price.kg,
					unitPricePerPiece: price.piece,
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
		if (p.quantityKg) return sum + (p.unitPricePerKg || 0) * p.quantityKg;
		if (p.quantityPieces)
			return sum + (p.unitPricePerPiece || 0) * p.quantityPieces;
		return sum;
	}, 0);

	const canCreate = selectedProducts.length > 0 && !!selectedCustomer;

	const handleCreateOrder = () => {
		if (!canCreate) return;
		const customerId = selectedCustomer?.id;
		if (!customerId) return;

		const faltantes = selectedProducts.filter((p) => classify(p) === "faltante");
		const viaDespiece = selectedProducts.filter(
			(p) => classify(p) === "despiece",
		);

		if (viaDespiece.length > 0) {
			toast.info(
				`${viaDespiece.length} pieza(s) se generarán por despiece: ${viaDespiece.map((p) => p.name).join(", ")}`,
			);
		}
		if (faltantes.length > 0) {
			toast.warning(
				`⚠️ Falta(n) ${faltantes.length} pieza(s): ${faltantes.map((p) => p.name).join(", ")}`,
			);
		}

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
				requiresPurchase: classify(p) === "faltante",
			})),
		});
	};

	if (loading) {
		return (
			<div className="mx-auto w-full max-w-5xl space-y-4">
				<Skeleton className="h-8 w-48" />
				<div className="grid grid-cols-3 gap-3">
					<Skeleton className="h-11" />
					<Skeleton className="h-11" />
					<Skeleton className="h-11" />
				</div>
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
					<Card>
						<CardContent className="p-4">
							<Skeleton className="mb-3 h-11" />
							<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
								{Array.from({ length: 9 }).map((_, i) => (
									<Skeleton key={i} className="h-20 rounded-xl" />
								))}
							</div>
						</CardContent>
					</Card>
					<Skeleton className="h-64 rounded-2xl" />
				</div>
			</div>
		);
	}

	const hasDespiece = selectedProducts.some((p) => classify(p) === "despiece");
	const hasFaltantes = selectedProducts.some((p) => classify(p) === "faltante");
	const needsWeighing = selectedProducts.some(
		(p) => p.is_sellable_by_weight && !p.quantityKg,
	);

	return (
		<div className="mx-auto w-full max-w-5xl">
			{/* iAntonella */}
			<AntonellaSlot
				data={{
					tone: "sugerencia",
					titulo: "Disponibilidad en vivo",
					texto:
						"Clasifico cada pieza al agregarla: en stock, vía despiece o faltante. CUERO y piezas de peso van a báscula. Te aviso antes de crear el pedido.",
					acciones: [
						"¿Qué piezas faltan en stock?",
						"¿Cubre mi stock los pedidos?",
					],
				}}
			/>

			{/* Encabezado */}
			<div className="mb-4 flex items-baseline justify-between gap-3">
				<h1 className="font-display text-[28px] tracking-wide text-foreground">
					POS
				</h1>
				{selectedCustomer && (
					<span className="text-sm font-semibold text-muted-foreground">
						{selectedCustomer.name}
					</span>
				)}
			</div>

			{/* Detalles de venta (cliente / método / lista) */}
			<div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
				<Combobox
					items={customers.map((c: any) => ({
						id: c.id,
						name: `${c.name ?? "Cliente"}${c.phone ? ` · ${c.phone}` : ""}`,
					}))}
					placeholder="Buscar cliente…"
					onSelect={handleSelectCustomer}
				/>
				<Combobox
					items={paymentMethods}
					placeholder={t("selectPaymentMethod")}
					onSelect={handleSelectPaymentMethod}
				/>
				<Combobox
					items={priceListOptions}
					placeholder="Lista de precios"
					onSelect={handleSelectPriceList}
				/>
			</div>

			{/* Catálogo + Carrito */}
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
				{/* Catálogo de productos */}
				<Card>
					<CardContent className="p-4">
						<div className="relative mb-3">
							<SearchIcon className="absolute top-3 left-3 h-4 w-4 text-muted-foreground" />
							<Input
								type="text"
								placeholder={t("searchPlaceholder")}
								value={productSearch}
								onChange={(e) => setProductSearch(e.target.value)}
								className="h-11 pl-9"
							/>
						</div>
						<div className="grid max-h-[440px] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
							{filteredProducts.map((product) => {
								const avail = catalogAvail(product);
								const price = Number(
									product.is_sellable_by_weight
										? product.price_per_kg
										: product.price_per_piece,
								);
								return (
									<button
										key={product.id}
										type="button"
										onClick={() => handleSelectProduct(product.id)}
										className="group rounded-xl border bg-card p-3 text-left transition-colors hover:bg-secondary active:scale-[0.98]"
									>
										<div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
											{product.category || "—"}
										</div>
										<div className="mb-2 line-clamp-2 text-[13px] font-bold leading-tight text-foreground">
											{product.name}
										</div>
										<div className="flex items-center justify-between gap-1">
											<span className="font-mono text-xs text-foreground">
												{price > 0
													? `$${price.toFixed(2)}`
													: "—"}
												{product.is_sellable_by_weight ? "/kg" : "/pz"}
											</span>
											<AvailBadge status={avail} small />
										</div>
									</button>
								);
							})}
						</div>
					</CardContent>
				</Card>

				{/* Carrito */}
				<Card className="flex flex-col">
					<CardHeader className="pb-2">
						<CardTitle className="font-display text-[18px] tracking-wide">
							{selectedCustomer ? selectedCustomer.name : t("products")}
						</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-1 flex-col">
						{/* Líneas del pedido */}
						{selectedProducts.length === 0 ? (
							<div className="flex flex-1 items-center justify-center py-10 text-sm text-muted-foreground">
								{t("selectProducts")}
							</div>
						) : (
							<div className="space-y-2">
								{selectedProducts.map((product) => {
									const avail = classify(product);
									const cartAvail: AvailStatus =
										product.is_sellable_by_weight && !product.quantityKg
											? "pesaje"
											: avail;
									const price =
										product.quantityKg !== null
											? product.unitPricePerKg
											: product.unitPricePerPiece;
									const subtotal =
										product.quantityKg !== null
											? product.quantityKg * price
											: product.quantityPieces * price;
									return (
										<div
											key={product.id}
											className="rounded-xl border bg-secondary/50 p-2.5"
										>
											{/* Nombre + badge */}
											<div className="mb-2 flex items-center gap-1.5">
												<span className="flex-1 truncate text-[13px] font-bold text-foreground">
													{product.name}
												</span>
												<AvailBadge status={cartAvail} small />
											</div>
											{/* Stepper + kg + precio + trash */}
											<div className="flex items-center gap-1.5">
												{/* Stepper de piezas */}
												<div className="flex items-center rounded-lg border bg-background">
													<button
														type="button"
														onClick={() => handleQuantityChange(product.id, -1)}
														disabled={product.quantityPieces <= 1}
														className="flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
													>
														<MinusIcon className="h-3.5 w-3.5" />
													</button>
													<Input
														type="number"
														className="h-9 w-10 border-0 text-center font-mono font-bold text-sm"
														value={String(product.quantityPieces)}
														onChange={(e) =>
															handleSetQuantityPieces(
																product.id,
																Number(e.target.value),
															)
														}
													/>
													<button
														type="button"
														onClick={() => handleQuantityChange(product.id, 1)}
														className="flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
													>
														<PlusIcon className="h-3.5 w-3.5" />
													</button>
												</div>
												{/* kg */}
												{product.is_sellable_by_weight ? (
													<Input
														type="number"
														step="0.001"
														placeholder="kg"
														className="h-9 w-20 text-center font-mono text-sm"
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
												) : null}
												{/* Precio */}
												<Input
													type="number"
													step="0.01"
													className="h-9 w-20 font-mono text-sm"
													value={String(price)}
													onChange={(e) => {
														const v = Number(e.target.value);
														if (product.quantityKg !== null)
															handleSetUnitPriceKg(product.id, v);
														else handleSetUnitPricePiece(product.id, v);
													}}
												/>
												{/* Subtotal */}
												<span className="ml-auto font-mono text-[13px] font-bold text-foreground">
													{formatCurrency(subtotal * 100, locale)}
												</span>
												{/* Eliminar */}
												<button
													type="button"
													onClick={() => handleRemoveProduct(product.id)}
													className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[var(--cg-red-wash)] hover:text-primary"
												>
													<Trash2Icon className="h-4 w-4" />
												</button>
											</div>
										</div>
									);
								})}
							</div>
						)}

						{/* Alertas de estado */}
						{hasDespiece && (
							<div className="mt-2 flex items-center gap-2 rounded-lg bg-[var(--cg-blue-wash)] px-3 py-2">
								<ScissorsIcon className="h-3.5 w-3.5 shrink-0 text-[var(--cg-blue)]" />
								<span className="text-[12px] font-medium text-[var(--cg-blue)]">
									Piezas por despiece — se generarán al confirmar
								</span>
							</div>
						)}
						{hasFaltantes && (
							<div className="mt-2 flex items-center gap-2 rounded-lg bg-[var(--cg-red-wash)] px-3 py-2">
								<span className="text-[12px] font-medium text-primary">
									⚠️ Piezas faltantes: sin stock ni despiece disponible
								</span>
							</div>
						)}

						{/* Total y botón */}
						<div className="mt-4 border-t pt-4">
							<div className="mb-3 flex items-baseline justify-between">
								<span className="font-display text-xl text-foreground">
									Total
								</span>
								<span className="font-display text-xl text-foreground">
									{formatCurrency(total * 100, locale)}
								</span>
							</div>
							<div className="flex items-center gap-3">
								<label className="flex cursor-pointer select-none items-center gap-2 text-sm text-foreground">
									<input
										type="checkbox"
										checked={emitNfce}
										onChange={(e) => setEmitNfce(e.target.checked)}
										className="h-4 w-4 rounded border accent-primary"
									/>
									<ReceiptTextIcon className="h-4 w-4 text-muted-foreground" />
									Factura
								</label>
								<Button
									onClick={handleCreateOrder}
									disabled={!canCreate || createOrderMutation.isPending}
									size="lg"
									className="flex-1 bg-primary font-bold text-primary-foreground hover:bg-primary/90"
								>
									{createOrderMutation.isPending && (
										<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
									)}
									{needsWeighing
										? t("orderRequiresWeighing")
										: t("createOrder")}
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
