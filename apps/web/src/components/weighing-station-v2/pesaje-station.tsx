"use client";

import { Button } from "@finopenpos/ui/components/button";
import { Combobox } from "@finopenpos/ui/components/combobox";
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
import { cn } from "@finopenpos/ui/lib/utils";
import {
	useMutation,
	useQueries,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { CheckCircleIcon, PackageIcon, ScaleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAntonella } from "@/components/antonella-dock";
import {
	type ScaleReading,
	ScaleReadingCard,
} from "@/components/scale-reading-card";
import {
	DiagnosticsPanel,
	getStatusLabel,
	type MergedCapture,
	type ScaleSerialControls,
	ScaleSerialPanel,
	ScaleSettingsForm,
} from "@/components/scale-serial/scale-serial-panel";
import type { LiveReading } from "@/components/scale-serial/use-scale-serial";
import type { LineTotals } from "@/lib/scale/webserial/line-totals";
import { DEFAULT_SCALE_SETTINGS } from "@/lib/scale/webserial/settings";
import { useTRPC } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";
import {
	DEMO_CAPTURES,
	DEMO_CUSTOMER_PRICES,
	DEMO_LIVE,
	DEMO_ORDERS,
	DEMO_TICKET_LINES,
} from "./demo-data";
import { type FnKey, FunctionScreen } from "./instrument/function-screen";
import { IqyDisplay, type IqyIndicator } from "./instrument/iqy-display";
import { OrdersOverlay } from "./overlays/orders-overlay";
import { TicketsOverlay } from "./overlays/tickets-overlay";
import { usePesajeTheme } from "./pesaje-themes";
import "./pesaje-themes.css";
import {
	canRegisterWeight,
	parseCustomTareKg,
} from "@/lib/weighing/parse-custom-tare";
import { type CustomerPriceRow, resolveDefaultPrice } from "./pricing";
import {
	matchPesajeShortcut,
	type PesajeCommand,
	shortcutLabel,
} from "./shortcuts";
import {
	AtajosPage,
	FN_PAGE_TITLES,
	FnFormCard,
	InicioPage,
	RecipientePage,
	TecladoPage,
	TemaPage,
} from "./tiles/fn-pages";
import { type SaleLine, SalePanel } from "./tiles/sale-panel";
import { OrderPanel, OrdersPanel, PendingPanel } from "./tiles/top-panels";
import {
	CONTAINERS,
	type ContainerId,
	captureNetG,
	type FnPage,
	itemName,
	orderTitle,
	PESAJE_THEMES,
	type PesajeCapture,
	type PesajeOrder,
	type PesajeOverlay,
	type TileId,
} from "./types";

const CONTAINER_LABELS: Record<string, string> = Object.fromEntries(
	CONTAINERS.map((container) => [container.id, container.label]),
);

export function PesajeStation({ demo = false }: { demo?: boolean }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const locale = useLocale();
	const { theme, setTheme, cycleTheme } = usePesajeTheme();
	const router = useRouter();
	const themeLabel =
		PESAJE_THEMES.find((item) => item.id === theme)?.label ?? "M1";
	const antonella = useAntonella();

	const [selectedOrderId, setSelectedOrderId] = useState<number | null>(
		demo ? (DEMO_ORDERS[0]?.id ?? null) : null,
	);
	const [currentItemIndex, setCurrentItemIndex] = useState(0);
	const [actualWeight, setActualWeight] = useState("");
	const [scaleUse, setScaleUse] = useState<{
		id: number;
		value: string;
	} | null>(null);
	const [containerId, setContainerId] = useState<ContainerId>("tambo_azul");
	const [customTare, setCustomTare] = useState("0.000");
	const [manualWeight, setManualWeight] = useState(false);
	const [serialTotals, setSerialTotals] = useState<LineTotals | null>(null);
	const [serialCaptures, setSerialCaptures] = useState<PesajeCapture[]>([]);
	const [live, setLive] = useState<LiveReading | null>(
		demo
			? {
					weightG: DEMO_LIVE.weightG,
					weight: DEMO_LIVE.weightG / 1000,
					unit: "kg",
					stable: DEMO_LIVE.stable,
					overload: DEMO_LIVE.overload,
					net: DEMO_LIVE.net,
					raw: "demo",
					at: Date.now(),
				}
			: null,
	);
	const [scaleStatus, setScaleStatus] = useState({
		status: demo ? "connected" : "idle",
		statusLabel: demo ? "Demostración" : "Sin conexión",
		statusDetail: demo ? "Datos de ejemplo" : (null as string | null),
		supported: demo ? true : (null as boolean | null),
		armed: true,
		pending: 0,
		connected: demo,
	});
	const [focusedTile, setFocusedTile] = useState<TileId>(4);
	const [overlay, setOverlay] = useState<PesajeOverlay>(null);
	const [fnPage, setFnPage] = useState<FnPage>(demo ? "recipiente" : "inicio");
	const [heldKg, setHeldKg] = useState<number | null>(null);
	const [priceEdits, setPriceEdits] = useState<Record<number, string>>({});
	const [saleIndex, setSaleIndex] = useState(0);
	const [copied, setCopied] = useState(false);
	const [scaleSettings, setScaleSettingsState] = useState(
		DEFAULT_SCALE_SETTINGS,
	);
	const controlsRef = useRef<ScaleSerialControls | null>(null);
	const weightInputRef = useRef<HTMLInputElement>(null);

	const [completedOrder, setCompletedOrder] = useState<{
		id: number;
		name: string;
	} | null>(null);
	const pendingCompletionRef = useRef<{ id: number; name: string } | null>(
		null,
	);
	const completedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const [batchProductId, setBatchProductId] = useState<number | null>(null);
	const [batchPieces, setBatchPieces] = useState("");
	const [batchWeightKg, setBatchWeightKg] = useState("");
	const [batchApplyToInventory, setBatchApplyToInventory] = useState(true);
	const [batchNoPieces, setBatchNoPieces] = useState(false);

	const {
		data: liveOrders = [],
		isLoading: isLoadingOrders,
		refetch: refetchOrders,
	} = useQuery({
		...trpc.orders.getPendingWeighingOrders.queryOptions(),
		refetchInterval: demo ? false : 8000,
		enabled: !demo,
	});

	const { data: products = [] } = useQuery({
		...trpc.products.list.queryOptions(),
		enabled: !demo,
	});

	const orders: PesajeOrder[] = demo
		? DEMO_ORDERS
		: (liveOrders as PesajeOrder[]);

	const [newOrderIds, setNewOrderIds] = useState<Set<number>>(new Set());
	const prevOrderIdsRef = useRef<Set<number> | null>(null);
	useEffect(() => {
		if (demo) return;
		const currentIds = new Set(orders.map((order) => order.id));
		const prev = prevOrderIdsRef.current;
		if (prev) {
			const fresh = [...currentIds].filter((id) => !prev.has(id));
			if (fresh.length > 0) {
				setNewOrderIds((current) => {
					const next = new Set(current);
					for (const id of fresh) next.add(id);
					return next;
				});
				const first = orders.find((order) => order.id === fresh[0]);
				toast.success(
					`Nuevo pedido #${fresh[0]}${first?.customer?.name ? ` – ${first.customer.name}` : ""}`,
				);
				setTimeout(() => {
					setNewOrderIds((current) => {
						const next = new Set(current);
						for (const id of fresh) next.delete(id);
						return next;
					});
				}, 3000);
			}
		}
		prevOrderIdsRef.current = currentIds;
	}, [orders, demo]);

	const selectedOrder = useMemo(
		() => orders.find((order) => order.id === selectedOrderId) ?? null,
		[orders, selectedOrderId],
	);

	const pendingItems = useMemo(
		() =>
			selectedOrder?.orderItems?.filter(
				(item) => item.status === "PENDIENTE_PESAJE",
			) ??
			selectedOrder?.orderItems ??
			[],
		[selectedOrder],
	);

	const clampedIndex = Math.min(
		currentItemIndex,
		Math.max(0, pendingItems.length - 1),
	);
	const currentItem = pendingItems[clampedIndex] ?? null;

	useEffect(() => {
		if (demo) return;
		if (selectedOrderId && pendingItems.length === 0 && !isLoadingOrders) {
			setSelectedOrderId(null);
			setCurrentItemIndex(0);
		}
	}, [pendingItems.length, selectedOrderId, isLoadingOrders, demo]);

	const containerDef = CONTAINERS.find(
		(container) => container.id === containerId,
	)!;
	const parsedCustomTare = parseCustomTareKg(customTare);
	const customTareInvalid = containerId === "otro" && parsedCustomTare === null;
	const tareKg =
		containerId === "otro" ? (parsedCustomTare ?? 0) : (containerDef.tare ?? 0);

	const usingSerialNet =
		!manualWeight && serialTotals !== null && serialTotals.count > 0;
	const manualGrossKg = Number.parseFloat(actualWeight) || 0;
	const netKg = usingSerialNet
		? serialTotals.netG / 1000
		: Math.max(0, manualGrossKg - tareKg);
	const hasValidWeight = canRegisterWeight({
		netKg,
		customTareInvalid,
		hasItem: currentItem !== null,
	});

	const serialLine = useMemo(() => {
		if (!selectedOrder || !currentItem) return null;
		return {
			orderId: selectedOrder.id,
			orderItemId: currentItem.id,
			productName: itemName(currentItem),
			requestedPieces: currentItem.quantity_pieces,
		};
	}, [selectedOrder, currentItem]);

	const serialContainer = useMemo(
		() => ({ id: containerId, label: containerDef.label, tareKg }),
		[containerId, containerDef.label, tareKg],
	);

	useEffect(() => {
		setManualWeight(false);
		const requested = currentItem?.quantity_kg
			? Number(currentItem.quantity_kg).toString()
			: "";
		setActualWeight(requested);
	}, [currentItem?.id]);

	useEffect(() => {
		if (!demo) return;
		setSerialCaptures(DEMO_CAPTURES);
		setSerialTotals({
			count: DEMO_CAPTURES.length,
			pieces: DEMO_CAPTURES.reduce(
				(sum, capture) => sum + (capture.pieceCount ?? 0),
				0,
			),
			grossG: DEMO_CAPTURES.reduce((sum, capture) => sum + capture.weightG, 0),
			tareG: DEMO_CAPTURES.reduce(
				(sum, capture) => sum + (capture.tareG ?? 0),
				0,
			),
			netG: DEMO_CAPTURES.reduce(
				(sum, capture) => sum + captureNetG(capture.weightG, capture.tareG),
				0,
			),
		});
		setActualWeight((DEMO_LIVE.weightG / 1000).toFixed(3));
	}, [demo]);

	const updateWeightMutation = useMutation(
		trpc.orders.updateOrderItemWeight.mutationOptions({
			onSuccess: () => {
				toast.success("Peso registrado");
				setActualWeight("");
				setScaleUse(null);
				if (pendingCompletionRef.current) {
					setCompletedOrder(pendingCompletionRef.current);
					pendingCompletionRef.current = null;
					if (completedTimerRef.current)
						clearTimeout(completedTimerRef.current);
					completedTimerRef.current = setTimeout(
						() => setCompletedOrder(null),
						9000,
					);
				}
				void refetchOrders();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const recordBatchMutation = useMutation(
		trpc.inventory.recordWeighingBatch.mutationOptions({
			onSuccess: () => {
				toast.success("Pesaje registrado");
				setBatchProductId(null);
				setBatchPieces("");
				setBatchWeightKg("");
				setBatchApplyToInventory(true);
				setBatchNoPieces(false);
				setOverlay(null);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const productionQueueMutation = useMutation(
		trpc.orders.createProductionWeighing.mutationOptions({
			onSuccess: (data: { id?: number }) => {
				toast.success("Enviado a la cola de pesaje");
				setBatchProductId(null);
				setBatchPieces("");
				setBatchWeightKg("");
				setBatchApplyToInventory(true);
				setBatchNoPieces(false);
				setOverlay(null);
				void refetchOrders();
				if (data?.id) setSelectedOrderId(data.id);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const handleRegisterWeight = useCallback(() => {
		if (!currentItem || !hasValidWeight) return;
		if (updateWeightMutation.isPending) return;
		if (demo) {
			toast.success(`Demostración: se registraría ${netKg.toFixed(3)} kg`);
			return;
		}
		const isProduction = selectedOrder?.notes === "Pesaje de producción";
		if (pendingItems.length <= 1 && selectedOrder && !isProduction) {
			pendingCompletionRef.current = {
				id: selectedOrder.id,
				name: selectedOrder.customer?.name ?? "Pedido",
			};
		} else {
			pendingCompletionRef.current = null;
		}
		updateWeightMutation.mutate({
			orderItemId: currentItem.id,
			actualWeightGrams: Math.round(netKg * 1000),
			scaleReadingId:
				!usingSerialNet && scaleUse && scaleUse.value === actualWeight
					? scaleUse.id
					: undefined,
		});
	}, [
		currentItem,
		hasValidWeight,
		demo,
		netKg,
		selectedOrder,
		pendingItems.length,
		updateWeightMutation,
		usingSerialNet,
		scaleUse,
		actualWeight,
	]);

	const handleCaptureStable = useCallback(() => {
		if (demo) {
			if (!live?.stable || live.overload || live.weightG == null) {
				toast.info("En la demostración el peso de ejemplo ya está capturado");
				return;
			}
			toast.success(
				`Demostración: captura de ${(live.weightG / 1000).toFixed(3)} kg`,
			);
			return;
		}
		controlsRef.current?.captureManual();
	}, [demo, live]);

	const handleUndo = useCallback(() => {
		if (demo) {
			toast.info("En la demostración no se deshacen capturas");
			return;
		}
		void controlsRef.current?.undoLast();
	}, [demo]);

	const handleCaptureTare = () => {
		const gross =
			live?.weightG != null && !manualWeight
				? live.weightG / 1000
				: Number.parseFloat(actualWeight) || 0;
		if (gross <= 0) {
			toast.info("No hay peso en la báscula para tomar como tara");
			return;
		}
		setCustomTare(gross.toFixed(3));
		setContainerId("otro");
		if (manualWeight) setActualWeight("");
		toast.success(`Tara de ${gross.toFixed(3)} kg (recipiente «Otro»)`);
	};

	const handleCaptureTareRef = useRef(handleCaptureTare);
	handleCaptureTareRef.current = handleCaptureTare;

	const handleUseScaleReading = (reading: ScaleReading) => {
		const value = (reading.weight_g / 1000).toFixed(3);
		setManualWeight(true);
		setActualWeight(value);
		setScaleUse({ id: reading.id, value });
		if (reading.net && containerId !== "ninguno") {
			setContainerId("ninguno");
			toast.info(
				"Lectura neta: se quitó el recipiente para no restar la tara dos veces",
			);
		}
	};

	const handlePrevItem = () =>
		setCurrentItemIndex((index) => Math.max(0, index - 1));
	const handleNextItem = () =>
		setCurrentItemIndex((index) =>
			index + 1 < pendingItems.length ? index + 1 : index,
		);

	const cycleContainer = useCallback((direction: number) => {
		setContainerId((current) => {
			const index = CONTAINERS.findIndex(
				(container) => container.id === current,
			);
			return CONTAINERS[
				(index + direction + CONTAINERS.length) % CONTAINERS.length
			].id;
		});
	}, []);

	const tapKey = (key: string) => {
		setManualWeight(true);
		setActualWeight((value) =>
			key === "←"
				? value.slice(0, -1)
				: key === "." && value.includes(".")
					? value
					: value.length < 6
						? value + key
						: value,
		);
	};

	// --- 5 · Venta: renglones ya pesados con el precio del cliente ---------
	const customerId = selectedOrder?.customer_id ?? null;
	const orderDetailQuery = useQuery({
		...trpc.orders.get.queryOptions({ id: selectedOrderId ?? 0 }),
		enabled: !demo && selectedOrderId !== null,
	});
	const customerPricesQuery = useQuery({
		...trpc.customerPrices.getByCustomer.queryOptions({
			customerId: customerId ?? 0,
		}),
		enabled: !demo && customerId !== null,
	});
	const priceRows: CustomerPriceRow[] = demo
		? DEMO_CUSTOMER_PRICES
		: (customerPricesQuery.data ?? []);
	const detailItems = demo
		? (selectedOrder?.orderItems ?? [])
		: (orderDetailQuery.data?.orderItems ?? []);
	const saleLines: SaleLine[] = useMemo(
		() =>
			detailItems
				.filter(
					(item) =>
						item.status !== "PENDIENTE_PESAJE" && Number(item.quantity_kg) > 0,
				)
				.map((item) => {
					const row = priceRows.find(
						(candidate) => candidate.productId === item.product_id,
					);
					// unit_price del pedido está en centavos; resolveDefaultPrice lo convierte.
					const suggested = resolveDefaultPrice(row, item.unit_price);
					const edited = priceEdits[item.id];
					return {
						itemId: item.id,
						name: itemName(item),
						kg: Number(item.quantity_kg) || 0,
						pieces: item.quantity_pieces ?? null,
						price: edited ?? (suggested ? suggested.pricePerKg.toFixed(2) : ""),
						source:
							edited !== undefined ? "manual" : (suggested?.source ?? "manual"),
					};
				}),
		[detailItems, priceRows, priceEdits],
	);
	useEffect(() => {
		setPriceEdits({});
		setSaleIndex(0);
	}, [selectedOrderId]);

	const goToCharge = useCallback(() => {
		if (!selectedOrder) return;
		if (demo) {
			toast.success(
				`Demostración: se abriría el cobro e impresión del pedido #${selectedOrder.id}`,
			);
			return;
		}
		router.push(`/admin/checkout?order=${selectedOrder.id}`);
	}, [demo, router, selectedOrder]);

	const moveSelection = useCallback(
		(direction: -1 | 1) => {
			if (focusedTile === 1) {
				if (orders.length === 0) return;
				const index = Math.max(
					0,
					orders.findIndex((order) => order.id === selectedOrderId),
				);
				const next =
					orders[(index + direction + orders.length) % orders.length];
				setSelectedOrderId(next.id);
				setCurrentItemIndex(0);
				return;
			}
			if (focusedTile === 2 || focusedTile === 3) {
				if (direction < 0) handlePrevItem();
				else handleNextItem();
				return;
			}
			if (focusedTile === 5) {
				setSaleIndex((index) =>
					Math.min(Math.max(0, index + direction), saleLines.length - 1),
				);
				return;
			}
			if (focusedTile === 7 && fnPage === "tema") {
				cycleTheme();
				return;
			}
			cycleContainer(direction);
		},
		[
			focusedTile,
			orders,
			selectedOrderId,
			cycleContainer,
			pendingItems.length,
			saleLines.length,
			fnPage,
			cycleTheme,
		],
	);

	const selectCurrent = useCallback(() => {
		if (focusedTile === 1 && selectedOrderId) {
			setFocusedTile(3);
			return;
		}
		if (focusedTile === 2 || focusedTile === 3) {
			setFocusedTile(4);
			return;
		}
		if (focusedTile === 5) {
			goToCharge();
			return;
		}
		handleRegisterWeight();
	}, [focusedTile, selectedOrderId, handleRegisterWeight, goToCharge]);

	const toggleHold = useCallback(() => {
		setHeldKg((current) => {
			if (current !== null) return null;
			const gross =
				live?.weightG != null && !manualWeight
					? live.weightG / 1000
					: Number.parseFloat(actualWeight) || 0;
			return gross;
		});
	}, [live, manualWeight, actualWeight]);

	const runCommand = useCallback(
		(command: PesajeCommand) => {
			switch (command) {
				case "power":
					if (demo) {
						toast.info("Demostración: no hay puerto serie");
						return;
					}
					if (scaleStatus.connected) controlsRef.current?.disconnect();
					else controlsRef.current?.connect();
					return;
				case "zero":
					setManualWeight(true);
					setActualWeight("");
					setHeldKg(null);
					return;
				case "tare":
					handleCaptureTareRef.current();
					return;
				case "hold":
					toggleHold();
					return;
				case "undo":
					handleUndo();
					return;
				case "charge":
					goToCharge();
					return;
				case "antonella":
					antonella.open();
					return;
				case "classic":
					router.push("/admin/weighing-station");
					return;
			}
		},
		[
			demo,
			scaleStatus.connected,
			toggleHold,
			handleUndo,
			goToCharge,
			antonella,
			router,
		],
	);

	const openPage = useCallback((page: FnPage) => {
		setFnPage(page);
		setFocusedTile(7);
		setOverlay(null);
		if (page === "teclado") {
			setTimeout(() => weightInputRef.current?.focus(), 0);
		}
	}, []);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			const action = matchPesajeShortcut(event, {
				overlayOpen: overlay !== null,
				isPending: updateWeightMutation.isPending,
			});
			if (!action) return;
			event.preventDefault();
			switch (action.type) {
				case "focus-tile":
					setFocusedTile(action.tile);
					setOverlay(null);
					break;
				case "move":
					moveSelection(action.direction);
					break;
				case "move-line":
					if (action.direction < 0) handlePrevItem();
					else handleNextItem();
					break;
				case "confirm":
					selectCurrent();
					break;
				case "capture":
					handleCaptureStable();
					break;
				case "overlay":
					setOverlay((current) =>
						current === action.overlay ? null : action.overlay,
					);
					break;
				case "page":
					openPage(action.page);
					break;
				case "command":
					runCommand(action.command);
					break;
				case "cycle-theme":
					cycleTheme();
					break;
				case "close":
					if (overlay) setOverlay(null);
					else setFnPage("inicio");
					break;
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		overlay,
		moveSelection,
		selectCurrent,
		handleCaptureStable,
		cycleTheme,
		openPage,
		runCommand,
		updateWeightMutation.isPending,
	]);

	const ticketDetailQuery = useQuery({
		...trpc.orders.get.queryOptions({ id: selectedOrderId ?? 0 }),
		enabled: !demo && overlay === "tickets" && selectedOrderId !== null,
	});

	const ticketItems = demo
		? []
		: (ticketDetailQuery.data?.orderItems ?? selectedOrder?.orderItems ?? []);

	const ticketCaptureQueries = useQueries({
		queries: (demo ? [] : ticketItems).map((item) => ({
			...trpc.scaleSerial.lineCaptures.queryOptions({ orderItemId: item.id }),
			enabled: !demo && overlay === "tickets",
		})),
	});

	const ticketLines = useMemo(() => {
		if (demo) return DEMO_TICKET_LINES;
		return ticketItems.map((item, index) => {
			const rows = ticketCaptureQueries[index]?.data ?? [];
			return {
				itemId: item.id,
				name: itemName(item),
				status: item.status,
				captures: rows.map((row) => ({
					eventId: row.eventId,
					weightG: row.weightG,
					tareG: row.tareG,
					containerId: row.containerId,
					netG: captureNetG(row.weightG, row.tareG),
					at: row.capturedAt?.getTime?.() ?? row.receivedAt.getTime(),
				})),
			};
		});
	}, [demo, ticketItems, ticketCaptureQueries]);

	const batchProduct = useMemo(
		() => products.find((product) => product.id === batchProductId) ?? null,
		[products, batchProductId],
	);
	const batchPendingPieces = useMemo(() => {
		if (!batchProduct) return null;
		return Math.max(
			0,
			(batchProduct.stock_pieces ?? 0) - batchProduct.weighed_pieces,
		);
	}, [batchProduct]);

	const sendToQueue = () => {
		if (demo) {
			toast.success("Demostración: se enviaría a la cola de pesaje");
			setOverlay(null);
			return;
		}
		if (!batchProduct) return;
		const pieces = batchNoPieces
			? null
			: Number.parseInt(batchPieces || "0", 10) || 0;
		if (!batchNoPieces && (!pieces || pieces <= 0)) {
			toast.error("Indica las piezas o marca «a granel»");
			return;
		}
		productionQueueMutation.mutate({
			productId: batchProduct.id,
			productName: batchProduct.name,
			pieces,
		});
	};

	const handleRegisterBatch = () => {
		if (demo) {
			toast.success("Demostración: se registraría el pesaje de producción");
			setOverlay(null);
			return;
		}
		if (!batchProductId) return;
		const weight = Number.parseFloat(batchWeightKg);
		const pieces =
			batchPieces.trim() === "" ? 0 : Number.parseInt(batchPieces, 10) || 0;
		if (!Number.isFinite(weight) || weight <= 0) return;
		if (
			batchApplyToInventory &&
			batchPendingPieces !== null &&
			pieces > batchPendingPieces
		) {
			toast.error(
				`Piezas a pesar exceden pendientes (${pieces} > ${batchPendingPieces})`,
			);
			return;
		}
		recordBatchMutation.mutate({
			productId: batchProductId,
			piecesWeighed: Math.max(0, pieces),
			weightKg: weight,
			applyToInventory: batchApplyToInventory,
		});
	};

	const copyDiagnostics = async () => {
		const frames = controlsRef.current?.frames ?? [];
		const text = frames
			.map(
				(frame) =>
					`${new Date(frame.at).toLocaleTimeString("es-MX")} | ${frame.text.replace(/\r/g, "␍").replace(/\n/g, "␊")} | ${frame.hex}`,
			)
			.join("\n");
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			toast.success("Diagnóstico copiado");
			setTimeout(() => setCopied(false), 1500);
		} catch {
			toast.error("No se pudo copiar el diagnóstico");
		}
	};

	const liveWeightG = live?.weightG ?? (demo ? DEMO_LIVE.weightG : null);
	const captures: PesajeCapture[] = demo ? DEMO_CAPTURES : serialCaptures;

	// Display 4 = la lectura EN VIVO: bruto en vivo, tara del recipiente
	// elegido y neto = bruto − tara. Lo acumulado (suma de capturas) se muestra
	// aparte en 2 y en la pantalla 7; antes se mezclaba la tara acumulada
	// (2 × 2.500 = 5.000) con el bruto en vivo.
	const liveIsNet = live?.net === true && !manualWeight;
	const liveGrossKg =
		heldKg ??
		(liveWeightG != null && !manualWeight ? liveWeightG / 1000 : manualGrossKg);
	const liveTareKg = liveIsNet ? 0 : tareKg;
	const liveNetKg = Math.max(0, liveGrossKg - liveTareKg);
	const accumulatedNetKg = usingSerialNet ? netKg : 0;
	const captureCount = serialTotals?.count ?? captures.length;
	const connected = scaleStatus.connected || demo;
	const scaleLabel = demo
		? "Demostración"
		: getStatusLabel(
				scaleStatus.status,
				scaleStatus.supported,
				controlsRef.current?.settings.simulator ?? false,
			);

	const indicators: IqyIndicator[] = [];
	if (Math.abs(liveGrossKg) < 0.005) indicators.push("cero");
	if (liveTareKg > 0) indicators.push("tara");
	if ((live?.stable ?? false) || (manualWeight && manualGrossKg > 0)) {
		indicators.push("estable");
	}
	if (heldKg !== null) indicators.push("hold");
	if (captureCount > 0) indicators.push("mmas");
	if (connected) indicators.push("bateria");

	const iqyButtons = [
		{
			id: "power",
			top: "ON",
			bottom: "OFF",
			color: "red" as const,
			shortcut: "Súper+⇧B",
			label: connected ? "Desconectar báscula" : "Conectar báscula",
			onPress: () => runCommand("power"),
		},
		{
			id: "zero",
			top: "→0←",
			bottom: "▲",
			color: "red" as const,
			shortcut: "Súper+0",
			label: "Cero: limpiar peso",
			onPress: () => runCommand("zero"),
		},
		{
			id: "tare",
			top: "→T←",
			bottom: "▼",
			color: "red" as const,
			shortcut: "Súper+R",
			label: "Tara: tomar el peso actual",
			onPress: () => runCommand("tare"),
		},
		{
			id: "mplus",
			top: "M+",
			bottom: "◀",
			color: "orange" as const,
			shortcut: "Espacio",
			label: "Capturar peso estable",
			onPress: handleCaptureStable,
		},
		{
			id: "hold",
			top: "HOLD",
			bottom: "▶",
			color: "orange" as const,
			shortcut: "Súper+L",
			label: heldKg !== null ? "Soltar HOLD" : "Congelar display",
			onPress: () => runCommand("hold"),
		},
		{
			id: "f",
			top: "f",
			bottom: "↵",
			color: "cyan" as const,
			shortcut: "Enter",
			label: "Registrar peso del renglón",
			onPress: handleRegisterWeight,
			disabled: !hasValidWeight || currentItem === null,
		},
	];

	const pageKey = (page: FnPage, label: string, key: string): FnKey => ({
		id: page,
		label,
		shortcut: shortcutLabel(key),
		active: fnPage === page,
		onPress: () => openPage(page),
	});
	const leftKeys: FnKey[] = [
		pageKey("inicio", "Inicio", "H"),
		pageKey("recipiente", "Tara", "C"),
		pageKey("conexion", "Serial", "B"),
		pageKey("diagnostico", "Tramas", "X"),
		pageKey("tema", "Tema", "M"),
	];
	const rightKeys: FnKey[] = [
		{
			id: "tickets",
			label: "Tickets",
			shortcut: shortcutLabel("T"),
			onPress: () => setOverlay("tickets"),
		},
		{
			id: "orders",
			label: "Cola",
			shortcut: shortcutLabel("O"),
			onPress: () => setOverlay("orders"),
		},
		{
			id: "batch",
			label: "Producción",
			shortcut: shortcutLabel("P"),
			onPress: () => setOverlay("batch"),
		},
		pageKey("teclado", "Teclado", "N"),
		pageKey("atajos", "Atajos", "/"),
	];
	const bottomKeys: FnKey[] = [
		{
			id: "capture",
			label: "M+ Capturar",
			shortcut: "Espacio",
			tone: "orange",
			wide: true,
			onPress: handleCaptureStable,
		},
		{
			id: "register",
			label: "Registrar peso",
			shortcut: "Enter",
			tone: "green",
			wide: true,
			disabled: !hasValidWeight || currentItem === null,
			onPress: handleRegisterWeight,
		},
		{
			id: "undo",
			label: "Deshacer",
			shortcut: shortcutLabel("Z"),
			onPress: () => runCommand("undo"),
		},
		{
			id: "charge",
			label: "Cobro",
			shortcut: shortcutLabel("G"),
			tone: "cyan",
			disabled: !selectedOrder,
			onPress: () => runCommand("charge"),
		},
		{
			id: "antonella",
			label: "iAntonella",
			shortcut: shortcutLabel("I"),
			onPress: () => runCommand("antonella"),
		},
		{
			id: "classic",
			label: "Clásica",
			shortcut: shortcutLabel("V"),
			onPress: () => runCommand("classic"),
		},
		{
			id: "esc",
			label: "Esc",
			shortcut: "Esc",
			tone: "red",
			onPress: () => {
				setOverlay(null);
				setFnPage("inicio");
			},
		},
	];

	const containerLabel =
		containerId === "otro"
			? `Otro · ${tareKg.toFixed(3)} kg`
			: `${containerDef.label} · ${tareKg.toFixed(3)} kg`;

	const fnContent = (() => {
		switch (fnPage) {
			case "recipiente":
				return (
					<RecipientePage
						containerId={containerId}
						customTare={customTare}
						customTareInvalid={customTareInvalid}
						onContainer={setContainerId}
						onCustomTare={setCustomTare}
						onTareFromWeight={handleCaptureTare}
					/>
				);
			case "tema":
				return <TemaPage theme={theme} onTheme={setTheme} />;
			case "atajos":
				return <AtajosPage />;
			case "teclado":
				return (
					<TecladoPage
						value={actualWeight}
						onValue={(value) => {
							setManualWeight(true);
							setActualWeight(value);
						}}
						onKey={tapKey}
						inputRef={weightInputRef}
						extra={
							demo ? null : (
								<FnFormCard>
									<ScaleReadingCard
										onUse={handleUseScaleReading}
										usedReadingId={
											scaleUse && scaleUse.value === actualWeight
												? scaleUse.id
												: null
										}
									/>
								</FnFormCard>
							)
						}
					/>
				);
			case "conexion":
				return (
					<div>
						<FnScreenRowsStatus
							label={scaleLabel}
							detail={scaleStatus.statusDetail}
							connected={connected}
						/>
						{demo ? (
							<p className="mt-3 text-[11px] opacity-80">
								Modo demostración: no hay puerto serie. En la estación real aquí
								se conecta la I-QY por USB-RS232 (Web Serial) y se ajustan
								baudios, paridad y formato.
							</p>
						) : (
							<FnFormCard>
								<div className="mb-3 flex gap-2">
									{scaleStatus.connected ? (
										<Button
											type="button"
											variant="outline"
											onClick={() => controlsRef.current?.disconnect()}
										>
											Desconectar
										</Button>
									) : (
										<Button
											type="button"
											onClick={() => controlsRef.current?.connect()}
										>
											Conectar báscula
										</Button>
									)}
								</div>
								<ScaleSettingsForm
									settings={controlsRef.current?.settings ?? scaleSettings}
									setSettings={(partial) => {
										controlsRef.current?.setSettings(partial);
										setScaleSettingsState((current) => ({
											...current,
											...partial,
										}));
									}}
								/>
							</FnFormCard>
						)}
					</div>
				);
			case "diagnostico":
				return demo ? (
					<p className="text-[11px] opacity-80">
						Modo demostración: sin tramas. Con la báscula conectada se ven las
						tramas crudas (texto y hex) y se pueden copiar.
					</p>
				) : (
					<FnFormCard>
						<DiagnosticsPanel
							frames={controlsRef.current?.frames ?? []}
							onCopy={copyDiagnostics}
							onClear={() => controlsRef.current?.clearFrames()}
							copied={copied}
						/>
					</FnFormCard>
				);
			default:
				return (
					<InicioPage
						productName={currentItem ? itemName(currentItem) : null}
						captures={captures}
						containerLabels={CONTAINER_LABELS}
						accumulatedNetKg={accumulatedNetKg}
						liveTareLabel={containerLabel}
						scaleLabel={scaleLabel}
						onUndo={handleUndo}
					/>
				);
		}
	})();

	const chargeHint = !selectedOrder
		? "Elige un pedido en 1."
		: pendingItems.length > 0 &&
				selectedOrder.orderItems.some(
					(item) => item.status === "PENDIENTE_PESAJE",
				)
			? `Faltan ${pendingItems.length} por pesar; se cobra lo pesado.`
			: "Todo pesado: listo para cobrar, imprimir y enviar.";

	return (
		<div
			data-pesaje-theme={theme}
			data-pesaje-station=""
			className="h-full min-h-0 bg-background text-foreground"
		>
			{!demo ? (
				<ScaleSerialPanel
					hidden
					line={serialLine}
					container={serialContainer}
					containerLabels={CONTAINER_LABELS}
					onCapturesTotal={setSerialTotals}
					onLiveChange={setLive}
					onCapturesChange={(items: MergedCapture[]) =>
						setSerialCaptures(items)
					}
					onStatusChange={setScaleStatus}
					controlsRef={controlsRef}
				/>
			) : null}

			{/* Carcasa del equipo: todo vive dentro del marco */}
			<div className="pesaje-housing flex h-full min-h-0 flex-col gap-2 rounded-[1.75rem] border-[3px] p-2 sm:p-3">
				<div className="flex shrink-0 items-center justify-between gap-3 px-2 font-mono text-[10px] uppercase tracking-[0.2em]">
					<span className="font-black text-[#f39a1e] text-xs tracking-[0.12em]">
						Cárnicos Gustavo · Estación de pesaje
					</span>
					<span className="flex items-center gap-3 text-[#9aa4ae]">
						<span className="flex items-center gap-1.5">
							<span
								aria-hidden="true"
								className={cn(
									"size-2 rounded-full",
									connected
										? "bg-[#3fb950] shadow-[0_0_6px_#3fb950]"
										: "bg-[#6e7681]",
								)}
							/>
							{scaleLabel}
						</span>
						<span>{orders.length} pedidos</span>
						<span>{themeLabel}</span>
					</span>
				</div>

				{/* Fila superior: 1 | (2 · 3 / 4) | 5 */}
				<div className="grid min-h-0 flex-[1.7] grid-cols-[minmax(10rem,16fr)_minmax(0,70fr)_minmax(12rem,14fr)] gap-2">
					<OrdersPanel
						orders={orders}
						selectedOrderId={selectedOrderId}
						newOrderIds={newOrderIds}
						focused={focusedTile === 1}
						onSelect={(id) => {
							setSelectedOrderId(id);
							setCurrentItemIndex(0);
							setFocusedTile(1);
						}}
						onFocusPanel={() => setFocusedTile(1)}
					/>
					<div className="flex min-h-0 min-w-0 flex-col gap-2">
						<div className="grid h-[24%] min-h-[6rem] shrink-0 grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-2 [@media(max-height:860px)]:h-[22%] [@media(max-height:860px)]:min-h-[5.25rem]">
							<OrderPanel
								order={selectedOrder}
								currentItem={currentItem}
								accumulatedNetKg={accumulatedNetKg}
								captureCount={captureCount}
								locale={locale}
								focused={focusedTile === 2}
								onFocusPanel={() => setFocusedTile(2)}
							/>
							<PendingPanel
								items={pendingItems.filter(
									(item) => item.status === "PENDIENTE_PESAJE",
								)}
								activeItemId={currentItem?.id ?? null}
								focused={focusedTile === 3}
								onSelect={(id) => {
									const index = pendingItems.findIndex(
										(item) => item.id === id,
									);
									if (index >= 0) setCurrentItemIndex(index);
									setFocusedTile(3);
								}}
								onFocusPanel={() => setFocusedTile(3)}
							/>
						</div>
						<div className="min-h-0 flex-1">
							<IqyDisplay
								valueText={
									live?.overload && !manualWeight ? "" : liveNetKg.toFixed(3)
								}
								overload={(live?.overload ?? false) && !manualWeight}
								digits={6}
								unit="kg"
								active={indicators}
								focused={focusedTile === 4}
								onFocusPanel={() => setFocusedTile(4)}
								subline={{
									gross: `${liveGrossKg.toFixed(3)} kg`,
									tare: `${liveTareKg.toFixed(3)} kg ${liveIsNet ? "(neto de báscula)" : containerDef.label}`,
									net: `${liveNetKg.toFixed(3)} kg`,
								}}
								buttons={iqyButtons}
							/>
						</div>
					</div>
					<SalePanel
						customerName={selectedOrder ? orderTitle(selectedOrder) : null}
						lines={saleLines}
						focused={focusedTile === 5}
						activeIndex={saleIndex}
						loadingPrices={
							!demo && customerPricesQuery.isLoading && customerId !== null
						}
						formatMoney={(cents) => formatCurrency(cents, locale)}
						onPriceChange={(itemId, value) =>
							setPriceEdits((current) => ({ ...current, [itemId]: value }))
						}
						onFocusPanel={() => setFocusedTile(5)}
						onCharge={goToCharge}
						onOpenTickets={() => setOverlay("tickets")}
						canCharge={selectedOrder !== null && saleLines.length > 0}
						chargeHint={chargeHint}
					/>
				</div>

				{/* 7 · Pantalla de funciones con sus botones alrededor */}
				<div className="min-h-0 flex-[1] [@media(max-height:860px)]:flex-[1.05]">
					<FunctionScreen
						title={`7 · ${FN_PAGE_TITLES[fnPage]}`}
						subtitle="Súper+7 · Esc vuelve a Inicio"
						left={leftKeys}
						right={rightKeys}
						bottom={bottomKeys}
						focused={focusedTile === 7}
						onFocusPanel={() => setFocusedTile(7)}
					>
						{fnContent}
					</FunctionScreen>
				</div>
			</div>

			{overlay === "tickets" ? (
				<TicketsOverlay
					orderLabel={
						selectedOrder
							? `${orderTitle(selectedOrder)} · Pedido #${selectedOrder.id}`
							: "Sin pedido seleccionado"
					}
					lines={selectedOrder ? ticketLines : []}
					containerLabels={CONTAINER_LABELS}
					onClose={() => setOverlay(null)}
				/>
			) : null}
			{overlay === "orders" ? (
				<OrdersOverlay
					orders={orders}
					selectedOrderId={selectedOrderId}
					onSelect={(id) => {
						setSelectedOrderId(id);
						setCurrentItemIndex(0);
						setOverlay(null);
						setFocusedTile(2);
					}}
					onClose={() => setOverlay(null)}
				/>
			) : null}
			<Dialog
				open={overlay === "batch"}
				onOpenChange={(open) => setOverlay(open ? "batch" : null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Pesaje de producción</DialogTitle>
						<DialogDescription>
							Registra el peso total de un lote (X piezas) de un producto.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4">
						<div className="space-y-1">
							<Label>Producto</Label>
							<Combobox
								items={products.map((product) => ({
									id: product.id,
									name: product.name,
								}))}
								placeholder="Selecciona producto"
								onSelect={(id) => {
									const productId = Number(id);
									setBatchProductId(productId);
									const product = products.find(
										(item) => item.id === productId,
									);
									setBatchNoPieces(
										product ? product.is_sellable_by_unit === false : false,
									);
								}}
							/>
						</div>
						<label className="flex cursor-pointer items-center gap-2 rounded-md border bg-muted/20 p-3 text-sm">
							<input
								type="checkbox"
								className="h-4 w-4 accent-primary"
								checked={batchNoPieces}
								onChange={(event) => setBatchNoPieces(event.target.checked)}
							/>
							<span>
								A granel — pesar por tara <strong>sin contar piezas</strong>{" "}
								(desgrase, hueso pelón, patas en tara…)
							</span>
						</label>
						{batchProduct ? (
							<div className="rounded-md border bg-muted/30 p-3 text-sm">
								<div className="flex items-center justify-between">
									<span className="text-muted-foreground">En stock</span>
									<span className="font-medium">
										{batchProduct.stock_pieces} piezas
									</span>
								</div>
								<div className="flex items-center justify-between">
									<span className="text-muted-foreground">Ya pesadas</span>
									<span className="font-medium">
										{batchProduct.weighed_pieces} piezas
									</span>
								</div>
								<div className="flex items-center justify-between">
									<span className="text-muted-foreground">Pendientes</span>
									<span className="font-medium">
										{batchPendingPieces ?? 0} piezas
									</span>
								</div>
							</div>
						) : null}
						<div
							className={cn(
								"grid gap-3",
								batchNoPieces ? "grid-cols-1" : "grid-cols-2",
							)}
						>
							{batchNoPieces ? null : (
								<div className="space-y-1">
									<Label>Piezas</Label>
									<Input
										type="number"
										inputMode="numeric"
										min="0"
										step="1"
										value={batchPieces}
										onChange={(event) => setBatchPieces(event.target.value)}
										onFocus={(event) => event.currentTarget.select()}
									/>
								</div>
							)}
							<div className="space-y-1">
								<Label>Peso total (kg)</Label>
								<Input
									type="number"
									inputMode="decimal"
									min="0"
									step="0.001"
									value={batchWeightKg}
									onChange={(event) => setBatchWeightKg(event.target.value)}
									onFocus={(event) => event.currentTarget.select()}
								/>
							</div>
						</div>
						<div className="space-y-1">
							<Label>¿Ya se había pesado antes?</Label>
							<Select
								value={batchApplyToInventory ? "NO" : "SI"}
								onValueChange={(value) =>
									setBatchApplyToInventory(value === "NO")
								}
							>
								<SelectTrigger>
									<SelectValue placeholder="Selecciona" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="NO">
										No, primera vez (sumar kg al inventario)
									</SelectItem>
									<SelectItem value="SI">
										Sí, ya estaba pesado (solo para despacho)
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3 text-muted-foreground text-sm">
							<PackageIcon className="h-4 w-4 shrink-0" />
							<span>
								«Primera vez» suma el peso al stock_kg del producto. «Ya estaba
								pesado» no modifica el inventario.
							</span>
						</div>
					</div>
					<DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
						<Button variant="secondary" onClick={() => setOverlay(null)}>
							Cancelar
						</Button>
						<Button
							variant="outline"
							onClick={sendToQueue}
							disabled={
								productionQueueMutation.isPending ||
								(!demo &&
									(!batchProductId ||
										(!batchNoPieces &&
											!(Number.parseInt(batchPieces || "0", 10) > 0))))
							}
						>
							<ScaleIcon className="mr-2 h-4 w-4" />
							{productionQueueMutation.isPending
								? "Enviando…"
								: "Enviar a cola de pesaje"}
						</Button>
						<Button
							onClick={handleRegisterBatch}
							disabled={
								recordBatchMutation.isPending ||
								(!demo &&
									(!batchProductId || !(Number.parseFloat(batchWeightKg) > 0)))
							}
						>
							{recordBatchMutation.isPending
								? "Registrando…"
								: "Registrar pesaje"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{completedOrder ? (
				<div className="fade-in slide-in-from-bottom-4 fixed right-6 bottom-6 z-50 animate-in">
					<Link href={`/admin/checkout?order=${completedOrder.id}`}>
						<Button
							size="lg"
							className="h-14 rounded-2xl bg-green-600 px-6 font-bold text-base shadow-xl hover:bg-green-700"
							onClick={() => setCompletedOrder(null)}
						>
							<CheckCircleIcon className="mr-2 h-5 w-5" />
							Cobrar pedido #{completedOrder.id} ({completedOrder.name})
						</Button>
					</Link>
				</div>
			) : null}
		</div>
	);
}

function FnScreenRowsStatus({
	label,
	detail,
	connected,
}: {
	label: string;
	detail: string | null;
	connected: boolean;
}) {
	return (
		<div className="flex items-center gap-2 text-xs">
			<span
				aria-hidden="true"
				className={cn(
					"size-2 rounded-full",
					connected ? "bg-[#9be59b] shadow-[0_0_6px_#9be59b]" : "bg-[#4d7652]",
				)}
			/>
			<span className="font-bold uppercase tracking-[0.12em]">{label}</span>
			{detail ? <span className="opacity-70">· {detail}</span> : null}
		</div>
	);
}
