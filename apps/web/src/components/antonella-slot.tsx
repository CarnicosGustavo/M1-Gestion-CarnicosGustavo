"use client";

import { cn } from "@finopenpos/ui/lib/utils";
import {
	ArrowRightIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	SparklesIcon,
} from "lucide-react";
import { useState } from "react";
import { AntonellaAvatar } from "@/components/antonella-avatar";
import { useAntonella } from "@/components/antonella-dock";

export type AntonellaTone = "ok" | "sugerencia" | "aviso" | "alerta";

const TONE: Record<
	AntonellaTone,
	{ edge: string; tag: string; tagBg: string; tagFg: string }
> = {
	ok: {
		edge: "var(--cg-green)",
		tag: "Todo en orden",
		tagBg: "var(--cg-green-wash)",
		tagFg: "var(--cg-green)",
	},
	sugerencia: {
		edge: "var(--cg-tan)",
		tag: "Sugerencia",
		tagBg: "var(--accent)",
		tagFg: "var(--accent-foreground)",
	},
	aviso: {
		edge: "var(--cg-amber)",
		tag: "Aviso",
		tagBg: "var(--cg-amber-wash)",
		tagFg: "var(--cg-amber)",
	},
	alerta: {
		edge: "var(--primary)",
		tag: "Alerta",
		tagBg: "var(--cg-red-wash)",
		tagFg: "var(--primary)",
	},
};

export interface AntonellaSlotData {
	tone: AntonellaTone;
	titulo: string;
	texto: string;
	acciones?: string[];
}

// Bloque inline de iAntonella arriba del contenido de un módulo.
// La primera acción es la "principal" (ejecuta la pregunta); las demás también
// abren el chat con esa consulta. "Preguntar más" abre el chat vacío.
export function AntonellaSlot({ data }: { data: AntonellaSlotData | null }) {
	const [open, setOpen] = useState(true);
	const antonella = useAntonella();
	if (!data) return null;
	const t = TONE[data.tone] ?? TONE.sugerencia;

	return (
		<div className="relative mb-4 overflow-hidden rounded-2xl border bg-gradient-to-b from-card to-secondary">
			<div className="h-[3px] opacity-90" style={{ background: t.edge }} />
			<div className="flex items-start gap-3.5 px-4 pt-3.5 pb-4">
				<AntonellaAvatar size={40} />
				<div className="min-w-0 flex-1">
					<div className="mb-1.5 flex flex-wrap items-center gap-2">
						<span className="font-extrabold text-foreground text-[13px]">
							iAntonella
						</span>
						<span className="h-[3px] w-[3px] rounded-full bg-muted-foreground" />
						<span className="font-semibold text-muted-foreground text-xs">
							{data.titulo}
						</span>
						<span
							className="rounded-full px-1.5 py-1 font-bold text-[10px] uppercase tracking-[0.06em]"
							style={{ color: t.tagFg, background: t.tagBg }}
						>
							{t.tag}
						</span>
					</div>
					{open && (
						<>
							<p className="mb-3 text-pretty text-[14px] text-foreground/85 leading-relaxed">
								{data.texto}
							</p>
							<div className="flex flex-wrap items-center gap-2">
								{(data.acciones ?? []).map((a, i) => (
									<button
										key={a}
										type="button"
										onClick={() => antonella.ask(a)}
										className={cn(
											"inline-flex items-center gap-1.5 rounded-full border px-3 py-2 font-bold text-[12.5px] transition-colors",
											i === 0
												? "border-[var(--cg-chrome)] bg-[var(--cg-chrome)] text-[var(--cg-chrome-fg)]"
												: "border-border bg-transparent text-foreground hover:bg-accent",
										)}
									>
										{i === 0 && (
											<SparklesIcon className="h-3.5 w-3.5 text-primary-foreground/80" />
										)}
										{a}
									</button>
								))}
								<button
									type="button"
									onClick={() => antonella.open()}
									className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-2 font-bold text-[12.5px] text-muted-foreground hover:text-foreground"
								>
									Preguntar más
									<ArrowRightIcon className="h-3.5 w-3.5" />
								</button>
							</div>
						</>
					)}
				</div>
				<button
					type="button"
					onClick={() => setOpen((o) => !o)}
					title={open ? "Ocultar" : "Mostrar"}
					className="p-1 text-muted-foreground"
				>
					{open ? (
						<ChevronUpIcon className="h-[18px] w-[18px]" />
					) : (
						<ChevronDownIcon className="h-[18px] w-[18px]" />
					)}
				</button>
			</div>
		</div>
	);
}
