"use client";

import { cn } from "@finopenpos/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightIcon, BellIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AntonellaAvatar } from "@/components/antonella-avatar";
import { useTRPC } from "@/lib/trpc/client";

const TONE: Record<string, { dot: string; bg: string }> = {
	alerta: { dot: "var(--primary)", bg: "var(--cg-red-wash)" },
	aviso: { dot: "var(--cg-amber)", bg: "var(--cg-amber-wash)" },
	sugerencia: { dot: "var(--cg-tan)", bg: "var(--accent)" },
	ok: { dot: "var(--cg-green)", bg: "var(--cg-green-wash)" },
};

// Centro de notificaciones de iAntonella: vigila el negocio y avisa en el
// dashboard (cobranza vencida, pedidos por pesar, despiece, merma alta).
export function NotificationBell() {
	const trpc = useTRPC();
	const [open, setOpen] = useState(false);
	const { data } = useQuery({
		...trpc.antonella.notifications.queryOptions(),
		refetchInterval: 60_000,
	});
	const items = data?.items ?? [];
	const count = items.length;
	const hasAlert = items.some((i) => i.tone === "alerta");

	return (
		<div className="relative">
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				title="Avisos de iAntonella"
				className="relative flex h-9 w-9 items-center justify-center rounded-full border bg-secondary text-muted-foreground transition-colors hover:text-foreground"
			>
				<BellIcon className="h-4 w-4" />
				{count > 0 && (
					<span
						className={cn(
							"absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-bold text-[10px] text-white",
							hasAlert ? "bg-primary" : "bg-[var(--cg-amber)]",
						)}
					>
						{count}
					</span>
				)}
			</button>

			{open && (
				<>
					<button
						type="button"
						aria-label="Cerrar"
						className="fixed inset-0 z-40 cursor-default"
						onClick={() => setOpen(false)}
					/>
					<div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(360px,90vw)] overflow-hidden rounded-2xl border bg-popover shadow-xl">
						<div className="flex items-center gap-2 border-b bg-[var(--cg-chrome)] px-4 py-3 text-[var(--cg-chrome-fg)]">
							<AntonellaAvatar size={28} />
							<div className="min-w-0">
								<div className="font-bold text-sm">Avisos de iAntonella</div>
								<div className="text-[var(--cg-chrome-fg)]/70 text-[11px]">
									{count > 0
										? `${count} cosa(s) que revisar`
										: "Todo en orden"}
								</div>
							</div>
						</div>
						<div className="max-h-[60vh] overflow-y-auto">
							{count === 0 ? (
								<div className="px-4 py-8 text-center text-muted-foreground text-sm">
									No hay nada pendiente. 🎉
								</div>
							) : (
								items.map((it) => {
									const tone = TONE[it.tone] ?? TONE.sugerencia;
									return (
										<Link
											key={it.id}
											href={it.href}
											onClick={() => setOpen(false)}
											className="flex items-start gap-2.5 border-b px-4 py-3 transition-colors hover:bg-muted/50"
										>
											<span
												className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
												style={{ background: tone.dot }}
											/>
											<div className="min-w-0 flex-1">
												<div className="flex items-center gap-2">
													<span className="font-semibold text-sm">
														{it.title}
													</span>
												</div>
												<p className="text-muted-foreground text-xs">
													{it.text}
												</p>
											</div>
											<ArrowRightIcon className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
										</Link>
									);
								})
							)}
						</div>
					</div>
				</>
			)}
		</div>
	);
}
