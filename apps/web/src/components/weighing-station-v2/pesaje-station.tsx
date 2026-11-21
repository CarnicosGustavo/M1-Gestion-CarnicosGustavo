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
import {
	DEMO_CAPTURES,
	DEMO_LIVE,
	DEMO_ORDERS,
	DEMO_TICKET_LINES,
} from "./demo-data";
import { CheatsheetOverlay } from "./overlays/cheatsheet-overlay";
import { OrdersOverlay } from "./overlays/orders-overlay";
import { ScaleOverlay } from "./overlays/scale-overlay";
import { TicketsOverlay } from "./overlays/tickets-overlay";
import { usePesajeTheme } from "./pesaje-themes";
import "./pesaje-themes.css";
import { matchPesajeShortcut } from "./shortcuts";
import { CapturesTile } from "./tiles/captures-tile";
import { OrderLinesTile } from "./tiles/order-lines-tile";
import { OrdersTile } from "./tiles/orders-tile";
import { StatusStrip } from "./tiles/status-strip";
import { WeightTile } from "./tiles/weight-tile";
import {
	CONTAINERS,
	type ContainerId,
	captureNetG,
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
	const { theme, cycleTheme } = usePesajeTheme();
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
	const [showKeypad, setShowKeypad] = useState(false);
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
	const [focusedTile, setFocusedTile] = useState<TileId>(3);
	const [overlay, setOverlay] = useState<PesajeOverlay>(null);
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
	const tareKg =
		containerId === "otro"
			? Number.parseFloat(customTare) || 0
			: (containerDef.tare ?? 0);

	const usingSerialNet =
		!manualWeight && serialTotals !== null && serialTotals.count > 0;
	const manualGrossKg = Number.parseFloat(actualWeight) || 0;
	const grossKg = usingSerialNet ? serialTotals.grossG / 1000 : manualGrossKg;
	const appliedTareKg = usingSerialNet ? serialTotals.tareG / 1000 : tareKg;
	const netKg = usingSerialNet
		? serialTotals.netG / 1000
		: Math.max(0, manualGrossKg - tareKg);
	const hasValidWeight = netKg > 0;

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
		if (!actualWeight || Number.parseFloat(actualWeight) <= 0) return;
		setCustomTare(Number.parseFloat(actualWeight).toFixed(3));
		setContainerId("otro");
		setActualWeight("");
	};

	const handleTare = () => setActualWeight("");

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
			if (focusedTile === 2) {
				if (direction < 0) handlePrevItem();
				else handleNextItem();
				return;
			}
			if (focusedTile === 3) {
				cycleContainer(direction);
			}
		},
		[focusedTile, orders, selectedOrderId, cycleContainer, pendingItems.length],
	);

	const selectCurrent = useCallback(() => {
		if (focusedTile === 1 && selectedOrderId) {
			setFocusedTile(2);
			return;
		}
		if (focusedTile === 3) {
			handleRegisterWeight();
		}
	}, [focusedTile, selectedOrderId, handleRegisterWeight]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			const action = matchPesajeShortcut(event, {
				overlayOpen: overlay !== null,
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
				case "cycle-theme":
					cycleTheme();
					toast.success("Tema actualizado");
					break;
				case "close":
					setOverlay(null);
					break;
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [overlay, moveSelection, selectCurrent, handleCaptureStable, cycleTheme]);

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
	const displayGross = usingSerialNet
		? grossKg
		: liveWeightG != null && !manualWeight
			? liveWeightG / 1000
			: grossKg;
	const displayNet = usingSerialNet
		? netKg
		: liveWeightG != null && !manualWeight
			? Math.max(0, liveWeightG / 1000 - tareKg)
			: netKg;
	const displayTare = appliedTareKg;

	return (
		<div
			data-pesaje-theme={theme}
			className="flex h-full min-h-0 flex-col gap-2 bg-background text-foreground"
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

			<div
				className={cn(
					"shrink-0",
					focusedTile === 5 &&
						"rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background",
				)}
			>
				<StatusStrip
					orderCount={orders.length}
					scaleLabel={
						demo
							? "Demostración"
							: getStatusLabel(
									scaleStatus.status,
									scaleStatus.supported,
									controlsRef.current?.settings.simulator ?? false,
								)
					}
					scaleConnected={scaleStatus.connected || demo}
					statusDetail={scaleStatus.statusDetail}
					themeLabel={themeLabel}
					onOpenCheatsheet={() => setOverlay("cheatsheet")}
					onAsk={(question) => antonella.ask(question)}
				/>
			</div>

			<div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-[minmax(16rem,22%)_minmax(0,1fr)_minmax(18rem,28%)]">
				<OrdersTile
					orders={orders}
					selectedOrderId={selectedOrderId}
					focused={focusedTile === 1}
					newOrderIds={newOrderIds}
					onSelect={(id) => {
						setSelectedOrderId(id);
						setCurrentItemIndex(0);
						setFocusedTile(1);
					}}
					onFocusTile={() => setFocusedTile(1)}
				/>
				<OrderLinesTile
					order={selectedOrder}
					items={pendingItems}
					activeItemId={currentItem?.id ?? null}
					focused={focusedTile === 2}
					lineTotals={serialTotals}
					locale={locale}
					onSelectItem={(id) => {
						const index = pendingItems.findIndex((item) => item.id === id);
						if (index >= 0) setCurrentItemIndex(index);
						setFocusedTile(2);
					}}
					onFocusTile={() => setFocusedTile(2)}
				/>
				<CapturesTile
					focused={focusedTile === 4}
					productName={currentItem ? itemName(currentItem) : null}
					captures={captures}
					containerLabels={CONTAINER_LABELS}
					onUndo={handleUndo}
					onFocusTile={() => setFocusedTile(4)}
				/>
			</div>

			<div className="min-h-0 shrink-0 basis-[42%] overflow-hidden">
				<WeightTile
					focused={focusedTile === 3}
					liveWeightG={liveWeightG}
					liveStable={live?.stable ?? false}
					liveOverload={live?.overload ?? false}
					connected={scaleStatus.connected || demo}
					grossKg={displayGross}
					tareKg={displayTare}
					netKg={displayNet}
					usingSerialNet={usingSerialNet}
					captureCount={serialTotals?.count ?? captures.length}
					containerId={containerId}
					containers={CONTAINERS}
					customTare={customTare}
					actualWeight={actualWeight}
					showKeypad={showKeypad}
					canRegister={hasValidWeight && currentItem !== null}
					productName={currentItem ? itemName(currentItem) : null}
					onFocusTile={() => setFocusedTile(3)}
					onContainerId={(id) => setContainerId(id as ContainerId)}
					onCustomTare={setCustomTare}
					onActualWeight={(value) => {
						setManualWeight(true);
						setActualWeight(value);
					}}
					onToggleKeypad={() => setShowKeypad((value) => !value)}
					onCaptureTare={handleCaptureTare}
					onTare={handleTare}
					onRegister={handleRegisterWeight}
					onCaptureStable={handleCaptureStable}
					onKeypad={tapKey}
					weightInputRef={weightInputRef}
					extra={
						demo ? null : (
							<ScaleReadingCard
								onUse={handleUseScaleReading}
								usedReadingId={
									scaleUse && scaleUse.value === actualWeight
										? scaleUse.id
										: null
								}
							/>
						)
					}
				/>
			</div>

			<div className="flex shrink-0 items-center justify-between gap-2 text-muted-foreground text-xs">
				<Link
					href="/admin/weighing-station"
					className="rounded px-1 underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
				>
					Versión clásica
				</Link>
				<span>Súper o Alt + T tickets · B báscula · / atajos</span>
				<Button
					type="button"
					size="sm"
					variant="outline"
					onClick={() => setOverlay("batch")}
				>
					<ScaleIcon className="mr-1 h-3.5 w-3.5" />
					Pesaje de producción
				</Button>
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
			{overlay === "cheatsheet" ? (
				<CheatsheetOverlay onClose={() => setOverlay(null)} />
			) : null}
			{overlay === "scale" ? (
				<ScaleOverlay onClose={() => setOverlay(null)}>
					{demo ? (
						<p className="text-muted-foreground text-sm">
							Modo demostración: no hay puerto serie. En la estación real, aquí
							aparecen la conexión Web Serial, los ajustes y el diagnóstico de
							tramas.
						</p>
					) : (
						<div className="space-y-4">
							<div className="flex flex-wrap gap-2">
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
								{scaleStatus.statusDetail ? (
									<p className="text-muted-foreground text-sm">
										{scaleStatus.statusDetail}
									</p>
								) : null}
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
							<DiagnosticsPanel
								frames={controlsRef.current?.frames ?? []}
								onCopy={copyDiagnostics}
								onClear={() => controlsRef.current?.clearFrames()}
								copied={copied}
							/>
						</div>
					)}
				</ScaleOverlay>
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
