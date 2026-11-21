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
	color: "red" | "orange" | "cyan";
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

const unitLabels = ["pcs", "lb", "kg"] as const;

const buttonTones: Record<IqyButton["color"], string> = {
	red: "border-b-[#7d1017] bg-gradient-to-b from-[#ef3a43] to-[#c71923] text-white",
	orange:
		"border-b-[#9b5806] bg-gradient-to-b from-[#ffae32] to-[#e4830c] text-[#171717]",
	cyan: "border-b-[#176782] bg-gradient-to-b from-[#55c9ef] to-[#2899c4] text-[#08222c]",
};

function ActiveTriangle({ active }: { active: boolean }) {
	return (
		<svg
			aria-hidden="true"
			className={cn(
				"size-2.5 shrink-0 transition-colors",
				active ? "fill-black" : "fill-[#888c84]",
			)}
			viewBox="0 0 10 9"
		>
			<path d="M5 0 10 9H0Z" />
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

	return (
		<section
			aria-label="Báscula I-QY"
			onMouseDown={onFocusPanel}
			className={cn(
				"@container flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[1.6rem] border-[#3a3a3a] border-[3px] bg-[#181818] p-[clamp(0.5rem,1.4cqw,1rem)] text-[#e7e7e7] shadow-[inset_0_2px_3px_rgba(255,255,255,0.08),inset_0_-8px_16px_rgba(0,0,0,0.72),0_12px_30px_rgba(0,0,0,0.55)]",
				focused && "border-[#f39a1e]",
				className,
			)}
		>
			<div className="flex shrink-0 items-center justify-between gap-3 px-1 pb-[clamp(0.25rem,0.8cqw,0.5rem)]">
				<h2 className="truncate font-black text-[#f39a1e] text-[clamp(0.95rem,3.2cqw,1.65rem)] tracking-[0.02em] [@media(max-height:860px)]:text-base">
					{brand}
				</h2>
				<div className="flex shrink-0 items-center gap-1.5 font-semibold text-[#777] text-[10px] uppercase tracking-[0.18em]">
					<span className="size-1.5 rounded-full bg-[#555] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]" />
					<span>Rhino I-QY</span>
				</div>
			</div>

			<div className="relative flex min-h-[5.5rem] flex-1 flex-col rounded-[0.8rem] border border-[#55584f] bg-[#c9ccc4] p-[clamp(0.5rem,1.8cqw,1rem)] shadow-[inset_0_4px_9px_rgba(31,36,29,0.48),inset_0_-3px_7px_rgba(255,255,255,0.48),0_1px_0_rgba(255,255,255,0.08)]">
				<div className="flex min-h-0 flex-1 items-stretch gap-2">
					<output
						aria-label={overload ? "Sobrecarga" : `Peso ${displayText} ${unit}`}
						className="relative block min-h-[2.5rem] min-w-0 flex-1 overflow-hidden"
					>
						<SegmentDisplay
							text={displayText}
							digits={digits}
							className="absolute inset-0 py-1"
						/>
					</output>

					<div className="flex shrink-0 flex-col items-end justify-center gap-1 font-bold font-mono text-[#31352e] text-[clamp(0.7rem,2.6cqw,1.35rem)]">
						{unitLabels.map((label) => (
							<div key={label} className="flex items-center gap-1 leading-none">
								<span
									className={cn(label === unit ? "opacity-100" : "opacity-45")}
								>
									{label}
								</span>
								<span
									className={cn(
										"w-3 text-left",
										label === unit ? "opacity-100" : "opacity-0",
									)}
								>
									◄
								</span>
							</div>
						))}
					</div>
				</div>

				<div className="mt-1 grid shrink-0 grid-cols-8 gap-x-1 border-[#8d9187]/55 border-t pt-1.5">
					{Object.entries(indicatorLabels).map(([key, label]) => {
						const indicator = key as IqyIndicator;
						const isActive = active.includes(indicator);

						return (
							<div
								key={indicator}
								className={cn(
									"flex min-w-0 items-center justify-center gap-1 font-bold font-mono text-[clamp(0.45rem,1.45cqw,0.72rem)] leading-none tracking-tight",
									isActive ? "text-black" : "text-[#656960]",
								)}
							>
								<ActiveTriangle active={isActive} />
								<span className="truncate">{label}</span>
							</div>
						);
					})}
				</div>

				{subline ? (
					<div className="mt-1.5 grid shrink-0 grid-cols-3 divide-x divide-[#858a80]/50 border-[#858a80]/55 border-t pt-1 font-bold font-mono text-[#343831] text-[clamp(0.48rem,1.55cqw,0.78rem)]">
						<div className="truncate px-1">
							<span className="opacity-60">BRUTO </span>
							<span className="tabular-nums">{subline.gross}</span>
						</div>
						<div className="truncate px-1">
							<span className="opacity-60">TARA </span>
							<span className="tabular-nums">{subline.tare}</span>
						</div>
						<div className="truncate px-1">
							<span className="opacity-60">NETO </span>
							<span className="tabular-nums">{subline.net}</span>
						</div>
					</div>
				) : null}
			</div>

			<div className="mt-[clamp(0.4rem,1.2cqw,0.7rem)] grid shrink-0 grid-cols-6 gap-[clamp(0.45rem,1.5cqw,0.9rem)]">
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
								"group flex h-[clamp(2.4rem,6.5cqw,3.8rem)] w-full min-w-0 flex-col items-center justify-center rounded-[0.65rem] border border-black/20 border-b-[3px] font-mono shadow-[0_3px_4px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.28)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f39a1e] active:translate-y-px active:shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.18)] disabled:cursor-not-allowed disabled:opacity-40 [@media(max-height:860px)]:h-8 [@media(max-height:860px)]:flex-row [@media(max-height:860px)]:gap-2",
								buttonTones[button.color],
							)}
						>
							<span className="max-w-full truncate font-black text-[clamp(0.65rem,2.6cqw,1.2rem)] leading-none">
								{button.top}
							</span>
							<span className="my-1 block h-px w-[58%] bg-current opacity-45 [@media(max-height:860px)]:my-0 [@media(max-height:860px)]:h-3 [@media(max-height:860px)]:w-px" />
							<span className="max-w-full truncate font-black text-[clamp(0.6rem,2.35cqw,1.05rem)] leading-none">
								{button.bottom}
							</span>
						</button>
						<kbd className="rounded border border-[#454545] bg-[#101010] px-1.5 py-0.5 font-bold font-mono text-[#9b9b9b] text-[9px] shadow-[0_1px_0_rgba(255,255,255,0.08)] [@media(max-height:860px)]:hidden">
							{button.shortcut}
						</kbd>
					</div>
				))}
			</div>
		</section>
	);
}
