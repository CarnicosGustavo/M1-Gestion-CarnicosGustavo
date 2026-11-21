"use client";

import { cn } from "@finopenpos/ui/lib/utils";
import type { ReactNode } from "react";

export interface FnKey {
	id: string;
	label: string;
	shortcut: string;
	onPress: () => void;
	active?: boolean;
	wide?: boolean;
	tone?: "neutral" | "red" | "orange" | "cyan" | "green";
	disabled?: boolean;
}

const keyTones: Record<NonNullable<FnKey["tone"]>, string> = {
	neutral:
		"border-[#111] bg-gradient-to-b from-[#383838] to-[#252525] text-[#e8e8e8]",
	red: "border-[#711117] bg-gradient-to-b from-[#d83b43] to-[#a91b23] text-white",
	orange:
		"border-[#945406] bg-gradient-to-b from-[#f7a624] to-[#db7d08] text-[#171717]",
	cyan: "border-[#176079] bg-gradient-to-b from-[#43b7df] to-[#2787ad] text-[#08232c]",
	green:
		"border-[#255b2e] bg-gradient-to-b from-[#50a95b] to-[#347d3e] text-white",
};

function FunctionKey({ item }: { item: FnKey }) {
	return (
		<button
			type="button"
			aria-label={item.label}
			aria-pressed={item.active}
			disabled={item.disabled}
			onClick={item.onPress}
			className={cn(
				"relative flex min-h-[2.15rem] w-full min-w-[4.6rem] flex-row items-center justify-center gap-1.5 rounded-md border border-b-[3px] px-2 py-1 font-bold font-mono text-[11px] uppercase tracking-wide shadow-[0_3px_5px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.12)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f39a1e] active:translate-y-px active:shadow-[0_1px_2px_rgba(0,0,0,0.4)] disabled:cursor-not-allowed disabled:opacity-40",
				keyTones[item.tone ?? "neutral"],
				item.active && "border-[#f39a1e] ring-1 ring-[#f39a1e]/70",
			)}
		>
			<span className="max-w-full truncate">{item.label}</span>
			<kbd className="rounded border border-current/20 bg-black/20 px-1 font-bold font-mono text-[8px] leading-none opacity-70">
				{item.shortcut}
			</kbd>
			{item.active ? (
				<span
					aria-hidden="true"
					className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-[#f39a1e] shadow-[0_0_6px_#f39a1e]"
				/>
			) : null}
		</button>
	);
}

export function FunctionScreen({
	title,
	subtitle,
	left,
	right,
	bottom,
	children,
	focused = false,
	className,
	onFocusPanel,
}: {
	title: string;
	subtitle?: string;
	left: FnKey[];
	right: FnKey[];
	bottom: FnKey[];
	children: ReactNode;
	focused?: boolean;
	className?: string;
	onFocusPanel?: () => void;
}) {
	return (
		<section
			aria-label={title}
			onMouseDown={onFocusPanel}
			className={cn(
				"grid h-full min-h-0 w-full grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-[minmax(0,1fr)_auto] gap-3 overflow-hidden rounded-[1.5rem] border-[#393939] border-[3px] bg-[#181818] p-3 text-[#e8e8e8] shadow-[inset_0_2px_3px_rgba(255,255,255,0.07),inset_0_-7px_16px_rgba(0,0,0,0.65),0_12px_30px_rgba(0,0,0,0.5)] [@media(max-height:860px)]:gap-2 [@media(max-height:860px)]:p-2",
				focused && "border-[#f39a1e]",
				className,
			)}
		>
			<div className="flex min-h-0 flex-col justify-between gap-2 [@media(max-height:860px)]:gap-1">
				{left.map((item) => (
					<FunctionKey key={item.id} item={item} />
				))}
			</div>

			<div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-[#25382c] bg-[#0e1a14] shadow-[inset_0_0_22px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.04)]">
				<div className="shrink-0 border-[#314b39] border-b bg-[#13231a] px-4 py-2.5">
					<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
						<h2 className="font-black font-mono text-[#9be59b] text-sm uppercase tracking-[0.14em]">
							{title}
						</h2>
						{subtitle ? (
							<p className="font-mono text-[#79b87b] text-[10px] uppercase tracking-wider">
								{subtitle}
							</p>
						) : null}
					</div>
				</div>

				<div
					className="relative min-h-0 flex-1 overflow-y-auto p-4 font-mono text-[#9be59b]"
					style={{
						backgroundImage:
							"linear-gradient(rgba(108,176,112,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(108,176,112,0.09) 1px, transparent 1px)",
						backgroundSize: "18px 18px",
					}}
				>
					{children}
				</div>
			</div>

			<div className="flex min-h-0 flex-col justify-between gap-2 [@media(max-height:860px)]:gap-1">
				{right.map((item) => (
					<FunctionKey key={item.id} item={item} />
				))}
			</div>

			<div className="col-span-3 flex min-h-0 flex-wrap items-stretch justify-center gap-2 border-[#303030] border-t bg-[#141414] px-1 pt-3 [@media(max-height:860px)]:pt-2">
				{bottom.map((item) => (
					<div
						key={item.id}
						className={cn(
							"flex",
							item.wide ? "min-w-[9rem] flex-[2]" : "min-w-[5rem] flex-1",
						)}
					>
						<FunctionKey item={item} />
					</div>
				))}
			</div>
		</section>
	);
}

export function FnScreenRow({
	label,
	value,
	highlight = false,
}: {
	label: string;
	value: ReactNode;
	highlight?: boolean;
}) {
	return (
		<div className="flex items-center gap-3 border-[#355440]/50 border-b py-2 last:border-b-0">
			<span className="shrink-0 font-bold text-[#72b777] text-[11px] uppercase tracking-[0.12em]">
				{label}
			</span>
			<span
				aria-hidden="true"
				className="min-w-4 flex-1 border-[#54845a]/70 border-b border-dotted"
			/>
			<span
				className={cn(
					"shrink-0 text-right font-bold text-sm tabular-nums",
					highlight ? "text-[#c9ff99]" : "text-[#9be59b]",
				)}
			>
				{value}
			</span>
		</div>
	);
}

export function FnScreenOption({
	selected = false,
	label,
	hint,
	onSelect,
	shortcut,
}: {
	selected: boolean;
	label: string;
	hint?: string;
	onSelect: () => void;
	shortcut: string;
}) {
	return (
		<button
			type="button"
			aria-pressed={selected}
			onClick={onSelect}
			className={cn(
				"flex w-full items-center gap-3 border-[#355440]/50 border-b px-2 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f39a1e]",
				selected
					? "bg-[#26583b] text-[#d5ffd1]"
					: "text-[#9be59b] hover:bg-[#193625]",
			)}
		>
			<span
				className={cn(
					"w-4 shrink-0 text-sm",
					selected ? "opacity-100" : "opacity-0",
				)}
				aria-hidden="true"
			>
				▶
			</span>
			<span className="min-w-0 flex-1 truncate font-bold text-xs uppercase tracking-wider">
				{label}
			</span>
			{hint ? (
				<span className="max-w-[45%] truncate text-[#70b878] text-[10px]">
					{hint}
				</span>
			) : null}
			<kbd className="shrink-0 rounded border border-[#4d7652] bg-[#0b1710] px-1.5 py-0.5 font-bold text-[#9be59b] text-[9px]">
				{shortcut}
			</kbd>
		</button>
	);
}
