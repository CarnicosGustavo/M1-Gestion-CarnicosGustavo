"use client";

import { Button } from "@finopenpos/ui/components/button";
import { cn } from "@finopenpos/ui/lib/utils";
import { X } from "lucide-react";
import * as React from "react";

const FOCUSABLE_SELECTOR = [
	"a[href]",
	"button:not([disabled])",
	"textarea:not([disabled])",
	"input:not([disabled]):not([type='hidden'])",
	"select:not([disabled])",
	"[tabindex]:not([tabindex='-1'])",
].join(",");

export interface OverlayFrameProps {
	title: string;
	subtitle?: string;
	onClose: () => void;
	children: React.ReactNode;
	initialFocusRef?: React.RefObject<HTMLElement | null>;
}

export function OverlayFrame({
	title,
	subtitle,
	onClose,
	children,
	initialFocusRef,
}: OverlayFrameProps) {
	const panelRef = React.useRef<HTMLDivElement>(null);
	const titleId = React.useId();
	const subtitleId = React.useId();

	React.useEffect(() => {
		const previouslyFocused =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		const target = initialFocusRef?.current ?? panelRef.current;

		window.requestAnimationFrame(() => {
			target?.focus();
		});

		return () => {
			previouslyFocused?.focus();
		};
	}, [initialFocusRef]);

	const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== "Tab" || !panelRef.current) {
			return;
		}

		const focusable = Array.from(
			panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
		).filter(
			(element) =>
				element.offsetParent !== null && !element.hasAttribute("disabled"),
		);

		if (focusable.length === 0) {
			event.preventDefault();
			panelRef.current.focus();
			return;
		}

		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		const active = document.activeElement;

		if (event.shiftKey && (active === first || active === panelRef.current)) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && active === last) {
			event.preventDefault();
			first.focus();
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-[4vh_4vw]">
			<button
				type="button"
				className="absolute inset-0 bg-black/50"
				aria-label="Cerrar"
				onClick={onClose}
			/>
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				aria-describedby={subtitle ? subtitleId : undefined}
				tabIndex={-1}
				onKeyDown={handleKeyDown}
				className={cn(
					"relative z-10 flex h-[90vh] w-[92vw] max-w-[1400px] flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-2xl outline-none",
					"focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-black/50",
				)}
			>
				<header className="flex shrink-0 items-start justify-between gap-4 border-border border-b bg-[var(--cg-cream)]/50 px-5 py-4">
					<div className="min-w-0">
						<h2
							id={titleId}
							className="font-display text-2xl uppercase tracking-wide"
						>
							{title}
						</h2>
						{subtitle ? (
							<p id={subtitleId} className="mt-1 text-muted-foreground text-sm">
								{subtitle}
							</p>
						) : null}
					</div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={onClose}
						aria-label="Cerrar"
					>
						<X className="h-4 w-4" aria-hidden="true" />
						Cerrar
					</Button>
				</header>
				<div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
			</div>
		</div>
	);
}
