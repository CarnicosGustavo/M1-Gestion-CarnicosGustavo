"use client";

import { Badge } from "@finopenpos/ui/components/badge";
import { Button } from "@finopenpos/ui/components/button";
import { Input } from "@finopenpos/ui/components/input";
import { Label } from "@finopenpos/ui/components/label";
import { cn } from "@finopenpos/ui/lib/utils";
import {
	AlertTriangle,
	Check,
	Delete,
	Keyboard,
	Package,
	Scale,
	X,
} from "lucide-react";
import type * as React from "react";

import { PesajeTile } from "../pesaje-tile";

export interface WeightTileProps {
	focused: boolean;
	liveWeightG: number | null;
	liveStable: boolean;
	liveOverload: boolean;
	connected: boolean;
	grossKg: number;
	tareKg: number;
	netKg: number;
	usingSerialNet: boolean;
	captureCount: number;
	containerId: string;
	containers: ReadonlyArray<{ id: string; label: string; tare: number | null }>;
	customTare: string;
	actualWeight: string;
	showKeypad: boolean;
	canRegister: boolean;
	productName: string | null;
	onFocusTile: () => void;
	onContainerId: (id: string) => void;
	onCustomTare: (v: string) => void;
	onActualWeight: (v: string) => void;
	onToggleKeypad: () => void;
	onCaptureTare: () => void;
	onTare: () => void;
	onRegister: () => void;
	onCaptureStable: () => void;
	onKeypad: (k: string) => void;
	weightInputRef: React.Ref<HTMLInputElement>;
	extra?: React.ReactNode;
}

function formatWeight(value: number | null) {
	if (value === null || !Number.isFinite(value)) {
		return "—";
	}

	return value.toLocaleString("es-MX", {
		minimumFractionDigits: 3,
		maximumFractionDigits: 3,
	});
}

