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
type DashboardRecipeGroup =
	RouterOutputs["products"]["disassemblyDashboardRecipes"][number];

export default function DisassemblyPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const t = useTranslations("pos");
	const tc = useTranslations("common");

	const invalidateStockQueries = () => {
		queryClient.invalidateQueries({ queryKey: trpc.products.list.queryKey() });
		queryClient.invalidateQueries({
			queryKey: trpc.products.disassemblyDashboard.queryKey(),
		});
		queryClient.invalidateQueries({
			queryKey: trpc.products.disassemblyDashboardRecipes.queryKey(),
		});
	};

	const [isClient, setIsClient] = useState(false);

	const [purchaseWholePigs, setPurchaseWholePigs] = useState<number>(0);
	const [purchaseCutStyle, setPurchaseCutStyle] = useState<"US" | "MX">("US");
	const [purchaseTotalWeightKg, setPurchaseTotalWeightKg] = useState<number>(0);
	const [purchaseSupplier, setPurchaseSupplier] = useState<string>("");
	const [purchaseNotes, setPurchaseNotes] = useState<string>("");

	// Tablero de despiece
	const [realWeightMode, setRealWeightMode] = useState(true);

	// Resumen post-despiece
	const [disassemblySummary, setDisassemblySummary] = useState<{
		parentProduct: string;
		quantity: number;
		style: string;
		totalItems: number;
		timestamp: Date;
	} | null>(null);

	const [selectedPrimaryParentId, setSelectedPrimaryParentId] =
		useState<string>("");
	const [selectedPrimaryStyle, setSelectedPrimaryStyle] = useState<string>("");
	const [primaryQuantity, setPrimaryQuantity] = useState<number>(0);

	useEffect(() => {
		setIsClient(true);
	}, []);

	const { data: products = [], isLoading: isLoadingProducts } = useQuery(
		trpc.products.list.queryOptions(),
	);

	const { data: dashboardStock = [] } = useQuery(
		trpc.products.disassemblyDashboard.queryOptions(),
	);
	const { data: dashboardRecipeGroups = [] } = useQuery(
		trpc.products.disassemblyDashboardRecipes.queryOptions(),
	);

	const parentProducts = useMemo(
		() => products.filter((p) => p.is_parent_product),
		[products],
	);

	const canalProduct = useMemo(() => {
		const normalizeName = (name: string) =>
			name
				.toLowerCase()
				.replace(/^\s*[a-z]{2}\d+\s*-\s*/i, "")
				.trim();
		const scoreCanal = (name: string) => {
			const n = normalizeName(name);
			if (n === "canal") return 0;
			if (n.includes("canal") && !n.includes("media")) return 1;
			if (n.includes("canal")) return 2;
			return 999;
		};
		const candidates = parentProducts.filter((p) =>
			normalizeName(p.name).includes("canal"),
		);
		return candidates.slice().sort((a, b) => {
			const sa = scoreCanal(a.name);
			const sb = scoreCanal(b.name);
			if (sa !== sb) return sa - sb;
			return a.id - b.id;
		})[0];
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

	const dashboardOrder = useCallback((name: string) => {
		const n = name.toLowerCase();
		if (n.includes("canal")) return 10;
		if (n.includes("costillar")) return 20;
		if (n.includes("lomo completo")) return 30;
		if (n.includes("espilomo")) return 40;
		if (n.includes("c/lomo")) return 50;
		if (n.includes("pecho")) return 60;
		if (n.includes("lomo")) return 70;
		if (n.includes("espinazo")) return 80;
		if (n.includes("cuero")) return 90;
		return 999;
	}, []);

	const dashboardProcessables = useMemo(() => {
		const normalize = (name: string) =>
			name
				.toLowerCase()
				.replace(/^\s*[a-z]{2}\d+\s*-\s*/i, "")
				.trim();
		const isIntermediate = (name: string) => {
			const n = normalize(name);
			return (
				n.includes("costillar") ||
				n.includes("lomo completo") ||
				(n.includes("cuero") && !n.includes("mitad"))
			);
		};
		return dashboardStock
			.filter((p) => p.transformationTypes.length > 0)
			.filter((p) => !isIntermediate(p.name))
			.sort((a, b) => {
				const ao = dashboardOrder(a.name);
				const bo = dashboardOrder(b.name);
				if (ao !== bo) return ao - bo;
				return a.name.localeCompare(b.name);
			});
	}, [dashboardOrder, dashboardStock]);

	const dashboardLeaves = useMemo(() => {
		return dashboardStock
			.filter((p) => p.transformationTypes.length === 0)
			.sort((a, b) => {
				const ao = dashboardOrder(a.name);
				const bo = dashboardOrder(b.name);
				if (ao !== bo) return ao - bo;
				return a.name.localeCompare(b.name);
			});
	}, [dashboardOrder, dashboardStock]);

	const dashboardRecipesByParent = useMemo(() => {
		const map = new Map<
			number,
			Map<
				string,
				Array<{
					childId: number;
					childName: string;
					childStockPieces: number;
					yieldQuantityPieces: string | number;
				}>
			>
		>();

		for (const g of dashboardRecipeGroups) {
			const byType = map.get(g.parentId) ?? new Map();
			byType.set(g.transformationType, g.children);
			map.set(g.parentId, byType);
		}
		return map;
	}, [dashboardRecipeGroups]);

	const recorteProduct = useMemo(() => {
		const normalize = (name: string) =>
			name
				.toLowerCase()
				.replace(/^\s*[a-z]{2}\d+\s*-\s*/i, "")
				.trim();
		const score = (name: string) => {
			const n = normalize(name);
			if (n.includes("cuero") && n.includes("recorte")) return 0;
			if (n.includes("recorte")) return 1;
			return 999;
		};
		const candidates = products.filter((p) =>
			normalize(p.name).includes("recorte"),
		);
		return candidates.slice().sort((a, b) => {
			const sa = score(a.name);
			const sb = score(b.name);
			if (sa !== sb) return sa - sb;
			return a.id - b.id;
		})[0];
	}, [products]);

	const [mapParentId, setMapParentId] = useState<number>(0);

	const [dashboardQty, setDashboardQty] = useState<Record<number, number>>({});
	const [dashboardType, setDashboardType] = useState<Record<number, string>>(
		{},
	);
	const [dashboardIntermediateLeave, setDashboardIntermediateLeave] = useState<
		Record<string, number>
	>({});

	const [batchMediasAmerican, setBatchMediasAmerican] = useState<number>(0);
	const [batchMediasNacionalLomo, setBatchMediasNacionalLomo] =
		useState<number>(0);
	const [batchMediasNacionalEspilomo, setBatchMediasNacionalEspilomo] =
		useState<number>(0);
	const [batchMode, setBatchMode] = useState<"CANAL_COMPLETO" | "MEDIA_CANAL">(
		"CANAL_COMPLETO",
	);
	const [lastPurchaseCanalProductId, setLastPurchaseCanalProductId] = useState<
		number | null
	>(null);
	const [lastPurchaseCanalStockPieces, setLastPurchaseCanalStockPieces] =
		useState<number | null>(null);

	useEffect(() => {
		if (!dashboardStock.length) return;

		setDashboardQty((prev) => {
			const next = { ...prev };
			for (const p of dashboardStock) {
				if (next[p.id] === undefined) next[p.id] = p.stock_pieces;
			}
			return next;
		});

		setDashboardType((prev) => {
			const next = { ...prev };
			for (const p of dashboardStock) {
				if (next[p.id] === undefined && p.transformationTypes.length) {
					next[p.id] = p.transformationTypes[0];
				}
			}
			return next;
		});
	}, [dashboardStock]);

	useEffect(() => {
		if (mapParentId !== 0) return;
		if (!dashboardProcessables.length) return;
		setMapParentId(dashboardProcessables[0].id);
	}, [dashboardProcessables, mapParentId]);

	const displayType = useCallback((t: string) => {
		return t.replace("NACIONAL_POLINESIA", "NACIONAL");
	}, []);

	const normalizeProductName = useCallback((name: string) => {
		return name
			.toLowerCase()
			.replace(/^\s*[a-z]{2}\d+\s*-\s*/i, "")
			.trim();
	}, []);

	const isCanalName = useCallback(
		(name: string) => normalizeProductName(name).includes("canal"),
		[normalizeProductName],
	);

	const isIntermediateName = useCallback(
		(name: string) => {
			const n = normalizeProductName(name);
			return (
				n.includes("costillar") ||
				n.includes("lomo completo") ||
				n.includes("cuero")
			);
		},
		[normalizeProductName],
	);

	const getDefaultTypeForParent = useCallback(
		(parentId: number) => {
			const byType = dashboardRecipesByParent.get(parentId);
			if (!byType) return "BASE";
			if (byType.has("BASE")) return "BASE";
			return (
				Array.from(byType.keys()).sort((a, b) => a.localeCompare(b))[0] ??
				"BASE"
			);
		},
		[dashboardRecipesByParent],
	);

	const shouldShowLeaveComplete = useCallback((name: string) => {
		const normalized = name
			.toLowerCase()
			.replace(/^\s*[a-z]{2}\d+\s*-\s*/i, "")
			.trim();
		return (
			normalized.includes("canal") ||
			normalized.includes("costillar") ||
			normalized.includes("lomo")
		);
	}, []);

	const selectedMapParent = useMemo(() => {
		if (!mapParentId) return null;
		return dashboardProcessables.find((p) => p.id === mapParentId) ?? null;
	}, [dashboardProcessables, mapParentId]);

	const executeDashboardCard = async (productId: number) => {
		const item = dashboardStock.find((p) => p.id === productId);
		if (!item) return;

		const qty = dashboardQty[productId] ?? 0;
		const type = dashboardType[productId];
		if (!type || qty <= 0) return;

		if (isCanalName(item.name)) {
			const byType = dashboardRecipesByParent.get(item.id);
			const outputMap = new Map<
				number,
				{ childName: string; addPieces: number }
			>();

			const addRecipes = (recipeType: string, realType: string) => {
				const rows = byType?.get(recipeType) ?? [];
				for (const r of rows) {
					const addPieces = expectedPieces(r.yieldQuantityPieces, qty);
					const prev = outputMap.get(r.childId);
					outputMap.set(r.childId, {
						childName: r.childName,
						addPieces: (prev?.addPieces ?? 0) + addPieces,
					});
				}

				const parentNameLower = item.name.toLowerCase();
				const typeLower = realType.toLowerCase();
				const shouldAutoRecorte =
					typeLower.includes("cuadr") &&
					(typeLower.includes("cuero") ||
						parentNameLower.includes("panza") ||
						parentNameLower.includes("cuero"));
				const hasRecorte = Array.from(outputMap.values()).some((x) =>
					x.childName.toLowerCase().includes("recorte"),
				);
				if (shouldAutoRecorte && !hasRecorte && recorteProduct) {
					const prev = outputMap.get(recorteProduct.id);
					outputMap.set(recorteProduct.id, {
						childName: recorteProduct.name,
						addPieces: (prev?.addPieces ?? 0) + qty,
					});
				}
			};

			addRecipes("BASE", type);
			if (type !== "BASE") addRecipes(type, type);

			const intermediateLeaves = Array.from(outputMap.entries())
				.filter(
					([childId, v]) => v.addPieces > 0 && isIntermediateName(v.childName),
				)
				.map(([childId, v]) => {
					const key = `${item.id}:${childId}`;
					const leave = Math.max(
						0,
						Math.min(dashboardIntermediateLeave[key] ?? 0, v.addPieces),
					);
					return { productId: childId, leaveComplete: leave };
				});

			await pipelineMutation.mutateAsync({
				canalProductId: item.id,
				qtyProcessCanal: qty,
				transformationType: type,
				intermediateLeaves,
				realWeightMode,
			});

			queryClient.invalidateQueries({
				queryKey: trpc.products.list.queryKey(),
			});
			queryClient.invalidateQueries({
				queryKey: trpc.products.disassemblyDashboard.queryKey(),
			});
			queryClient.invalidateQueries({
				queryKey: trpc.products.disassemblyDashboardRecipes.queryKey(),
			});
			return;
		}

		await disassemblyMutation.mutateAsync({
			parentProductId: productId,
			quantityToProcess: qty,
			transformationType: type,
			realWeightMode,
			entryMode: false,
		});

		invalidateStockQueries();
	};

	const executeDashboardAll = async () => {
		for (const p of dashboardProcessables) {
			const qty = dashboardQty[p.id] ?? 0;
			const type = dashboardType[p.id];
			if (!type || qty <= 0) continue;
			if (qty > p.stock_pieces) continue;
			await executeDashboardCard(p.id);
		}
		invalidateStockQueries();
	};

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
					`Compra registrada: +${data.mediasAmericano + data.mediasNacionalLomo + data.mediasNacionalEspilomo} medias canales, ${data.newKg} kg total`,
				);
				setBatchMediasAmerican(data.mediasAmericano);
				setBatchMediasNacionalLomo(data.mediasNacionalLomo);
				setBatchMediasNacionalEspilomo(data.mediasNacionalEspilomo);
				setBatchMode(data.purchaseMode);
				setLastPurchaseCanalProductId(data.productId);
				setLastPurchaseCanalStockPieces(data.newStock);
				setPurchaseWholePigs(0);
				setPurchaseTotalWeightKg(0);
				setPurchaseSupplier("");
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
				invalidateStockQueries();

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

	const pipelineMutation = useMutation(
		trpc.products.processDisassemblyPipeline.mutationOptions({
			onSuccess: () => {
				invalidateStockQueries();
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

	const mediasAmerican = batchMediasAmerican;
	const npLomoQty = batchMediasNacionalLomo;
	const npEspilomoQty = batchMediasNacionalEspilomo;

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

		const totalToProcess = mediasAmerican + npLomoQty + npEspilomoQty;
		if (totalToProcess <= 0) return;

		const canalPiecesAvailable =
			lastPurchaseCanalProductId === canalProduct.id &&
			lastPurchaseCanalStockPieces !== null
				? Math.max(canalProduct.stock_pieces, lastPurchaseCanalStockPieces)
				: canalProduct.stock_pieces;

		if (canalPiecesAvailable < totalToProcess) {
			toast.error(
				`Cantidad excede el stock de canal (disponible ${canalPiecesAvailable}, requerido ${totalToProcess})`,
			);
			return;
		}

		const steps: Array<{ qty: number; style: string }> = [];
		if (mediasAmerican > 0)
			steps.push({ qty: mediasAmerican, style: "AMERICANO" });
		if (npLomoQty > 0 || npEspilomoQty > 0) {
			steps.push({
				qty: npLomoQty,
				style: "NACIONAL_POLINESIA_LOMO",
			});
			steps.push({
				qty: npEspilomoQty,
				style: "NACIONAL_POLINESIA_ESPILOMO",
			});
		}

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

		invalidateStockQueries();
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
					<div className="space-y-4">
						<div className="flex items-center gap-2">
							<PackageIcon className="h-5 w-5 text-blue-600" />
							<h3 className="font-medium text-blue-900 text-lg">
								Ingreso de Compra de Canales
							</h3>
						</div>
						<p className="text-blue-800 text-sm">
							Ingresa la cantidad de cerdos completos y el estilo (MX/US). El
							sistema convierte automáticamente a medias canales:
							<br />
							US: 2 medias iguales | MX: 1 media lado Lomo + 1 media lado
							Espilomo
						</p>

						<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
							<div className="space-y-1">
								<Label className="text-blue-900 text-sm">
									Cerdos completos (vivos)
								</Label>
								<Input
									type="number"
									min="0"
									step="1"
									value={purchaseWholePigs || ""}
									onChange={(e) => {
										const val = e.target.value;
										setPurchaseWholePigs(
											val === ""
												? 0
												: Math.max(0, Number.parseInt(val, 10) || 0),
										);
									}}
									placeholder="Ej: 10"
								/>
							</div>

							<div className="space-y-1">
								<Label className="text-blue-900 text-sm">Estilo</Label>
								<Select
									value={purchaseCutStyle}
									onValueChange={(v) => setPurchaseCutStyle(v as "US" | "MX")}
								>
									<SelectTrigger>
										<SelectValue placeholder="Selecciona" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="MX">🇲🇽 MX (Nacional)</SelectItem>
										<SelectItem value="US">🇺🇸 US (Americano)</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-1">
								<Label className="text-blue-900 text-sm">Peso Total (kg)</Label>
								<Input
									type="number"
									min="0"
									step="0.001"
									value={purchaseTotalWeightKg || ""}
									onChange={(e) => {
										const val = e.target.value;
										setPurchaseTotalWeightKg(
											val === "" ? 0 : Math.max(0, Number.parseFloat(val) || 0),
										);
									}}
									placeholder="Ej: 250.5"
								/>
							</div>
						</div>

						{purchaseWholePigs > 0 ? (
							<div className="text-muted-foreground text-xs">
								Genera:{" "}
								{purchaseCutStyle === "US"
									? `${purchaseWholePigs * 2} medias (Americano)`
									: `${purchaseWholePigs} medias lado Lomo + ${purchaseWholePigs} medias lado Espilomo (Nacional)`}
							</div>
						) : null}

						<div className="flex justify-end">
							<Button
								size="sm"
								onClick={() => {
									if (purchaseWholePigs <= 0 || purchaseTotalWeightKg <= 0)
										return;
									purchaseMutation.mutate({
										purchaseMode: "CANAL_COMPLETO",
										qtyAmericano:
											purchaseCutStyle === "US" ? purchaseWholePigs : 0,
										qtyNacional:
											purchaseCutStyle === "MX" ? purchaseWholePigs : 0,
										qtyNacionalLomo: 0,
										qtyNacionalEspilomo: 0,
										totalWeightKg: purchaseTotalWeightKg,
										supplier: purchaseSupplier || undefined,
										notes: purchaseNotes || undefined,
									});
								}}
								disabled={
									purchaseWholePigs <= 0 ||
									purchaseTotalWeightKg <= 0 ||
									purchaseMutation.isPending
								}
								className="bg-blue-600 hover:bg-blue-700"
							>
								{purchaseMutation.isPending
									? "Registrando..."
									: "Registrar compra"}
							</Button>
						</div>

						{(purchaseSupplier || purchaseNotes) && (
							<div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
								Proveedor: {purchaseSupplier || "-"} | Notas:{" "}
								{purchaseNotes || "-"}
							</div>
						)}

						<div className="flex gap-3">
							<Input
								type="text"
								placeholder="Proveedor (opcional)"
								value={purchaseSupplier}
								onChange={(e) => setPurchaseSupplier(e.target.value)}
								className="max-w-xs"
							/>
							<Input
								type="text"
								placeholder="Notas (opcional)"
								value={purchaseNotes}
								onChange={(e) => setPurchaseNotes(e.target.value)}
								className="flex-1"
							/>
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
										<Label>Última compra cargada</Label>
										<div className="rounded-md border px-3 py-2 text-sm">
											{batchMode === "CANAL_COMPLETO"
												? "Canal completo"
												: "Media canal"}{" "}
											| AM medias: {mediasAmerican} | N lomo: {npLomoQty} | N
											espilomo: {npEspilomoQty}
										</div>
										<div className="text-muted-foreground text-xs">
											Nacional procesa: {npLomoQty} lado lomo + {npEspilomoQty}{" "}
											lado espilomo
										</div>
									</div>

									<div className="space-y-2">
										<Label>Totales a procesar</Label>
										<div className="rounded-md border px-3 py-2 text-sm">
											AM: {mediasAmerican} medias | N:{" "}
											{npLomoQty + npEspilomoQty} medias | Total:{" "}
											{mediasAmerican + npLomoQty + npEspilomoQty}
										</div>
									</div>
								</div>

								<div className="space-y-4 border-t pt-4">
									{npLomoQty + npEspilomoQty > 0 && canalNpPreview.length ? (
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

									{mediasAmerican > 0 && canalAmerican.data?.length ? (
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
																	mediasAmerican,
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
										{mediasAmerican + npLomoQty + npEspilomoQty >
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
												mediasAmerican + npLomoQty + npEspilomoQty <= 0 ||
												mediasAmerican + npLomoQty + npEspilomoQty >
													canalProduct.stock_pieces
											}
										>
											{disassemblyMutation.isPending ? (
												tc("loading")
											) : (
												<>
													<CheckCircleIcon className="mr-2 h-5 w-5" />
													Procesar canal comprado
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
								Tablero de despiece
							</h3>
							<Button
								size="sm"
								onClick={executeDashboardAll}
								disabled={
									disassemblyMutation.isPending ||
									pipelineMutation.isPending ||
									!dashboardProcessables.length
								}
							>
								Ejecutar todo
							</Button>
						</div>

						<div className="text-muted-foreground text-sm">
							Ejecuta especificaciones disponibles según stock y recetas.
						</div>

						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div className="space-y-3">
								<div className="font-medium text-sm">Padres / acciones</div>
								{dashboardProcessables.length ? (
									dashboardProcessables.map((p) => {
										const qty = dashboardQty[p.id] ?? p.stock_pieces;
										const type = dashboardType[p.id] ?? "";
										const disabled = !type || qty <= 0 || qty > p.stock_pieces;
										const leaveCompleteQty = Math.max(0, p.stock_pieces - qty);
										const byType = dashboardRecipesByParent.get(p.id);
										const isCanal = isCanalName(p.name);

										const outputMap = new Map<
											number,
											{
												childId: number;
												childName: string;
												childStockPieces: number;
												addPieces: number;
											}
										>();
										const addRecipes = (
											recipeType: string,
											realType: string,
										) => {
											const rows = byType?.get(recipeType) ?? [];
											for (const r of rows) {
												const addPieces = expectedPieces(
													r.yieldQuantityPieces,
													qty,
												);
												const prev = outputMap.get(r.childId);
												outputMap.set(r.childId, {
													childId: r.childId,
													childName: r.childName,
													childStockPieces: r.childStockPieces,
													addPieces: (prev?.addPieces ?? 0) + addPieces,
												});
											}

											const parentNameLower = p.name.toLowerCase();
											const typeLower = realType.toLowerCase();
											const shouldAutoRecorte =
												typeLower.includes("cuadr") &&
												(typeLower.includes("cuero") ||
													parentNameLower.includes("panza") ||
													parentNameLower.includes("cuero"));
											const hasRecorte = Array.from(outputMap.values()).some(
												(x) => x.childName.toLowerCase().includes("recorte"),
											);
											if (shouldAutoRecorte && !hasRecorte && recorteProduct) {
												const prev = outputMap.get(recorteProduct.id);
												outputMap.set(recorteProduct.id, {
													childId: recorteProduct.id,
													childName: recorteProduct.name,
													childStockPieces: recorteProduct.stock_pieces,
													addPieces: (prev?.addPieces ?? 0) + qty,
												});
											}
										};

										if (type) {
											addRecipes("BASE", type);
											if (type !== "BASE") addRecipes(type, type);
										}

										const outputs = Array.from(outputMap.values())
											.filter((x) => x.addPieces > 0)
											.sort((a, b) => a.childName.localeCompare(b.childName));

										const intermediateOutputs = isCanal
											? outputs.filter((o) => isIntermediateName(o.childName))
											: [];
										const finalOutputs = isCanal
											? outputs.filter((o) => !isIntermediateName(o.childName))
											: outputs;

										return (
											<div
												key={p.id}
												className="rounded-md border bg-background p-3"
											>
												<div className="flex items-start justify-between gap-3">
													<div className="min-w-0">
														<div className="truncate font-medium text-sm">
															{p.name}
														</div>
														<div className="text-muted-foreground text-xs">
															Stock: {p.stock_pieces} pzas
														</div>
													</div>
													<Button
														size="sm"
														onClick={() => executeDashboardCard(p.id)}
														disabled={
															disabled ||
															disassemblyMutation.isPending ||
															pipelineMutation.isPending
														}
													>
														Ejecutar
													</Button>
												</div>

												<div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
													<div className="space-y-1">
														<div className="text-muted-foreground text-xs">
															Acción
														</div>
														<Select
															value={type}
															onValueChange={(v) =>
																setDashboardType((prev) => ({
																	...prev,
																	[p.id]: v,
																}))
															}
														>
															<SelectTrigger>
																<SelectValue />
															</SelectTrigger>
															<SelectContent>
																{p.transformationTypes.map((t) => (
																	<SelectItem key={t} value={t}>
																		{displayType(t)}
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
													</div>

													<div className="space-y-1">
														<div className="text-muted-foreground text-xs">
															Cantidad
														</div>
														<Input
															type="number"
															min="0"
															step="1"
															value={qty || ""}
															onChange={(e) => {
																const val = e.target.value;
																setDashboardQty((prev) => ({
																	...prev,
																	[p.id]:
																		val === ""
																			? 0
																			: Number.parseInt(val, 10) || 0,
																}));
															}}
														/>
														{shouldShowLeaveComplete(p.name) ? (
															<div className="mt-2 space-y-1">
																<div className="text-muted-foreground text-xs">
																	Dejar completo
																</div>
																<Input
																	type="number"
																	min="0"
																	step="1"
																	value={leaveCompleteQty || ""}
																	onChange={(e) => {
																		const val = e.target.value;
																		const leave =
																			val === ""
																				? 0
																				: Number.parseInt(val, 10) || 0;
																		const clamped = Math.min(
																			Math.max(leave, 0),
																			p.stock_pieces,
																		);
																		setDashboardQty((prev) => ({
																			...prev,
																			[p.id]: Math.max(
																				0,
																				p.stock_pieces - clamped,
																			),
																		}));
																	}}
																/>
																<div className="text-muted-foreground text-xs">
																	Procesar:{" "}
																	{Math.max(0, Math.min(qty, p.stock_pieces))} ·
																	Dejar: {leaveCompleteQty}
																</div>
															</div>
														) : (
															<div className="text-muted-foreground text-xs">
																Dejar en stock: {leaveCompleteQty}
															</div>
														)}
														{qty > p.stock_pieces ? (
															<div className="text-red-600 text-xs">
																Cantidad excede el stock
															</div>
														) : null}
													</div>
												</div>

												{type ? (
													<div className="mt-3 rounded-md bg-muted/30 p-2">
														<div className="text-muted-foreground text-xs">
															Genera (al ejecutar)
														</div>
														{outputs.length ? (
															<div className="mt-1 space-y-1">
																{finalOutputs.map((o) => (
																	<div
																		key={o.childId}
																		className="flex items-center justify-between gap-3 text-xs"
																	>
																		<div className="min-w-0 truncate">
																			→ {o.childName}
																		</div>
																		<div className="shrink-0 text-muted-foreground">
																			+{o.addPieces} (stock {o.childStockPieces}{" "}
																			→ {o.childStockPieces + o.addPieces})
																		</div>
																	</div>
																))}

																{isCanal
																	? intermediateOutputs.map((o) => {
																			const key = `${p.id}:${o.childId}`;
																			const leave = Math.max(
																				0,
																				Math.min(
																					dashboardIntermediateLeave[key] ?? 0,
																					o.addPieces,
																				),
																			);
																			const toSplit = Math.max(
																				0,
																				o.addPieces - leave,
																			);
																			const intermediateType =
																				getDefaultTypeForParent(o.childId);
																			const byTypeChild =
																				dashboardRecipesByParent.get(o.childId);

																			const childOutputMap = new Map<
																				number,
																				{
																					childId: number;
																					childName: string;
																					childStockPieces: number;
																					addPieces: number;
																				}
																			>();
																			const addIntermediateRecipes = (
																				recipeType: string,
																				realType: string,
																			) => {
																				const rows =
																					byTypeChild?.get(recipeType) ?? [];
																				for (const r of rows) {
																					const addPieces = expectedPieces(
																						r.yieldQuantityPieces,
																						toSplit,
																					);
																					const prev = childOutputMap.get(
																						r.childId,
																					);
																					childOutputMap.set(r.childId, {
																						childId: r.childId,
																						childName: r.childName,
																						childStockPieces:
																							r.childStockPieces,
																						addPieces:
																							(prev?.addPieces ?? 0) +
																							addPieces,
																					});
																				}

																				const parentNameLower =
																					o.childName.toLowerCase();
																				const typeLower =
																					realType.toLowerCase();
																				const shouldAutoRecorte =
																					typeLower.includes("cuadr") &&
																					(typeLower.includes("cuero") ||
																						parentNameLower.includes("panza") ||
																						parentNameLower.includes("cuero"));
																				const hasRecorte = Array.from(
																					childOutputMap.values(),
																				).some((x) =>
																					x.childName
																						.toLowerCase()
																						.includes("recorte"),
																				);
																				if (
																					shouldAutoRecorte &&
																					!hasRecorte &&
																					recorteProduct
																				) {
																					const prev = childOutputMap.get(
																						recorteProduct.id,
																					);
																					childOutputMap.set(
																						recorteProduct.id,
																						{
																							childId: recorteProduct.id,
																							childName: recorteProduct.name,
																							childStockPieces:
																								recorteProduct.stock_pieces,
																							addPieces:
																								(prev?.addPieces ?? 0) +
																								toSplit,
																						},
																					);
																				}
																			};

																			if (toSplit > 0) {
																				addIntermediateRecipes(
																					"BASE",
																					intermediateType,
																				);
																				if (intermediateType !== "BASE")
																					addIntermediateRecipes(
																						intermediateType,
																						intermediateType,
																					);
																			}

																			const childOutputs = Array.from(
																				childOutputMap.values(),
																			)
																				.filter((x) => x.addPieces > 0)
																				.sort((a, b) =>
																					a.childName.localeCompare(
																						b.childName,
																					),
																				);

																			return (
																				<div
																					key={o.childId}
																					className="rounded-md bg-background/60 p-2"
																				>
																					<div className="flex items-center justify-between gap-3 text-xs">
																						<div className="min-w-0 truncate">
																							→ {o.childName}
																						</div>
																						<div className="shrink-0 text-muted-foreground">
																							+{o.addPieces} (stock{" "}
																							{o.childStockPieces} →{" "}
																							{o.childStockPieces + o.addPieces}
																							)
																						</div>
																					</div>

																					<div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
																						<div className="space-y-1">
																							<div className="text-muted-foreground text-xs">
																								Dejar completo
																							</div>
																							<Input
																								type="number"
																								min="0"
																								step="1"
																								value={leave || ""}
																								onChange={(e) => {
																									const val = e.target.value;
																									const raw =
																										val === ""
																											? 0
																											: Number.parseInt(
																													val,
																													10,
																												) || 0;
																									const clamped = Math.min(
																										Math.max(raw, 0),
																										o.addPieces,
																									);
																									setDashboardIntermediateLeave(
																										(prev) => ({
																											...prev,
																											[key]: clamped,
																										}),
																									);
																								}}
																							/>
																							<div className="text-muted-foreground text-xs">
																								Separar: {toSplit} · Dejar:{" "}
																								{leave}
																							</div>
																						</div>
																						<div className="space-y-1">
																							<div className="text-muted-foreground text-xs">
																								Acción interna
																							</div>
																							<div className="text-xs">
																								{displayType(intermediateType)}
																							</div>
																						</div>
																					</div>

																					{toSplit > 0 ? (
																						<div className="mt-2 space-y-1">
																							{childOutputs.length ? (
																								childOutputs.map((c) => (
																									<div
																										key={c.childId}
																										className="flex items-center justify-between gap-3 text-xs"
																									>
																										<div className="min-w-0 truncate">
																											→ {c.childName}
																										</div>
																										<div className="shrink-0 text-muted-foreground">
																											+{c.addPieces} (stock{" "}
																											{c.childStockPieces} →{" "}
																											{c.childStockPieces +
																												c.addPieces}
																											)
																										</div>
																									</div>
																								))
																							) : (
																								<div className="text-muted-foreground text-xs">
																									Sin receta configurada para
																									separar.
																								</div>
																							)}
																						</div>
																					) : (
																						<div className="mt-2 text-muted-foreground text-xs">
																							Se deja completo.
																						</div>
																					)}
																				</div>
																			);
																		})
																	: null}
															</div>
														) : (
															<div className="mt-1 text-muted-foreground text-xs">
																Sin recetas configuradas para esta acción.
															</div>
														)}
													</div>
												) : null}
											</div>
										);
									})
								) : (
									<div className="rounded-md border bg-muted/30 p-3 text-muted-foreground text-sm">
										Sin acciones disponibles (stock 0 o sin recetas).
									</div>
								)}
							</div>

							<div className="space-y-3">
								<div className="font-medium text-sm">Hijos / stock</div>
								{dashboardLeaves.length ? (
									dashboardLeaves.map((p) => (
										<div
											key={p.id}
											className="rounded-md border bg-background p-3"
										>
											<div className="truncate font-medium text-sm">
												{p.name}
											</div>
											<div className="text-muted-foreground text-xs">
												Stock: {p.stock_pieces} pzas
											</div>
										</div>
									))
								) : (
									<div className="rounded-md border bg-muted/30 p-3 text-muted-foreground text-sm">
										Sin stock en productos finales.
									</div>
								)}
							</div>
						</div>

						<div className="space-y-3 rounded-md border bg-muted/10 p-3">
							<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
								<div className="font-medium text-sm">
									Mapa / organigrama (recetas)
								</div>
								<Select
									value={mapParentId ? String(mapParentId) : ""}
									onValueChange={(v) => setMapParentId(Number(v))}
								>
									<SelectTrigger className="w-full sm:w-[320px]">
										<SelectValue placeholder="Selecciona un padre" />
									</SelectTrigger>
									<SelectContent>
										{dashboardProcessables.map((p) => (
											<SelectItem key={p.id} value={String(p.id)}>
												{p.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{selectedMapParent ? (
								<div className="space-y-2">
									{selectedMapParent.transformationTypes.map((type) => {
										const byType = dashboardRecipesByParent.get(
											selectedMapParent.id,
										);
										const outputMap = new Map<
											number,
											{
												childId: number;
												childName: string;
												addPieces: number;
											}
										>();

										const addRecipes = (
											recipeType: string,
											realType: string,
										) => {
											const rows = byType?.get(recipeType) ?? [];
											for (const r of rows) {
												const addPieces = expectedPieces(
													r.yieldQuantityPieces,
													1,
												);
												const prev = outputMap.get(r.childId);
												outputMap.set(r.childId, {
													childId: r.childId,
													childName: r.childName,
													addPieces: (prev?.addPieces ?? 0) + addPieces,
												});
											}

											const parentNameLower =
												selectedMapParent.name.toLowerCase();
											const typeLower = realType.toLowerCase();
											const shouldAutoRecorte =
												typeLower.includes("cuadr") &&
												(typeLower.includes("cuero") ||
													parentNameLower.includes("panza") ||
													parentNameLower.includes("cuero"));
											const hasRecorte = Array.from(outputMap.values()).some(
												(x) => x.childName.toLowerCase().includes("recorte"),
											);
											if (shouldAutoRecorte && !hasRecorte && recorteProduct) {
												const prev = outputMap.get(recorteProduct.id);
												outputMap.set(recorteProduct.id, {
													childId: recorteProduct.id,
													childName: recorteProduct.name,
													addPieces: (prev?.addPieces ?? 0) + 1,
												});
											}
										};

										addRecipes("BASE", type);
										if (type !== "BASE") addRecipes(type, type);

										const outputs = Array.from(outputMap.values())
											.filter((x) => x.addPieces > 0)
											.sort((a, b) => a.childName.localeCompare(b.childName));

										return (
											<details
												key={type}
												className="rounded-md border bg-background px-3 py-2"
											>
												<summary className="cursor-pointer select-none font-medium text-sm">
													Acción: {displayType(type)}{" "}
													<span className="text-muted-foreground text-xs">
														{type === "BASE"
															? "(solo BASE)"
															: "(BASE + acción)"}
													</span>
												</summary>
												<div className="mt-2 space-y-1 text-sm">
													{outputs.length ? (
														outputs.map((o) => (
															<div key={o.childId} className="text-xs">
																→ {o.childName}: {o.addPieces} pza(s) por 1
															</div>
														))
													) : (
														<div className="text-muted-foreground text-xs">
															Sin recetas configuradas para esta acción.
														</div>
													)}
												</div>
											</details>
										);
									})}
								</div>
							) : (
								<div className="text-muted-foreground text-sm">
									Selecciona un producto padre para ver el organigrama.
								</div>
							)}
						</div>
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
						setSelectedPrimaryParentId("");
						setSelectedPrimaryStyle("");
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
