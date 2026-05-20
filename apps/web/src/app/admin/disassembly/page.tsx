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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

	const [purchaseWholePigsAmericano, setPurchaseWholePigsAmericano] = useState<number>(0);
	const [purchaseWholePigsNacional, setPurchaseWholePigsNacional] = useState<number>(0);
	const [purchasePricePerKg, setPurchasePricePerKg] = useState<number>(0);
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

	const recipesUpsertMutation = useMutation(
		trpc.inventory.recipesUpsert.mutationOptions({
			onSuccess: () => {
				invalidateStockQueries();
			},
		}),
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

	const canalAmericanoProduct = useMemo(() => {
		const normalizeName = (name: string) =>
			name
				.toLowerCase()
				.replace(/^\s*[a-z]{2}\d+\s*-\s*/i, "")
				.trim();
		const score = (name: string) => {
			const n = normalizeName(name);
			if (n.includes("canal americano")) return 0;
			if (n.includes("americano") && n.includes("canal")) return 1;
			return 999;
		};
		const candidates = parentProducts
			.map((p) => ({ p, s: score(p.name) }))
			.filter((x) => x.s < 999)
			.sort((a, b) => a.s - b.s || a.p.id - b.p.id);

		return candidates[0]?.p ?? null;
	}, [parentProducts]);

	const canalNacionalLomoProduct = useMemo(() => {
		const normalizeName = (name: string) =>
			name
				.toLowerCase()
				.replace(/^\s*[a-z]{2}\d+\s*-\s*/i, "")
				.trim();
		const score = (name: string) => {
			const n = normalizeName(name);
			if (n.includes("canal nacional lomo") || n.includes("canal nacional lado lomo"))
				return 0;
			if (n.includes("nacional") && n.includes("lomo") && n.includes("canal"))
				return 1;
			return 999;
		};
		const candidates = parentProducts
			.map((p) => ({ p, s: score(p.name) }))
			.filter((x) => x.s < 999)
			.sort((a, b) => a.s - b.s || a.p.id - b.p.id);

		return candidates[0]?.p ?? null;
	}, [parentProducts]);

	const canalNacionalEspilomoProduct = useMemo(() => {
		const normalizeName = (name: string) =>
			name
				.toLowerCase()
				.replace(/^\s*[a-z]{2}\d+\s*-\s*/i, "")
				.trim();
		const score = (name: string) => {
			const n = normalizeName(name);
			if (
				n.includes("canal nacional espilomo") ||
				n.includes("canal nacional lado espilomo")
			)
				return 0;
			if (n.includes("nacional") && n.includes("espilomo") && n.includes("canal"))
				return 1;
			return 999;
		};
		const candidates = parentProducts
			.map((p) => ({ p, s: score(p.name) }))
			.filter((x) => x.s < 999)
			.sort((a, b) => a.s - b.s || a.p.id - b.p.id);

		return candidates[0]?.p ?? null;
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
		return dashboardStock
			.filter((p) => p.transformationTypes.length > 0)
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
	const [dashboardIntermediateAuto, setDashboardIntermediateAuto] = useState<
		Record<string, boolean>
	>({});

	const [batchMediasAmerican, setBatchMediasAmerican] = useState<number>(0);
	const [batchMediasNacionalLomo, setBatchMediasNacionalLomo] =
		useState<number>(0);
	const [batchMediasNacionalEspilomo, setBatchMediasNacionalEspilomo] =
		useState<number>(0);
	const [batchMode, setBatchMode] = useState<"CANAL_COMPLETO" | "MEDIA_CANAL">(
		"CANAL_COMPLETO",
	);
	const [lastPurchaseStockPiecesByProductId, setLastPurchaseStockPiecesByProductId] =
		useState<Record<number, number>>({});

	const resetPurchaseInputs = () => {
		setPurchaseWholePigsAmericano(0);
		setPurchaseWholePigsNacional(0);
		setPurchasePricePerKg(0);
		setPurchaseTotalWeightKg(0);
		setPurchaseSupplier("");
		setPurchaseNotes("");
	};

	const resetDisassemblyInputs = () => {
		setDashboardQty({});
		setDashboardType({});
		setDashboardIntermediateLeave({});
		setDashboardIntermediateAuto({});
		setMapParentId(0);
		setSelectedPrimaryParentId("");
		setSelectedPrimaryStyle("");
		setPrimaryQuantity(0);
		setBatchMediasAmerican(0);
		setBatchMediasNacionalLomo(0);
		setBatchMediasNacionalEspilomo(0);
		setBatchMode("CANAL_COMPLETO");
	};

	const displayType = useCallback((t: string) => {
		return t
			.replace("NACIONAL_POLINESIA", "NACIONAL")
			.replace("NACIONAL_", "NACIONAL ");
	}, []);

	const normalizeProductName = useCallback((name: string) => {
		return name
			.toLowerCase()
			.replace(/^\s*[a-z]{2}\d+\s*-\s*/i, "")
			.trim();
	}, []);

	const fixedTypeForCanal = useCallback(
		(name: string) => {
			const n = normalizeProductName(name);
			if (n.includes("canal americano")) return "AMERICANO";
			if (n.includes("canal nacional lomo")) return "NACIONAL_LOMO";
			if (n.includes("canal nacional espilomo")) return "NACIONAL_ESPILOMO";
			return null;
		},
		[normalizeProductName],
	);

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
					const fixed = fixedTypeForCanal(p.name);
					next[p.id] = fixed ?? p.transformationTypes[0];
				}
			}
			return next;
		});
	}, [dashboardStock, fixedTypeForCanal]);

	useEffect(() => {
		if (mapParentId !== 0) return;
		if (!dashboardProcessables.length) return;
		setMapParentId(dashboardProcessables[0].id);
	}, [dashboardProcessables, mapParentId]);

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
				n.includes("cuero") ||
				n.includes("mascara") ||
				n.includes("craneo")
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

	const getAvailableTypesForParent = useCallback(
		(parentId: number) => {
			const byType = dashboardRecipesByParent.get(parentId);
			if (!byType) return [];
			const types = Array.from(byType.keys()).filter(Boolean);
			types.sort((a, b) => a.localeCompare(b));
			if (types.includes("BASE")) {
				return ["BASE", ...types.filter((t) => t !== "BASE")];
			}
			return types;
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

	const defaultAutoSplitForIntermediate = useCallback(
		(args: { parentName: string; parentType: string; childName: string }) => {
			const child = normalizeProductName(args.childName);
			if (child.includes("cuero")) return false;

			const parentType = (args.parentType ?? "").toLowerCase();
			const isEspilomo =
				parentType.includes("nacional_espilomo") ||
				parentType.includes("mx espilomo") ||
				(parentType.includes("nacional") && parentType.includes("espilomo"));
			if (isEspilomo && child.includes("costillar")) return false;

			return true;
		},
		[normalizeProductName],
	);

	const selectedMapParent = useMemo(() => {
		if (!mapParentId) return null;
		return dashboardProcessables.find((p) => p.id === mapParentId) ?? null;
	}, [dashboardProcessables, mapParentId]);

	const executeDashboardCard = async (productId: number) => {
		const item = dashboardStock.find((p) => p.id === productId);
		if (!item) return;

		const qty = dashboardQty[productId] ?? 0;
		const fixed = fixedTypeForCanal(item.name);
		const type = fixed ?? dashboardType[productId];
		if (!type || qty <= 0) return;

		const effectiveChildren = effectiveChildrenForParent(item.id, type);
		const intermediateLeaves = effectiveChildren
			.map((r) => {
				const addPieces = expectedPieces(r.yieldQuantityPieces, qty);
				return {
					childId: r.childId,
					childName: r.childName,
					addPieces,
				};
			})
			.filter((x) => x.addPieces > 0 && isIntermediateName(x.childName))
			.map((x) => {
				const key = `${item.id}:${x.childId}`;
				const auto =
					dashboardIntermediateAuto[key] ??
					defaultAutoSplitForIntermediate({
						parentName: item.name,
						parentType: type,
						childName: x.childName,
					});
				const leave = Math.max(
					0,
					Math.min(dashboardIntermediateLeave[key] ?? 0, x.addPieces),
				);
				return {
					productId: x.childId,
					transformationType:
						dashboardType[x.childId] ?? getDefaultTypeForParent(x.childId),
					leaveComplete: auto ? leave : x.addPieces,
				};
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

	const canalAmerican = useQuery({
		...trpc.products.getTransformations.queryOptions({
			parentProductId: canalAmericanoProduct?.id ?? 0,
			transformationType: "AMERICANO",
		}),
		enabled: !!canalAmericanoProduct,
	});
	const canalNationalLomo = useQuery({
		...trpc.products.getTransformations.queryOptions({
			parentProductId: canalNacionalLomoProduct?.id ?? 0,
			transformationType: "NACIONAL_LOMO",
		}),
		enabled: !!canalNacionalLomoProduct,
	});
	const canalNationalEspilomo = useQuery({
		...trpc.products.getTransformations.queryOptions({
			parentProductId: canalNacionalEspilomoProduct?.id ?? 0,
			transformationType: "NACIONAL_ESPILOMO",
		}),
		enabled: !!canalNacionalEspilomoProduct,
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
					`Compra registrada: +${data.totalPieces} medias canales, ${data.totalKg} kg total`,
				);
				setBatchMediasAmerican(data.mediasAmericano);
				setBatchMediasNacionalLomo(data.mediasNacionalLomo);
				setBatchMediasNacionalEspilomo(data.mediasNacionalEspilomo);
				setBatchMode(data.purchaseMode);
				setLastPurchaseStockPiecesByProductId(() => {
					const next: Record<number, number> = {};
					for (const a of data.allocations ?? []) {
						next[a.productId] = a.newStock;
					}
					return next;
				});
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

	const yieldPiecesPerOne = useCallback((yieldQuantityPieces: unknown) => {
		const raw = Number(yieldQuantityPieces);
		const normalized = raw > 50 ? raw / 1000 : raw;
		const rounded = Math.round(normalized * 1000) / 1000;
		return Number.isFinite(rounded) ? rounded : 0;
	}, []);

	const autoSeedSecondaryRecipesDoneRef = useRef(false);

	const findBestProductByTokens = useCallback(
		(args: { include: string[]; exclude?: string[] }) => {
			const include = args.include.map((s) => s.toLowerCase());
			const exclude = (args.exclude ?? []).map((s) => s.toLowerCase());

			const score = (name: string) => {
				const n = normalizeProductName(name);
				for (const ex of exclude) if (n.includes(ex)) return null;
				for (const inc of include) if (!n.includes(inc)) return null;
				let s = 0;
				for (const inc of include) if (n === inc) s -= 20;
				for (const inc of include) if (n.startsWith(inc)) s -= 5;
				return s + n.length / 1000;
			};

			const candidates = products
				.map((p) => ({ p, s: score(p.name) }))
				.filter((x) => x.s !== null) as Array<{ p: (typeof products)[number]; s: number }>;

			candidates.sort((a, b) => a.s - b.s || a.p.id - b.p.id);
			return candidates[0]?.p ?? null;
		},
		[normalizeProductName, products],
	);

	const ensureRecipe = useCallback(
		async (args: {
			parentId: number;
			childId: number;
			type: string;
			pieces: number;
		}) => {
			try {
				await recipesUpsertMutation.mutateAsync({
					parentProductId: args.parentId,
					childProductId: args.childId,
					yieldQuantityPieces: args.pieces,
					yieldWeightRatio: 0,
					transformationType: args.type,
					isActive: true,
				});
				return true;
			} catch {
				return false;
			}
		},
		[recipesUpsertMutation],
	);

	useEffect(() => {
		if (autoSeedSecondaryRecipesDoneRef.current) return;
		if (!products.length) return;
		if (!dashboardStock.length) return;
		if (recipesUpsertMutation.isPending) return;

		const parentsNeeding = dashboardStock.filter((p) => {
			if (p.stock_pieces <= 0) return false;
			if (p.transformationTypes.length > 0) return false;
			const n = normalizeProductName(p.name);
			return n.includes("pierna") || n.includes("espaldilla") || n.includes("cabeza");
		});

		if (!parentsNeeding.length) {
			autoSeedSecondaryRecipesDoneRef.current = true;
			return;
		}

		autoSeedSecondaryRecipesDoneRef.current = true;

		const run = async () => {
			let created = 0;

			const huesoPreferred = findBestProductByTokens({
				include: ["hueso"],
				exclude: ["americano", "c/h", "con hueso"],
			});
			const huesoFallback = findBestProductByTokens({ include: ["hueso"] });
			const hueso = huesoPreferred ?? huesoFallback ?? null;
			if (!hueso) return;

			for (const parent of parentsNeeding) {
				const n = normalizeProductName(parent.name);

				if (n.includes("pierna")) {
					const pulpaPierna = findBestProductByTokens({
						include: ["pulpa", "pierna"],
					});
					const pulpaFallback = findBestProductByTokens({
						include: ["pulpa"],
						exclude: ["espaldilla", "jamon"],
					});
					const pulpa = pulpaPierna ?? pulpaFallback ?? null;
					if (!pulpa) continue;
					created += (await ensureRecipe({
						parentId: parent.id,
						childId: pulpa.id,
						type: "SIN_HUESO",
						pieces: 1,
					}))
						? 1
						: 0;
					created += (await ensureRecipe({
						parentId: parent.id,
						childId: hueso.id,
						type: "SIN_HUESO",
						pieces: 1,
					}))
						? 1
						: 0;
				}

				if (n.includes("espaldilla")) {
					const pulpaEspaldilla = findBestProductByTokens({
						include: ["pulpa", "espaldilla"],
					});
					if (!pulpaEspaldilla) continue;
					created += (await ensureRecipe({
						parentId: parent.id,
						childId: pulpaEspaldilla.id,
						type: "SIN_HUESO",
						pieces: 1,
					}))
						? 1
						: 0;
					created += (await ensureRecipe({
						parentId: parent.id,
						childId: hueso.id,
						type: "SIN_HUESO",
						pieces: 1,
					}))
						? 1
						: 0;
				}

				if (n.includes("cabeza")) {
					const headChildren: Array<{ name: string; pieces: number; tokens: string[] }> =
						[
							{ name: "MASCARA COMPLETA", pieces: 1, tokens: ["mascara"] },
							{ name: "PAPADA", pieces: 1, tokens: ["papada"] },
							{ name: "CACHETE", pieces: 2, tokens: ["cachete"] },
							{ name: "LENGUA", pieces: 1, tokens: ["lengua"] },
							{ name: "OREJAS", pieces: 2, tokens: ["orejas"] },
							{ name: "TROMPA", pieces: 1, tokens: ["trompa"] },
							{ name: "SESOS", pieces: 1, tokens: ["sesos"] },
						];

					for (const c of headChildren) {
						const child = findBestProductByTokens({ include: c.tokens });
						if (!child) continue;
						created += (await ensureRecipe({
							parentId: parent.id,
							childId: child.id,
							type: "DESPIECE_CABEZA",
							pieces: c.pieces,
						}))
							? 1
							: 0;
					}
				}
			}

			if (created > 0) {
				toast.success(
					`Listo: habilitadas opciones de Pierna/Espaldilla (SIN_HUESO) y Cabeza (DESPIECE_CABEZA). Recetas agregadas: ${created}.`,
				);
			}
			const missingTargets: string[] = [];
			const hasPierna = parentsNeeding.some((p) =>
				normalizeProductName(p.name).includes("pierna"),
			);
			const hasEspaldilla = parentsNeeding.some((p) =>
				normalizeProductName(p.name).includes("espaldilla"),
			);
			if (hasPierna) {
				const pulpaPierna = findBestProductByTokens({
					include: ["pulpa", "pierna"],
				});
				const pulpaFallback = findBestProductByTokens({
					include: ["pulpa"],
					exclude: ["espaldilla", "jamon"],
				});
				if (!pulpaPierna && !pulpaFallback) missingTargets.push("PULPA DE PIERNA");
			}
			if (hasEspaldilla) {
				const pulpaEspaldilla = findBestProductByTokens({
					include: ["pulpa", "espaldilla"],
				});
				if (!pulpaEspaldilla) missingTargets.push("PULPA DE ESPALDILLA");
			}
			if (missingTargets.length) {
				toast.error(
					`Faltan productos para habilitar SIN_HUESO: ${missingTargets.join(
						", ",
					)}. Crea esos productos y recarga.`,
				);
			}
			invalidateStockQueries();
		};

		run();
	}, [
		dashboardStock,
		ensureRecipe,
		findBestProductByTokens,
		invalidateStockQueries,
		normalizeProductName,
		products.length,
		recipesUpsertMutation.isPending,
	]);

	const mediasAmerican = batchMediasAmerican;
	const npLomoQty = batchMediasNacionalLomo;
	const npEspilomoQty = batchMediasNacionalEspilomo;

	const effectiveChildrenForParent = useCallback(
		(parentId: number, selectedType: string) => {
			const byType = dashboardRecipesByParent.get(parentId);
			if (!byType) return [];
			const base = byType.get("BASE") ?? [];
			if (selectedType === "BASE") {
				const map = new Map<number, (typeof base)[number]>();
				for (const r of base) map.set(r.childId, r);
				return Array.from(map.values());
			}
			const specific = byType.get(selectedType) ?? [];
			const map = new Map<number, (typeof base)[number]>();
			for (const r of base) map.set(r.childId, r);
			for (const r of specific) map.set(r.childId, r);
			return Array.from(map.values());
		},
		[dashboardRecipesByParent],
	);

	const buildTwoLevelPreview = useCallback(
		(args: {
			rootName: string;
			rootId: number;
			rootQty: number;
			rootWeight?: number;
			rootStyle: string;
			level1: Array<{
				childId: number;
				childName: string;
				yieldQuantityPieces: string | number;
				yieldWeightRatio?: string | number | null;
			}>;
		}) => {
			const level1Generated = new Map<
				number,
				{
					name: string;
					pieces: number;
					weight: number;
					origin: string;
				}
			>();

			const rootOrigin = `${args.rootName} (${displayType(args.rootStyle)})`;
			for (const r of args.level1) {
				const pieces = expectedPieces(r.yieldQuantityPieces, args.rootQty);
				if (pieces <= 0) continue;

				const ratio = Number(r.yieldWeightRatio || 0);
				const weight = args.rootWeight ? args.rootWeight * ratio : 0;

				const prev = level1Generated.get(r.childId);
				level1Generated.set(r.childId, {
					name: r.childName,
					pieces: (prev?.pieces ?? 0) + pieces,
					weight: (prev?.weight ?? 0) + weight,
					origin: rootOrigin,
				});
			}

			const leafRows: Array<{
				id: number;
				name: string;
				pieces: number;
				weight: number;
				origin: string;
			}> = [];

			for (const [childId, v] of level1Generated.entries()) {
				if (!isIntermediateName(v.name)) {
					leafRows.push({
						id: childId,
						name: v.name,
						pieces: v.pieces,
						weight: v.weight,
						origin: v.origin,
					});
					continue;
				}

				const leaveKey = `${args.rootId}:${childId}`;
				const auto =
					dashboardIntermediateAuto[leaveKey] ??
					defaultAutoSplitForIntermediate({
						parentName: args.rootName,
						parentType: args.rootStyle,
						childName: v.name,
					});
				const intermediateType =
					dashboardType[childId] ?? getDefaultTypeForParent(childId);
				const leaveComplete = auto
					? Math.max(
							0,
							Math.min(dashboardIntermediateLeave[leaveKey] ?? 0, v.pieces),
						)
					: v.pieces;
				const qtyToProcess = v.pieces - leaveComplete;

				// Distribuir peso proporcionalmente a las piezas
				const weightPerPiece = v.pieces > 0 ? v.weight / v.pieces : 0;
				const weightToLeave = leaveComplete * weightPerPiece;
				const weightToProcess = v.weight - weightToLeave;

				if (leaveComplete > 0) {
					leafRows.push({
						id: childId,
						name: v.name,
						pieces: leaveComplete,
						weight: weightToLeave,
						origin: v.origin,
					});
				}
				if (qtyToProcess <= 0) continue;

				const children = effectiveChildrenForParent(childId, intermediateType);
				const intermediateOrigin = `${rootOrigin} → ${v.name} (${displayType(intermediateType)})`;
				for (const c of children) {
					const childPieces = expectedPieces(
						c.yieldQuantityPieces,
						qtyToProcess,
					);
					if (childPieces <= 0) continue;

					const childRatio = Number((c as any).yieldWeightRatio || 0);
					const childWeight = weightToProcess * childRatio;

					leafRows.push({
						id: c.childId,
						name: c.childName,
						pieces: childPieces,
						weight: childWeight,
						origin: intermediateOrigin,
					});
				}
			}

			leafRows.sort((a, b) => a.name.localeCompare(b.name));

			const conflicts = new Map<
				number,
				{
					name: string;
					origins: string[];
					totalPieces: number;
					totalWeight: number;
				}
			>();
			for (const row of leafRows) {
				const prev = conflicts.get(row.id);
				if (!prev) {
					conflicts.set(row.id, {
						name: row.name,
						origins: [row.origin],
						totalPieces: row.pieces,
						totalWeight: row.weight,
					});
					continue;
				}
				const origins = prev.origins.includes(row.origin)
					? prev.origins
					: [...prev.origins, row.origin];
				conflicts.set(row.id, {
					name: prev.name,
					origins,
					totalPieces: prev.totalPieces + row.pieces,
					totalWeight: prev.totalWeight + row.weight,
				});
			}

			const conflictList = Array.from(conflicts.entries())
				.filter(([, v]) => v.origins.length > 1)
				.map(([id, v]) => ({ id, ...v }))
				.sort((a, b) => a.name.localeCompare(b.name));

			return { rows: leafRows, conflicts: conflictList };
		},
		[
			dashboardIntermediateAuto,
			dashboardIntermediateLeave,
			dashboardType,
			defaultAutoSplitForIntermediate,
			displayType,
			effectiveChildrenForParent,
			expectedPieces,
			getDefaultTypeForParent,
			isIntermediateName,
		],
	);

	const canalAmericanLevel1 = useMemo(() => {
		return (canalAmerican.data ?? [])
			.map((r) => ({
				childId: r.child_product_id,
				childName: r.childProduct?.name ?? "-",
				yieldQuantityPieces: r.yield_quantity_pieces,
				yieldWeightRatio: r.yield_weight_ratio,
			}))
			.filter((r) => r.childName !== "-");
	}, [canalAmerican.data]);

	const canalNationalLomoLevel1 = useMemo(() => {
		return (canalNationalLomo.data ?? [])
			.map((r) => ({
				childId: r.child_product_id,
				childName: r.childProduct?.name ?? "-",
				yieldQuantityPieces: r.yield_quantity_pieces,
				yieldWeightRatio: r.yield_weight_ratio,
			}))
			.filter((r) => r.childName !== "-");
	}, [canalNationalLomo.data]);

	const canalNationalEspilomoLevel1 = useMemo(() => {
		return (canalNationalEspilomo.data ?? [])
			.map((r) => ({
				childId: r.child_product_id,
				childName: r.childProduct?.name ?? "-",
				yieldQuantityPieces: r.yield_quantity_pieces,
				yieldWeightRatio: r.yield_weight_ratio,
			}))
			.filter((r) => r.childName !== "-");
	}, [canalNationalEspilomo.data]);

	const totalMediasInPurchase = useMemo(() => {
		return (purchaseWholePigsAmericano + purchaseWholePigsNacional) * 2;
	}, [purchaseWholePigsAmericano, purchaseWholePigsNacional]);

	const weightPerMediaInPurchase = useMemo(() => {
		if (totalMediasInPurchase <= 0) return 0;
		return purchaseTotalWeightKg / totalMediasInPurchase;
	}, [purchaseTotalWeightKg, totalMediasInPurchase]);

	const canalAmericanPreview = useMemo(() => {
		if (!canalAmericanoProduct || mediasAmerican <= 0)
			return { rows: [], conflicts: [] };

		// Estimar peso proporcional
		const estimatedWeight = weightPerMediaInPurchase * mediasAmerican;

		return buildTwoLevelPreview({
			rootName: canalAmericanoProduct.name,
			rootId: canalAmericanoProduct.id,
			rootQty: mediasAmerican,
			rootWeight: estimatedWeight || undefined,
			rootStyle: "US",
			level1: canalAmericanLevel1,
		});
	}, [
		buildTwoLevelPreview,
		canalAmericanLevel1,
		canalAmericanoProduct,
		mediasAmerican,
		weightPerMediaInPurchase,
	]);

	const canalNationalLomoPreview = useMemo(() => {
		if (!canalNacionalLomoProduct || npLomoQty <= 0)
			return { rows: [], conflicts: [] };

		const estimatedWeight = weightPerMediaInPurchase * npLomoQty;

		return buildTwoLevelPreview({
			rootName: canalNacionalLomoProduct.name,
			rootId: canalNacionalLomoProduct.id,
			rootQty: npLomoQty,
			rootWeight: estimatedWeight || undefined,
			rootStyle: "MX LOMO",
			level1: canalNationalLomoLevel1,
		});
	}, [
		buildTwoLevelPreview,
		canalNacionalLomoProduct,
		canalNationalLomoLevel1,
		npLomoQty,
		weightPerMediaInPurchase,
	]);

	const canalNationalEspilomoPreview = useMemo(() => {
		if (!canalNacionalEspilomoProduct || npEspilomoQty <= 0)
			return { rows: [], conflicts: [] };

		const estimatedWeight = weightPerMediaInPurchase * npEspilomoQty;

		return buildTwoLevelPreview({
			rootName: canalNacionalEspilomoProduct.name,
			rootId: canalNacionalEspilomoProduct.id,
			rootQty: npEspilomoQty,
			rootWeight: estimatedWeight || undefined,
			rootStyle: "MX ESPILOMO",
			level1: canalNationalEspilomoLevel1,
		});
	}, [
		buildTwoLevelPreview,
		canalNacionalEspilomoProduct,
		canalNationalEspilomoLevel1,
		npEspilomoQty,
		weightPerMediaInPurchase,
	]);

	const executeCanalBatch = async () => {
		const steps: Array<{
			product: (typeof parentProducts)[number];
			qty: number;
			style: string;
			rows: Array<(typeof canalAmerican.data extends Array<infer T> ? T : never)>;
		}> = [];
		if (mediasAmerican > 0 && canalAmericanoProduct) {
			steps.push({
				product: canalAmericanoProduct,
				qty: mediasAmerican,
				style: "AMERICANO",
				rows: (canalAmerican.data ?? []) as any,
			});
		}
		if (npLomoQty > 0 && canalNacionalLomoProduct) {
			steps.push({
				product: canalNacionalLomoProduct,
				qty: npLomoQty,
				style: "NACIONAL_LOMO",
				rows: (canalNationalLomo.data ?? []) as any,
			});
		}
		if (npEspilomoQty > 0 && canalNacionalEspilomoProduct) {
			steps.push({
				product: canalNacionalEspilomoProduct,
				qty: npEspilomoQty,
				style: "NACIONAL_ESPILOMO",
				rows: (canalNationalEspilomo.data ?? []) as any,
			});
		}

		const piecesAvailableFor = (p: (typeof parentProducts)[number]) => {
			const last = lastPurchaseStockPiecesByProductId[p.id] ?? 0;
			return Math.max(p.stock_pieces, last);
		};

		for (const s of steps) {
			if (s.qty <= 0) continue;

			const available = piecesAvailableFor(s.product);
			if (available < s.qty) {
				toast.error(
					`Cantidad excede el stock (${s.product.name} disponible ${available}, requerido ${s.qty})`,
				);
				return;
			}

			const rows = s.rows as any[];
			const generatedByChildId = new Map<
				number,
				{ name: string; pieces: number }
			>();
			for (const r of rows) {
				const childId = r.child_product_id;
				const childName = r.childProduct?.name ?? "-";
				const addPieces = expectedPieces(r.yield_quantity_pieces, s.qty);
				if (addPieces <= 0) continue;
				const prev = generatedByChildId.get(childId);
				generatedByChildId.set(childId, {
					name: childName,
					pieces: (prev?.pieces ?? 0) + addPieces,
				});
			}

			const intermediateLeaves = Array.from(generatedByChildId.entries())
				.filter(([, v]) => v.pieces > 0 && isIntermediateName(v.name))
				.map(([childId, v]) => {
					const key = `${s.product.id}:${childId}`;
					const auto =
						dashboardIntermediateAuto[key] ??
						defaultAutoSplitForIntermediate({
							parentName: s.product.name,
							parentType: s.style,
							childName: v.name,
						});
					const leave = Math.max(
						0,
						Math.min(dashboardIntermediateLeave[key] ?? 0, v.pieces),
					);
					return {
						productId: childId,
						transformationType:
							dashboardType[childId] ?? getDefaultTypeForParent(childId),
						leaveComplete: auto ? leave : v.pieces,
					};
				});

			await pipelineMutation.mutateAsync({
				canalProductId: s.product.id,
				qtyProcessCanal: s.qty,
				transformationType: s.style,
				intermediateLeaves,
				realWeightMode,
			});
		}

		invalidateStockQueries();
		setBatchMediasAmerican(0);
		setBatchMediasNacionalLomo(0);
		setBatchMediasNacionalEspilomo(0);
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

						<div className="grid grid-cols-1 gap-4 md:grid-cols-4">
							<div className="space-y-1">
								<Label className="text-blue-900 text-sm">
									Cerdos Americanos (vivos)
								</Label>
								<Input
									type="number"
									min="0"
									step="1"
									value={purchaseWholePigsAmericano || ""}
									onChange={(e) => {
										const val = e.target.value;
										setPurchaseWholePigsAmericano(
											val === ""
												? 0
												: Math.max(0, Number.parseInt(val, 10) || 0),
										);
									}}
									placeholder="Ej: 10"
								/>
							</div>

							<div className="space-y-1">
								<Label className="text-blue-900 text-sm">
									Cerdos Nacionales (vivos)
								</Label>
								<Input
									type="number"
									min="0"
									step="1"
									value={purchaseWholePigsNacional || ""}
									onChange={(e) => {
										const val = e.target.value;
										setPurchaseWholePigsNacional(
											val === ""
												? 0
												: Math.max(0, Number.parseInt(val, 10) || 0),
										);
									}}
									placeholder="Ej: 10"
								/>
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

							<div className="space-y-1">
								<Label className="text-blue-900 text-sm">
									Precio por Kilo ($)
								</Label>
								<Input
									type="number"
									min="0"
									step="0.01"
									value={purchasePricePerKg || ""}
									onChange={(e) => {
										const val = e.target.value;
										setPurchasePricePerKg(
											val === "" ? 0 : Math.max(0, Number.parseFloat(val) || 0),
										);
									}}
									placeholder="Ej: 85.00"
								/>
								<div className="text-[10px] text-muted-foreground">
									Se actualizará el costo del canal para estimar precios de piezas.
								</div>
							</div>
						</div>

						{purchaseWholePigsAmericano > 0 || purchaseWholePigsNacional > 0 ? (
							<div className="text-muted-foreground text-xs">
								Genera:{" "}
								{purchaseWholePigsAmericano > 0 ? `${purchaseWholePigsAmericano * 2} medias (Americano) ` : ""}
								{purchaseWholePigsNacional > 0 ? `${purchaseWholePigsNacional} medias lado Lomo + ${purchaseWholePigsNacional} medias lado Espilomo (Nacional)` : ""}
							</div>
						) : null}

						<div className="flex justify-end">
							<div className="flex items-center gap-2">
								<Button
									size="sm"
									variant="outline"
									type="button"
									onClick={resetPurchaseInputs}
									disabled={purchaseMutation.isPending}
								>
									Reset
								</Button>
								<Button
									size="sm"
									onClick={() => {
										if ((purchaseWholePigsAmericano <= 0 && purchaseWholePigsNacional <= 0) || purchaseTotalWeightKg <= 0)
											return;
										purchaseMutation.mutate({
											purchaseMode: "CANAL_COMPLETO",
											qtyAmericano: purchaseWholePigsAmericano,
											qtyNacional: purchaseWholePigsNacional,
											qtyNacionalLomo: 0,
											qtyNacionalEspilomo: 0,
											totalWeightKg: purchaseTotalWeightKg,
											pricePerKg: purchasePricePerKg > 0 ? purchasePricePerKg : undefined,
											supplier: purchaseSupplier || undefined,
											notes: purchaseNotes || undefined,
										});
									}}
									disabled={
										(purchaseWholePigsAmericano <= 0 && purchaseWholePigsNacional <= 0) ||
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
						</div>

						{(purchaseSupplier || purchaseNotes) && (
							<div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
								Proveedor: {purchaseSupplier || "-"} | Notas:{" "}
								{purchaseNotes || "-"}
							</div>
						)}

						<div className="flex gap-3">
							<div className="max-w-xs">
								<Input
									type="text"
									placeholder="Proveedor (opcional)"
									value={purchaseSupplier}
									onChange={(e) => setPurchaseSupplier(e.target.value)}
									className="w-full"
									list="proveedores-list"
								/>
								<datalist id="proveedores-list">
									<option value="La Barca" />
									<option value="Proveedor 2" />
								</datalist>
							</div>
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
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={resetDisassemblyInputs}
							>
								Reset
							</Button>
						</div>
						<div className="text-muted-foreground text-sm">
							Procesa el stock de canal y genera piezas según recetas. Primero
							registra la compra de canales.
						</div>

						{!canalAmericanoProduct &&
						!canalNacionalLomoProduct &&
						!canalNacionalEspilomoProduct ? (
							<div className="text-muted-foreground text-sm">
								No se encontraron productos CANAL (Americano / Nacional Lomo /
								Nacional Espilomo).
							</div>
						) : (
							<>
								<div className="grid grid-cols-1 gap-6 md:grid-cols-3">
									<div className="space-y-2">
										<Label>Canal Americano (stock)</Label>
										{canalAmericanoProduct ? (
											<div className="rounded-md border bg-rose-50 px-3 py-2 text-sm">
												{canalAmericanoProduct.name} (
												{canalAmericanoProduct.stock_pieces} {t("pieces")})
											</div>
										) : (
											<div className="rounded-md border bg-rose-50 px-3 py-2 text-sm text-muted-foreground">
												No configurado
											</div>
										)}
									</div>

									<div className="space-y-2">
										<Label>Canal Nacional Lomo (stock)</Label>
										{canalNacionalLomoProduct ? (
											<div className="rounded-md border bg-emerald-50 px-3 py-2 text-sm">
												{canalNacionalLomoProduct.name} (
												{canalNacionalLomoProduct.stock_pieces} {t("pieces")})
											</div>
										) : (
											<div className="rounded-md border bg-emerald-50 px-3 py-2 text-sm text-muted-foreground">
												No configurado
											</div>
										)}
									</div>

									<div className="space-y-2">
										<Label>Canal Nacional Espilomo (stock)</Label>
										{canalNacionalEspilomoProduct ? (
											<div className="rounded-md border bg-sky-50 px-3 py-2 text-sm">
												{canalNacionalEspilomoProduct.name} (
												{canalNacionalEspilomoProduct.stock_pieces}{" "}
												{t("pieces")})
											</div>
										) : (
											<div className="rounded-md border bg-sky-50 px-3 py-2 text-sm text-muted-foreground">
												No configurado
											</div>
										)}
									</div>
								</div>

								<div className="rounded-md border px-3 py-2 text-sm">
									Última compra cargada:{" "}
									{batchMode === "CANAL_COMPLETO"
										? "Canal completo"
										: "Media canal"}{" "}
									| US: {mediasAmerican} medias | MX Lomo: {npLomoQty} medias | MX
									Espilomo: {npEspilomoQty} medias
								</div>

								<div className="space-y-4 border-t pt-4">
									{mediasAmerican > 0 && canalAmericanPreview.rows.length ? (
										<div className="overflow-x-auto rounded-md border bg-rose-50">
											<div className="bg-rose-100 px-3 py-2 font-medium text-sm">
												Vista previa US (Americano)
											</div>
											{canalAmericanPreview.conflicts.length ? (
												<div className="border-b bg-amber-50 px-3 py-2 text-amber-900 text-xs">
													<div className="flex items-center gap-2">
														<AlertCircleIcon className="h-4 w-4" />
														<span className="font-medium">
															Conflicto: productos generados por múltiples rutas
														</span>
													</div>
													<div className="mt-1">
														{canalAmericanPreview.conflicts
															.slice(0, 5)
															.map((c) => c.name)
															.join(", ")}
														{canalAmericanPreview.conflicts.length > 5
															? "…"
															: ""}
													</div>
												</div>
											) : null}
											<table className="w-full text-sm">
												<thead className="bg-rose-100">
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
														<th className="p-3 text-left font-medium">
															Origen
														</th>
													</tr>
												</thead>
												<tbody>
													{canalAmericanPreview.rows.map((row) => (
														<tr
															key={`${row.id}-${row.origin}`}
															className="border-t"
														>
															<td className="p-3">{row.name}</td>
															<td className="p-3">{row.pieces}</td>
															<td className="p-3">
																{realWeightMode ? (
																	<span className="text-muted-foreground italic">
																		Pendiente
																	</span>
																) : (
																	<span className="font-medium text-blue-600">
																		{row.weight.toFixed(3)} kg
																	</span>
																)}
															</td>
															<td className="p-3 text-muted-foreground text-xs">
																{row.origin}
															</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									) : null}

									{npLomoQty > 0 && canalNationalLomoPreview.rows.length ? (
										<div className="overflow-x-auto rounded-md border bg-emerald-50">
											<div className="bg-emerald-100 px-3 py-2 font-medium text-sm">
												Vista previa MX (Lado Lomo)
											</div>
											{canalNationalLomoPreview.conflicts.length ? (
												<div className="border-b bg-amber-50 px-3 py-2 text-amber-900 text-xs">
													<div className="flex items-center gap-2">
														<AlertCircleIcon className="h-4 w-4" />
														<span className="font-medium">
															Conflicto: productos generados por múltiples rutas
														</span>
													</div>
													<div className="mt-1">
														{canalNationalLomoPreview.conflicts
															.slice(0, 5)
															.map((c) => c.name)
															.join(", ")}
														{canalNationalLomoPreview.conflicts.length > 5
															? "…"
															: ""}
													</div>
												</div>
											) : null}
											<table className="w-full text-sm">
												<thead className="bg-emerald-100">
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
														<th className="p-3 text-left font-medium">
															Origen
														</th>
													</tr>
												</thead>
												<tbody>
													{canalNationalLomoPreview.rows.map((row) => (
														<tr
															key={`${row.id}-${row.origin}`}
															className="border-t"
														>
															<td className="p-3">{row.name}</td>
															<td className="p-3">{row.pieces}</td>
															<td className="p-3">
																{realWeightMode ? (
																	<span className="text-muted-foreground italic">
																		Pendiente
																	</span>
																) : (
																	<span className="font-medium text-blue-600">
																		{row.weight.toFixed(3)} kg
																	</span>
																)}
															</td>
															<td className="p-3 text-muted-foreground text-xs">
																{row.origin}
															</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									) : null}

									{npEspilomoQty > 0 &&
									canalNationalEspilomoPreview.rows.length ? (
										<div className="overflow-x-auto rounded-md border bg-sky-50">
											<div className="bg-sky-100 px-3 py-2 font-medium text-sm">
												Vista previa MX (Lado Espilomo)
											</div>
											{canalNationalEspilomoPreview.conflicts.length ? (
												<div className="border-b bg-amber-50 px-3 py-2 text-amber-900 text-xs">
													<div className="flex items-center gap-2">
														<AlertCircleIcon className="h-4 w-4" />
														<span className="font-medium">
															Conflicto: productos generados por múltiples rutas
														</span>
													</div>
													<div className="mt-1">
														{canalNationalEspilomoPreview.conflicts
															.slice(0, 5)
															.map((c) => c.name)
															.join(", ")}
														{canalNationalEspilomoPreview.conflicts.length > 5
															? "…"
															: ""}
													</div>
												</div>
											) : null}
											<table className="w-full text-sm">
												<thead className="bg-sky-100">
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
														<th className="p-3 text-left font-medium">
															Origen
														</th>
													</tr>
												</thead>
												<tbody>
													{canalNationalEspilomoPreview.rows.map((row) => (
														<tr
															key={`${row.id}-${row.origin}`}
															className="border-t"
														>
															<td className="p-3">{row.name}</td>
															<td className="p-3">{row.pieces}</td>
															<td className="p-3">
																{realWeightMode ? (
																	<span className="text-muted-foreground italic">
																		Pendiente
																	</span>
																) : (
																	<span className="font-medium text-blue-600">
																		{row.weight.toFixed(3)} kg
																	</span>
																)}
															</td>
															<td className="p-3 text-muted-foreground text-xs">
																{row.origin}
															</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									) : null}

									<div className="flex justify-end pt-4">
										{canalAmericanPreview.conflicts.length > 0 ||
										canalNationalLomoPreview.conflicts.length > 0 ||
										canalNationalEspilomoPreview.conflicts.length > 0 ? (
											<div className="mr-auto flex items-center gap-2 text-amber-700 text-xs">
												<AlertCircleIcon className="h-3.5 w-3.5" />
												Hay conflictos de rutas en recetas. Corrige recetas para
												evitar duplicados antes de procesar.
											</div>
										) : null}
										<Button
											size="lg"
											onClick={executeCanalBatch}
											disabled={
												disassemblyMutation.isPending ||
												pipelineMutation.isPending ||
												canalAmericanPreview.conflicts.length > 0 ||
												canalNationalLomoPreview.conflicts.length > 0 ||
												canalNationalEspilomoPreview.conflicts.length > 0 ||
												mediasAmerican + npLomoQty + npEspilomoQty <= 0
											}
										>
											{disassemblyMutation.isPending ||
											pipelineMutation.isPending ? (
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
										const fixed = fixedTypeForCanal(p.name);
										const effectiveType = fixed ?? type;
										const disabled =
											!effectiveType || qty <= 0 || qty > p.stock_pieces;
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
										const selectedRecipes = effectiveType
											? effectiveChildrenForParent(p.id, effectiveType)
											: [];
										for (const r of selectedRecipes) {
											const addPieces = expectedPieces(r.yieldQuantityPieces, qty);
											const prev = outputMap.get(r.childId);
											outputMap.set(r.childId, {
												childId: r.childId,
												childName: r.childName,
												childStockPieces: r.childStockPieces,
												addPieces: (prev?.addPieces ?? 0) + addPieces,
											});
										}

										const parentNameLower = p.name.toLowerCase();
										const typeLower = effectiveType.toLowerCase();
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
												childId: recorteProduct.id,
												childName: recorteProduct.name,
												childStockPieces: recorteProduct.stock_pieces,
												addPieces: (prev?.addPieces ?? 0) + qty,
											});
										}

										const outputs = Array.from(outputMap.values())
											.filter((x) => x.addPieces > 0)
											.sort((a, b) => a.childName.localeCompare(b.childName));

										const intermediateOutputs = outputs.filter((o) =>
											isIntermediateName(o.childName),
										);
										const finalOutputs = outputs.filter(
											(o) => !isIntermediateName(o.childName),
										);

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
														{fixed ? (
															<div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
																{displayType(fixed)}
															</div>
														) : (
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
														)}
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

												{effectiveType ? (
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

																{intermediateOutputs.length
																	? intermediateOutputs.map((o) => {
																			const key = `${p.id}:${o.childId}`;
																			const auto =
																				dashboardIntermediateAuto[key] ??
																				defaultAutoSplitForIntermediate({
																					parentName: p.name,
																					parentType: type,
																					childName: o.childName,
																				});
																			const leave = auto
																				? Math.max(
																						0,
																						Math.min(
																							dashboardIntermediateLeave[key] ??
																								0,
																							o.addPieces,
																						),
																					)
																				: o.addPieces;
																			const toSplit = auto
																				? Math.max(0, o.addPieces - leave)
																				: 0;
																			const intermediateType =
																				dashboardType[o.childId] ??
																				getDefaultTypeForParent(o.childId);
																			const availableInternalTypes =
																				getAvailableTypesForParent(o.childId);
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

																			const selectedIntermediateRecipes = auto
																				? effectiveChildrenForParent(
																						o.childId,
																						intermediateType,
																					)
																				: [];

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
																								disabled={!auto}
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
																							<div className="mt-2">
																								<Button
																									type="button"
																									size="sm"
																									variant={auto ? "default" : "outline"}
																									onClick={() =>
																										setDashboardIntermediateAuto(
																											(prev) => ({
																												...prev,
																												[key]: !auto,
																											}),
																										)
																									}
																								>
																									{auto ? "Auto-separar: Sí" : "Auto-separar: No"}
																								</Button>
																							</div>
																						</div>
																						<div className="space-y-1">
																							<div className="text-muted-foreground text-xs">
																								Acción interna
																							</div>
																							{availableInternalTypes.length ? (
																								<Select
																									value={intermediateType}
																									onValueChange={(v) =>
																										setDashboardType((prev) => ({
																											...prev,
																											[o.childId]: v,
																										}))
																									}
																									disabled={!auto}
																								>
																									<SelectTrigger>
																										<SelectValue />
																									</SelectTrigger>
																									<SelectContent>
																										{availableInternalTypes.map((t) => (
																											<SelectItem key={t} value={t}>
																												{displayType(t)}
																											</SelectItem>
																										))}
																									</SelectContent>
																								</Select>
																							) : (
																								<div className="text-muted-foreground text-xs">
																									Sin acciones configuradas.
																								</div>
																							)}
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

																					<details className="mt-2 rounded-md bg-background/80 px-2 py-1">
																						<summary className="cursor-pointer select-none text-muted-foreground text-xs">
																							Receta interna (por 1 pieza)
																						</summary>
																						<div className="mt-2 space-y-1 text-xs">
																							{selectedIntermediateRecipes.length ? (
																								selectedIntermediateRecipes.map(
																									(r) => (
																										<div
																											key={r.childId}
																											className="flex items-center justify-between gap-3"
																										>
																											<div className="min-w-0 truncate">
																												→ {r.childName}
																											</div>
																											<div className="shrink-0 text-muted-foreground">
																												{yieldPiecesPerOne(
																													r.yieldQuantityPieces,
																												)}{" "}
																												pza(s)
																											</div>
																										</div>
																									),
																								)
																							) : (
																								<div className="text-muted-foreground text-xs">
																									Sin receta configurada.
																								</div>
																							)}
																						</div>
																					</details>
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

														<details className="mt-2 rounded-md bg-background/60 px-2 py-1">
															<summary className="cursor-pointer select-none text-muted-foreground text-xs">
																Receta (por 1 pieza)
															</summary>
															<div className="mt-2 space-y-1 text-xs">
																{selectedRecipes.length ? (
																	selectedRecipes.map((r) => (
																		<div
																			key={r.childId}
																			className="flex items-center justify-between gap-3"
																		>
																			<div className="min-w-0 truncate">
																				→ {r.childName}
																			</div>
																			<div className="shrink-0 text-muted-foreground">
																				{yieldPiecesPerOne(r.yieldQuantityPieces)} pza(s)
																			</div>
																		</div>
																	))
																) : (
																	<div className="text-muted-foreground text-xs">
																		Sin recetas configuradas para esta acción.
																	</div>
																)}
															</div>
														</details>
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

										const selectedRecipes = effectiveChildrenForParent(
											selectedMapParent.id,
											type,
										);
										for (const r of selectedRecipes) {
											const addPieces = expectedPieces(r.yieldQuantityPieces, 1);
											const prev = outputMap.get(r.childId);
											outputMap.set(r.childId, {
												childId: r.childId,
												childName: r.childName,
												addPieces: (prev?.addPieces ?? 0) + addPieces,
											});
										}

										const parentNameLower =
											selectedMapParent.name.toLowerCase();
										const typeLower = type.toLowerCase();
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
												childId: recorteProduct.id,
												childName: recorteProduct.name,
												addPieces: (prev?.addPieces ?? 0) + 1,
											});
										}

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
