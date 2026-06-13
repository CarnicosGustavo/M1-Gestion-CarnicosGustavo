"use client";

import { Button } from "@finopenpos/ui/components/button";
import { cn } from "@finopenpos/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckIcon, Loader2Icon, ScissorsIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AntonellaAvatar } from "@/components/antonella-avatar";
import { useTRPC } from "@/lib/trpc/client";

// Card de iAntonella que sugiere el despiece necesario para cubrir los pedidos
// abiertos y lo ejecuta con un clic, mostrando las piezas generadas.
export function DespiecePlanCard({ onDone }: { onDone?: () => void }) {
	const trpc = useTRPC();
	const planOpts = trpc.yields.suggestDespiecePlan.queryOptions();
	const { data, refetch } = useQuery(planOpts);

	const [running, setRunning] = useState(false);
	const [generated, setGenerated] = useState<
		{ name: string; pieces: number; kg: number }[] | null
	>(null);

	const disassembleMut = useMutation(
		trpc.products.processDisassembly.mutationOptions(),
	);

	if (!data || !data.hasDemand || data.plan.length === 0) {
		// Mostrar el resultado tras ejecutar, aunque ya no haya plan
		if (generated && generated.length > 0) {
			return <GeneratedResult generated={generated} />;
		}
		return null;
	}

	const execute = async () => {
		setRunning(true);
		try {
			// Junta lo que se va a generar (para el reporte final)
			const acc = new Map<string, { pieces: number; kg: number }>();
			for (const item of data.plan) {
				await disassembleMut.mutateAsync({
					parentProductId: item.canalProductId,
					quantityToProcess: item.quantity,
					transformationType: item.type,
					entryMode: false,
				});
				for (const g of item.generates) {
					const prev = acc.get(g.name) ?? { pieces: 0, kg: 0 };
					acc.set(g.name, {
						pieces: prev.pieces + g.pieces,
						kg: prev.kg + g.kg,
					});
				}
			}
			const result = [...acc.entries()]
				.map(([name, v]) => ({ name, ...v }))
				.sort((a, b) => b.pieces - a.pieces);
			setGenerated(result);
			toast.success("Despiece ejecutado");
			refetch();
			onDone?.();
		} catch (e: any) {
			toast.error(e?.message ?? "Error al ejecutar el despiece");
		} finally {
			setRunning(false);
		}
	};

	return (
		<div className="mb-4 overflow-hidden rounded-2xl border border-[var(--cg-amber)] bg-[var(--cg-amber-wash)]">
			<div className="h-[3px] bg-[var(--cg-amber)]" />
			<div className="flex items-start gap-3.5 px-4 pt-3.5 pb-4">
				<AntonellaAvatar size={40} />
				<div className="min-w-0 flex-1">
					<div className="mb-1.5 flex flex-wrap items-center gap-2">
						<span className="font-extrabold text-[13px] text-foreground">
							iAntonella
						</span>
						<span className="h-[3px] w-[3px] rounded-full bg-muted-foreground" />
						<span className="font-semibold text-muted-foreground text-xs">
							Despiece sugerido para cubrir pedidos
						</span>
						<span className="rounded-full bg-[var(--cg-amber)] px-1.5 py-1 font-bold text-[10px] text-white uppercase tracking-[0.06em]">
							Acción
						</span>
					</div>
					<p className="mb-2.5 text-[14px] text-foreground/85 leading-relaxed">
						Para cubrir los pedidos abiertos conviene despiezar{" "}
						<strong>{data.totalCanals} canal(es)</strong>. Tú confirmas y yo lo
						ejecuto:
					</p>

					{/* Plan detallado */}
					<div className="mb-3 space-y-1.5">
						{data.plan.map((item) => (
							<div
								key={item.canalProductId}
								className="rounded-lg border bg-card/70 px-3 py-2 text-xs"
							>
								<div className="flex items-center gap-2 font-semibold">
									<ScissorsIcon className="h-3.5 w-3.5 text-primary" />
									Despiezar {item.quantity} {shortName(item.canalName)}
								</div>
								<div className="mt-1 text-muted-foreground">
									→ genera:{" "}
									{item.generates
										.filter((g) => g.pieces > 0)
										.map((g) => `${g.name} ×${g.pieces}`)
										.join(" · ")}
								</div>
							</div>
						))}
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<Button
							size="sm"
							onClick={execute}
							disabled={running}
							className="rounded-full bg-[var(--cg-green)] text-white hover:bg-[var(--cg-green)]/90"
						>
							{running ? (
								<Loader2Icon className="mr-1.5 h-4 w-4 animate-spin" />
							) : (
								<SparklesIcon className="mr-1.5 h-4 w-4" />
							)}
							{running ? "Ejecutando…" : "Ejecutar despiece"}
						</Button>
						<span className="text-[11px] text-muted-foreground">
							Descuenta los canales y suma las piezas al inventario.
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}

function GeneratedResult({
	generated,
}: {
	generated: { name: string; pieces: number; kg: number }[];
}) {
	return (
		<div className="mb-4 overflow-hidden rounded-2xl border border-[var(--cg-green)] bg-[var(--cg-green-wash)]">
			<div className="h-[3px] bg-[var(--cg-green)]" />
			<div className="flex items-start gap-3.5 px-4 pt-3.5 pb-4">
				<AntonellaAvatar size={40} />
				<div className="min-w-0 flex-1">
					<div className="mb-1.5 flex items-center gap-2">
						<CheckIcon className="h-4 w-4 text-[var(--cg-green)]" />
						<span className="font-extrabold text-[13px] text-foreground">
							Despiece ejecutado — piezas generadas
						</span>
					</div>
					<div className="flex flex-wrap gap-1.5">
						{generated
							.filter((g) => g.pieces > 0)
							.map((g) => (
								<span
									key={g.name}
									className="rounded-full border border-[var(--cg-green)]/30 bg-card px-2.5 py-1 font-semibold text-xs"
								>
									{g.name} <strong>×{g.pieces}</strong>
									{g.kg > 0 ? (
										<span className="text-muted-foreground">
											{" "}
											· {g.kg.toFixed(1)} kg
										</span>
									) : null}
								</span>
							))}
					</div>
				</div>
			</div>
		</div>
	);
}

// "CANAL NACIONAL LADO LOMO" → "Nac · Lomo"; "CANAL AMERICANO" → "Americano"
function shortName(name: string) {
	return name
		.replace(/^CANAL\s+/i, "")
		.replace(/NACIONAL\s+LADO\s+/i, "Nac · ")
		.trim();
}
