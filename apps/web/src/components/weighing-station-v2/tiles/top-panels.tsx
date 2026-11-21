"use client";

import { MessageCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { PanelFrame, PanelListItem, PanelRow } from "../instrument/panel-frame";
import type { PesajeOrder, PesajeOrderItem } from "../types";
import { itemName, orderTitle } from "../types";
import { presenceClass, usePresence } from "../use-presence";

function kgText(value: number | string | null | undefined): string | null {
	if (value === null || value === undefined || value === "") return null;
	const n = Number(value);
	return Number.isFinite(n) ? `${n.toFixed(3)} kg` : null;
}

/** 1 · Pedidos: aquí se selecciona el pedido. */
export function OrdersPanel({
	orders,
	selectedOrderId,
	newOrderIds,
	focused,
	onSelect,
	onFocusPanel,
}: {
	orders: PesajeOrder[];
	selectedOrderId: number | null;
	newOrderIds: Set<number>;
	focused: boolean;
	onSelect: (id: number) => void;
	onFocusPanel: () => void;
}) {
	return (
		<PanelFrame
			number={1}
			title="Pedidos"
			shortcut="Súper+1"
			focused={focused}
			onFocusPanel={onFocusPanel}
			className="h-full"
		>
			{orders.length === 0 ? (
				<p className="p-4 text-center text-[#8e99a4] text-xs">
					No hay pedidos pendientes de pesar.
				</p>
			) : (
				<ul aria-label="Pedidos pendientes" className="pz-zoom">
					{orders.map((order) => (
						<li
							key={order.id}
							className={newOrderIds.has(order.id) ? "animate-pulse" : ""}
						>
							<PanelListItem
								title={`#${order.id} ${orderTitle(order)}`}
								subtitle={`${order.orderItems.filter((item) => item.status === "PENDIENTE_PESAJE").length} por pesar`}
								selected={order.id === selectedOrderId}
								onSelect={() => onSelect(order.id)}
								badge={
									order.whatsapp_message_id ? (
										<span className="inline-flex items-center gap-0.5">
											<MessageCircle
												className="h-2.5 w-2.5"
												aria-hidden="true"
											/>
											WA
										</span>
									) : undefined
								}
							/>
						</li>
					))}
				</ul>
			)}
		</PanelFrame>
	);
}

/** 2 · Pedido: datos del pedido seleccionado (los productos van en 3). */
export function OrderPanel({
	order,
	pendingCount,
	weighedCount,
	accumulatedNetKg,
	captureCount,
	locale,
	focused,
	onFocusPanel,
}: {
	order: PesajeOrder | null;
	pendingCount: number;
	weighedCount: number;
	accumulatedNetKg: number;
	captureCount: number;
	locale: string;
	focused: boolean;
	onFocusPanel: () => void;
}) {
	return (
		<PanelFrame
			number={2}
			title="Pedido"
			shortcut="Súper+2"
			focused={focused}
			onFocusPanel={onFocusPanel}
			className="h-full"
		>
			{order ? (
				<div className="pz-zoom">
					<PanelRow label="Pedido" value={`PED-${order.id}`} />
					<PanelRow label="Cliente" value={orderTitle(order)} wrap />
					<PanelRow
						label="Renglones"
						value={`${pendingCount} por pesar · ${weighedCount} pesados`}
					/>
					<PanelRow
						label="Neto acum."
						value={`${accumulatedNetKg.toFixed(3)} kg · ${captureCount} cap.`}
						accent
					/>
					<PanelRow
						label="Total pedido"
						value={formatCurrency(Number(order.total_amount ?? 0), locale)}
					/>
				</div>
			) : (
				<p className="p-4 text-[#8e99a4] text-xs">
					Elige un pedido en 1 (Súper+1, J/K y Enter).
				</p>
			)}
		</PanelFrame>
	);
}

/** 3 · Productos pendientes de pesar. */
export function PendingPanel({
	items,
	activeItemId,
	focused,
	onSelect,
	onFocusPanel,
}: {
	items: PesajeOrderItem[];
	activeItemId: number | null;
	focused: boolean;
	onSelect: (id: number) => void;
	onFocusPanel: () => void;
}) {
	const shown = usePresence(items, (item) => item.id);
	return (
		<PanelFrame
			number={3}
			title="Pendientes de pesar"
			shortcut="Súper+3"
			focused={focused}
			onFocusPanel={onFocusPanel}
			className="h-full"
		>
			{shown.length === 0 ? (
				<p className="p-4 text-[#8e99a4] text-xs">Nada pendiente.</p>
			) : (
				<ul
					aria-label="Productos pendientes de pesar"
					className="pz-zoom overflow-x-hidden"
				>
					{shown.map(({ key, item, state }) => {
						const index = items.findIndex((i) => i.id === item.id);
						const pieces = item.quantity_pieces
							? `${item.quantity_pieces} pza`
							: null;
						const requested = kgText(item.quantity_kg);
						return (
							<li
								key={key}
								// Sale hacia la báscula (abajo); si regresa de la venta, entra
								// desde la derecha.
								className={presenceClass(state, "right", "bottom")}
							>
								<PanelListItem
									title={`L${index >= 0 ? index + 1 : "·"} ${itemName(item)}`}
									subtitle={[pieces, requested ? `pedido ${requested}` : null]
										.filter(Boolean)
										.join(" · ")}
									selected={item.id === activeItemId}
									onSelect={() => onSelect(item.id)}
								/>
							</li>
						);
					})}
				</ul>
			)}
		</PanelFrame>
	);
}
