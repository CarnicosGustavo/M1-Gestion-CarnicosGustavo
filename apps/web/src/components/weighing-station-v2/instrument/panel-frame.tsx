"use client";

import { cn } from "@finopenpos/ui/lib/utils";
import type { ReactNode } from "react";

export function PanelFrame({
	number,
	title,
	shortcut,
	focused = false,
	children,
	className,
	bodyClassName,
	onFocusPanel,
}: {
	number: number;
	title: string;
	shortcut: string;
	focused?: boolean;
	children: ReactNode;
	className?: string;
	bodyClassName?: string;
	onFocusPanel?: () => void;
}) {
	return (
		<section
			aria-label={title}
			onMouseDown={onFocusPanel}
			className={cn(
				"flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-[var(--pz-panel,#1b1f24)] text-[#edf1f5] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_4px_12px_rgba(0,0,0,0.2)] transition-colors focus:outline-none",
				focused
					? "border-[var(--pz-accent,#f39a1e)]"
					: "border-[var(--pz-panel-border,#2d333b)]",
				className,
			)}
		>
			<header className="flex shrink-0 items-center gap-2.5 border-[var(--pz-panel-border,#2d333b)] border-b bg-[var(--pz-panel-head,#20252b)] px-3 py-2">
				<span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-[#505963] bg-[#15191e] font-black font-mono text-[#f39a1e] text-[10px]">
					{number}
				</span>
				<h2 className="min-w-0 flex-1 truncate font-black text-[#e4e8ec] text-[11px] uppercase tracking-[0.16em]">
					{title}
				</h2>
				<kbd className="shrink-0 rounded border border-[#4b535d] bg-[#111419] px-1.5 py-0.5 font-bold font-mono text-[#aeb7c1] text-[9px] shadow-[0_1px_0_rgba(255,255,255,0.06)]">
					{shortcut}
				</kbd>
			</header>

			<div className={cn("min-h-0 flex-1 overflow-y-auto", bodyClassName)}>
				{children}
			</div>
		</section>
	);
}

export function PanelRow({
	label,
	value,
	accent = false,
	wrap = false,
}: {
	label: string;
	value: ReactNode;
	accent?: boolean;
	/** Texto largo (cliente): se parte en renglones en vez de cortarse. */
	wrap?: boolean;
}) {
	return (
		<div className="flex items-center justify-between gap-3 border-[var(--pz-panel-border,#2d333b)]/75 border-b px-3 py-2.5 last:border-b-0">
			<span className="shrink-0 font-medium text-[#9aa4ae] text-[11px] uppercase tracking-wide">
				{label}
			</span>
			<span
				className={cn(
					"min-w-0 text-right font-semibold text-[#f4f6f8] text-sm",
					wrap ? "line-clamp-2 break-words leading-tight" : "truncate",
					accent && "text-[#f39a1e]",
				)}
			>
				{value}
			</span>
		</div>
	);
}

export function PanelListItem({
	title,
	subtitle,
	selected = false,
	onSelect,
	badge,
}: {
	title: string;
	subtitle?: string;
	selected?: boolean;
	onSelect?: () => void;
	badge?: ReactNode;
}) {
	return (
		<button
			type="button"
			aria-pressed={selected}
			onClick={onSelect}
			className={cn(
				"flex w-full items-center gap-3 border-[var(--pz-panel-border,#2d333b)]/75 border-b px-3.5 py-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f39a1e] focus-visible:ring-inset [@media(max-height:860px)]:py-2.5",
				selected
					? "bg-[#1f5fa3] text-white"
					: "bg-transparent text-[#edf1f5] hover:bg-[#252b31]",
			)}
		>
			<span className="min-w-0 flex-1">
				<span className="line-clamp-2 block break-words font-bold text-[15px] leading-tight">
					{title}
				</span>
				{subtitle ? (
					<span
						className={cn(
							"mt-1 block truncate text-xs",
							selected ? "text-white/70" : "text-[#8e99a4]",
						)}
					>
						{subtitle}
					</span>
				) : null}
			</span>
			{badge !== undefined ? (
				<span
					className={cn(
						"shrink-0 rounded border px-1.5 py-0.5 font-bold font-mono text-[9px]",
						selected
							? "border-white/25 bg-black/15 text-white"
							: "border-[#49515b] bg-[#111419] text-[#b9c1ca]",
					)}
				>
					{badge}
				</span>
			) : null}
		</button>
	);
}
