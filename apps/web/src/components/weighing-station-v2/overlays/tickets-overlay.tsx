"use client";

import { cn } from "@finopenpos/ui/lib/utils";
import { PackageOpen } from "lucide-react";

import { OverlayFrame } from "./overlay-frame";

export interface TicketLine {
	itemId: number;
	name: string;
	status: string | null;
	captures: Array<{
		eventId: string;
		weightG: number;
		tareG: number | null;
		containerId: string | null;
		netG: number;
		at: number;
		pending?: boolean;
	}>;
}

export interface TicketsOverlayProps {
	orderLabel: string;
	lines: TicketLine[];
	containerLabels: Record<string, string>;
	onClose: () => void;
}

function statusLabel(status: string | null) {
	switch (status) {
		case "PENDIENTE_PESAJE":
			return "Pendiente de pesaje";
		case "PESADO":
			return "Pesado";
		case "LISTA_PARA_COBRO":
			return "Lista para cobro";
		case "COMPLETADA":
			return "Completada";
		default:
			return status ?? "Pendiente";
	}
}

function formatKg(grams: number) {
	return `${(grams / 1000).toLocaleString("es-MX", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 3,
	})} kg`;
}

export function TicketsOverlay({
	orderLabel,
	lines,
	containerLabels,
	onClose,
}: TicketsOverlayProps) {
	return (
		<OverlayFrame title="Tickets" subtitle={orderLabel} onClose={onClose}>
			<div className="mx-auto w-full max-w-6xl p-5">
				{lines.length === 0 ? (
					<div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
						<PackageOpen className="h-9 w-9" aria-hidden="true" />
						<p className="text-sm">No hay un pedido seleccionado.</p>
					</div>
				) : (
					<div className="space-y-4">
						{lines.map((line) => {
							const totalG = line.captures.reduce(
								(sum, capture) => sum + capture.netG,
								0,
							);

							return (
								<section
									key={line.itemId}
									className="overflow-hidden rounded-lg border border-border bg-background"
								>
									<header className="flex items-center justify-between gap-4 border-border border-b bg-[var(--cg-cream)]/50 px-4 py-3">
										<div>
											<h3 className="font-semibold">{line.name}</h3>
											<p className="mt-0.5 text-muted-foreground text-xs">
												Renglón #{line.itemId}
											</p>
										</div>
										<div className="text-right">
											<span
												className={cn(
													"inline-flex rounded-full px-2 py-1 font-semibold text-xs",
													line.status
														? "bg-emerald-100 text-emerald-800"
														: "bg-muted text-muted-foreground",
												)}
											>
												{statusLabel(line.status)}
											</span>
											<p className="mt-1 font-bold font-mono text-sm tabular-nums">
												Total {formatKg(totalG)}
											</p>
										</div>
									</header>

									{line.captures.length === 0 ? (
										<p className="px-4 py-5 text-muted-foreground text-sm">
											Este renglón no tiene capturas.
										</p>
									) : (
										<div className="overflow-x-auto">
											<table className="w-full border-collapse text-left text-xs">
												<thead className="bg-muted/60 text-muted-foreground">
													<tr>
														<th scope="col" className="px-4 py-2 font-medium">
															Hora
														</th>
														<th
															scope="col"
															className="px-4 py-2 text-right font-medium"
														>
															Bruto
														</th>
														<th
															scope="col"
															className="px-4 py-2 text-right font-medium"
														>
															Tara
														</th>
														<th scope="col" className="px-4 py-2 font-medium">
															Recipiente
														</th>
														<th
															scope="col"
															className="px-4 py-2 text-right font-medium"
														>
															Neto
														</th>
													</tr>
												</thead>
												<tbody>
													{line.captures.map((capture) => (
														<tr
															key={capture.eventId}
															className={cn(
																"border-border border-t",
																capture.pending && "bg-amber-50",
															)}
														>
															<td className="whitespace-nowrap px-4 py-2.5 font-mono tabular-nums">
																{new Date(capture.at).toLocaleTimeString(
																	"es-MX",
																	{
																		hour: "2-digit",
																		minute: "2-digit",
																		second: "2-digit",
																	},
																)}
															</td>
															<td className="whitespace-nowrap px-4 py-2.5 text-right font-mono tabular-nums">
																{formatKg(capture.weightG)}
															</td>
															<td className="whitespace-nowrap px-4 py-2.5 text-right font-mono tabular-nums">
																{formatKg(capture.tareG ?? 0)}
															</td>
															<td className="max-w-48 truncate px-4 py-2.5">
																{capture.containerId
																	? (containerLabels[capture.containerId] ??
																		capture.containerId)
																	: "—"}
															</td>
															<td className="whitespace-nowrap px-4 py-2.5 text-right font-mono font-semibold tabular-nums">
																{formatKg(capture.netG)}
															</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									)}
								</section>
							);
						})}
					</div>
				)}
			</div>
		</OverlayFrame>
	);
}
