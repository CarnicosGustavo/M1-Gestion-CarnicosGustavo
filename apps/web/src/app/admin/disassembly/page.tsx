"use client";

import { Button } from "@finopenpos/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@finopenpos/ui/components/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@finopenpos/ui/components/dialog";
import { Input } from "@finopenpos/ui/components/input";
import { Label } from "@finopenpos/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@finopenpos/ui/components/select";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertCircleIcon,
	CheckCircleIcon,
	LoaderIcon,
	PackageIcon,
	PrinterIcon,
	ScissorsIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/router";

type Transformation = RouterOutputs["products"]["getTransformations"][number];

export default function DisassemblyPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const t = useTranslations("pos");
	const tc = useTranslations("common");

	const [isClient, setIsClient] = useState(false);

	// Ingreso de compra de canales
	const [purchaseAmericanQty, setPurchaseAmericanQty] = useState<number>(0);
	const [purchaseNationalPolynesiaQty, setPurchaseNationalPolynesiaQty] =
		useState<number>(0);
	const [purchaseWeightKg, setPurchaseWeightKg] = useState<number>(0);
	const [purchaseNotes, setPurchaseNotes] = useState<string>("");
	const purchaseQuantity = purchaseAmericanQty + purchaseNationalPolynesiaQty;

	// Despiece masivo
	const [batchAmerican, setBatchAmerican] = useState<number>(0);
	const [batchNationalPolynesia, setBatchNationalPolynesia] =
		useState<number>(0);
	const [realWeightMode, setRealWeightMode] = useState(true);

	// Despiece de pieza primaria
	const [selectedPrimaryParentId, setSelectedPrimaryParentId] =
		useState<string>("");
	const [selectedPrimaryStyle, setSelectedPrimaryStyle] = useState<string>("");
	useState<string>("BASE");

	// Resumen post-despiece
	const [disassemblySummary, setDisassemblySummary] = useState<{
		parentProduct: string;
		quantity: number;
		style: string;
		totalItems: number;
		timestamp: Date;
	} | null>(null);

	useEffect(() => {
		setIsClient(true);
	}, []);

	const { data: products = [], isLoading: isLoadingProducts } = useQuery(
		trpc.products.list.queryOptions(),
	);

	const parentProducts = useMemo(
		() => products.filter((p) => p.is_parent_product),
		[products],
	);

	const canalProduct = useMemo(() => {
		const lower = (s: string) => s.toLowerCase();
		return parentProducts.find((p) => lower(p.name).includes("canal")) ?? null;
	}, [parentProducts]);

	const primaryParentProducts = useMemo(() => {
		if (canalProduct) {
			const byHierarchy = parentProducts.filter(
				(p) => p.parent_product_id === canalProduct.id,
			);
			if (byHierarchy.length) return byHierarchy;
		}

		const lower = (s: string) => s.toLowerCase();
		const fallback = parentProducts.filter((p) => {
			const n = lower(p.name);
			if (canalProduct && p.id === canalProduct.id) return false;
			return (
				n.includes("pierna") ||
				n.includes("espaldilla") ||
				n.includes("lomo") ||
				n.includes("espilomo")
			);
		});
		if (fallback.length) return fallback;

		return parentProducts.filter(
			(p) => !canalProduct || p.id !== canalProduct.id,
		);
	}, [canalProduct, parentProducts]);

	const selectedPrimaryParent = useMemo(() => {
		return (
			primaryParentProducts.find(
				(p) => p.id === Number(selectedPrimaryParentId),
			) ?? null
		);
	}, [primaryParentProducts, selectedPrimaryParentId]);

	const hasAnyPrimaryStock = useMemo(() => {
		return primaryParentProducts.some((p) => p.stock_pieces > 0);
	}, [primaryParentProducts]);

	const canalNationalPolynesiaLomo = useQuery({
		...trpc.products.getTransformations.queryOptions({
			parentProductId: canalProduct?.id ?? 0,
			transformationType: "NACIONAL_POLINESIA_LOMO",
		}),
		enabled: !!canalProduct,
	});
	const canalAmerican = useQuery({
		...trpc.products.getTransformations.queryOptions({
			parentProductId: canalProduct?.id ?? 0,
			transformationType: "AMERICANO",
		}),
		enabled: !!canalProduct,
	});
	const canalNationalPolynesiaEspilomo = useQuery({
		...trpc.products.getTransformations.queryOptions({
			parentProductId: canalProduct?.id ?? 0,
			transformationType: "NACIONAL_POLINESIA_ESPILOMO",
		}),
		enabled: !!canalProduct,
	});

	const availableTypesQuery = useQuery({
		...trpc.products.getAvailableTransformationTypes.queryOptions({
			parentProductId: Number(selectedPrimaryParentId || 0),
		}),
		enabled: !!selectedPrimaryParentId,
	});

	const availableCuttingStyles = useMemo(() => {
		const types = availableTypesQuery.data ?? [];
		if (!types.length) return [];
		const unique = Array.from(new Set(types));
		unique.sort((a, b) => a.localeCompare(b));
		if (unique.includes("BASE")) {
			return ["BASE", ...unique.filter((x) => x !== "BASE")];
		}
		return unique;
	}, [availableTypesQuery.data]);

	useEffect(() => {
		if (!selectedPrimaryParentId) {
			if (selectedPrimaryStyle) setSelectedPrimaryStyle("");
			return;
		}
		if (!availableCuttingStyles.length) return;
		if (!availableCuttingStyles.includes(selectedPrimaryStyle)) {
			setSelectedPrimaryStyle(availableCuttingStyles[0]);
		}
	}, [availableCuttingStyles, selectedPrimaryParentId, selectedPrimaryStyle]);

	const primaryTransformations = useQuery({
		...trpc.products.getTransformations.queryOptions({
			parentProductId: Number(selectedPrimaryParentId || 0),
			transformationType: selectedPrimaryStyle || "BASE",
		}),
		enabled: !!selectedPrimaryParentId,
	});

	const purchaseMutation = useMutation(
		trpc.products.registerChannelPurchase.mutationOptions({
			onSuccess: (data) => {
				toast.success(
					`Compra registrada: ${data.newStock} canales, ${data.newKg} kg total`,
				);
				setBatchAmerican(purchaseAmericanQty);
				setBatchNationalPolynesia(purchaseNationalPolynesiaQty);
				setPurchaseAmericanQty(0);
				setPurchaseNationalPolynesiaQty(0);
				setPurchaseWeightKg(0);
				setPurchaseNotes("");
				// Refrescar lista de productos
				queryClient.invalidateQueries({
					queryKey: trpc.products.list.queryKey(),
				});
			},
			onError: (error) => {
				toast.error(`Error al registrar compra: ${error.message}`);
			},
		}),
	);

	const disassemblyMutation = useMutation(
		trpc.products.processDisassembly.mutationOptions({
			onSuccess: (_data, variables) => {
				// Mostrar resumen en modal
				const parent = products.find((p) => p.id === variables.parentProductId);
				if (
					variables.entryMode !== true &&
					parent &&
					selectedPrimaryParent &&
					variables.parentProductId === selectedPrimaryParent.id &&
					primaryTransformations.data
				) {
					setDisassemblySummary({
						parentProduct: parent.name,
						quantity: variables.quantityToProcess,
						style: variables.transformationType,
						totalItems: primaryTransformations.data.length,
						timestamp: new Date(),
					});
				}
				toast.success(t("disassemblySuccess"));
			},
			onError: (error) => {
				toast.error(`${t("disassemblyError")}: ${error.message}`);
			},
		}),
	);

	const expectedPieces = useCallback(
		(yieldQuantityPieces: unknown, qty: number) => {
			const raw = Number(yieldQuantityPieces);
			const normalized = raw > 50 ? raw / 1000 : raw;
			return Math.round(normalized * qty);
		},
		[],
	);

	const npLomoQty = useMemo(() => {
		return Math.ceil(batchNationalPolynesia / 2);
	}, [batchNationalPolynesia]);

	const npEspilomoQty = useMemo(() => {
		return Math.max(0, batchNationalPolynesia - npLomoQty);
	}, [batchNationalPolynesia, npLomoQty]);

	const canalNpPreview = useMemo(() => {
		const map = new Map<number, { name: string; pieces: number }>();

		for (const row of canalNationalPolynesiaLomo.data ?? []) {
			const id = row.child_product_id;
			const name = row.childProduct?.name ?? "-";
			const pieces = expectedPieces(row.yield_quantity_pieces, npLomoQty);
			const prev = map.get(id);
			map.set(id, { name, pieces: (prev?.pieces ?? 0) + pieces });
		}

		for (const row of canalNationalPolynesiaEspilomo.data ?? []) {
			const id = row.child_product_id;
			const name = row.childProduct?.name ?? "-";
			const pieces = expectedPieces(row.yield_quantity_pieces, npEspilomoQty);
			const prev = map.get(id);
			map.set(id, { name, pieces: (prev?.pieces ?? 0) + pieces });
		}

		return Array.from(map.entries())
			.map(([id, v]) => ({ id, ...v }))
			.sort((a, b) => a.name.localeCompare(b.name));
	}, [
		canalNationalPolynesiaEspilomo.data,
		canalNationalPolynesiaLomo.data,
		expectedPieces,
		npEspilomoQty,
		npLomoQty,
	]);

	const executeCanalBatch = async () => {
		if (!canalProduct) return;

		const totalToProcess = batchAmerican + batchNationalPolynesia;
		if (totalToProcess <= 0) return;

		if (canalProduct.stock_pieces < totalToProcess) {
			toast.error("Cantidad excede el stock de canal");
			return;
		}

		const steps: Array<{ qty: number; style: string }> = [];
		if (batchAmerican > 0)
			steps.push({ qty: batchAmerican, style: "AMERICANO" });
		if (npLomoQty > 0)
			steps.push({ qty: npLomoQty, style: "NACIONAL_POLINESIA_LOMO" });
		if (npEspilomoQty > 0)
			steps.push({ qty: npEspilomoQty, style: "NACIONAL_POLINESIA_ESPILOMO" });

		for (const s of steps) {
			if (s.qty <= 0) continue;
			await disassemblyMutation.mutateAsync({
				parentProductId: canalProduct.id,
				quantityToProcess: s.qty,
				transformationType: s.style,
				realWeightMode,
				entryMode: false,
			});
		}

		queryClient.invalidateQueries({ queryKey: trpc.products.list.queryKey() });
	};

	const executePrimaryDisassembly = () => {
		if (!selectedPrimaryParent || primaryQuantity <= 0) return;
		disassemblyMutation.mutate({
			parentProductId: selectedPrimaryParent.id,
			quantityToProcess: primaryQuantity,
			transformationType: selectedPrimaryStyle,
			realWeightMode,
			entryMode: false,
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
		<div className="mx-auto flex max-w-5xl flex-col gap-6">
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<ScissorsIcon className="h-6 w-6 text-primary" />
						<CardTitle>{t("disassembly")}</CardTitle>
					</div>
					<CardDescription>{t("disassemblyDescription")}</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{/* SECCIÓN 0: INGRESO DE COMPRA DE CANALES */}
					<div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
						<div className="flex items-center gap-2">
							<PackageIcon className="h-5 w-5 text-blue-600" />
							<h3 className="font-medium text-blue-900 text-lg">
								Ingreso de Compra de Canales
							</h3>
						</div>
						<p className="text-blue-800 text-sm">
							Registra la compra inicial de canales. Los datos ingresados serán
							el stock disponible para despiece.
						</p>

						<div className="grid grid-cols-1 gap-4 md:grid-cols-4">
							<div className="space-y-2">
								<Label className="text-blue-900">
									Cantidad Nacional/Polinesia
								</Label>
								<Input
									type="number"
									min="0"
									step="1"
									value={purchaseNationalPolynesiaQty || ""}
									onChange={(e) => {
										const val = e.target.value;
										if (val === "") setPurchaseNationalPolynesiaQty(0);
										else {
											const num = Number.parseInt(val, 10);
											if (!Number.isNaN(num) && num >= 0)
												setPurchaseNationalPolynesiaQty(num);
										}
									}}
									placeholder="Ej: 20"
									className="border-blue-200"
								/>
							</div>

							<div className="space-y-2">
								<Label className="text-blue-900">Cantidad Americano</Label>
								<Input
									type="number"
									min="0"
									step="1"
									value={purchaseAmericanQty || ""}
									onChange={(e) => {
										const val = e.target.value;
										if (val === "") setPurchaseAmericanQty(0);
										else {
											const num = Number.parseInt(val, 10);
											if (!Number.isNaN(num) && num >= 0)
												setPurchaseAmericanQty(num);
										}
									}}
									placeholder="Ej: 10"
									className="border-blue-200"
								/>
								<div className="text-blue-700 text-xs">
									Total: {purchaseQuantity} canales
								</div>
							</div>

							<div className="space-y-2">
								<Label className="text-blue-900">Peso Total (kg)</Label>
								<Input
									type="number"
									min="0"
									step="0.001"
									value={purchaseWeightKg || ""}
									onChange={(e) => {
										const val = e.target.value;
										if (val === "") setPurchaseWeightKg(0);
										else {
											const num = Number.parseFloat(val);
											if (!Number.isNaN(num) && num >= 0)
												setPurchaseWeightKg(num);
										}
									}}
									placeholder="Ej: 25.500"
									className="border-blue-200"
								/>
								{purchaseQuantity > 0 && purchaseWeightKg > 0 && (
									<div className="text-blue-700 text-xs">
										Promedio: {(purchaseWeightKg / purchaseQuantity).toFixed(3)}{" "}
										kg/pieza
									</div>
								)}
							</div>

							<div className="space-y-2">
								<Label className="text-blue-900">Notas (opcional)</Label>
								<Input
									type="text"
									value={purchaseNotes}
									onChange={(e) => setPurchaseNotes(e.target.value)}
									placeholder="Proveedor, fecha, etc."
									className="border-blue-200"
								/>
							</div>
						</div>

						<div className="flex justify-end pt-2">
							<Button
								onClick={() => {
									const breakdown = `N/P:${purchaseNationalPolynesiaQty} AM:${purchaseAmericanQty}`;
									const notes = purchaseNotes
										? `${purchaseNotes} (${breakdown})`
										: breakdown;
									purchaseMutation.mutate({
										quantityPieces: purchaseQuantity,
										totalWeightKg: purchaseWeightKg,
										notes,
									});
								}}
								disabled={
									purchaseQuantity <= 0 ||
									purchaseWeightKg <= 0 ||
									purchaseMutation.isPending
								}
								className="bg-blue-600 hover:bg-blue-700"
							>
								{purchaseMutation.isPending ? (
									<>
										<LoaderIcon className="mr-2 h-5 w-5 animate-spin" />
										Registrando...
									</>
								) : (
									<>
										<CheckCircleIcon className="mr-2 h-5 w-5" />
										Registrar Compra
									</>
								)}
							</Button>
						</div>
					</div>

					<div className="space-y-4">
						<div className="flex items-center justify-end">
							<Button
								type="button"
								variant={realWeightMode ? "default" : "outline"}
								size="sm"
								onClick={() => setRealWeightMode((v) => !v)}
							>
								{realWeightMode
									? "Peso real (sin estimar kg)"
									: "Modo estimado"}
							</Button>
						</div>
						<div className="flex items-center justify-between">
							<h3 className="flex items-center gap-2 font-medium text-lg">
								<PackageIcon className="h-5 w-5" />
								Despiece masivo de canal
							</h3>
						</div>
						<div className="text-muted-foreground text-sm">
							Procesa el stock de canal y genera piezas según recetas. Primero
							registra la compra de canales.
						</div>

						{!canalProduct ? (
							<div className="text-muted-foreground text-sm">
								No se encontró un producto padre que contenga “canal” en el
								nombre.
							</div>
						) : (
							<>
								<div className="grid grid-cols-1 gap-6 md:grid-cols-3">
									<div className="space-y-2">
										<Label>Canal (stock)</Label>
										<div className="rounded-md border px-3 py-2 text-sm">
											{canalProduct.name} ({canalProduct.stock_pieces}{" "}
											{t("pieces")})
										</div>
									</div>

									<div className="space-y-2">
										<Label>Cantidad Nacional/Polinesia</Label>
										<Input
											type="number"
											min="0"
											step="1"
											value={batchNationalPolynesia || ""}
											onChange={(e) => {
												const val = e.target.value;
												if (val === "") setBatchNationalPolynesia(0);
												else {
													const num = Number.parseInt(val, 10);
													if (!Number.isNaN(num) && num >= 0)
														setBatchNationalPolynesia(num);
												}
											}}
										/>
										{batchNationalPolynesia > 0 ? (
											<div className="text-muted-foreground text-xs">
												Se divide automáticamente: {npLomoQty} lado lomo +{" "}
												{npEspilomoQty} lado espilomo
											</div>
										) : null}
									</div>

									<div className="space-y-2">
										<Label>Cantidad Americano</Label>
										<Input
											type="number"
											min="0"
											step="1"
											value={batchAmerican || ""}
											onChange={(e) => {
												const val = e.target.value;
												if (val === "") setBatchAmerican(0);
												else {
													const num = Number.parseInt(val, 10);
													if (!Number.isNaN(num) && num >= 0)
														setBatchAmerican(num);
												}
											}}
										/>
									</div>
								</div>

								<div className="space-y-4 border-t pt-4">
									{batchNationalPolynesia > 0 && canalNpPreview.length ? (
										<div className="overflow-x-auto rounded-md border">
											<div className="bg-muted/50 px-3 py-2 font-medium text-sm">
												Vista previa Nacional/Polinesia
											</div>
											<table className="w-full text-sm">
												<thead className="bg-muted/50">
													<tr>
														<th className="p-3 text-left font-medium">
															{t("childProduct")}
														</th>
														<th className="p-3 text-left font-medium">
															{t("expectedQty")}
														</th>
														<th className="p-3 text-left font-medium">
															{t("expectedWeight")}
														</th>
													</tr>
												</thead>
												<tbody>
													{canalNpPreview.map((row) => (
														<tr key={row.id} className="border-t">
															<td className="p-3">{row.name}</td>
															<td className="p-3">{row.pieces}</td>
															<td className="p-3">
																{realWeightMode ? "Pendiente de pesaje" : "-"}
															</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									) : null}

									{batchAmerican > 0 && canalAmerican.data?.length ? (
										<div className="overflow-x-auto rounded-md border">
											<div className="bg-muted/50 px-3 py-2 font-medium text-sm">
												Vista previa Americano
											</div>
											<table className="w-full text-sm">
												<thead className="bg-muted/50">
													<tr>
														<th className="p-3 text-left font-medium">
															{t("childProduct")}
														</th>
														<th className="p-3 text-left font-medium">
															{t("expectedQty")}
														</th>
														<th className="p-3 text-left font-medium">
															{t("expectedWeight")}
														</th>
													</tr>
												</thead>
												<tbody>
													{canalAmerican.data.map((row: Transformation) => (
														<tr key={row.id} className="border-t">
															<td className="p-3">
																{row.childProduct?.name ?? "-"}
															</td>
															<td className="p-3">
																{expectedPieces(
																	row.yield_quantity_pieces,
																	batchAmerican,
																)}
															</td>
															<td className="p-3">
																{realWeightMode ? "Pendiente de pesaje" : "-"}
															</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									) : null}

									<div className="flex justify-end pt-4">
										{batchAmerican + batchNationalPolynesia >
											canalProduct.stock_pieces && (
											<div className="mr-auto flex items-center gap-2 text-red-600 text-xs">
												<AlertCircleIcon className="h-3.5 w-3.5" />
												Cantidad excede el stock de canal
											</div>
										)}
										<Button
											size="lg"
											onClick={executeCanalBatch}
											disabled={
												disassemblyMutation.isPending ||
												batchAmerican + batchNationalPolynesia <= 0 ||
												batchAmerican + batchNationalPolynesia >
													canalProduct.stock_pieces
											}
										>
											{disassemblyMutation.isPending ? (
												tc("loading")
											) : (
												<>
													<CheckCircleIcon className="mr-2 h-5 w-5" />
													Procesar lote
												</>
											)}
										</Button>
									</div>
								</div>
							</>
						)}
					</div>

					<div className="space-y-4 border-t pt-6">
						<div className="flex items-center justify-between">
							<h3 className="flex items-center gap-2 font-medium text-lg">
								<PackageIcon className="h-5 w-5" />
								Despiece de Pieza Primaria
							</h3>
						</div>

						<div className="text-muted-foreground text-sm">
							Procesa piezas secundarias (Pierna, Espaldilla, Cabeza, etc.)
							generadas desde el despiece masivo de canal.
						</div>

						{!hasAnyPrimaryStock ? (
							<div className="rounded-md border bg-muted/30 p-3 text-muted-foreground text-sm">
								Primero registra la compra y procesa el lote de canal para
								generar stock de piezas primarias.
							</div>
						) : null}

						{selectedPrimaryParent && (
							<div className="rounded-md border border-amber-200 bg-amber-50 p-3">
								<div className="text-amber-900 text-sm">
									<strong>Consejo:</strong> Selecciona un estilo que tenga
									recetas configuradas. Si no aparece el estilo que necesitas,
									créalo en Recetas y luego vuelve aquí.
								</div>
							</div>
						)}

						<div className="grid grid-cols-1 gap-6 md:grid-cols-3">
							<div className="space-y-2">
								<Label>{t("parentProduct")}</Label>
								<Select
									disabled={!hasAnyPrimaryStock}
									value={selectedPrimaryParentId}
									onValueChange={setSelectedPrimaryParentId}
								>
									<SelectTrigger>
										<SelectValue placeholder={tc("search")} />
									</SelectTrigger>
									<SelectContent>
										{primaryParentProducts.length === 0 ? (
											<div className="p-3 text-center text-muted-foreground text-sm">
												No se encontraron productos padre
											</div>
										) : (
											primaryParentProducts.map((p) => (
												<SelectItem key={p.id} value={p.id.toString()}>
													{p.name} ({p.stock_pieces} {t("pieces")})
												</SelectItem>
											))
										)}
									</SelectContent>
								</Select>
								{selectedPrimaryParent &&
									selectedPrimaryParent.stock_pieces === 0 && (
										<div className="flex items-center gap-2 text-amber-600 text-xs">
											<AlertCircleIcon className="h-3.5 w-3.5" />
											Sin stock disponible
										</div>
									)}
							</div>

							<div className="space-y-2">
								<Label>{t("cuttingStyle")}</Label>
								<Select
									value={selectedPrimaryStyle}
									onValueChange={setSelectedPrimaryStyle}
									disabled={!selectedPrimaryParent || !hasAnyPrimaryStock}
								>
									<SelectTrigger>
										<SelectValue placeholder={tc("all")} />
									</SelectTrigger>
									<SelectContent>
										{availableCuttingStyles.length ? (
											availableCuttingStyles.map((style) => (
												<SelectItem key={style} value={style}>
													{style}
												</SelectItem>
											))
										) : (
											<div className="p-3 text-center text-muted-foreground text-sm">
												No hay estilos disponibles
											</div>
										)}
									</SelectContent>
								</Select>
								{primaryTransformations.isFetching && (
									<div className="flex items-center gap-1.5 text-muted-foreground text-xs">
										<LoaderIcon className="h-3.5 w-3.5 animate-spin" />
										Cargando recetas...
									</div>
								)}
							</div>

							<div className="space-y-2">
								<Label>{t("quantityToProcess")}</Label>
								<Input
									type="number"
									min="1"
									max={String(selectedPrimaryParent?.stock_pieces || 1)}
									value={primaryQuantity || ""}
									onChange={(e) => {
										const val = e.target.value;
										if (val === "") setPrimaryQuantity(1);
										else {
											const num = Number.parseInt(val, 10);
											if (!Number.isNaN(num) && num >= 1)
												setPrimaryQuantity(num);
										}
									}}
									disabled={!selectedPrimaryParent}
								/>
								{selectedPrimaryParent &&
									primaryQuantity > selectedPrimaryParent.stock_pieces && (
										<div className="flex items-center gap-2 text-red-600 text-xs">
											<AlertCircleIcon className="h-3.5 w-3.5" />
											Cantidad excede el stock
										</div>
									)}
							</div>
						</div>

						{selectedPrimaryParent ? (
							<div className="space-y-4 border-t pt-4">
								{primaryTransformations.isLoading ? (
									<div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
										<LoaderIcon className="h-5 w-5 animate-spin" />
										Cargando recetas...
									</div>
								) : primaryTransformations.data?.length ? (
									<>
										<div className="overflow-x-auto rounded-md border">
											<table className="w-full text-sm">
												<thead className="bg-muted/50">
													<tr>
														<th className="p-3 text-left font-medium">
															{t("childProduct")}
														</th>
														<th className="p-3 text-left font-medium">
															{t("expectedQty")}
														</th>
														<th className="p-3 text-left font-medium">
															{t("expectedWeight")}
														</th>
													</tr>
												</thead>
												<tbody>
													{primaryTransformations.data.map(
														(row: Transformation) => (
															<tr key={row.id} className="border-t">
																<td className="p-3">
																	{row.childProduct?.name ?? "-"}
																</td>
																<td className="p-3">
																	{expectedPieces(
																		row.yield_quantity_pieces,
																		primaryQuantity,
																	)}
																</td>
																<td className="p-3">
																	{realWeightMode ? "Pendiente de pesaje" : "-"}
																</td>
															</tr>
														),
													)}
												</tbody>
											</table>
										</div>
										<div className="flex justify-end pt-4">
											<Button
												size="lg"
												onClick={executePrimaryDisassembly}
												disabled={
													disassemblyMutation.isPending ||
													primaryQuantity >
														(selectedPrimaryParent.stock_pieces || 0)
												}
											>
												{disassemblyMutation.isPending ? (
													tc("loading")
												) : (
													<>
														<CheckCircleIcon className="mr-2 h-5 w-5" />
														{t("executeDisassembly")}
													</>
												)}
											</Button>
										</div>
									</>
								) : (
									<div className="flex flex-col items-center justify-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-6 text-amber-900">
										<AlertCircleIcon className="h-5 w-5" />
										<div className="font-medium text-sm">
											No se encontraron recetas
										</div>
										<p className="text-amber-800 text-xs">
											El estilo de despiece "{selectedPrimaryStyle}" no tiene
											recetas configuradas para el producto{" "}
											{selectedPrimaryParent.name}. Por favor, selecciona otro
											estilo o configura las recetas.
										</p>
									</div>
								)}
							</div>
						) : null}
					</div>
				</CardContent>
			</Card>

			{/* Dialog de Resumen Post-Despiece */}
			<Dialog
				open={!!disassemblySummary}
				onOpenChange={(open) => {
					if (!open) {
						setDisassemblySummary(null);
						// Reset forms cuando se cierra
						setBatchNational(0);
						setBatchAmerican(0);
						setBatchPolynesian(0);
						setSelectedPrimaryParentId("");
						setSelectedPrimaryStyle("BASE");
						setPrimaryQuantity(1);
						queryClient.invalidateQueries({
							queryKey: trpc.products.list.queryKey(),
						});
					}
				}}
			>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<CheckCircleIcon className="h-5 w-5 text-green-600" />
							Despiece Completado
						</DialogTitle>
						<DialogDescription>
							Resumen de la operación realizada
						</DialogDescription>
					</DialogHeader>

					{disassemblySummary && (
						<div className="space-y-4">
							{/* Consolidado */}
							<div className="grid grid-cols-2 gap-4">
								<div className="rounded-lg border bg-slate-50 p-4">
									<p className="text-muted-foreground text-xs">
										Producto Padre
									</p>
									<p className="font-semibold text-lg">
										{disassemblySummary.parentProduct}
									</p>
								</div>
								<div className="rounded-lg border bg-slate-50 p-4">
									<p className="text-muted-foreground text-xs">
										Estilo Aplicado
									</p>
									<p className="font-semibold text-lg">
										{disassemblySummary.style}
									</p>
								</div>
								<div className="rounded-lg border bg-slate-50 p-4">
									<p className="text-muted-foreground text-xs">
										Cantidad Procesada
									</p>
									<p className="font-semibold text-lg">
										{disassemblySummary.quantity} piezas
									</p>
								</div>
								<div className="rounded-lg border bg-slate-50 p-4">
									<p className="text-muted-foreground text-xs">Items Creados</p>
									<p className="font-semibold text-green-600 text-lg">
										{disassemblySummary.totalItems}
									</p>
								</div>
							</div>

							{/* Timestamp y Usuario */}
							<div className="rounded-lg border bg-blue-50 p-3">
								<div className="grid grid-cols-2 gap-4 text-sm">
									<div>
										<p className="text-muted-foreground text-xs">
											Fecha y Hora
										</p>
										<p className="font-medium">
											{disassemblySummary.timestamp.toLocaleString("es-ES")}
										</p>
									</div>
									<div>
										<p className="text-muted-foreground text-xs">Estado</p>
										<p className="font-medium text-green-600">✓ Completado</p>
									</div>
								</div>
							</div>

							{/* Recetas Aplicadas */}
							{primaryTransformations.data &&
								primaryTransformations.data.length > 0 && (
									<div className="rounded-lg border p-3">
										<p className="mb-2 font-semibold text-sm">
											Productos Generados:
										</p>
										<div className="space-y-1 text-sm">
											{primaryTransformations.data.map((trans) => (
												<div key={trans.id} className="flex items-center gap-2">
													<CheckCircleIcon className="h-4 w-4 text-green-600" />
													<span>{trans.childProduct?.name}</span>
													<span className="ml-auto text-muted-foreground">
														+
														{expectedPieces(
															trans.yield_quantity_pieces,
															disassemblySummary.quantity,
														)}{" "}
														piezas
													</span>
												</div>
											))}
										</div>
									</div>
								)}
						</div>
					)}

					<DialogFooter className="flex justify-end gap-2">
						<Button
							variant="outline"
							onClick={() => window.print()}
							className="flex gap-2"
						>
							<PrinterIcon className="h-4 w-4" />
							Imprimir
						</Button>
						<Button
							onClick={() => setDisassemblySummary(null)}
							className="flex gap-2"
						>
							<CheckCircleIcon className="h-4 w-4" />
							Aceptar y Continuar
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
