"use client";

import type { ReactNode } from "react";
import { formatCustomTareHint } from "@/lib/weighing/parse-custom-tare";
import { FnScreenOption, FnScreenRow } from "../instrument/function-screen";
import { SHORTCUT_ROWS } from "../shortcuts";
import {
	CONTAINERS,
	type ContainerId,
	captureNetG,
	type FnPage,
	formatKg,
	PESAJE_THEMES,
	type PesajeCapture,
	type PesajeThemeId,
} from "../types";

export const FN_PAGE_TITLES: Record<FnPage, string> = {
	inicio: "Inicio · renglón en báscula",
	recipiente: "Recipiente y tara",
	conexion: "Conexión serial (RS-232)",
	diagnostico: "Diagnóstico de tramas",
	tema: "Tema de la estación",
	teclado: "Teclado · peso manual",
	atajos: "Atajos de teclado",
};

/** Contenedor claro para formularios existentes (shadcn) dentro del LCD. */
export function FnFormCard({ children }: { children: ReactNode }) {
	return (
		<div className="mt-3 rounded-md bg-card p-3 font-sans text-card-foreground text-sm">
			{children}
		</div>
	);
}

export function InicioPage({
	productName,
	captures,
	containerLabels,
	accumulatedNetKg,
	liveTareLabel,
	scaleLabel,
	onUndo,
}: {
	productName: string | null;
	captures: PesajeCapture[];
	containerLabels: Record<string, string>;
	accumulatedNetKg: number;
	liveTareLabel: string;
	scaleLabel: string;
	onUndo: () => void;
}) {
	return (
		<div className="space-y-3">
			<div>
				<FnScreenRow label="Producto" value={productName ?? "—"} highlight />
				<FnScreenRow label="Báscula" value={scaleLabel} />
				<FnScreenRow label="Recipiente" value={liveTareLabel} />
				<FnScreenRow
					label="Neto acumulado"
					value={`${accumulatedNetKg.toFixed(3)} kg`}
					highlight
				/>
			</div>
			<div>
				<div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.12em]">
					<span>Capturas ({captures.length})</span>
					<button
						type="button"
						onClick={onUndo}
						disabled={captures.length === 0}
						className="rounded border border-[#4d7652] px-2 py-0.5 text-[10px] hover:bg-[#193625] disabled:opacity-40"
					>
						Deshacer última · Súper+Z
					</button>
				</div>
				{captures.length === 0 ? (
					<p className="text-[11px] opacity-70">
						Sin capturas. Pulsa M+ (Espacio) con peso estable.
					</p>
				) : (
					<ol className="space-y-0.5 text-xs tabular-nums">
						{captures.map((capture, index) => (
							<li
								key={capture.eventId}
								className="grid grid-cols-[2rem_1fr_1fr_1fr_auto] gap-2"
							>
								<span className="opacity-60">#{index + 1}</span>
								<span>B {formatKg(capture.weightG)}</span>
								<span>
									T {formatKg(capture.tareG)}{" "}
									<span className="opacity-60">
										{capture.containerId
											? (containerLabels[capture.containerId] ??
												capture.containerId)
											: ""}
									</span>
								</span>
								<span className="font-bold">
									N {formatKg(captureNetG(capture.weightG, capture.tareG))}
								</span>
								<span className="opacity-60">
									{capture.pending ? "por enviar" : capture.source}
								</span>
							</li>
						))}
					</ol>
				)}
			</div>
		</div>
	);
}

