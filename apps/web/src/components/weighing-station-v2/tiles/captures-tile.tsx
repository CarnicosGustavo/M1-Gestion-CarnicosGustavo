"use client";

import { Button } from "@finopenpos/ui/components/button";
import { cn } from "@finopenpos/ui/lib/utils";
import { Undo2 } from "lucide-react";

import { PesajeTile } from "../pesaje-tile";

export interface CaptureRecord {
	eventId: string;
	weightG: number;
	tareG: number | null;
	containerId: string | null;
	pieceCount: number | null;
	pending: boolean;
	at: number;
	source: string;
}

export interface CapturesTileProps {
	focused: boolean;
	productName: string | null;
	captures: CaptureRecord[];
	containerLabels: Record<string, string>;
	onUndo: () => void;
	onFocusTile: () => void;
}

function formatKg(grams: number | null) {
	if (grams === null || !Number.isFinite(grams)) {
		return "—";
	}

	return `${(grams / 1000).toLocaleString("es-MX", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 3,
	})} kg`;
}

export function CapturesTile({
	focused,
	productName,
	captures,
	containerLabels,
	onUndo,
	onFocusTile,
}: CapturesTileProps) {
	return (
		<PesajeTile
			id={4}
			title="Capturas"
			shortcut="Súper+4"
			focused={focused}
			onFocusTile={onFocusTile}
			className="h-full"
			bodyClassName="p-2"
		>
			<div className="space-y-2">
				<div className="flex items-center justify-between gap-2 px-1">
					<p className="min-w-0 truncate text-muted-foreground text-xs">
						{productName ?? "Sin producto seleccionado"}
					</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={onUndo}
						disabled={captures.length === 0}
						aria-label="Deshacer última captura"
					>
						<Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
						Deshacer última
					</Button>
				</div>

				{captures.length === 0 ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						Aún no hay capturas.
					</p>
				) : (
					<div className="overflow-x-auto rounded-md border border-border">
						<table className="w-full border-collapse text-left text-[11px]">
							<thead className="sticky top-0 z-10 bg-muted text-muted-foreground">
								<tr>
									<th
										scope="col"
										className="whitespace-nowrap px-2 py-1.5 font-medium"
									>
										Hora
									</th>
									<th
										scope="col"
										className="whitespace-nowrap px-2 py-1.5 text-right font-medium"
									>
										Bruto
									</th>
									<th
										scope="col"
										className="whitespace-nowrap px-2 py-1.5 text-right font-medium"
									>
										Tara
									</th>
									<th
										scope="col"
										className="whitespace-nowrap px-2 py-1.5 font-medium"
									>
										Recipiente
									</th>
									<th
										scope="col"
										className="whitespace-nowrap px-2 py-1.5 text-right font-medium"
									>
										Neto
									</th>
									<th
										scope="col"
										className="whitespace-nowrap px-2 py-1.5 text-right font-medium"
									>
										Piezas
									</th>
									<th
										scope="col"
										className="whitespace-nowrap px-2 py-1.5 font-medium"
									>
										Origen
									</th>
								</tr>
							</thead>
							<tbody>
								{captures.map((capture) => {
									const netG = capture.weightG - (capture.tareG ?? 0);

									return (
										<tr
											key={capture.eventId}
											className={cn(
												"border-border border-t",
												capture.pending && "bg-amber-50",
											)}
										>
											<td className="whitespace-nowrap px-2 py-1.5 font-mono tabular-nums">
												{new Date(capture.at).toLocaleTimeString("es-MX", {
													hour: "2-digit",
													minute: "2-digit",
													second: "2-digit",
												})}
											</td>
											<td className="whitespace-nowrap px-2 py-1.5 text-right font-mono tabular-nums">
												{formatKg(capture.weightG)}
											</td>
											<td className="whitespace-nowrap px-2 py-1.5 text-right font-mono tabular-nums">
												{formatKg(capture.tareG)}
											</td>
											<td className="max-w-28 truncate px-2 py-1.5">
												{capture.containerId
													? (containerLabels[capture.containerId] ??
														capture.containerId)
													: "—"}
											</td>
											<td className="whitespace-nowrap px-2 py-1.5 text-right font-mono font-semibold tabular-nums">
												{formatKg(netG)}
											</td>
											<td className="whitespace-nowrap px-2 py-1.5 text-right font-mono tabular-nums">
												{capture.pieceCount ?? "—"}
											</td>
											<td className="whitespace-nowrap px-2 py-1.5">
												<span className="inline-flex items-center gap-1.5">
													<span className="max-w-24 truncate">
														{capture.source}
													</span>
													{capture.pending ? (
														<span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-semibold text-[9px] text-amber-900">
															en cola
														</span>
													) : null}
												</span>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</PesajeTile>
	);
}
