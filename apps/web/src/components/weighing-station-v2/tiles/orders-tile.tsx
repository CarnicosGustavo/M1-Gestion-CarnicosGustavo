"use client";

import { cn } from "@finopenpos/ui/lib/utils";
import { MessageCircle, PackageCheck } from "lucide-react";
import { PesajeTile } from "../pesaje-tile";
import type { PesajeOrder } from "../types";
import { orderTitle } from "../types";

export interface OrdersTileProps {
	orders: PesajeOrder[];
	selectedOrderId: number | null;
	focused: boolean;
	newOrderIds: Set<number>;
	onSelect: (id: number) => void;
	onFocusTile: () => void;
}

export function OrdersTile({
	orders,
	selectedOrderId,
	focused,
	newOrderIds,
	onSelect,
	onFocusTile,
}: OrdersTileProps) {
	return (
		<PesajeTile
			id={1}
			title="Pedidos"
			shortcut="Súper+1"
			focused={focused}
			onFocusTile={onFocusTile}
			className="h-full"
			bodyClassName="p-2"
		>
			{orders.length === 0 ? (
				<div className="flex h-full min-h-32 flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
					<PackageCheck className="h-7 w-7" aria-hidden="true" />
					<p className="text-sm">No hay pedidos pendientes.</p>
				</div>
			) : (
				<ul className="space-y-1" aria-label="Pedidos pendientes">
					{orders.map((order) => {
						const isNew = newOrderIds.has(order.id);
						const isSelected = selectedOrderId === order.id;

						return (
							<li key={order.id}>
								<button
									type="button"
									onClick={() => onSelect(order.id)}
									className={cn(
										"w-full rounded-md border border-transparent px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
										isSelected && "border-primary/50 bg-primary/10",
										isNew && "animate-pulse bg-emerald-100 text-emerald-950",
										!isSelected && !isNew && "hover:bg-muted",
									)}
									aria-current={isSelected ? "true" : undefined}
								>
									<div className="flex items-start gap-2">
										<div className="min-w-0 flex-1">
											<p className="truncate font-semibold text-sm">
												{orderTitle(order)}
											</p>
											<p className="mt-0.5 text-muted-foreground text-xs">
												{order.orderItems.length} artículo
												{order.orderItems.length === 1 ? "" : "s"} pendiente
												{order.orderItems.length === 1 ? "" : "s"}
											</p>
										</div>
										{order.whatsapp_message_id ? (
											<span
												className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 font-semibold text-[10px] text-emerald-800"
												title="Pedido recibido por WhatsApp"
											>
												<MessageCircle className="h-3 w-3" aria-hidden="true" />
												WhatsApp
											</span>
										) : null}
									</div>
								</button>
							</li>
						);
					})}
				</ul>
			)}
		</PesajeTile>
	);
}
