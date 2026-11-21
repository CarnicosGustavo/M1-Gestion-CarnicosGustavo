"use client";

import { cn } from "@finopenpos/ui/lib/utils";
import {
	ChevronRight,
	CircleHelp,
	Keyboard,
	Wifi,
	WifiOff,
} from "lucide-react";
import { AntonellaAvatar } from "@/components/antonella-avatar";

export interface StatusStripProps {
	orderCount: number;
	scaleLabel: string;
	scaleConnected: boolean;
	statusDetail?: string | null;
	themeLabel: string;
	onOpenCheatsheet: () => void;
	onAsk?: (q: string) => void;
}

export function StatusStrip({
	orderCount,
	scaleLabel,
	scaleConnected,
	statusDetail,
	themeLabel,
	onOpenCheatsheet,
	onAsk,
}: StatusStripProps) {
	const orderMessage =
		orderCount > 0
			? `Hay ${orderCount} pedido${orderCount === 1 ? "" : "s"} por pesar.`
			: "No hay pedidos pendientes de pesaje.";

	return (
		<div className="flex h-12 shrink-0 items-center gap-3 rounded-lg border border-border bg-card px-3 text-sm shadow-sm">
			<div className="relative shrink-0">
				<AntonellaAvatar size={32} />
				{onAsk ? (
					<button
						type="button"
						onClick={() => onAsk(orderMessage)}
						className="absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
						aria-label="Preguntar a Antonella"
					>
						<CircleHelp className="h-2.5 w-2.5" aria-hidden="true" />
					</button>
				) : null}
			</div>

			<div className="min-w-0 flex-1">
				<p className="truncate font-medium">{orderMessage}</p>
				{statusDetail ? (
					<p className="truncate text-muted-foreground text-xs">
						{statusDetail}
					</p>
				) : null}
			</div>

			<p
				className={cn(
					"hidden items-center gap-1.5 rounded-md border px-2 py-1 font-medium text-xs md:flex",
					scaleConnected
						? "border-emerald-200 bg-emerald-50 text-emerald-800"
						: "border-destructive/30 bg-destructive/10 text-destructive",
				)}
			>
				<span className="sr-only">
					{scaleConnected
						? `Báscula conectada: ${scaleLabel}`
						: `Báscula desconectada: ${scaleLabel}`}
				</span>
				{scaleConnected ? (
					<Wifi className="h-3.5 w-3.5" aria-hidden="true" />
				) : (
					<WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
				)}
				<span className="max-w-36 truncate">{scaleLabel}</span>
			</p>

			<span className="hidden truncate text-muted-foreground text-xs lg:block">
				Tema: {themeLabel}
			</span>

			<button
				type="button"
				onClick={onOpenCheatsheet}
				className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 font-medium text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
				aria-label="Abrir atajos de teclado"
			>
				<Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
				Atajos
				<ChevronRight className="h-3 w-3" aria-hidden="true" />
			</button>
		</div>
	);
}
