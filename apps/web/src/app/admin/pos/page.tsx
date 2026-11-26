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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangleIcon,
	CheckIcon,
	Loader2Icon,
	MinusIcon,
	PackageSearchIcon,
	PlusIcon,
	RefreshCwIcon,
	ScaleIcon,
	ScissorsIcon,
	SearchIcon,
	ShoppingCartIcon,
	Trash2Icon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AntonellaSlot } from "@/components/antonella-slot";
import { ScreenHead } from "@/components/screen-head";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/router";
import { formatCurrency } from "@/lib/utils";
import {
	catalogDisp,
	isMissingPrice,
	lineDisp,
	lineTotal,
	needsWeigh,
	quantityKgGramsForPayload,
	resolvePrice,
	shouldCommitPrice,
	unitPriceCentsForPayload,
} from "./pos-logic";

type Product = RouterOutputs["products"]["list"][number];
type Customer = RouterOutputs["customers"]["list"][number];
type CustomerPrice = RouterOutputs["customerPrices"]["getByCustomer"][number];
type Availability = RouterOutputs["products"]["availabilityMap"][number];
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
	priceEdited?: boolean;
};

type Disp = import("./pos-logic").Disp;

type PieceQtyInputProps = {
	value: number;
	onCommit: (value: number) => void;
	ariaLabel: string;
};

function PieceQtyInput({ value, onCommit, ariaLabel }: PieceQtyInputProps) {
	const [text, setText] = useState(String(value));

	useEffect(() => {
		setText(String(value));
	}, [value]);

	const commit = () => {
		const parsed = Number(text);
		const normalized = Number.isFinite(parsed)
			? Math.max(1, Math.floor(parsed))
			: 1;
		setText(String(normalized));
		onCommit(normalized);
	};

	return (
		<Input
			type="number"
			inputMode="numeric"
			min={1}
			value={text}
			onChange={(event) => setText(event.target.value)}
			onBlur={commit}
			className="h-11 w-16 border-0 border-x border-y-0 px-1 text-center font-bold font-mono text-sm"
			aria-label={ariaLabel}
			aria-live="polite"
		/>
	);
}

type LinePriceInputProps = {
	value: number;
	onCommit: (value: number) => void;
	ariaLabel: string;
};

function LinePriceInput({ value, onCommit, ariaLabel }: LinePriceInputProps) {
	const [text, setText] = useState(String(value));

	useEffect(() => {
		setText(String(value));
	}, [value]);

	const commit = () => {
		const parsed = Number(text);
		const normalized = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
		setText(String(normalized));
		if (shouldCommitPrice(normalized, value)) onCommit(normalized);
	};

	return (
		<Input
			type="number"
			step="0.01"
			inputMode="decimal"
			value={text}
			onChange={(event) => setText(event.target.value)}
			onBlur={commit}
			className="h-11 flex-1"
			aria-label={ariaLabel}
		/>
	);
}