export function WeightTile({
	focused,
	liveWeightG,
	liveStable,
	liveOverload,
	connected,
	grossKg,
	tareKg,
	netKg,
	usingSerialNet,
	captureCount,
	containerId,
	containers,
	customTare,
	actualWeight,
	showKeypad,
	canRegister,
	productName,
	onFocusTile,
	onContainerId,
	onCustomTare,
	onActualWeight,
	onToggleKeypad,
	onCaptureTare,
	onTare,
	onRegister,
	onCaptureStable,
	onKeypad,
	weightInputRef,
	extra,
}: WeightTileProps) {
	const status = liveOverload
		? "SOBRECARGO"
		: liveStable
			? "STABLE"
			: "MOVIENDO";
	const statusClasses = liveOverload
		? "bg-destructive text-destructive-foreground"
		: liveStable
			? "bg-emerald-500 text-[var(--cg-chrome-fg)]"
			: "bg-amber-400 text-amber-950";

	return (
		<PesajeTile
			id={3}
			title="Báscula"
			shortcut="Súper+3"
			focused={focused}
			onFocusTile={onFocusTile}
			className="h-full"
			bodyClassName="flex flex-col overflow-hidden p-3"
		>
			<div className="grid h-full min-h-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,1fr)]">
				<div className="flex min-h-[11rem] flex-col overflow-hidden rounded-lg border border-[var(--cg-chrome)] bg-[var(--cg-chrome)] text-[var(--cg-chrome-fg)] shadow-lg">
					<div className="flex items-center justify-between gap-2 border-white/10 border-b px-4 py-2">
						<div className="flex min-w-0 items-center gap-2">
							<Scale
								className="h-4 w-4 shrink-0 text-primary"
								aria-hidden="true"
							/>
							<p className="truncate font-semibold text-xs uppercase tracking-wider">
								{productName ?? "Peso en vivo"}
							</p>
						</div>
						<Badge
							className={cn(
								"rounded-full border-0 font-bold font-mono text-[10px] tracking-wider",
								statusClasses,
							)}
						>
							{status}
						</Badge>
					</div>

					<div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-2 text-center">
						<p className="font-black font-mono text-[clamp(2.8rem,6vw,5.5rem)] text-[var(--cg-chrome-fg)] tabular-nums leading-none tracking-[-0.08em]">
							<span className="sr-only">Peso neto: </span>
							{formatWeight(netKg)}
							<span className="sr-only"> kilogramos</span>
						</p>
						<div className="mt-1 font-semibold text-[var(--cg-chrome-fg)]/60 text-sm uppercase tracking-[0.25em]">
							kg netos
						</div>
					</div>

					<div className="grid grid-cols-3 border-white/10 border-t bg-black/15 text-center font-mono tabular-nums">
						<div className="border-white/10 border-r px-2 py-2">
							<p className="text-[9px] text-[var(--cg-chrome-fg)]/45 uppercase tracking-wider">
								Bruto
							</p>
							<p className="mt-0.5 font-bold text-[var(--cg-chrome-fg)] text-sm">
								{formatWeight(grossKg)}
							</p>
						</div>
						<div className="border-white/10 border-r px-2 py-2">
							<p className="text-[9px] text-[var(--cg-chrome-fg)]/45 uppercase tracking-wider">
								Tara
							</p>
							<p className="mt-0.5 font-bold text-[var(--cg-chrome-fg)] text-sm">
								{formatWeight(tareKg)}
							</p>
						</div>
						<div className="px-2 py-2">
							<p className="text-[9px] text-[var(--cg-chrome-fg)]/45 uppercase tracking-wider">
								Neto
							</p>
							<p className="mt-0.5 font-bold text-primary text-sm">
								{formatWeight(netKg)}
							</p>
						</div>
					</div>
				</div>

				<div className="min-h-0 shrink-0 space-y-2 overflow-y-auto">
					<div className="flex flex-wrap items-center gap-2 text-xs">
						<span
							className={cn(
								"inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-medium",
								connected
									? "bg-emerald-100 text-emerald-800"
									: "bg-destructive/10 text-destructive",
							)}
						>
							<span
								className={cn(
									"h-1.5 w-1.5 rounded-full",
									connected ? "bg-emerald-500" : "bg-destructive",
								)}
							/>
							{connected ? "Báscula conectada" : "Báscula desconectada"}
						</span>
						{usingSerialNet ? (
							<span className="rounded-full bg-muted px-2 py-1 font-medium text-muted-foreground">
								Neto por serie
							</span>
						) : null}
						<span className="rounded-full bg-muted px-2 py-1 font-medium text-muted-foreground">
							{captureCount} captura{captureCount === 1 ? "" : "s"}
						</span>
					</div>

					<div className="grid gap-3 sm:grid-cols-2">
						<div className="space-y-1.5">
							<Label htmlFor="weight-container" className="text-xs">
								Recipiente
							</Label>
							<select
								id="weight-container"
								value={containerId}
								onChange={(event) => onContainerId(event.target.value)}
								className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
							>
								{containers.map((container) => (
									<option key={container.id} value={container.id}>
										{container.label}
										{container.tare !== null
											? ` · ${formatWeight(container.tare)} kg`
											: ""}
									</option>
								))}
							</select>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="weight-custom-tare" className="text-xs">
								Tara personalizada
							</Label>
							<div className="flex gap-2">
								<Input
									id="weight-custom-tare"
									inputMode="decimal"
									value={customTare}
									onChange={(event) => onCustomTare(event.target.value)}
									placeholder="0.00"
									className="h-9 min-w-0 font-mono tabular-nums"
								/>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={onCaptureTare}
									disabled={
										!actualWeight || Number.parseFloat(actualWeight) <= 0
									}
								>
									Capturar
								</Button>
							</div>
						</div>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="weight-actual" className="text-xs">
							Peso manual
						</Label>
						<div className="flex gap-2">
							<Input
								ref={weightInputRef}
								id="weight-actual"
								inputMode="decimal"
								value={actualWeight}
								onChange={(event) => onActualWeight(event.target.value)}
								placeholder="0.00"
								className="h-10 min-w-0 font-bold font-mono text-lg tabular-nums"
							/>
							<Button
								type="button"
								variant="outline"
								onClick={onToggleKeypad}
								aria-expanded={showKeypad}
								aria-controls="weight-keypad"
							>
								<Keyboard className="h-4 w-4" aria-hidden="true" />
								Teclado
							</Button>
						</div>
					</div>

					{showKeypad ? (
						<fieldset
							id="weight-keypad"
							className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-muted/50 p-2"
						>
							<legend className="sr-only">Teclado numérico</legend>
							{["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((key) => (
								<Button
									key={key}
									type="button"
									variant="outline"
									size="lg"
									className="font-mono text-lg"
									onClick={() => onKeypad(key)}
									aria-label={`Teclear ${key}`}
								>
									{key}
								</Button>
							))}
							<Button
								type="button"
								variant="outline"
								size="lg"
								onClick={() => onKeypad("←")}
								aria-label="Retroceso"
							>
								<Delete className="h-4 w-4" aria-hidden="true" />
							</Button>
							<Button
								type="button"
								variant="outline"
								size="lg"
								className="font-mono text-lg"
								onClick={() => onKeypad("0")}
								aria-label="Teclear 0"
							>
								0
							</Button>
							<Button
								type="button"
								variant="outline"
								size="lg"
								className="font-mono text-lg"
								onClick={() => onKeypad(".")}
								aria-label="Teclear punto decimal"
							>
								.
							</Button>
						</fieldset>
					) : null}

					{!connected ? (
						<div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 text-xs">
							<AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
							La báscula está desconectada. Puedes capturar una tara manual.
						</div>
					) : null}

					<div className="grid gap-2 sm:grid-cols-3">
						<Button type="button" variant="secondary" onClick={onTare}>
							<Scale className="h-4 w-4" aria-hidden="true" />
							Poner tara
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={onCaptureStable}
							disabled={!connected || !liveStable || liveOverload}
						>
							<Check className="h-4 w-4" aria-hidden="true" />
							Capturar estable
						</Button>
						<Button type="button" onClick={onRegister} disabled={!canRegister}>
							<Package className="h-4 w-4" aria-hidden="true" />
							Registrar
						</Button>
					</div>

					{extra}
					{liveOverload ? (
						<div className="flex items-center justify-center gap-2 rounded-md bg-destructive px-3 py-2 font-semibold text-destructive-foreground text-sm">
							<X className="h-4 w-4" aria-hidden="true" />
							Exceso de peso. No se puede registrar.
						</div>
					) : null}
				</div>
			</div>
		</PesajeTile>
	);
}
