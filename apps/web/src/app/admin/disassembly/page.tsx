"use client";

import { Button } from "@finopenpos/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@finopenpos/ui/components/card";
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
import { CheckCircleIcon, PackageIcon, ScissorsIcon, AlertCircleIcon, LoaderIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/router";

const cuttingStyles = ["BASE", "NACIONAL", "AMERICANO", "POLINESIO"] as const;

type Transformation = RouterOutputs["products"]["getTransformations"][number];

export default function DisassemblyPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const t = useTranslations("pos");
	const tc = useTranslations("common");

	const [isClient, setIsClient] = useState(false);

	// Ingreso de compra de canales
	const [purchaseQuantity, setPurchaseQuantity] = useState<number>(0);
	const [purchaseWeightKg, setPurchaseWeightKg] = useState<number>(0);
	const [purchaseNotes, setPurchaseNotes] = useState<string>("");

	// Despiece masivo
	const [batchNational, setBatchNational] = useState<number>(0);
	const [batchAmerican, setBatchAmerican] = useState<number>(0);
	const [batchPolynesian, setBatchPolynesian] = useState<number>(0);
	const [realWeightMode, setRealWeightMode] = useState(true);

	// Despiece de pieza primaria
	const [selectedPrimaryParentId, setSelectedPrimaryParentId] =
		useState<string>("");
	const [selectedPrimaryStyle, setSelectedPrimaryStyle] =
		useState<(typeof cuttingStyles)[number]>("BASE");
	const [primaryQuantity, setPrimaryQuantity] = useState<number>(1);

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

	const canalNational = useQuery({
		...trpc.products.getTransformations.queryOptions({
			parentProductId: canalProduct?.id ?? 0,
			transformationType: "NACIONAL",
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
	const canalPolynesian = useQuery({
		...trpc.products.getTransformations.queryOptions({
			parentProductId: canalProduct?.id ?? 0,
			transformationType: "POLINESIO",
		}),
		enabled: !!canalProduct,
	});

	const primaryTransformations = useQuery({
		...trpc.products.getTransformations.queryOptions({
			parentProductId: Number(selectedPrimaryParentId || 0),
			transformationType: selectedPrimaryStyle,
		}),
		enabled: !!selectedPrimaryParentId,
	});

	// Determine which cutting styles have recipes for the selected parent
	const availableCuttingStyles = useMemo(() => {
		if (!selectedPrimaryParent) return cuttingStyles;

		// For now, assume all styles are potentially available
		// In a more advanced implementation, we could query recipes for each style
		return cuttingStyles;
	}, [selectedPrimaryParent]);

	const purchaseMutation = useMutation(
		trpc.products.registerChannelPurchase.mutationOptions({
			onSuccess: (data) => {
				toast.success(
					`Compra registrada: ${data.newStock} canales, ${data.newKg} kg total`,
				);
				setPurchaseQuantity(0);
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
			onSuccess: () => {
				toast.success(t("disassemblySuccess"));
				setBatchNational(0);
				setBatchAmerican(0);
				setBatchPolynesian(0);
				setSelectedPrimaryParentId("");
				setSelectedPrimaryStyle("BASE");
				setPrimaryQuantity(1);
				queryClient.invalidateQueries({
					queryKey: trpc.products.list.queryKey(),
				});
			},
			onError: (error) => {
				toast.error(`${t("disassemblyError")}: ${error.message}`);
			},
		}),
	);

	const expectedPieces = (yieldQuantityPieces: unknown, qty: number) => {
		const raw = Number(yieldQuantityPieces);
		const normalized = raw > 50 ? raw / 1000 : raw;
		return Math.round(normalized * qty);
	};

	const executeCanalBatch = async () => {
		if (!canalProduct) return;

		const steps: Array<{ qty: number; style: (typeof cuttingStyles)[number] }> =
			[
				{ qty: batchNational, style: "NACIONAL" },
				{ qty: batchAmerican, style: "AMERICANO" },
				{ qty: batchPolynesian, style: "POLINESIO" },
			];

		for (const s of steps) {
			if (s.qty <= 0) continue;
			await disassemblyMutation.mutateAsync({
				parentProductId: canalProduct.id,
				quantityToProcess: s.qty,
				transformationType: s.style,
				realWeightMode,
				entryMode: true,
			});
		}
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
							<h3 className="font-medium text-lg text-blue-900">
								Ingreso de Compra de Canales
							</h3>
						</div>
						<p className="text-sm text-blue-800">
							Registra la compra inicial de canales. Los datos ingresados serán el stock disponible para despiece.
						</p>

						<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
							<div className="space-y-2">
								<Label className="text-blue-900">Cantidad de Canales</Label>
								<Input
									type="number"
									min={0}
									step={1}
									value={purchaseQuantity}
									onChange={(e) => setPurchaseQuantity(Number(e.target.value))}
									placeholder="Ej: 50"
									className="border-blue-200"
								/>
							</div>

							<div className="space-y-2">
								<Label className="text-blue-900">Peso Total (kg)</Label>
								<Input
									type="number"
									min={0}
									step={0.001}
									value={purchaseWeightKg}
									onChange={(e) => setPurchaseWeightKg(Number(e.target.value))}
									placeholder="Ej: 25.500"
									className="border-blue-200"
								/>
								{purchaseQuantity > 0 && purchaseWeightKg > 0 && (
									<div className="text-xs text-blue-700">
										Promedio: {(purchaseWeightKg / purchaseQuantity).toFixed(3)} kg/pieza
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
									purchaseMutation.mutate({
										quantityPieces: purchaseQuantity,
										totalWeightKg: purchaseWeightKg,
										notes: purchaseNotes || undefined,
									});
								}}
								disabled={purchaseQuantity <= 0 || purchaseWeightKg <= 0 || purchaseMutation.isPending}
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
							Este lote registra entrada de canal y genera piezas según recetas.
							No requiere stock previo.
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
										<Label>Cantidad Nacional</Label>
										<Input
											type="number"
											min={0}
											value={batchNational}
											onChange={(e) => setBatchNational(Number(e.target.value))}
										/>
									</div>

									<div className="space-y-2">
										<Label>Cantidad Americano</Label>
										<Input
											type="number"
											min={0}
											value={batchAmerican}
											onChange={(e) => setBatchAmerican(Number(e.target.value))}
										/>
									</div>

									<div className="space-y-2 md:col-span-3">
										<Label>Cantidad Polinesio</Label>
										<Input
											type="number"
											min={0}
											value={batchPolynesian}
											onChange={(e) =>
												setBatchPolynesian(Number(e.target.value))
											}
										/>
									</div>
								</div>

								<div className="space-y-4 border-t pt-4">
									{batchNational > 0 && canalNational.data?.length ? (
										<div className="overflow-x-auto rounded-md border">
											<div className="bg-muted/50 px-3 py-2 font-medium text-sm">
												Vista previa Nacional
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
													{canalNational.data.map((row: Transformation) => (
														<tr key={row.id} className="border-t">
															<td className="p-3">
																{row.childProduct?.name ?? "-"}
															</td>
															<td className="p-3">
																{expectedPieces(
																	row.yield_quantity_pieces,
																	batchNational,
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

									{batchPolynesian > 0 && canalPolynesian.data?.length ? (
										<div className="overflow-x-auto rounded-md border">
											<div className="bg-muted/50 px-3 py-2 font-medium text-sm">
												Vista previa Polinesio
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
													{canalPolynesian.data.map((row: Transformation) => (
														<tr key={row.id} className="border-t">
															<td className="p-3">
																{row.childProduct?.name ?? "-"}
															</td>
															<td className="p-3">
																{expectedPieces(
																	row.yield_quantity_pieces,
																	batchPolynesian,
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
										<Button
											size="lg"
											onClick={executeCanalBatch}
											disabled={
												disassemblyMutation.isPending ||
												batchNational + batchAmerican + batchPolynesian <= 0
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
							Procesa piezas secundarias (Pierna, Espaldilla, Cabeza, etc.) generadas desde el despiece masivo de canal.
						</div>

						{selectedPrimaryParent && (
							<div className="rounded-md bg-amber-50 border border-amber-200 p-3">
								<div className="text-sm text-amber-900">
									<strong>Consejo:</strong> Para <strong>{selectedPrimaryParent.name}</strong>,
									{selectedPrimaryParent.name.toLowerCase().includes("pierna")
										? ' usa el estilo "DESPIECE_PIERNA"'
										: selectedPrimaryParent.name.toLowerCase().includes("espaldilla")
										? ' usa el estilo "DESPIECE_ESPALDILLA"'
										: selectedPrimaryParent.name.toLowerCase().includes("cabeza")
										? ' usa el estilo "DESPIECE_CABEZA"'
										: ' selecciona el estilo disponible'}
									.
								</div>
							</div>
						)}

						<div className="grid grid-cols-1 gap-6 md:grid-cols-3">
							<div className="space-y-2">
								<Label>{t("parentProduct")}</Label>
								<Select
									value={selectedPrimaryParentId}
									onValueChange={setSelectedPrimaryParentId}
								>
									<SelectTrigger>
										<SelectValue placeholder={tc("search")} />
									</SelectTrigger>
									<SelectContent>
										{primaryParentProducts.length === 0 ? (
											<div className="p-3 text-sm text-muted-foreground text-center">
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
								{selectedPrimaryParent && selectedPrimaryParent.stock_pieces === 0 && (
									<div className="flex items-center gap-2 text-xs text-amber-600">
										<AlertCircleIcon className="h-3.5 w-3.5" />
										Sin stock disponible
									</div>
								)}
							</div>

							<div className="space-y-2">
								<Label>{t("cuttingStyle")}</Label>
								<Select
									value={selectedPrimaryStyle}
									onValueChange={(v) =>
										setSelectedPrimaryStyle(v as (typeof cuttingStyles)[number])
									}
									disabled={!selectedPrimaryParent}
								>
									<SelectTrigger>
										<SelectValue placeholder={tc("all")} />
									</SelectTrigger>
									<SelectContent>
										{availableCuttingStyles.map((style) => (
											<SelectItem key={style} value={style}>
												{style}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{primaryTransformations.isFetching && (
									<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
										<LoaderIcon className="h-3.5 w-3.5 animate-spin" />
										Cargando recetas...
									</div>
								)}
							</div>

							<div className="space-y-2">
								<Label>{t("quantityToProcess")}</Label>
								<Input
									type="number"
									min={1}
									max={selectedPrimaryParent?.stock_pieces || 1}
									value={primaryQuantity}
									onChange={(e) => setPrimaryQuantity(Number(e.target.value))}
									disabled={!selectedPrimaryParent}
								/>
								{selectedPrimaryParent && primaryQuantity > selectedPrimaryParent.stock_pieces && (
									<div className="flex items-center gap-2 text-xs text-red-600">
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
									<div className="flex flex-col items-center justify-center gap-2 rounded-md border border-amber-200 bg-amber-50 py-6 px-4 text-amber-900">
										<AlertCircleIcon className="h-5 w-5" />
										<div className="text-sm font-medium">
											No se encontraron recetas
										</div>
										<p className="text-xs text-amber-800">
											El estilo de despiece "{selectedPrimaryStyle}" no tiene recetas configuradas para el producto {selectedPrimaryParent.name}. Por favor, selecciona otro estilo o configura las recetas.
										</p>
									</div>
								)}
							</div>
						) : null}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
