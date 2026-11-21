"use client";

import { cn } from "@finopenpos/ui/lib/utils";
import { SegmentDisplay } from "./segment-display";

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
	orange: "bg-gradient-to-b from-[#ffe14a] to-[#f0c400] text-[#1a1400]",
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
				charged ? "text-[#152029]" : "text-[#152029]/30",
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
	focused?: boolean;
	className?: string;
	onFocusPanel?: () => void;
}) {
	const displayText = overload ? "-OL-" : valueText;
	const batteryOn = active.includes("bateria");

	return (
		<section
			aria-label="Báscula I-QY"
			onMouseDown={onFocusPanel}
			className={cn(
				"@container flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[1.85rem] p-[clamp(0.4rem,1.4cqw,0.85rem)]",
				"bg-[linear-gradient(180deg,#f0f2f4_0%,#c5c9ce_42%,#9ea4ab_100%)]",
				"shadow-[inset_0_2px_0_rgba(255,255,255,0.72),inset_0_-4px_8px_rgba(0,0,0,0.28),0_10px_24px_rgba(0,0,0,0.35)]",
				"ring-1 ring-[#8b9097]",
				focused && "ring-2 ring-[#f39a1e]",
				className,
			)}
		>
			{/* Frente negro brillante del indicador */}
			<div className="flex min-h-0 flex-1 flex-col rounded-[1.15rem] bg-[#0b0b0d] px-[clamp(0.55rem,1.8cqw,1.1rem)] pt-[clamp(0.4rem,1.2cqw,0.7rem)] pb-[clamp(0.45rem,1.3cqw,0.8rem)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-10px_18px_rgba(0,0,0,0.55)]">
				{/* Logo centrado, estilo placa Rhino: recuadro negro, borde blanco, tipografía dorada */}
				<div className="mb-[clamp(0.35rem,1.15cqw,0.65rem)] flex shrink-0 justify-center">
					<div className="flex items-center gap-2 rounded-[3px] border-2 border-white bg-black px-[clamp(0.55rem,1.8cqw,0.95rem)] py-[clamp(0.15rem,0.55cqw,0.3rem)] shadow-[0_0_0_1px_#111]">
						<span
							aria-hidden="true"
							className="flex size-[clamp(1.05rem,3.2cqw,1.55rem)] shrink-0 items-center justify-center rounded-full border-[#e8c547] border-[1.5px] font-black text-[#e8c547] text-[clamp(0.4rem,1.15cqw,0.58rem)] leading-none tracking-tight"
						>
							CG
						</span>
						<h2 className="truncate font-black text-[#e8c547] text-[clamp(0.72rem,2.5cqw,1.2rem)] leading-none tracking-[0.04em] [text-shadow:0_1px_0_#6a4e0a]">
							{brand}
						</h2>
					</div>
				</div>

				{/* LCD celeste retroiluminado */}
				<div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[0.35rem] border border-[#3a6a80] bg-[linear-gradient(180deg,#c5ebf6_0%,#8fd0ea_55%,#7ec4e0_100%)] p-[clamp(0.3rem,1.1cqw,0.6rem)] shadow-[inset_0_3px_8px_rgba(20,50,70,0.35),inset_0_-2px_4px_rgba(255,255,255,0.35)]">
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.28)_0%,rgba(255,255,255,0)_42%)]"
					/>

					<div className="relative flex min-h-0 flex-1 items-stretch gap-[clamp(0.25rem,1cqw,0.6rem)]">
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
								onClassName="fill-[#101820]"
								ghostClassName="fill-[#101820] opacity-[0.08]"
							/>
						</output>

						<div className="flex shrink-0 flex-col items-start justify-center gap-[clamp(0.15rem,0.7cqw,0.4rem)] pr-0.5 font-bold font-mono text-[#152029] text-[clamp(0.58rem,2.1cqw,0.95rem)] leading-none">
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
						<div className="relative mt-0.5 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5 font-bold font-mono text-[#1a2a33] text-[clamp(0.42rem,1.25cqw,0.68rem)] leading-none tracking-wide opacity-85">
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
										isActive ? "text-[#101820]" : "text-[#101820]/15",
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
					<p className="mt-1 font-black text-[clamp(0.62rem,1.9cqw,0.88rem)] text-white tracking-[0.14em]">
						I-QY
					</p>
				</div>

				{/* Botones de membrana, cuadrados, borde blanco */}
				<div className="mt-[clamp(0.4rem,1.3cqw,0.75rem)] grid shrink-0 grid-cols-6 gap-[clamp(0.35rem,1.4cqw,0.8rem)] px-[clamp(0.1rem,1cqw,0.4rem)]">
					{buttons.map((button) => (
						<div
							key={button.id}
							className="flex min-w-0 flex-col items-center gap-1"
						>
							<button
								type="button"
								aria-label={button.label}
								disabled={button.disabled}
								onClick={button.onPress}
								className={cn(
									"flex aspect-[1.15/1] h-[clamp(2.15rem,22%,3.35rem)] w-full min-w-0 max-w-[5.2rem] flex-col items-center justify-center self-center rounded-[0.45rem] border-2 border-white font-mono shadow-[0_2px_3px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.35)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f39a1e] active:translate-y-px active:shadow-[inset_0_2px_3px_rgba(0,0,0,0.35)] disabled:cursor-not-allowed disabled:opacity-40 [@media(max-height:860px)]:h-[2.45rem] [@media(max-height:860px)]:max-w-[4.4rem]",
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
				</div>
			</div>
		</section>
	);
}
