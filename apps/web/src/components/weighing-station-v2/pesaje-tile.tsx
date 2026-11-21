"use client";

import { cn } from "@finopenpos/ui/lib/utils";
import type * as React from "react";

export interface PesajeTileProps {
	id: 1 | 2 | 3 | 4 | 5;
	title: string;
	shortcut: string;
	focused: boolean;
	children: React.ReactNode;
	className?: string;
	bodyClassName?: string;
	onFocusTile?: () => void;
}

export function PesajeTile({
	id,
	title,
	shortcut,
	focused,
	children,
	className,
	bodyClassName,
	onFocusTile,
}: PesajeTileProps) {
	return (
		<section
			id={`pesaje-tile-${id}`}
			aria-label={title}
			data-focused={focused ? "true" : "false"}
			className={cn(
				"flex min-h-0 flex-col overflow-hidden rounded-lg border-2 bg-card text-card-foreground transition-colors",
				focused ? "border-primary" : "border-transparent",
				!focused && "shadow-[inset_0_0_0_1px_var(--border)]",
				className,
			)}
			onFocus={onFocusTile}
			onMouseDown={onFocusTile}
		>
			<header className="flex h-9 shrink-0 items-center justify-between gap-2 border-border border-b bg-[var(--cg-cream)]/50 px-3">
				<h2 className="min-w-0 truncate font-semibold text-xs uppercase tracking-wide">
					{title}
				</h2>
				<kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-medium font-mono text-[10px] text-muted-foreground leading-none">
					{shortcut}
				</kbd>
			</header>
			<div className={cn("min-h-0 flex-1 overflow-y-auto", bodyClassName)}>
				{children}
			</div>
		</section>
	);
}
