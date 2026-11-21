"use client";

import { cn } from "@finopenpos/ui/lib/utils";
import { Undo2 } from "lucide-react";
import { presenceClass, usePresence } from "../use-presence";
import { SegmentDisplay } from "./segment-display";

/** Producto del pedido que está en la báscula (entra a la izquierda del peso). */
export interface IqyItem {
	id: number;
	name: string;
	detail: string;
	position: string;
}

export type IqyIndicator =
	| "cero"
	| "tara"
	| "estable"
	| "hold"
	| "pico"
	| "mmas"
	| "hml"
	| "bateria";

export interface IqyButton {
	id: string;
	top: string;
	bottom: string;
	color: "red" | "orange" | "yellow" | "cyan" | "blue";
	shortcut: string;
	label: string;
	onPress: () => void;
	disabled?: boolean;
}

const indicatorLabels: Record<IqyIndicator, string> = {
	cero: "CERO",
	tara: "TARA",
	estable: "ESTABLE",
	hold: "HOLD",
	pico: "PICO",
	mmas: "M+",
	hml: "HML",
	bateria: "BATERÍA",
};

/** Marcas en el borde inferior del LCD, alineadas con las etiquetas de abajo. */
const indicatorMarks: Record<IqyIndicator, string> = {
	cero: "▶O",
	tara: "▼",
	estable: "▼▼",
	hold: "H",
	pico: "▲",
	mmas: "M+",
	hml: "HML",
	bateria: "",
};

const unitLabels = ["pcs", "lb", "kg"] as const;

const buttonTones: Record<IqyButton["color"], string> = {
	red: "bg-gradient-to-b from-[#ef3a3a] to-[#c41e26] text-white",
	orange: "bg-gradient-to-b from-[#ffb12e] to-[#ef8a0c] text-[#1a1000]",
	yellow: "bg-gradient-to-b from-[#ffe14a] to-[#f0c400] text-[#1a1400]",
	cyan: "bg-gradient-to-b from-[#3aa4e8] to-[#1d7ec0] text-white",
	blue: "bg-gradient-to-b from-[#3aa4e8] to-[#1d7ec0] text-white",
};

function BatteryIcon({ charged }: { charged: boolean }) {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 22 12"
			className={cn(
				"h-[clamp(0.55rem,1.8cqw,0.85rem)] w-[clamp(1.1rem,3.6cqw,1.7rem)]",
				charged ? "text-[#2b2e28]" : "text-[#2b2e28]/25",
			)}
		>
			<rect
				x="0.75"
				y="1.5"
				width="18"
				height="9"
				rx="1.2"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.4"
			/>
			<rect
				x="18.6"
				y="4"
				width="2.2"
				height="4"
				rx="0.4"
				fill="currentColor"
			/>
			{charged ? (
				<rect
					x="2.4"
					y="3.2"
					width="14.2"
					height="5.6"
					rx="0.4"
					fill="currentColor"
				/>
			) : null}
		</svg>
	);
}

