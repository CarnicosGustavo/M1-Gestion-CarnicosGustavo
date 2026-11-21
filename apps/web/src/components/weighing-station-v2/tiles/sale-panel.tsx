"use client";

import { cn } from "@finopenpos/ui/lib/utils";
import { Banknote, CreditCard, Undo2 } from "lucide-react";
import { PanelFrame } from "../instrument/panel-frame";
import {
	lineSubtotalCents,
	PRICE_SOURCE_LABELS,
	type PriceSource,
} from "../pricing";
import { presenceClass, usePresence } from "../use-presence";

export type SaleLine = {
	itemId: number;
	productId: number | null;
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
	/** Quita el peso: el producto regresa a «Pendientes de pesar». */
	onReturn: (itemId: number) => void;
	onCharge: (type: "contado" | "credito") => void;
	canCharge: boolean;
	chargeHint: string; // texto pequeño bajo los botones
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
		onReturn,
		onCharge,
		canCharge,
		chargeHint,
	} = props;

	const totalCents = lines.reduce(
		(sum, line) =>
			sum + lineSubtotalCents(line.kg, Number.parseFloat(line.price) || 0),
		0,
	);
	const shown = usePresence(lines, (line) => line.itemId);

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
						<div className="pz-zoom font-semibold text-[#e6edf3] text-xs leading-snug">
							{customerName}
						</div>
					</div>
				) : null}

				{loadingPrices ? (
					<div className="shrink-0 px-3 py-1.5 text-[#8b949e] text-[10px]">
						Cargando precios…
					</div>
				) : null}

				{shown.length === 0 ? (
					<div className="flex min-h-0 flex-1 items-center justify-center px-5 text-center">
						<p className="text-[#8b949e] text-xs leading-relaxed">
							Lo pesado en la báscula aparece aquí con el precio del cliente.
						</p>
					</div>
				) : (
					<ul className="pz-zoom min-h-0 flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden px-2 py-2">
						{shown.map(({ key, item: line, state }) => {
							const index = lines.findIndex((l) => l.itemId === line.itemId);
							const subtotalCents = lineSubtotalCents(
								line.kg,
								Number.parseFloat(line.price) || 0,
							);
							const isActive = focused && index === activeIndex;

							return (
								<li
									key={key}
									className={cn(
										"rounded-md border border-[#2d333b] bg-[#20252b] px-2.5 py-2 transition-colors",
										isActive && "border-l-2 border-l-[#f39a1e]",
										state === "enter" && "border-[#3fb950]/70",
										presenceClass(state, "left", "left"),
									)}
								>
									<div className="flex items-start gap-2">
										<div className="min-w-0 flex-1">
											<div className="line-clamp-2 break-words font-bold text-[#e6edf3] text-sm leading-tight">
												{line.name}
											</div>
											<div className="mt-0.5 font-mono text-[#9da7b3] text-[11px] tabular-nums">
												{line.kg.toLocaleString("es-MX", {
													minimumFractionDigits: 3,
													maximumFractionDigits: 3,
												})}{" "}
												kg
												{line.pieces !== null ? ` · ${line.pieces} pza` : ""}
											</div>
										</div>
										<button
											type="button"
											onClick={() => onReturn(line.itemId)}
											disabled={state === "leave"}
											title="Quitar peso: regresa a pendientes de pesar"
											aria-label={`Quitar peso de ${line.name}`}
											className="flex size-6 shrink-0 items-center justify-center rounded border border-[#3d444d] text-[#8b949e] transition-colors hover:border-[#d63a3a] hover:bg-[#d63a3a]/15 hover:text-[#ff8f8f]"
										>
											<Undo2 aria-hidden="true" size={13} />
										</button>
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
					<div className="mb-2.5 flex items-center justify-between">
						<span className="font-semibold text-[#c9d1d9] text-xs">Total</span>
						<span className="font-bold font-mono text-2xl text-[#f39a1e] tabular-nums">
							{formatMoney(totalCents)}
						</span>
					</div>
					<div className="grid grid-cols-2 gap-2">
						<button
							type="button"
							onClick={() => onCharge("contado")}
							disabled={!canCharge}
							className="flex flex-col items-center justify-center rounded-md bg-gradient-to-b from-[#4cc35d] to-[#2f9a3f] px-2 py-2 font-bold text-[#06210b] shadow-[0_2px_0_rgba(0,0,0,0.45)] transition hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:from-[#2d4a33] disabled:to-[#24392a] disabled:text-[#5f7a64]"
						>
							<span className="flex items-center gap-1.5 text-sm uppercase tracking-wide">
								<Banknote aria-hidden="true" size={15} strokeWidth={2.4} />
								Contado
							</span>
							<kbd className="font-mono font-normal text-[9px] opacity-70">
								Súper+G
							</kbd>
						</button>
						<button
							type="button"
							onClick={() => onCharge("credito")}
							disabled={!canCharge}
							className="flex flex-col items-center justify-center rounded-md bg-gradient-to-b from-[#3aa9d1] to-[#23799b] px-2 py-2 font-bold text-[#04202b] shadow-[0_2px_0_rgba(0,0,0,0.45)] transition hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:from-[#264451] disabled:to-[#1d3540] disabled:text-[#58717c]"
						>
							<span className="flex items-center gap-1.5 text-sm uppercase tracking-wide">
								<CreditCard aria-hidden="true" size={15} strokeWidth={2.4} />
								Crédito
							</span>
							<kbd className="font-mono font-normal text-[9px] opacity-70">
								Súper+⇧G
							</kbd>
						</button>
					</div>
					<div className="mt-1.5 min-h-3 text-[#8b949e] text-[10px] leading-3">
						{chargeHint}
					</div>
				</div>
			</div>
		</PanelFrame>
	);
}