export function RecipientePage({
	containerId,
	customTare,
	customTareInvalid = false,
	onContainer,
	onCustomTare,
	onTareFromWeight,
}: {
	containerId: ContainerId;
	customTare: string;
	customTareInvalid?: boolean;
	onContainer: (id: ContainerId) => void;
	onCustomTare: (value: string) => void;
	onTareFromWeight: () => void;
}) {
	return (
		<div>
			<p className="mb-2 text-[11px] opacity-80">
				La tara del recipiente se resta a cada pesada en vivo. Súper+J / K con
				la pantalla 7 enfocada cambia el recipiente.
			</p>
			{CONTAINERS.map((container, index) => (
				<FnScreenOption
					key={container.id}
					selected={container.id === containerId}
					label={container.label}
					hint={
						container.tare === null
							? formatCustomTareHint(customTare)
							: `${container.tare.toFixed(3)} kg`
					}
					shortcut={String(index + 1)}
					onSelect={() => onContainer(container.id)}
				/>
			))}
			{containerId === "otro" ? (
				<label className="mt-3 flex items-center gap-2 text-xs">
					Tara personalizada (kg)
					<input
						type="text"
						inputMode="decimal"
						value={customTare}
						onChange={(event) => onCustomTare(event.target.value)}
						aria-invalid={customTareInvalid}
						className="w-24 rounded border border-[#4d7652] bg-[#0b1710] px-2 py-1 text-right text-[#c9ff99] outline-none focus:border-[#f39a1e]"
					/>
				</label>
			) : null}
			{containerId === "otro" && customTareInvalid ? (
				<p className="mt-2 text-[#f39a1e] text-[11px]">
					La tara debe ser 0 o más, sin coma (usa punto).
				</p>
			) : null}
			<button
				type="button"
				onClick={onTareFromWeight}
				className="mt-3 rounded border border-[#4d7652] px-3 py-1.5 text-xs hover:bg-[#193625]"
			>
				→T← Tomar el peso actual como tara · Súper+R
			</button>
		</div>
	);
}

export function TemaPage({
	theme,
	onTheme,
}: {
	theme: PesajeThemeId;
	onTheme: (id: PesajeThemeId) => void;
}) {
	return (
		<div>
			{PESAJE_THEMES.map((item, index) => (
				<FnScreenOption
					key={item.id}
					selected={item.id === theme}
					label={item.label}
					hint={item.id === "m1" ? "Predeterminado" : "Estilo Omarchy"}
					shortcut={String(index + 1)}
					onSelect={() => onTheme(item.id)}
				/>
			))}
			<p className="mt-3 text-[11px] opacity-70">
				Súper+Shift+T cicla los temas. Se guarda en este navegador.
			</p>
		</div>
	);
}

export function AtajosPage() {
	return (
		<table className="w-full text-left text-xs">
			<thead className="text-[10px] uppercase tracking-[0.12em] opacity-70">
				<tr>
					<th className="py-1 pr-2 font-normal">Súper</th>
					<th className="py-1 pr-2 font-normal">Respaldo</th>
					<th className="py-1 font-normal">Acción</th>
				</tr>
			</thead>
			<tbody>
				{SHORTCUT_ROWS.map((row) => (
					<tr key={row.action} className="border-[#355440]/50 border-t">
						<td className="py-1 pr-2 font-bold text-[#c9ff99]">{row.keys}</td>
						<td className="py-1 pr-2 opacity-80">{row.fallback || "—"}</td>
						<td className="py-1">{row.action}</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}

export function TecladoPage({
	value,
	onValue,
	onKey,
	inputRef,
	extra,
}: {
	value: string;
	onValue: (value: string) => void;
	onKey: (key: string) => void;
	inputRef: React.RefObject<HTMLInputElement | null>;
	extra?: ReactNode;
}) {
	const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "←"];
	return (
		<div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
			<div>
				<label className="flex items-center gap-2 text-xs">
					Peso bruto (kg)
					<input
						ref={inputRef}
						type="text"
						inputMode="decimal"
						value={value}
						onChange={(event) => onValue(event.target.value)}
						className="w-32 rounded border border-[#4d7652] bg-[#0b1710] px-2 py-1 text-right text-[#c9ff99] text-lg outline-none focus:border-[#f39a1e]"
					/>
				</label>
				<div className="mt-2 grid max-w-xs grid-cols-3 gap-1.5">
					{keys.map((key) => (
						<button
							key={key}
							type="button"
							onClick={() => onKey(key)}
							className="rounded border border-[#4d7652] bg-[#0b1710] py-2 font-bold text-base hover:bg-[#193625]"
						>
							{key}
						</button>
					))}
				</div>
			</div>
			{extra ? <div className="min-w-0">{extra}</div> : null}
		</div>
	);
}
