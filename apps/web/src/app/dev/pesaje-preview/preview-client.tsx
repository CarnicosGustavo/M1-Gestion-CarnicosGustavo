"use client";

import { ScaleIcon } from "lucide-react";
import { AntonellaProvider } from "@/components/antonella-dock";
import { PesajeStation } from "@/components/weighing-station-v2/pesaje-station";

export function PesajePreviewClient() {
	return (
		<div className="flex h-screen w-full flex-col bg-background">
			<header className="grid h-[60px] shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b bg-card px-4">
				<h1 className="font-display text-xl tracking-wide">Báscula</h1>
				<div className="flex flex-col items-center leading-none">
					<span className="font-semibold text-[9px] text-primary tracking-[0.32em]">
						CÁRNICOS
					</span>
					<span className="font-display text-[17px] tracking-[0.04em]">
						GUSTAVO
					</span>
				</div>
				<p className="justify-self-end text-muted-foreground text-xs">
					Vista previa local (datos de ejemplo)
				</p>
			</header>
			<div className="flex min-h-0 flex-1">
				<nav
					aria-label="Rail de demostración"
					className="hidden w-[64px] shrink-0 flex-col items-center gap-1.5 bg-[var(--cg-chrome)] px-2 py-3.5 sm:flex"
				>
					<span className="flex h-[46px] w-[46px] items-center justify-center rounded-[13px] bg-primary text-[var(--cg-chrome-fg)]">
						<ScaleIcon className="h-[21px] w-[21px]" aria-hidden="true" />
						<span className="sr-only">Báscula</span>
					</span>
				</nav>
				<main className="min-h-0 flex-1 overflow-hidden p-3">
					<AntonellaProvider>
						<PesajeStation demo />
					</AntonellaProvider>
				</main>
			</div>
		</div>
	);
}
