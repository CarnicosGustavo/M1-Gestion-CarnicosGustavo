"use client";

import { cn } from "@finopenpos/ui/lib/utils";
import type { ReactNode } from "react";

export interface FnKey {
	id: string;
	label: string;
	shortcut: string;
	onPress: () => void;
	active?: boolean;
	tone?: "neutral" | "red" | "orange" | "cyan" | "green";
	disabled?: boolean;
	icon?: ReactNode;
	/** Tecla de mantener (micrófono): se usa en vez de onPress. */
	onHoldStart?: () => void;
	onHoldEnd?: () => void;
}

export interface FnKeyGroup {
	id: string;
	label: string;
	keys: FnKey[];
}

const keyTones: Record<NonNullable<FnKey["tone"]>, string> = {
	neutral:
		"border-[#3a3f46] bg-gradient-to-b from-[#2c3036] to-[#202328] text-[#e9e4d8] hover:from-[#33383f]",
	red: "border-[#8a1d24] bg-gradient-to-b from-[#c8353d] to-[#9f1d25] text-white",
	orange:
		"border-[#a35d07] bg-gradient-to-b from-[#f7a624] to-[#db7d08] text-[#1b1206]",
	cyan: "border-[#1d6a86] bg-gradient-to-b from-[#3aa9d1] to-[#23799b] text-[#05202a]",
	green:
		"border-[#2a6633] bg-gradient-to-b from-[#4da657] to-[#347d3e] text-white",
};

function FunctionKey({ item }: { item: FnKey }) {
	return (
		<button
			type="button"
			aria-label={item.label}
			aria-pressed={item.active}
			disabled={item.disabled}
			onClick={item.onHoldStart ? undefined : item.onPress}
			onPointerDown={
				item.onHoldStart
					? (event) => {
							event.currentTarget.setPointerCapture(event.pointerId);
							item.onHoldStart?.();
						}
					: undefined
			}
			onPointerUp={item.onHoldStart ? () => item.onHoldEnd?.() : undefined}
			onPointerCancel={item.onHoldStart ? () => item.onHoldEnd?.() : undefined}
			className={cn(
				"relative flex h-full min-h-[3rem] w-full min-w-0 touch-none select-none flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg border px-2 pt-1.5 pb-1 font-mono uppercase shadow-[0_2px_0_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f39a1e] active:translate-y-px active:shadow-none disabled:cursor-not-allowed disabled:opacity-40 [@media(max-height:860px)]:min-h-[2.6rem]",
				keyTones[item.tone ?? "neutral"],
				item.active &&
					"border-[#f39a1e] from-[#3a2a10] to-[#2a1e0b] text-[#f39a1e] shadow-[0_0_0_1px_#f39a1e55,0_2px_0_rgba(0,0,0,0.55)]",
			)}
		>
			{item.active ? (
				<span
					aria-hidden="true"
					className="absolute inset-x-3 top-0 h-[3px] rounded-b bg-[#f39a1e] shadow-[0_0_8px_#f39a1e]"
				/>
			) : null}
			<span className="flex max-w-full items-center gap-1.5 truncate font-bold text-[12px] tracking-[0.08em]">
				{item.icon}
				{item.label}
			</span>
			<kbd className="max-w-full truncate font-mono font-normal text-[9px] tracking-wide opacity-55">
				{item.shortcut}
			</kbd>
		</button>
	);
}

/**
 * 7 · Pantalla de funciones a todo lo ancho, con una sola fila de teclas
 * agrupadas debajo (báscula · módulos · sistema).
 */
export function FunctionScreen({
	title,
	subtitle,
	groups,
	children,
	focused = false,
	className,
	onFocusPanel,
}: {
	title: string;
	subtitle?: string;
	groups: FnKeyGroup[];
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
				"flex h-full min-h-0 w-full flex-col gap-2.5 overflow-hidden rounded-[1.5rem] border-[#393939] border-[3px] bg-[#181818] p-2.5 text-[#e8e8e8] shadow-[inset_0_2px_3px_rgba(255,255,255,0.07),inset_0_-7px_16px_rgba(0,0,0,0.65),0_12px_30px_rgba(0,0,0,0.5)] [@media(max-height:860px)]:gap-2 [@media(max-height:860px)]:p-2",
				focused && "border-[#f39a1e]",
				className,
			)}
		>
			<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-[#25382c] bg-[#0e1a14] shadow-[inset_0_0_22px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.04)]">
				<div className="shrink-0 border-[#314b39] border-b bg-[#13231a] px-4 py-2">
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
					className="relative min-h-0 flex-1 overflow-y-auto px-4 py-3 font-mono text-[#9be59b]"
					style={{
						backgroundImage:
							"linear-gradient(rgba(108,176,112,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(108,176,112,0.09) 1px, transparent 1px)",
						backgroundSize: "18px 18px",
					}}
				>
					{children}
				</div>
			</div>

			<div className="flex shrink-0 items-stretch gap-3">
				{groups.map((group, index) => (
					<fieldset
						key={group.id}
						className={cn(
							"m-0 flex min-w-0 basis-0 flex-col gap-1 border-0 p-0",
							index > 0 && "border-[#2c3036] border-l pl-3",
						)}
						// Cada grupo crece según cuántas teclas tiene: todas miden igual.
						style={{ flexGrow: group.keys.length }}
					>
						<legend className="float-left mb-1 w-full px-1 font-mono text-[#6f7782] text-[9px] uppercase tracking-[0.2em] [@media(max-height:860px)]:sr-only">
							{group.label}
						</legend>
						<div className="flex min-h-0 flex-1 gap-1.5">
							{group.keys.map((item) => (
								<div key={item.id} className="min-w-0 flex-1">
									<FunctionKey item={item} />
								</div>
							))}
						</div>
					</fieldset>
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
