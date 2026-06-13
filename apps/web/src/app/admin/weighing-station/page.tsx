"use client";

import { Badge } from "@finopenpos/ui/components/badge";
import { Button } from "@finopenpos/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@finopenpos/ui/components/card";
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
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import { cn } from "@finopenpos/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CheckCircleIcon,
	ChevronLeftIcon,
	ChevronRight,
	ChevronRightIcon,
	MessageSquareIcon,
	PackageIcon,
	PencilIcon,
	ScaleIcon,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AntonellaSlot } from "@/components/antonella-slot";
import { useRealtimeTable } from "@/lib/supabase/use-realtime-table";
import { useTRPC } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Contenedores / Tara predefinida
// ---------------------------------------------------------------------------
const CONTAINERS = [
	{ id: "ninguno", label: "Sin recipiente", tare: 0 },
	{ id: "tambo_azul", label: "Tambo Azul", tare: 2.5 },
	{ id: "tara", label: "Tara", tare: 1.2 },
	{ id: "cubeta", label: "Cubeta", tare: 0.9 },
	{ id: "otro", label: "Otro", tare: null },
] as const;

type ContainerId = (typeof CONTAINERS)[number]["id"];

// ---------------------------------------------------------------------------

export default function WeighingStationPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const t = useTranslations("pos");
	const tc = useTranslations("common");
	const locale = useLocale();

	// Orden seleccionada
	const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
	// Índice del artículo actual dentro de los pendientes
	const [currentItemIndex, setCurrentItemIndex] = useState(0);

	// Peso bruto ingresado
	const [actualWeight, setActualWeight] = useState("");

	// Contenedor / Tara
	const [containerId, setContainerId] = useState<ContainerId>("ninguno");
	const [customTare, setCustomTare] = useState("0.000");

	// Pedido recién completado (para el botón flotante a cobro)
	const [completedOrder, setCompletedOrder] = useState<{
		id: number;
		name: string;
	} | null>(null);
	const pendingCompletionRef = useRef<{ id: number; name: string } | null>(
		null,
	);
	const completedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Diálogo de pesaje por lote
	const [batchOpen, setBatchOpen] = useState(false);
	const [batchProductId, setBatchProductId] = useState<number | null>(null);
	const [batchPieces, setBatchPieces] = useState("");
	const [batchWeightKg, setBatchWeightKg] = useState("");
	const [batchApplyToInventory, setBatchApplyToInventory] = useState(true);
	// Producto a granel: se pesa por tara, sin contar piezas (DESGRASE, HUESO…)
	const [batchNoPieces, setBatchNoPieces] = useState(false);

	// ---------------------------------------------------------------------------
	// Queries
	// ---------------------------------------------------------------------------
	const {
		data: orders = [],
		isLoading: isLoadingOrders,
		refetch: refetchOrders,
	} = useQuery({
		...trpc.orders.getPendingWeighingOrders.queryOptions(),
		// Respaldo: refresca por polling si Realtime no está disponible
		refetchInterval: 8000,
	});

	// Realtime: refresca al instante cuando cambian pedidos o sus artículos.
	// No-op silencioso si Supabase no está configurado (queda el polling).
	const invalidatePendingWeighing = useCallback(() => {
		queryClient.invalidateQueries({
			queryKey: trpc.orders.getPendingWeighingOrders.queryOptions().queryKey,
		});
	}, [queryClient, trpc]);
	useRealtimeTable({ table: "orders", onChange: invalidatePendingWeighing });
	useRealtimeTable({
		table: "order_items",
		onChange: invalidatePendingWeighing,
	});

	// Detección de pedidos nuevos → alerta verde parpadeante por 3s
	const [newOrderIds, setNewOrderIds] = useState<Set<number>>(new Set());
	const prevOrderIdsRef = useRef<Set<number> | null>(null);
	useEffect(() => {
		const currentIds = new Set(orders.map((o) => o.id));
		const prev = prevOrderIdsRef.current;
		if (prev) {
			const fresh = [...currentIds].filter((id) => !prev.has(id));
			if (fresh.length > 0) {
				setNewOrderIds((s) => {
					const next = new Set(s);
					fresh.forEach((id) => next.add(id));
					return next;
				});
				const first = orders.find((o) => o.id === fresh[0]);
				toast.success(
					`Nuevo pedido #${fresh[0]}${first?.customer?.name ? ` – ${first.customer.name}` : ""}`,
				);
				// Quitar el parpadeo después de 3 segundos
				setTimeout(() => {
					setNewOrderIds((s) => {
						const next = new Set(s);
						fresh.forEach((id) => next.delete(id));
						return next;
					});
				}, 3000);
			}
		}
		prevOrderIdsRef.current = currentIds;
	}, [orders]);

	const { data: products = [] } = useQuery(trpc.products.list.queryOptions());

	// ---------------------------------------------------------------------------
	// Derivados de orden / artículo
	// ---------------------------------------------------------------------------
	const selectedOrder = useMemo(
		() => orders.find((o) => o.id === selectedOrderId),
		[orders, selectedOrderId],
	);

	const pendingItems = useMemo(
		() =>
			selectedOrder?.orderItems?.filter(
				(item) => item.status === "PENDIENTE_PESAJE",
			) ?? [],
		[selectedOrder],
	);

	const clampedIndex = Math.min(
		currentItemIndex,
		Math.max(0, pendingItems.length - 1),
	);
	const currentItem = pendingItems[clampedIndex] ?? null;

	// Deseleccionar orden cuando ya no queden artículos pendientes
	useEffect(() => {
		if (selectedOrderId && pendingItems.length === 0 && !isLoadingOrders) {
			setSelectedOrderId(null);
			setCurrentItemIndex(0);
		}
	}, [pendingItems.length, selectedOrderId, isLoadingOrders]);

	// Resetear índice al cambiar de orden
	useEffect(() => {
		setCurrentItemIndex(0);
		setActualWeight("");
	}, [selectedOrderId]);

	// ---------------------------------------------------------------------------
	// Cálculo de tara / neto
	// ---------------------------------------------------------------------------
	const containerDef = CONTAINERS.find((c) => c.id === containerId)!;
	const tareKg =
		containerId === "otro"
			? Number.parseFloat(customTare) || 0
			: (containerDef.tare ?? 0);

	const grossKg = Number.parseFloat(actualWeight) || 0;
	const netKg = Math.max(0, grossKg - tareKg);
	const hasValidWeight = netKg > 0;

	// ---------------------------------------------------------------------------
	// Mutations
	// ---------------------------------------------------------------------------
	const updateWeightMutation = useMutation(
		trpc.orders.updateOrderItemWeight.mutationOptions({
			onSuccess: () => {
				toast.success(t("weighed"));
				setActualWeight("");
				// Si este era el último artículo por pesar, el pedido quedó listo
				// para cobro: mostrar botón flotante a /admin/checkout por unos segundos.
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
				refetchOrders();
			},
			onError: (error) => {
				toast.error(error.message);
			},
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
				setBatchOpen(false);
				queryClient.invalidateQueries({
					queryKey: trpc.products.list.queryKey(),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.products.disassemblyDashboard.queryKey(),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.inventory.status.queryKey(),
				});
			},
			onError: (error) => {
				toast.error(error.message);
			},
		}),
	);

	// Envía el producto a la cola de la estación como "Pesaje de producción"
	const productionQueueMutation = useMutation(
		trpc.orders.createProductionWeighing.mutationOptions({
			onSuccess: (data: any) => {
				toast.success("Enviado a la cola de pesaje");
				setBatchProductId(null);
				setBatchPieces("");
				setBatchWeightKg("");
				setBatchApplyToInventory(true);
				setBatchNoPieces(false);
				setBatchOpen(false);
				refetchOrders();
				if (data?.id) setSelectedOrderId(data.id);
			},
			onError: (error) => {
				toast.error(error.message);
			},
		}),
	);

	const sendToQueue = () => {
		if (!batchProduct) return;
		const pieces = batchNoPieces
			? null
			: Number.parseInt(batchPieces || "0", 10) || 0;
		if (!batchNoPieces && (!pieces || pieces <= 0)) {
			toast.error("Indica las piezas o marca 'a granel'");
			return;
		}
		productionQueueMutation.mutate({
			productId: batchProduct.id,
			productName: batchProduct.name,
			pieces,
		});
	};

	// Título de un pedido en la cola: cliente, o "Pesaje de producción" si es
	// un pesaje de producción (sin cliente).
	const orderTitle = (o: any) =>
		o?.customer?.name ||
		(o?.notes === "Pesaje de producción"
			? "Pesaje de producción"
			: "Consumidor Final");

	// ---------------------------------------------------------------------------
	// Handlers
	// ---------------------------------------------------------------------------
	const handleRegisterWeight = useCallback(() => {
		if (!currentItem || !hasValidWeight) return;
		// ¿Es el último artículo por pesar? Si sí y NO es producción, ofrecer cobro.
		const isProduction =
			(selectedOrder as any)?.notes === "Pesaje de producción";
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
			actualWeightKg: Math.round(netKg * 1000),
		});
	}, [
		currentItem,
		hasValidWeight,
		netKg,
		updateWeightMutation,
		pendingItems.length,
		selectedOrder,
	]);

	// Limpiar peso bruto (TARE)
	const handleTare = () => {
		setActualWeight("");
	};

	// Capturar el peso actual como tara del recipiente y dejar la báscula en cero
	const handleCaptureTare = () => {
		if (!actualWeight || Number.parseFloat(actualWeight) <= 0) return;
		setCustomTare(Number.parseFloat(actualWeight).toFixed(3));
		setContainerId("otro");
		setActualWeight("");
	};

	const handlePrevItem = () => {
		setCurrentItemIndex((i) => Math.max(0, i - 1));
		setActualWeight("");
	};

	const handleNextItem = () => {
		setCurrentItemIndex((i) => {
			const next = i + 1;
			return next < pendingItems.length ? next : i;
		});
		setActualWeight("");
	};

	// Cambia el recipiente con flechas ↑/↓ (cicla la lista), conservando el peso bruto
	const cycleContainer = useCallback((dir: number) => {
		setContainerId((cur) => {
			const idx = CONTAINERS.findIndex((c) => c.id === cur);
			const next = (idx + dir + CONTAINERS.length) % CONTAINERS.length;
			return CONTAINERS[next].id;
		});
	}, []);

	// Mantener el cursor SIEMPRE en el input de peso (al cambiar de artículo o tras registrar)
	const weightInputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		weightInputRef.current?.focus();
	}, [currentItem?.id]);

	// Atajos de teclado del input de peso: Enter registra, flechas navegan
	const handleWeightKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			handleRegisterWeight();
		} else if (e.key === "ArrowLeft") {
			e.preventDefault();
			handlePrevItem();
		} else if (e.key === "ArrowRight") {
			e.preventDefault();
			handleNextItem();
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			cycleContainer(-1);
		} else if (e.key === "ArrowDown") {
			e.preventDefault();
			cycleContainer(1);
		}
	};

	const batchProduct = useMemo(
		() => products.find((p) => p.id === batchProductId) ?? null,
		[products, batchProductId],
	);
	const batchPendingPieces = useMemo(() => {
		if (!batchProduct) return null;
		return Math.max(0, batchProduct.stock_pieces - batchProduct.weighed_pieces);
	}, [batchProduct]);

	const handleRegisterBatch = () => {
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

	// ---------------------------------------------------------------------------
	// Render
	// ---------------------------------------------------------------------------
	if (isLoadingOrders) {
		return <Skeleton className="h-[600px] w-full" />;
	}

	return (
		<div className="mx-auto max-w-7xl space-y-4">
			<AntonellaSlot
				data={
					orders.length > 0
						? {
								tone: "aviso",
								titulo: "Estación de pesaje",
								texto: `Hay ${orders.length} pedido(s) por pesar. Pesa pieza por pieza (neto = bruto − tara) y al terminar te llevo al cobro.`,
								acciones: ["¿Qué pedidos faltan por pesar?"],
							}
						: {
								tone: "ok",
								titulo: "Estación de pesaje",
								texto:
									"No hay pedidos pendientes de pesaje. Puedes registrar un pesaje de producción a granel cuando lo necesites.",
							}
				}
			/>
			<div className="flex items-center justify-end">
				<Button onClick={() => setBatchOpen(true)} variant="outline">
					<ScaleIcon className="mr-2 h-4 w-4" />
					Agregar pesaje a producto
				</Button>
			</div>

			<div className="grid h-[calc(100vh-160px)] grid-cols-1 gap-6 lg:grid-cols-3">
				{/* ----------------------------------------------------------------- */}
				{/* Sidebar: Lista de órdenes pendientes                              */}
				{/* ----------------------------------------------------------------- */}
				<Card className="flex flex-col overflow-hidden lg:col-span-1">
					<CardHeader className="border-b bg-[var(--cg-chrome)]">
						<CardTitle className="flex items-center gap-2 font-display text-xl tracking-wide text-[var(--cg-chrome-fg)]">
							<ScaleIcon className="h-5 w-5" />
							{t("weighingStation")}
						</CardTitle>
						<p className="text-sm text-[var(--cg-rail-dim)]">
							{orders.length} {t("orders").toLowerCase()}{" "}
							{tc("pending").toLowerCase()}
						</p>
					</CardHeader>
					<CardContent className="flex-1 overflow-y-auto p-0">
						{orders.length === 0 ? (
							<div className="p-8 text-center text-muted-foreground">
								<CheckCircleIcon className="mx-auto mb-4 h-12 w-12 opacity-20" />
								<p>{tc("noItemFound")}</p>
							</div>
						) : (
							<div className="divide-y">
								{orders.map((order) => (
									<button
										key={order.id}
										onClick={() => setSelectedOrderId(order.id)}
										className={cn(
											"group flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-accent",
											selectedOrderId === order.id && "bg-accent",
											newOrderIds.has(order.id) &&
												"animate-pulse bg-[var(--cg-green-wash)] ring-2 ring-inset ring-[var(--cg-green)]",
										)}
									>
										<div className="space-y-1">
											<div className="flex items-center gap-2 font-medium">
												#{order.id} – {orderTitle(order)}
												{order.whatsapp_message_id && (
													<Badge
														variant="secondary"
														className="bg-[var(--cg-green-wash)] text-[var(--cg-green)] hover:bg-[var(--cg-green-wash)]"
													>
														<MessageSquareIcon className="mr-1 h-3 w-3" />
														WhatsApp
													</Badge>
												)}
											</div>
											<div className="text-muted-foreground text-xs">
												{order.orderItems.length} artículo(s) pendiente(s)
											</div>
										</div>
										<ChevronRightIcon
											className={cn(
												"h-5 w-5 text-muted-foreground transition-transform",
												selectedOrderId === order.id
													? "translate-x-1"
													: "opacity-0 group-hover:opacity-100",
											)}
										/>
									</button>
								))}
							</div>
						)}
					</CardContent>
				</Card>

				{/* ----------------------------------------------------------------- */}
				{/* Panel principal: captura de peso                                  */}
				{/* ----------------------------------------------------------------- */}
				<Card className="flex flex-col overflow-hidden lg:col-span-2">
					{selectedOrder && currentItem ? (
						<>
							{/* Encabezado de orden */}
							<CardHeader className="border-b px-6 py-3">
								<div className="flex items-center justify-between gap-3">
									<div className="space-y-0.5">
										<CardTitle className="text-lg">
											{orderTitle(selectedOrder)}
										</CardTitle>
										<CardDescription>
											Pedido #{selectedOrder.id}
										</CardDescription>
									</div>
									<div className="flex items-center gap-3">
										<Link href={`/admin/orders/${selectedOrder.id}`}>
											<Button variant="outline" size="sm">
												<PencilIcon className="mr-2 h-4 w-4" />
												Editar pedido
											</Button>
										</Link>
										<div className="text-right">
											<div className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
												{tc("total")}
											</div>
											<div className="font-bold text-xl">
												{formatCurrency(selectedOrder.total_amount, locale)}
											</div>
										</div>
									</div>
								</div>
							</CardHeader>

							<CardContent className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
								{/* Artículo actual -------------------------------------------------- */}
								<div className="space-y-1 text-center">
									<p className="font-semibold text-primary text-xs uppercase tracking-widest">
										Artículo{" "}
										<span className="text-foreground">
											{clampedIndex + 1} de {pendingItems.length}
										</span>
									</p>
									<h2 className="font-display text-4xl tracking-wide">
										{currentItem.quantity_pieces}&nbsp;{currentItem.product?.name ?? currentItem.product_name}
									</h2>
									{currentItem.product?.category && (
										<p className="text-muted-foreground text-sm">
											{currentItem.product.category}
										</p>
									)}
								</div>

								{/* Selector de recipiente ----------------------------------------- */}
								<div className="space-y-2">
									<Label className="font-semibold text-sm">Recipiente</Label>
									<div className="flex flex-wrap gap-2">
										{CONTAINERS.map((c) => (
											<button
												key={c.id}
												type="button"
												onClick={() => {
													setContainerId(c.id);
													if (c.id !== "otro") setActualWeight("");
												}}
												className={cn(
													"rounded-xl border px-4 py-2 font-medium text-sm transition-all",
													containerId === c.id
														? "border-primary bg-primary text-primary-foreground shadow"
														: "border-border bg-muted/40 hover:bg-muted",
												)}
											>
												{c.label}
												{c.tare !== null && c.tare > 0 && (
													<span className="ml-1 text-xs opacity-60">
														({c.tare.toFixed(3)} kg)
													</span>
												)}
											</button>
										))}
									</div>

									{/* Input de tara personalizada */}
									{containerId === "otro" && (
										<div className="mt-1 flex items-center gap-2">
											<Label className="whitespace-nowrap text-muted-foreground text-xs">
												Peso del recipiente (kg)
											</Label>
											<Input
												type="number"
												step="0.001"
												min="0"
												value={customTare}
												onChange={(e) => setCustomTare(e.target.value)}
												onFocus={(e) => e.currentTarget.select()}
												className="w-32 text-center font-mono"
												placeholder="0.000"
											/>
										</div>
									)}

									{/* Tara activa (solo informativo, para contenedores predefinidos) */}
									{containerId !== "ninguno" && containerId !== "otro" && (
										<div className="mt-1 flex items-center gap-2">
											<Label className="whitespace-nowrap text-muted-foreground text-xs">
												Peso del recipiente (kg)
											</Label>
											<Input
												type="number"
												step="0.001"
												min="0"
												value={tareKg.toFixed(3)}
												onChange={(e) => {
													// Permite ajustar manualmente aunque sea contenedor predefinido
													setContainerId("otro");
													setCustomTare(e.target.value);
												}}
												onFocus={(e) => e.currentTarget.select()}
												className="w-32 text-center font-mono"
											/>
											<span className="text-muted-foreground text-xs">
												(editable)
											</span>
										</div>
									)}
								</div>

								{/* Input de peso bruto -------------------------------------------- */}
								<div className="space-y-2">
									<div className="flex items-center justify-between gap-2">
										<Label htmlFor="weight" className="font-semibold text-sm">
											Peso bruto (kg)
										</Label>
										<div className="flex gap-1">
											{/* CAPTURAR: toma el peso actual como tara y deja en cero */}
											<button
												type="button"
												onClick={handleCaptureTare}
												disabled={!actualWeight || parseFloat(actualWeight) <= 0}
												className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-lg border border-[var(--cg-blue)] bg-[var(--cg-blue-wash)] text-[var(--cg-blue)] hover:brightness-95 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
												title="Poner este peso como tara del recipiente y dejar la báscula en cero"
											>
												Capturar
											</button>
											{/* TARE: limpiar input (báscula en cero) */}
											<button
												type="button"
												onClick={handleTare}
												className="rounded-lg border border-border bg-muted px-3 py-1 font-bold text-xs uppercase tracking-wider transition-colors hover:bg-muted/80"
												title="Limpiar / poner en cero (TARE)"
											>
												TARE
											</button>
										</div>
									</div>
									<div className="relative">
										<Input
											ref={weightInputRef}
											id="weight"
											type="number"
											step="0.001"
											min="0"
											autoFocus
											value={actualWeight}
											onChange={(e) => setActualWeight(e.target.value)}
											onKeyDown={handleWeightKeyDown}
											onFocus={(e) => e.currentTarget.select()}
											className="h-24 rounded-2xl border-2 pr-20 text-center font-bold font-mono text-5xl focus-visible:ring-offset-2"
											placeholder="0.000"
										/>
										<div className="pointer-events-none absolute top-1/2 right-5 -translate-y-1/2 font-bold text-3xl text-muted-foreground">
											kg
										</div>
									</div>
								</div>

								{/* Resumen bruto / tara / neto ------------------------------------ */}
								{(containerId !== "ninguno" || grossKg > 0) && (
									<div className="space-y-1 rounded-2xl border bg-muted/30 px-5 py-3 text-sm">
										<div className="flex justify-between text-muted-foreground">
											<span>Peso bruto</span>
											<span className="font-mono">{grossKg.toFixed(3)} kg</span>
										</div>
										{tareKg > 0 && (
											<div className="flex justify-between text-muted-foreground">
												<span>(–) Tara ({containerDef.label})</span>
												<span className="font-mono">
													–{tareKg.toFixed(3)} kg
												</span>
											</div>
										)}
										<div className="mt-1 flex justify-between border-t pt-1 font-bold text-base">
											<span>= Peso neto</span>
											<span
												className={cn(
													"font-mono",
													netKg > 0 ? "text-[var(--cg-green)]" : "text-muted-foreground",
												)}
											>
												{netKg.toFixed(3)} kg
											</span>
										</div>
									</div>
								)}

								{/* Botones de acción ---------------------------------------------- */}
								<div className="mt-auto flex gap-3">
									<Button
										variant="outline"
										size="lg"
										className="h-16 flex-1 rounded-2xl font-semibold text-base"
										onClick={handlePrevItem}
										disabled={currentItemIndex === 0}
									>
										<ChevronLeftIcon className="mr-2 h-5 w-5" />
										Anterior
									</Button>

									<Button
										size="lg"
										className="h-16 flex-[3] rounded-2xl font-bold text-lg shadow-lg transition-all hover:shadow-xl"
										onClick={handleRegisterWeight}
										disabled={updateWeightMutation.isPending || !hasValidWeight}
									>
										{updateWeightMutation.isPending ? (
											tc("loading")
										) : (
											<>
												<ScaleIcon className="mr-2 h-6 w-6" />
												Registrar{" "}
												{netKg > 0 ? `${netKg.toFixed(3)} kg` : "peso"}
											</>
										)}
									</Button>

									<Button
										variant="outline"
										size="lg"
										className="h-16 flex-1 rounded-2xl font-semibold text-base"
										onClick={handleNextItem}
										disabled={currentItemIndex >= pendingItems.length - 1}
									>
										Siguiente
										<ChevronRight className="ml-2 h-5 w-5" />
									</Button>
								</div>

								{/* Dots de progreso ---------------------------------------------- */}
								<div className="flex justify-center gap-2">
									{selectedOrder.orderItems.map((item) => (
										<div
											key={item.id}
											className={cn(
												"h-3 w-3 rounded-full transition-all",
												item.id === currentItem.id
													? "scale-125 bg-primary"
													: item.status === "PESADO"
														? "bg-green-500"
														: "bg-muted",
											)}
										/>
									))}
								</div>
							</CardContent>
						</>
					) : (
						<div className="flex flex-1 flex-col items-center justify-center p-12 text-muted-foreground">
							<ScaleIcon className="mb-6 h-24 w-24 opacity-10" />
							<h3 className="font-medium text-2xl">
								{t("weighingStationDescription")}
							</h3>
							<p className="mt-2 max-w-md text-center">
								Selecciona una orden de la lista de pendientes para comenzar a
								registrar el peso de los productos.
							</p>
						</div>
					)}
				</Card>
			</div>

			{/* ------------------------------------------------------------------- */}
			{/* Diálogo de pesaje por lote                                          */}
			{/* ------------------------------------------------------------------- */}
			<Dialog open={batchOpen} onOpenChange={setBatchOpen}>
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
								items={products.map((p) => ({ id: p.id, name: p.name }))}
								placeholder="Selecciona producto"
								onSelect={(id) => {
									const pid = Number(id);
									setBatchProductId(pid);
									// Auto: a granel si el producto no se vende por unidad
									const p = products.find((x) => x.id === pid) as any;
									setBatchNoPieces(p ? p.is_sellable_by_unit === false : false);
								}}
							/>
						</div>

						{/* A granel: pesar por tara sin contar piezas */}
						<label className="flex cursor-pointer items-center gap-2 rounded-md border bg-muted/20 p-3 text-sm">
							<input
								type="checkbox"
								className="h-4 w-4 accent-primary"
								checked={batchNoPieces}
								onChange={(e) => setBatchNoPieces(e.target.checked)}
							/>
							<span>
								A granel — pesar por tara <strong>sin contar piezas</strong>{" "}
								(desgrase, hueso pelón, patas en tara…)
							</span>
						</label>

						{batchProduct && (
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
						)}

						<div
							className={cn(
								"grid gap-3",
								batchNoPieces ? "grid-cols-1" : "grid-cols-2",
							)}
						>
							{!batchNoPieces && (
								<div className="space-y-1">
									<Label>Piezas</Label>
									<Input
										type="number"
										inputMode="numeric"
										min="0"
										step="1"
										value={batchPieces}
										onChange={(e) => setBatchPieces(e.target.value)}
										onFocus={(e) => e.currentTarget.select()}
										placeholder="Ej: 8"
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
									onChange={(e) => setBatchWeightKg(e.target.value)}
									onFocus={(e) => e.currentTarget.select()}
									placeholder="Ej: 24.350"
								/>
							</div>
						</div>

						<div className="space-y-1">
							<Label>¿Ya se había pesado antes?</Label>
							<Select
								value={batchApplyToInventory ? "NO" : "SI"}
								onValueChange={(v) => setBatchApplyToInventory(v === "NO")}
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
								"Primera vez" suma el peso al stock_kg del producto. "Ya estaba
								pesado" no modifica el inventario.
							</span>
						</div>
					</div>

					<DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
						<Button variant="secondary" onClick={() => setBatchOpen(false)}>
							Cancelar
						</Button>
						<Button
							variant="outline"
							onClick={sendToQueue}
							disabled={
								productionQueueMutation.isPending ||
								!batchProductId ||
								(!batchNoPieces &&
									!(Number.parseInt(batchPieces || "0", 10) > 0))
							}
							title="Crea un pesaje de producción en la cola para pesarlo pieza por pieza"
						>
							<ScaleIcon className="mr-2 h-4 w-4" />
							{productionQueueMutation.isPending
								? tc("loading")
								: "Enviar a cola de pesaje"}
						</Button>
						<Button
							onClick={handleRegisterBatch}
							disabled={
								recordBatchMutation.isPending ||
								!batchProductId ||
								!(Number.parseFloat(batchWeightKg) > 0) ||
								(batchApplyToInventory &&
									batchPendingPieces !== null &&
									(Number.parseInt(batchPieces || "0", 10) || 0) >
										batchPendingPieces)
							}
						>
							{recordBatchMutation.isPending
								? tc("loading")
								: "Registrar pesaje"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Botón flotante: pedido recién pesado → ir a cobro */}
			{completedOrder && (
				<div className="fade-in slide-in-from-bottom-4 fixed right-6 bottom-6 z-50 animate-in">
					<Link href={`/admin/checkout?order=${completedOrder.id}`}>
						<Button
							size="lg"
							className="h-14 rounded-2xl bg-[var(--cg-green)] px-6 text-base font-bold shadow-xl hover:brightness-95"
							onClick={() => setCompletedOrder(null)}
						>
							<CheckCircleIcon className="mr-2 h-5 w-5" />
							Cobrar pedido #{completedOrder.id} ({completedOrder.name})
						</Button>
					</Link>
				</div>
			)}
		</div>
	);
}
