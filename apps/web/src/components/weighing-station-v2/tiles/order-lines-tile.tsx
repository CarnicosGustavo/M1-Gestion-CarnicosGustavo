"use client";

import { cn } from "@finopenpos/ui/lib/utils";
import { ExternalLink, PackageOpen } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { PesajeTile } from "../pesaje-tile";
import type { PesajeOrder, PesajeOrderItem } from "../types";
import { formatKg, itemName, orderTitle } from "../types";

export interface OrderLinesTileProps {
	order: PesajeOrder | null;
	items: PesajeOrderItem[];
	activeItemId: number | null;
	focused: boolean;
	lineTotals?: { count: number; pieces: number; netG: number } | null;
	locale: string;
	onSelectItem: (id: number) => void;
	onFocusTile: () => void;
}

export function OrderLinesTile({
	order,
	items,
	activeItemId,
	focused,
	lineTotals,
	locale,
	onSelectItem,
	onFocusTile,
}: OrderLinesTileProps) {
	return (
		<PesajeTile
			id={2}
			title="Renglones"
			shortcut="Súper+2"
			focused={focused}
			onFocusTile={onFocusTile}
			className="h-full"
			bodyClassName="p-3"
		>
			{!order ? (
				<div className="flex h-full min-h-32 flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
					<PackageOpen className="h-7 w-7" aria-hidden="true" />
					<p className="text-sm">
						Selecciona un pedido para ver sus renglones.
					</p>
				</div>
			) : (
				<div className="space-y-3">
					<div className="border-border border-b pb-3">
						<div className="flex items-start justify-between gap-2">
							<div className="min-w-0">
								<p className="truncate font-semibold text-sm">
									{orderTitle(order)}
								</p>
								<p className="text-muted-foreground text-xs">
									Pedido #{order.id}
								</p>
							</div>
							<a
								href={`/admin/orders/${order.id}`}
								className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 font-medium text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
								aria-label={`Editar pedido ${order.id}`}
							>
								Editar pedido
								<ExternalLink className="h-3 w-3" aria-hidden="true" />
							</a>
						</div>
						<p className="mt-2 font-bold text-lg tabular-nums">
							{formatCurrency(Number(order.total_amount ?? 0), locale)}
						</p>
					</div>

					{items.length === 0 ? (
						<p className="py-6 text-center text-muted-foreground text-sm">
							Este pedido no tiene renglones.
						</p>
					) : (
						<ul className="space-y-1.5" aria-label="Renglones del pedido">
							{items.map((item) => {
								const isActive = activeItemId === item.id;

								return (
									<li key={item.id}>
										<button
											type="button"
											onClick={() => onSelectItem(item.id)}
											className={cn(
												"w-full rounded-md border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
												isActive
													? "border-primary bg-primary/10"
													: "border-border bg-background hover:bg-muted",
											)}
											aria-current={isActive ? "true" : undefined}
										>
											<div className="flex items-start justify-between gap-3">
												<div className="min-w-0">
													<p className="truncate font-semibold text-sm">
														{itemName(item)}
													</p>
													<p className="mt-0.5 text-muted-foreground text-xs">
														{item.quantity_pieces ?? 0} pieza
														{(item.quantity_pieces ?? 0) === 1 ? "" : "s"}
														{item.quantity_kg
															? ` · Solicitado: ${Number(item.quantity_kg).toFixed(3)} kg`
															: ""}
													</p>
												</div>
												{isActive ? (
													<span className="shrink-0 rounded bg-[var(--cg-green-wash)] px-1.5 py-0.5 font-semibold text-[10px] text-[var(--cg-green)]">
														Activo
													</span>
												) : null}
											</div>
										</button>
									</li>
								);
							})}
						</ul>
					)}

					{lineTotals && activeItemId !== null ? (
						<div className="rounded-md border border-border bg-muted/50 px-3 py-2">
							<div className="flex items-center justify-between text-muted-foreground text-xs">
								<span>Acumulado del renglón activo</span>
								<span>
									{lineTotals.count} captura{lineTotals.count === 1 ? "" : "s"}
								</span>
							</div>
							<div className="mt-1 flex items-center justify-between gap-3">
								<span className="text-xs">
									{lineTotals.pieces} pieza{lineTotals.pieces === 1 ? "" : "s"}
								</span>
								<strong className="font-mono text-sm tabular-nums">
									{formatKg(lineTotals.netG)} kg
								</strong>
							</div>
						</div>
					) : null}
				</div>
			)}
		</PesajeTile>
	);
}
