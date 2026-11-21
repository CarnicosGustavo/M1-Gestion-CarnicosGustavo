"use client";

import { cn } from "@finopenpos/ui/lib/utils";
import { Printer, Receipt, Truck } from "lucide-react";
import { PanelFrame } from "../instrument/panel-frame";
import {
	lineSubtotalCents,
	PRICE_SOURCE_LABELS,
	type PriceSource,
} from "../pricing";

export type SaleLine = {
	itemId: number;
	name: string;
	kg: number;
	pieces: number | null;
	price: string;
	source: PriceSource;
};

export interface SalePanelProps {
	customerName: string | null;
	lines: SaleLine[];
	focused: boolean;
	activeIndex: number; // renglón resaltado con el teclado
	loadingPrices: boolean;
	formatMoney: (cents: number) => string;
	onPriceChange: (itemId: number, value: string) => void;
	onFocusPanel: () => void;
	onCharge: () => void; // cobro + ticket
	onOpenTickets: () => void;
	canCharge: boolean;
	chargeHint: string; // texto pequeño bajo el botón
}

function sourceStyles(source: PriceSource): string {
	switch (source) {
		case "ultimo":
			return "border-[#2f6f3b] bg-[#18351f] text-[#56d364]";
		case "lista":
			return "border-[#285b8f] bg-[#152a43] text-[#79c0ff]";
		case "pedido":
		case "base":
			return "border-[#343b44] bg-[#242a31] text-[#9da7b3]";
		case "manual":
			return "border-[#8a5318] bg-[#3a2815] text-[#f39a1e]";
	}
}

export function SalePanel(props: SalePanelProps) {
	const {
		customerName,
		lines,
		focused,
		activeIndex,
		loadingPrices,
		formatMoney,
		onPriceChange,
		onFocusPanel,
		onCharge,
		onOpenTickets,
		canCharge,
		chargeHint,
	} = props;

	const totalCents = lines.reduce(
		(sum, line) =>
			sum + lineSubtotalCents(line.kg, Number.parseFloat(line.price) || 0),
		0,
	);

	return (
		<PanelFrame
			number={5}
			title="Venta / ticket"
			shortcut="Súper+5"
			focused={focused}
			onFocusPanel={onFocusPanel}
			className="h-full min-h-0"
			bodyClassName="flex min-h-0 flex-1 flex-col p-0"
		>
			<div className="flex min-h-0 flex-1 flex-col">
				{customerName ? (
					<div className="shrink-0 border-[#2d333b] border-b px-3 py-2">
						<div className="truncate font-semibold text-[#e6edf3] text-[11px]">
							{customerName}
						</div>
					</div>
				) : null}

				{loadingPrices ? (
					<div className="shrink-0 px-3 py-1.5 text-[#8b949e] text-[10px]">
						Cargando precios…
					</div>
				) : null}

				{lines.length === 0 ? (
					<div className="flex min-h-0 flex-1 items-center justify-center px-5 text-center">
						<p className="text-[#8b949e] text-xs leading-relaxed">
							Lo pesado en la báscula aparece aquí con el precio del cliente.
						</p>
					</div>
				) : (
					<ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-2">
						{lines.map((line, index) => {
							const subtotalCents = lineSubtotalCents(
								line.kg,
								Number.parseFloat(line.price) || 0,
							);
							const isActive = focused && index === activeIndex;

							return (
								<li
									key={line.itemId}
									className={cn(
										"rounded-sm border border-[#2d333b] bg-[#20252b] px-2 py-2 transition-colors",
										isActive && "border-l-2 border-l-[#f39a1e]",
									)}
								>
									<div className="truncate font-bold text-[#e6edf3] text-xs">
										{line.name}
									</div>
									<div className="mt-0.5 font-mono text-[#9da7b3] text-[10px] tabular-nums">
										{line.kg.toLocaleString("es-MX", {
											minimumFractionDigits: 3,
											maximumFractionDigits: 3,
										})}{" "}
										kg
										{line.pieces !== null ? ` · ${line.pieces} pza` : ""}
									</div>
									<div className="mt-2 flex items-center gap-1.5">
										<div className="relative min-w-0 flex-1">
											<span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 font-mono text-[#8b949e] text-[10px]">
												$
											</span>
											<input
												type="text"
												inputMode="decimal"
												value={line.price}
												onChange={(event) =>
													onPriceChange(line.itemId, event.target.value)
												}
												onFocus={onFocusPanel}
												aria-label={`Precio por kg de ${line.name}`}
												className="w-full rounded border border-[#2d333b] bg-[#0f1216] py-1 pr-2 pl-5 text-right font-mono text-[#e6edf3] text-xs outline-none transition-colors focus:border-[#f39a1e]"
											/>
										</div>
										<span
											className={cn(
												"shrink-0 rounded border px-1.5 py-1 font-semibold text-[9px]",
												sourceStyles(line.source),
											)}
										>
											{PRICE_SOURCE_LABELS[line.source]}
										</span>
									</div>
									<div className="mt-1 text-right font-mono font-semibold text-[#e6edf3] text-xs tabular-nums">
										{formatMoney(subtotalCents)}
									</div>
								</li>
							);
						})}
					</ul>
				)}

				<div className="shrink-0 border-[#2d333b] border-t bg-[#1b1f24] px-3 py-3">
					<div className="mb-2 flex items-center justify-between">
						<span className="font-semibold text-[#c9d1d9] text-xs">Total</span>
						<span className="font-bold font-mono text-[#f39a1e] text-xl tabular-nums">
							{formatMoney(totalCents)}
						</span>
					</div>
					<button
						type="button"
						onClick={onCharge}
						disabled={!canCharge}
						className="flex w-full items-center justify-center gap-2 rounded-md bg-[#3fb950] px-3 py-2 font-bold text-black text-xs transition-colors hover:bg-[#56d364] disabled:cursor-not-allowed disabled:bg-[#2d6b39] disabled:text-[#18251c]"
					>
						<Printer aria-hidden="true" size={14} strokeWidth={2.5} />
						Cobrar e imprimir
						<kbd className="ml-1 rounded border border-black/20 bg-black/10 px-1 py-0.5 font-mono text-[9px]">
							Súper+G
						</kbd>
					</button>
					<div className="mt-1 min-h-3 text-[#8b949e] text-[10px] leading-3">
						{chargeHint}
					</div>
					<div className="mt-2 grid grid-cols-2 gap-2">
						<button
							type="button"
							onClick={onOpenTickets}
							className="flex items-center justify-center gap-1.5 rounded-md border border-[#3d444d] bg-[#252b32] px-2 py-1.5 font-semibold text-[#c9d1d9] text-[10px] transition-colors hover:border-[#58a6ff] hover:text-[#79c0ff]"
						>
							<Receipt aria-hidden="true" size={13} />
							Tickets
							<kbd className="font-mono text-[#8b949e] text-[8px]">Súper+T</kbd>
						</button>
						<button
							type="button"
							disabled
							title="Próximamente: enviar al cliente"
							className="flex cursor-not-allowed items-center justify-center gap-1.5 rounded-md border border-[#30363d] bg-[#20252b] px-2 py-1.5 font-semibold text-[#656e76] text-[10px]"
						>
							<Truck aria-hidden="true" size={13} />
							Envío
						</button>
					</div>
				</div>
			</div>
		</PanelFrame>
	);
}
