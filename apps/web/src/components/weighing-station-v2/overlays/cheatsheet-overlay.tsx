"use client";

import { SHORTCUT_ROWS } from "../shortcuts";

import { OverlayFrame } from "./overlay-frame";

export interface CheatsheetOverlayProps {
	onClose: () => void;
}

export function CheatsheetOverlay({ onClose }: CheatsheetOverlayProps) {
	return (
		<OverlayFrame
			title="Atajos"
			subtitle="Súper (Meta) es el atajo principal. Alt es el respaldo porque algunos navegadores se tragan la tecla Meta."
			onClose={onClose}
		>
			<div className="mx-auto w-full max-w-3xl p-6">
				<div className="mb-5 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 text-sm">
					<p>
						Usa{" "}
						<kbd className="rounded border border-amber-400 bg-white px-1.5 py-0.5 font-mono font-semibold text-xs">
							Súper
						</kbd>{" "}
						+ número para cambiar de tesela.
					</p>
					<p className="mt-1">
						Si el navegador intercepta Súper, utiliza{" "}
						<kbd className="rounded border border-amber-400 bg-white px-1.5 py-0.5 font-mono font-semibold text-xs">
							Alt
						</kbd>{" "}
						+ número.
					</p>
				</div>

				<div className="overflow-hidden rounded-lg border border-border">
					<table className="w-full border-collapse text-left text-sm">
						<thead className="bg-muted text-muted-foreground text-xs uppercase tracking-wide">
							<tr>
								<th scope="col" className="px-4 py-3 font-semibold">
									Acción
								</th>
								<th scope="col" className="px-4 py-3 font-semibold">
									Súper
								</th>
								<th scope="col" className="px-4 py-3 font-semibold">
									Respaldo Alt
								</th>
							</tr>
						</thead>
						<tbody>
							{SHORTCUT_ROWS.map((row) => (
								<tr key={row.action} className="border-border border-t">
									<td className="px-4 py-3">{row.action}</td>
									<td className="px-4 py-3">
										<kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
											{row.keys}
										</kbd>
									</td>
									<td className="px-4 py-3">
										{row.fallback ? (
											<kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
												{row.fallback}
											</kbd>
										) : (
											<span className="text-muted-foreground">—</span>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</OverlayFrame>
	);
}
