"use client";

import { cn } from "@finopenpos/ui/lib/utils";
import { MessageCircle, PackageOpen } from "lucide-react";

import type { PesajeOrder } from "../types";
import { orderTitle } from "../types";
import { OverlayFrame } from "./overlay-frame";

export interface OrdersOverlayProps {
	orders: PesajeOrder[];
	selectedOrderId: number | null;
	onSelect: (id: number) => void;
	onClose: () => void;
}

export function OrdersOverlay({
	orders,
	selectedOrderId,
	onSelect,
	onClose,
}: OrdersOverlayProps) {
	return (
		<OverlayFrame
			title="Pedidos"
			subtitle={`${orders.length} ${orders.length === 1 ? "pedido pendiente" : "pedidos pendientes"}`}
			onClose={onClose}
		>
			<div className="mx-auto w-full max-w-6xl p-5">
				{orders.length === 0 ? (
					<div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
						<PackageOpen className="h-9 w-9" aria-hidden="true" />
						<p className="text-sm">No hay pedidos pendientes.</p>
					</div>
				) : (
					<ul
						className="grid gap-2 md:grid-cols-2"
						aria-label="Lista ampliada de pedidos"
					>
						{orders.map((order) => {
							const itemCount = order.orderItems.length;
							const isSelected = selectedOrderId === order.id;

							return (
								<li key={order.id}>
									<button
										type="button"
										onClick={() => onSelect(order.id)}
										className={cn(
											"w-full rounded-md border bg-card px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
											isSelected
												? "border-2 border-primary bg-primary/5"
												: "border-border hover:bg-muted",
										)}
										aria-current={isSelected ? "true" : undefined}
									>
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<p className="truncate font-semibold">
													{orderTitle(order)}
												</p>
												<p className="mt-1 text-muted-foreground text-xs">
													Pedido #{order.id}
												</p>
											</div>
											{order.whatsapp_message_id ? (
												<span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 font-semibold text-[10px] text-emerald-800">
													<MessageCircle
														className="h-3 w-3"
														aria-hidden="true"
													/>
													WhatsApp
												</span>
											) : null}
										</div>
										<p className="mt-3 text-muted-foreground text-xs">
											{itemCount} artículo{itemCount === 1 ? "" : "s"} pendiente
											{itemCount === 1 ? "" : "s"}
											{order.notes ? ` · ${order.notes}` : ""}
										</p>
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</OverlayFrame>
	);
}
