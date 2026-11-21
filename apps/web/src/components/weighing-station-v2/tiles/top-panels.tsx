"use client";

import { MessageCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { PanelFrame, PanelListItem, PanelRow } from "../instrument/panel-frame";
import type { PesajeOrder, PesajeOrderItem } from "../types";
import { itemName, orderTitle } from "../types";

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
				<ul aria-label="Pedidos pendientes">
					{orders.map((order) => (
						<li
							key={order.id}
							className={newOrderIds.has(order.id) ? "animate-pulse" : ""}
						>
							<PanelListItem
								title={`#${order.id} ${orderTitle(order)}`}
								subtitle={`${order.orderItems.length} por pesar`}
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

/** 2 · Pedido: detalles del pedido seleccionado. */
export function OrderPanel({
	order,
	currentItem,
	accumulatedNetKg,
	captureCount,
	locale,
	focused,
	onFocusPanel,
}: {
	order: PesajeOrder | null;
	currentItem: PesajeOrderItem | null;
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
				<div className="@container">
					<div className="grid @md:grid-cols-2 grid-cols-1">
						<PanelRow label="Pedido" value={`PED-${order.id}`} />
						<PanelRow label="Cliente" value={orderTitle(order)} />
						<PanelRow
							label="Producto"
							value={currentItem ? itemName(currentItem) : "—"}
						/>
						<PanelRow
							label="Piezas"
							value={
								currentItem?.quantity_pieces
									? `${currentItem.quantity_pieces} pza`
									: "—"
							}
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
	return (
		<PanelFrame
			number={3}
			title="Pendientes de pesar"
			shortcut="Súper+3"
			focused={focused}
			onFocusPanel={onFocusPanel}
			className="h-full"
		>
			{items.length === 0 ? (
				<p className="p-4 text-[#8e99a4] text-xs">Nada pendiente.</p>
			) : (
				<ul aria-label="Productos pendientes de pesar">
					{items.map((item, index) => {
						const pieces = item.quantity_pieces
							? `${item.quantity_pieces} pza`
							: null;
						const requested = kgText(item.quantity_kg);
						return (
							<li key={item.id}>
								<PanelListItem
									title={`L${index + 1} ${itemName(item)}`}
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