export default function POSPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const t = useTranslations("pos");
	const tc = useTranslations("common");
	const tOrders = useTranslations("orders");
	const locale = useLocale();

	const {
		data: products = [],
		isLoading: loadingProducts,
		isError: productsError,
	} = useQuery(trpc.products.list.queryOptions());
	const {
		data: customers = [],
		isLoading: loadingCustomers,
		isError: customersError,
	} = useQuery(trpc.customers.list.queryOptions());
	const {
		data: priceLists = [],
		isLoading: loadingPriceLists,
		isError: priceListsError,
	} = useQuery(trpc.inventory.priceListsList.queryOptions());
	const { data: availability = [], isError: availabilityError } = useQuery(
		trpc.products.availabilityMap.queryOptions(),
	);

	const [selectedProducts, setSelectedProducts] = useState<POSProduct[]>([]);
	const [selectedCustomer, setSelectedCustomer] = useState<{
		id: number;
		name: string | null;
		phone?: string | null;
	} | null>(null);
	const [productSearch, setProductSearch] = useState("");
	const [selectedPriceListId, setSelectedPriceListId] =
		useState<string>("base");

	const availMap = useMemo(() => {
		const map = new Map<number, Availability>();
		for (const item of availability) map.set(item.productId, item);
		return map;
	}, [availability]);

	const priceListItemsQuery = useQuery({
		...trpc.inventory.priceListItemsByList.queryOptions({
			priceListId: Number(selectedPriceListId),
		}),
		enabled: selectedPriceListId !== "base",
	});

	const customerPricesQuery = useQuery({
		...trpc.customerPrices.getByCustomer.queryOptions({
			customerId: selectedCustomer?.id ?? 0,
		}),
		enabled: !!selectedCustomer,
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

	const customerOwnMap = useMemo(() => {
		const map = new Map<number, { kg?: number; piece?: number }>();
		for (const item of (customerPricesQuery.data ?? []) as CustomerPrice[]) {
			const kg =
				item.customerPricePerKg !== null
					? Number(item.customerPricePerKg)
					: null;
			const piece =
				item.customerPricePerPiece !== null
					? Number(item.customerPricePerPiece)
					: null;
			map.set(item.productId, {
				kg: kg !== null && Number.isFinite(kg) ? kg : undefined,
				piece: piece !== null && Number.isFinite(piece) ? piece : undefined,
			});
		}
		return map;
	}, [customerPricesQuery.data]);

	const assignedListMap = useMemo(() => {
		const map = new Map<number, { kg?: number; piece?: number }>();
		for (const item of (customerPricesQuery.data ?? []) as CustomerPrice[]) {
			const kg =
				item.listPricePerKg !== null ? Number(item.listPricePerKg) : null;
			const piece =
				item.listPricePerPiece !== null ? Number(item.listPricePerPiece) : null;
			map.set(item.productId, {
				kg: kg !== null && Number.isFinite(kg) ? kg : undefined,
				piece: piece !== null && Number.isFinite(piece) ? piece : undefined,
			});
		}
		return map;
	}, [customerPricesQuery.data]);

	useEffect(() => {
		setSelectedProducts((prev) => {
			let changed = false;
			const next = prev.map((product) => {
				if (product.priceEdited) return product;

				const price = resolvePrice(
					product.id,
					Number(product.price_per_kg) || 0,
					Number(product.price_per_piece) || 0,
					customerOwnMap,
					priceOverrides,
					assignedListMap,
				);
				if (
					price.kg !== product.unitPricePerKg ||
					price.piece !== product.unitPricePerPiece
				) {
					changed = true;
					return {
						...product,
						unitPricePerKg: price.kg,
						unitPricePerPiece: price.piece,
					};
				}
				return product;
			});
			return changed ? next : prev;
		});
	}, [assignedListMap, customerOwnMap, priceOverrides]);

	const filteredProducts = useMemo(() => {
		if (!productSearch.trim()) return products;
		const query = productSearch.toLowerCase();
		return products.filter(
			(product) =>
				product.name.toLowerCase().includes(query) ||
				(product.category ?? "").toLowerCase().includes(query),
		);
	}, [products, productSearch]);

	const priceListOptions = useMemo(
		() => [
			{ id: "base", name: "Precio base" },
			...priceLists.map((list) => ({ id: String(list.id), name: list.name })),
		],
		[priceLists],
	);

	const loading = loadingProducts || loadingCustomers || loadingPriceLists;

	const pricesLoading =
		(!!selectedCustomer && customerPricesQuery.isFetching) ||
		(selectedPriceListId !== "base" && priceListItemsQuery.isFetching);

	const pricesError =
		(!!selectedCustomer && customerPricesQuery.isError) ||
		(selectedPriceListId !== "base" && priceListItemsQuery.isError);

	const loadError =
		productsError || customersError || availabilityError || priceListsError;

	const hasMissingPrice = selectedProducts.some((product) =>
		product.is_sellable_by_weight
			? isMissingPrice(product.unitPricePerKg)
			: isMissingPrice(product.unitPricePerPiece),
	);

	const canCreate =
		selectedProducts.length > 0 &&
		!!selectedCustomer &&
		!pricesLoading &&
		!pricesError &&
		!hasMissingPrice;

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
			},
			onError: (error) => toast.error(error.message || tOrders("createError")),
		}),
	);

	const handleSelectPriceList = (id: number | string) => {
		setSelectedPriceListId(String(id));
	};

	const handleSelectProduct = (productId: number | string) => {
		const product = products.find((item) => item.id === productId);
		if (!product) return;

		const existing = selectedProducts.find((item) => item.id === productId);
		if (existing) {
			if (product.is_sellable_by_weight) {
				toast.info(t("alreadyInCart", { name: product.name }));
				return;
			}

			setSelectedProducts((current) =>
				current.map((item) =>
					item.id === productId
						? { ...item, quantityPieces: item.quantityPieces + 1 }
						: item,
				),
			);
			return;
		}

		const baseKg = Number(product.price_per_kg) || 0;
		const basePiece = Number(product.price_per_piece) || 0;
		const price = resolvePrice(
			product.id,
			baseKg,
			basePiece,
			customerOwnMap,
			priceOverrides,
			assignedListMap,
		);

		setSelectedProducts((current) => [
			...current,
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
				priceEdited: false,
			},
		]);

		if (catalogDisp(product, availMap.get(product.id)) === "faltante") {
			toast.info(t("pendingPurchaseToast", { name: product.name }));
		}
	};

	const handleSelectCustomer = (customerId: number | string) => {
		const customer = customers.find((item) => item.id === customerId);
		if (customer) {
			setSelectedCustomer({
				id: customer.id,
				name: customer.name,
				phone: customer.phone,
			});
		}
	};

	const handleQuantityChange = (productId: number, delta: number) => {
		setSelectedProducts((prev) =>
			prev.map((product) => {
				if (product.id !== productId) return product;
				const newQuantity = product.quantityPieces + delta;
				if (newQuantity <= 0) return product;
				return { ...product, quantityPieces: newQuantity };
			}),
		);
	};

	const handleSetQuantityPieces = (productId: number, value: number) => {
		setSelectedProducts((prev) =>
			prev.map((product) => {
				if (product.id !== productId) return product;
				const normalized = Number.isFinite(value)
					? Math.max(1, Math.floor(value))
					: 1;
				return { ...product, quantityPieces: normalized };
			}),
		);
	};

	const handleSetQuantityKg = (productId: number, value: number | null) => {
		setSelectedProducts((prev) =>
			prev.map((product) => {
				if (product.id !== productId) return product;
				if (value === null) return { ...product, quantityKg: null };
				const normalized = Number.isFinite(value) ? Math.max(0, value) : 0;
				return { ...product, quantityKg: normalized };
			}),
		);
	};

	const handleSetUnitPriceKg = (productId: number, value: number) => {
		setSelectedProducts((prev) =>
			prev.map((product) => {
				if (product.id !== productId) return product;
				const normalized = Number.isFinite(value) ? Math.max(0, value) : 0;
				return {
					...product,
					unitPricePerKg: normalized,
					priceEdited: true,
				};
			}),
		);
	};

	const handleSetUnitPricePiece = (productId: number, value: number) => {
		setSelectedProducts((prev) =>
			prev.map((product) => {
				if (product.id !== productId) return product;
				const normalized = Number.isFinite(value) ? Math.max(0, value) : 0;
				return {
					...product,
					unitPricePerPiece: normalized,
					priceEdited: true,
				};
			}),
		);
	};

	const handleRemoveProduct = (productId: number) => {
		setSelectedProducts((current) =>
			current.filter((product) => product.id !== productId),
		);
	};

	const total = selectedProducts.reduce(
		(sum, product) => sum + lineTotal(product),
		0,
	);

	const needWeigh = selectedProducts.some((product) => needsWeigh(product));

	const despieceCount = selectedProducts.filter(
		(product) => lineDisp(product, availMap.get(product.id)) === "despiece",
	).length;
	const faltanteCount = selectedProducts.filter(
		(product) => lineDisp(product, availMap.get(product.id)) === "faltante",
	).length;

	const createDisabledReason = !selectedCustomer
		? t("needCustomer")
		: selectedProducts.length === 0
			? t("needProducts")
			: pricesLoading
				? t("pricesLoading")
				: pricesError
					? t("pricesError")
					: hasMissingPrice
						? t("missingPriceWarning")
						: null;

	const handleCreateOrder = () => {
		if (!canCreate || createOrderMutation.isPending) return;
		const customerId = selectedCustomer?.id;
		if (!customerId) return;

		const faltantes = selectedProducts.filter(
			(product) => lineDisp(product, availMap.get(product.id)) === "faltante",
		);
		const viaDespiece = selectedProducts.filter(
			(product) => lineDisp(product, availMap.get(product.id)) === "despiece",
		);

		if (hasMissingPrice) {
			toast.warning(t("missingPriceWarning"));
			return;
		}

		const payload = {
			customerId,
			items: selectedProducts.map((product) => ({
				productId: product.id,
				quantityPieces: product.is_sellable_by_weight
					? undefined
					: product.quantityPieces,
				quantityKg: quantityKgGramsForPayload(product.quantityKg),
				unitPrice: unitPriceCentsForPayload(product),
				requiresPurchase:
					lineDisp(product, availMap.get(product.id)) === "faltante",
			})),
		};

		createOrderMutation.mutate(payload, {
			onSuccess: () => {
				if (viaDespiece.length > 0) {
					toast.info(
						t("despieceCreatedToast", {
							count: viaDespiece.length,
							names: viaDespiece.map((product) => product.name).join(", "),
						}),
					);
				}
				if (faltantes.length > 0) {
					toast.warning(
						t("faltanteCreatedToast", {
							count: faltantes.length,
							names: faltantes.map((product) => product.name).join(", "),
						}),
					);
				}
			},
		});
	};

	const DISP: Record<
		Disp,
		{ label: string; cls: string; Icon: typeof CheckIcon }
	> = {
		stock: {
			label: "En stock",
			cls: "bg-cg-green-wash text-[#1f4d32] dark:text-cg-green",
			Icon: CheckIcon,
		},
		despiece: {
			label: "Por despiece",
			cls: "bg-cg-blue-wash text-[#1e4560] dark:text-cg-blue",
			Icon: ScissorsIcon,
		},
		conversion: {
			label: "Por conversión",
			cls: "bg-cg-blue-wash text-[#1e4560] dark:text-cg-blue",
			Icon: RefreshCwIcon,
		},
		pesaje: {
			label: "Por pesar",
			cls: "bg-cg-amber-wash text-[#6b4508] dark:text-cg-amber",
			Icon: ScaleIcon,
		},
		faltante: {
			label: "Faltante",
			cls: "bg-[var(--cg-red-wash)] text-destructive",
			Icon: AlertTriangleIcon,
		},
	};

	const catalogPrice = (product: Product) => {
		const price = resolvePrice(
			product.id,
			Number(product.price_per_kg) || 0,
			Number(product.price_per_piece) || 0,
			customerOwnMap,
			priceOverrides,
			assignedListMap,
		);
		return product.is_sellable_by_weight
			? { value: price.kg, unit: "/kg" }
			: { value: price.piece, unit: "/pza" };
	};

	const selectedCustomerValue = selectedCustomer
		? `${selectedCustomer.name ?? "Cliente"}${
				selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ""
			}`
		: "";

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
						{Array.from({ length: 3 }).map((_, index) => (
							<div key={index} className="flex items-center gap-4">
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
		<div className="mx-auto w-full max-w-6xl pb-28 lg:pb-0">
			<ScreenHead
				title="Punto de venta"
				desc="Captura el pedido del cliente. Antonella clasifica cada pieza en stock, vía despiece o por pesar al agregarla."
			/>
			<AntonellaSlot
				data={{
					tone: "sugerencia",
					titulo: "Punto de venta",
					texto:
						"Te aviso si una pieza no tiene stock y hay que despiezarla o pesarla. Puedo resolver precios del cliente y estimar el total antes de pesar.",
					acciones: [
						"¿Qué piezas faltan en stock?",
						"¿Cubre mi stock los pedidos?",
					],
				}}
			/>

			{loadError ? (
				<div
					className="mb-4 rounded-lg bg-[var(--cg-red-wash)] px-3 py-2 font-semibold text-destructive text-sm"
					role="alert"
				>
					{t("loadError")}
				</div>
			) : null}

			{pricesError ? (
				<div
					className="mb-4 rounded-lg bg-[var(--cg-red-wash)] px-3 py-2 font-semibold text-destructive text-sm"
					role="alert"
				>
					{t("pricesError")}
				</div>
			) : null}

			<div className="grid items-start gap-4 lg:grid-cols-[1fr_360px]">
				<div className="flex flex-col gap-4">
					<Card>
						<CardContent className="grid gap-3 pt-6 sm:grid-cols-2">
							<Combobox
								items={customers.map((customer: Customer) => ({
									id: customer.id,
									name: `${customer.name ?? "Cliente"}${
										customer.phone ? ` · ${customer.phone}` : ""
									}`,
								}))}
								value={selectedCustomerValue}
								placeholder="Cliente"
								onSelect={handleSelectCustomer}
							/>
							<Combobox
								items={priceListOptions}
								value={
									priceListOptions.find(
										(option) => option.id === selectedPriceListId,
									)?.name ?? ""
								}
								placeholder="Lista de precios"
								onSelect={handleSelectPriceList}
							/>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<div className="flex items-center gap-2">
								<PackageSearchIcon className="h-5 w-5" />
								<CardTitle>{t("products")}</CardTitle>
								<span className="ml-auto text-muted-foreground text-xs">
									toca para agregar
								</span>
							</div>
							<div className="!mt-4 relative">
								<SearchIcon className="absolute top-3.5 left-2.5 h-4 w-4 text-muted-foreground" />
								<label className="sr-only" htmlFor="pos-product-search">
									{t("searchLabel")}
								</label>
								<Input
									id="pos-product-search"
									type="text"
									placeholder={t("searchPlaceholder")}
									value={productSearch}
									onChange={(event) => setProductSearch(event.target.value)}
									className="h-11 pl-8"
								/>
							</div>
						</CardHeader>
						<CardContent>
							{filteredProducts.length === 0 ? (
								<div className="flex min-h-32 items-center justify-center px-4 py-8 text-center text-muted-foreground text-sm">
									{productSearch.trim() ? t("emptySearch") : t("needProducts")}
								</div>
							) : (
								<div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2.5">
									{filteredProducts.map((product) => {
										const display =
											DISP[catalogDisp(product, availMap.get(product.id))];
										const { value, unit } = catalogPrice(product);
										const missingPrice = isMissingPrice(value);
										return (
											<button
												key={product.id}
												type="button"
												onClick={() => handleSelectProduct(product.id)}
												className="flex min-h-[88px] flex-col rounded-xl border bg-muted/40 p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/50"
												title={
													display.label === "Faltante"
														? t("pendingPurchaseToast", { name: product.name })
														: undefined
												}
											>
												<div className="flex items-start justify-between gap-2">
													<span className="font-semibold text-foreground text-sm leading-tight">
														{product.name}
													</span>
													<PlusIcon className="h-4 w-4 shrink-0 text-primary" />
												</div>
												<div className="mt-2 font-bold font-mono text-foreground">
													{missingPrice ? (
														<span className="text-destructive">
															{t("missingPrice")}
														</span>
													) : (
														formatCurrency(value * 100, locale)
													)}
													<span className="ml-0.5 font-normal font-sans text-muted-foreground text-xs">
														{unit}
													</span>
												</div>
												<span
													className={`mt-auto inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-xs ${display.cls}`}
												>
													<display.Icon className="h-3 w-3" />
													{display.label}
												</span>
											</button>
										);
									})}
								</div>
							)}
						</CardContent>
					</Card>
				</div>

				<Card className="lg:sticky lg:top-4">
					<div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
						<ShoppingCartIcon className="h-5 w-5" />
						<span className="font-semibold">Carrito</span>
						<span className="ml-auto text-muted-foreground text-xs">
							{selectedProducts.length}{" "}
							{selectedProducts.length === 1 ? "línea" : "líneas"}
						</span>
					</div>

					{selectedProducts.length === 0 ? (
						<div className="flex h-32 items-center justify-center px-4 text-center text-muted-foreground text-sm">
							{t("selectProducts")}
						</div>
					) : (
						<div className="flex max-h-[46vh] flex-col gap-2 overflow-y-auto p-3">
							{selectedProducts.map((product) => {
								const display =
									DISP[lineDisp(product, availMap.get(product.id))];
								const isWeighPending = needsWeigh(product);
								const showPieceControls = !product.is_sellable_by_weight;
								const lineAmount = lineTotal(product);
								const displayedPrice = product.is_sellable_by_weight
									? product.unitPricePerKg
									: product.unitPricePerPiece;
								return (
									<div key={product.id} className="rounded-xl border p-3">
										<div className="mb-2 flex items-center justify-between gap-2">
											<span className="font-semibold text-foreground text-sm leading-tight">
												{product.name}
											</span>
											<button
												type="button"
												onClick={() => handleRemoveProduct(product.id)}
												className="min-h-11 min-w-11 p-2 text-primary"
												aria-label={tc("remove")}
											>
												<Trash2Icon className="h-5 w-5" />
											</button>
										</div>

										<div className="flex flex-wrap items-center justify-between gap-2">
											<span
												className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-xs ${display.cls}`}
											>
												<display.Icon className="h-3 w-3" />
												{display.label}
											</span>

											{showPieceControls ? (
												<div className="flex items-center overflow-hidden rounded-lg border">
													<button
														type="button"
														className="h-11 w-11 bg-muted/60 font-bold text-foreground disabled:opacity-40"
														onClick={() => handleQuantityChange(product.id, -1)}
														disabled={product.quantityPieces <= 1}
														aria-label={t("decreaseQty")}
													>
														<MinusIcon className="h-4 w-4" />
													</button>
													<PieceQtyInput
														value={product.quantityPieces}
														onCommit={(value) =>
															handleSetQuantityPieces(product.id, value)
														}
														ariaLabel={t("qty")}
													/>
													<button
														type="button"
														className="h-11 w-11 bg-muted/60 font-bold text-foreground"
														onClick={() => handleQuantityChange(product.id, 1)}
														aria-label={t("increaseQty")}
													>
														<PlusIcon className="h-4 w-4" />
													</button>
												</div>
											) : null}

											<span className="min-w-16 text-right font-bold font-mono text-sm">
												{isWeighPending
													? "~pesar"
													: formatCurrency(lineAmount * 100, locale)}
											</span>
										</div>

										{product.is_sellable_by_weight ? (
											<Input
												type="number"
												step="0.001"
												inputMode="decimal"
												placeholder="Kg (se define al pesar)"
												className="mt-2 h-11"
												value={
													product.quantityKg === null
														? ""
														: String(product.quantityKg)
												}
												onChange={(event) => {
													const raw = event.target.value.trim();
													handleSetQuantityKg(
														product.id,
														raw ? Number(raw) : null,
													);
												}}
											/>
										) : null}

										<div className="mt-2 flex items-center gap-2">
											<LinePriceInput
												value={displayedPrice}
												onCommit={(value) => {
													if (product.is_sellable_by_weight) {
														handleSetUnitPriceKg(product.id, value);
													} else {
														handleSetUnitPricePiece(product.id, value);
													}
												}}
												ariaLabel={t("linePrice")}
											/>
											<span className="shrink-0 text-muted-foreground text-sm">
												{product.is_sellable_by_weight ? "/kg" : "/pza"}
											</span>
										</div>
									</div>
								);
							})}
						</div>
					)}

					{despieceCount > 0 || faltanteCount > 0 ? (
						<div className="flex flex-col gap-1.5 px-3 pb-2">
							{despieceCount > 0 ? (
								<div className="flex items-center gap-2 rounded-lg bg-cg-blue-wash px-2.5 py-2 font-semibold text-[#1e4560] text-xs dark:text-cg-blue">
									<ScissorsIcon className="h-3.5 w-3.5 shrink-0" />
									{t("despieceBanner", { count: despieceCount })}
								</div>
							) : null}
							{faltanteCount > 0 ? (
								<div className="flex items-center gap-2 rounded-lg bg-[var(--cg-red-wash)] px-2.5 py-2 font-semibold text-destructive text-xs">
									<AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" />
									{t("pendingPurchaseBanner", { count: faltanteCount })}
								</div>
							) : null}
						</div>
					) : null}

					<div className="hidden border-t px-4 py-4 lg:block">
						<div className="mb-3 flex items-center justify-between">
							<span className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
								Total estimado
							</span>
							<span className="font-display text-3xl text-foreground">
								{formatCurrency(total * 100, locale)}
							</span>
						</div>
						<Button
							onClick={handleCreateOrder}
							disabled={!canCreate || createOrderMutation.isPending}
							size="lg"
							className="w-full"
							variant={needWeigh ? "secondary" : "default"}
						>
							{createOrderMutation.isPending ? (
								<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
							) : needWeigh ? (
								<ScaleIcon className="mr-2 h-4 w-4" />
							) : (
								<CheckIcon className="mr-2 h-4 w-4" />
							)}
							{needWeigh ? t("orderRequiresWeighing") : t("createOrder")}
						</Button>
						{createDisabledReason ? (
							<p className="mt-2 text-center text-muted-foreground text-xs">
								{createDisabledReason}
							</p>
						) : null}
					</div>
				</Card>
			</div>

			<div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background px-4 py-3 shadow-lg lg:hidden">
				<div className="mx-auto flex max-w-6xl items-center gap-3">
					<div className="min-w-0 flex-1">
						<div className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
							Total estimado
						</div>
						<div className="truncate font-display text-2xl text-foreground">
							{formatCurrency(total * 100, locale)}
						</div>
					</div>
					<Button
						onClick={handleCreateOrder}
						disabled={!canCreate || createOrderMutation.isPending}
						size="lg"
						variant={needWeigh ? "secondary" : "default"}
					>
						{createOrderMutation.isPending ? (
							<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
						) : needWeigh ? (
							<ScaleIcon className="mr-2 h-4 w-4" />
						) : (
							<CheckIcon className="mr-2 h-4 w-4" />
						)}
						{needWeigh ? t("orderRequiresWeighing") : t("createOrder")}
					</Button>
				</div>
				{createDisabledReason ? (
					<p className="mx-auto mt-1 max-w-6xl text-center text-muted-foreground text-xs">
						{createDisabledReason}
					</p>
				) : null}
			</div>
		</div>
	);
}