export function IqyDisplay({
	brand = "Cárnicos Gustavo",
	valueText,
	digits = 5,
	unit,
	active,
	overload = false,
	subline,
	buttons,
	item = null,
	undo,
	focused = false,
	className,
	onFocusPanel,
}: {
	brand?: string;
	valueText: string;
	digits?: number;
	unit: "kg" | "lb" | "pcs";
	active: IqyIndicator[];
	overload?: boolean;
	subline?: { gross: string; tare: string; net: string };
	buttons: IqyButton[];
	item?: IqyItem | null;
	undo?: {
		label: string;
		shortcut: string;
		onPress: () => void;
		disabled?: boolean;
	};
	focused?: boolean;
	className?: string;
	onFocusPanel?: () => void;
}) {
	const displayText = overload ? "-OL-" : valueText;
	const batteryOn = active.includes("bateria");
	const shownItems = usePresence(item ? [item] : [], (entry) => entry.id);

	return (
		<section
			aria-label="Báscula I-QY"
			onMouseDown={onFocusPanel}
			className={cn(
				"@container flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[2.2rem] p-[clamp(0.5rem,1.6cqw,1rem)]",
				"bg-[linear-gradient(180deg,#c4c8cc_0%,#a7acb1_45%,#8a8f95_100%)]",
				"shadow-[inset_0_2px_1px_rgba(255,255,255,0.55),inset_0_-5px_10px_rgba(0,0,0,0.3),0_10px_24px_rgba(0,0,0,0.35)]",
				"ring-1 ring-[#6f747a]",
				focused && "ring-2 ring-[#f39a1e]",
				className,
			)}
		>
			{/* Frente negro brillante del indicador */}
			<div className="flex min-h-0 flex-1 flex-col rounded-[1.15rem] bg-[#0b0b0d] px-[clamp(0.55rem,1.8cqw,1.1rem)] pt-[clamp(0.4rem,1.2cqw,0.7rem)] pb-[clamp(0.45rem,1.3cqw,0.8rem)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-10px_18px_rgba(0,0,0,0.55)]">
				{/* Logo centrado sobre el frente negro, como en el indicador real */}
				<div className="mb-[clamp(0.35rem,1.15cqw,0.65rem)] flex shrink-0 justify-center">
					<div className="flex items-center gap-2 px-2">
						<span
							aria-hidden="true"
							className="flex size-[clamp(1.05rem,3.2cqw,1.55rem)] shrink-0 items-center justify-center rounded-full border-[#f0b429] border-[1.5px] font-black text-[#f0b429] text-[clamp(0.4rem,1.15cqw,0.58rem)] leading-none tracking-tight"
						>
							CG
						</span>
						<h2 className="truncate font-black text-[#f0b429] text-[clamp(0.8rem,2.6cqw,1.3rem)] uppercase italic leading-none tracking-[0.06em] [text-shadow:0_1px_0_#6a4e0a]">
							{brand}
						</h2>
					</div>
				</div>

				{/* LCD gris claro, como el I-QYW */}
				<div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[0.3rem] border-[#5f625c] border-[2px] bg-[linear-gradient(180deg,#eceee7_0%,#dadcd3_55%,#cbcdc3_100%)] p-[clamp(0.3rem,1.1cqw,0.6rem)] shadow-[inset_0_3px_8px_rgba(30,32,28,0.35),inset_0_-2px_4px_rgba(255,255,255,0.4)]">
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.28)_0%,rgba(255,255,255,0)_42%)]"
					/>

					<div className="relative flex min-h-0 flex-1 items-stretch gap-[clamp(0.25rem,1cqw,0.6rem)]">
						{/* Producto en báscula: entra desde arriba (Pendientes) y sale
						    hacia la derecha (Venta) al aceptar el peso. */}
						<div className="relative w-[32%] shrink-0 overflow-hidden border-[#2b2e28]/20 border-r pr-[clamp(0.3rem,1cqw,0.7rem)]">
							{shownItems.length === 0 ? (
								<div className="flex h-full items-center font-bold font-mono text-[#2b2e28]/35 text-[clamp(0.55rem,1.6cqw,0.85rem)] uppercase tracking-widest">
									Sin producto
								</div>
							) : (
								shownItems.map(({ key, item: entry, state }) => (
									<div
										key={key}
										className={cn(
											"absolute inset-0 flex flex-col justify-center pr-[clamp(0.3rem,1cqw,0.7rem)]",
											presenceClass(state, "top", "right"),
										)}
									>
										<span className="font-bold font-mono text-[#2b2e28]/60 text-[clamp(0.45rem,1.2cqw,0.7rem)] uppercase tracking-[0.18em]">
											{entry.position}
										</span>
										<span className="line-clamp-2 break-words font-black text-[#141612] text-[clamp(0.85rem,3.1cqw,1.9rem)] uppercase leading-[1.02]">
											{entry.name}
										</span>
										<span className="mt-1 font-bold font-mono text-[#2b2e28] text-[clamp(0.5rem,1.45cqw,0.85rem)] leading-tight">
											{entry.detail}
										</span>
									</div>
								))
							)}
						</div>
						<output
							aria-label={
								overload ? "Sobrecarga" : `Peso ${displayText} ${unit}`
							}
							className="relative block min-h-0 min-w-0 flex-1 overflow-hidden"
						>
							<SegmentDisplay
								text={displayText}
								digits={digits}
								className="absolute inset-0"
								onClassName="fill-[#141612]"
								ghostClassName="fill-[#141612] opacity-[0.06]"
							/>
						</output>

						<div className="flex shrink-0 flex-col items-start justify-center gap-[clamp(0.15rem,0.7cqw,0.4rem)] pr-0.5 font-bold font-mono text-[#3c3f39] text-[clamp(0.58rem,2.1cqw,0.95rem)] leading-none">
							{unitLabels.map((label) => (
								<div key={label} className="flex items-center gap-0.5">
									<span
										className={cn(
											"w-3 text-left",
											label === unit ? "opacity-100" : "opacity-0",
										)}
										aria-hidden="true"
									>
										▶
									</span>
									<span
										className={cn(
											label === unit ? "opacity-100" : "opacity-35",
										)}
									>
										{label}
									</span>
								</div>
							))}
							<div className="mt-1 pl-3">
								<BatteryIcon charged={batteryOn} />
							</div>
						</div>
					</div>

					{subline ? (
						<div className="relative mt-0.5 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5 font-bold font-mono text-[#2b2e28] text-[clamp(0.42rem,1.25cqw,0.68rem)] leading-none tracking-wide opacity-85">
							<span className="truncate">B {subline.gross}</span>
							<span className="truncate">T {subline.tare}</span>
							<span className="truncate">N {subline.net}</span>
						</div>
					) : null}

					<div className="relative mt-1 grid shrink-0 grid-cols-8 gap-0.5">
						{(Object.keys(indicatorLabels) as IqyIndicator[]).map((key) => {
							const mark = indicatorMarks[key];
							const isActive = active.includes(key);
							return (
								<div
									key={key}
									className={cn(
										"flex h-[1.1em] items-end justify-center font-black font-mono text-[clamp(0.42rem,1.3cqw,0.7rem)] leading-none",
										isActive ? "text-[#141612]" : "text-[#141612]/12",
									)}
									aria-hidden="true"
								>
									{mark}
								</div>
							);
						})}
					</div>
				</div>

				{/* Etiquetas serigrafiadas bajo el LCD, alineadas con las marcas */}
				<div className="mt-[clamp(0.22rem,0.7cqw,0.4rem)] shrink-0 px-[calc(clamp(0.3rem,1.1cqw,0.6rem)+1px)]">
					<div className="grid grid-cols-8 gap-0.5">
						{(Object.keys(indicatorLabels) as IqyIndicator[]).map((key) => {
							const isActive = active.includes(key);
							return (
								<span
									key={key}
									className={cn(
										"truncate text-center font-bold font-sans text-[clamp(0.38rem,1.15cqw,0.62rem)] uppercase leading-none tracking-[0.04em]",
										isActive ? "text-white" : "text-white/70",
									)}
								>
									{indicatorLabels[key]}
								</span>
							);
						})}
					</div>
					<p className="mt-1 font-bold text-[clamp(0.55rem,1.6cqw,0.78rem)] text-white tracking-[0.1em]">
						I-QYW
					</p>
				</div>

				{/* Botones de membrana, cuadrados, borde blanco */}
				<div className="mt-[clamp(0.3rem,1cqw,0.6rem)] flex shrink-0 items-start gap-[clamp(0.4rem,1.5cqw,0.95rem)] px-[clamp(0.1rem,1cqw,0.4rem)]">
					{buttons.map((button) => (
						<div
							key={button.id}
							className="flex shrink-0 flex-col items-center gap-1"
						>
							<button
								type="button"
								aria-label={button.label}
								disabled={button.disabled}
								onClick={button.onPress}
								className={cn(
									"flex aspect-[1.08/1] w-[clamp(2.4rem,6.4cqw,3.7rem)] flex-col items-center justify-center rounded-[0.5rem] border border-black/40 font-mono shadow-[0_2px_3px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.4)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f39a1e] active:translate-y-px active:shadow-[inset_0_2px_3px_rgba(0,0,0,0.35)] disabled:cursor-not-allowed disabled:opacity-40 [@media(max-height:860px)]:w-[2.6rem]",
									buttonTones[button.color],
								)}
							>
								<span className="max-w-full truncate font-black text-[clamp(0.58rem,2.1cqw,0.95rem)] leading-none">
									{button.top}
								</span>
								<span className="my-[0.18em] block h-px w-[62%] bg-current opacity-50" />
								<span className="max-w-full truncate font-black text-[clamp(0.52rem,1.9cqw,0.85rem)] leading-none">
									{button.bottom}
								</span>
							</button>
							<kbd className="rounded border border-white/15 bg-black/50 px-1 py-px font-bold font-mono text-[8px] text-white/55 [@media(max-height:860px)]:hidden">
								{button.shortcut}
							</kbd>
						</div>
					))}
					{undo ? (
						<div className="ml-auto flex shrink-0 flex-col items-center gap-1">
							<button
								type="button"
								onClick={undo.onPress}
								disabled={undo.disabled}
								aria-label={undo.label}
								className="flex h-[clamp(2.2rem,5.9cqw,3.4rem)] items-center gap-2 rounded-[0.5rem] border border-[#4a4f56] bg-gradient-to-b from-[#2f3339] to-[#1d2024] px-[clamp(0.6rem,1.8cqw,1.1rem)] font-bold font-mono text-[#e9e4d8] text-[clamp(0.55rem,1.5cqw,0.8rem)] uppercase tracking-wider shadow-[0_2px_3px_rgba(0,0,0,0.5)] transition hover:border-[#f39a1e] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 [@media(max-height:860px)]:h-[2.4rem]"
							>
								<Undo2 aria-hidden="true" className="size-[1.2em]" />
								{undo.label}
							</button>
							<kbd className="rounded border border-white/15 bg-black/50 px-1 py-px font-bold font-mono text-[8px] text-white/55 [@media(max-height:860px)]:hidden">
								{undo.shortcut}
							</kbd>
						</div>
					) : null}
				</div>
			</div>
		</section>
	);
}
