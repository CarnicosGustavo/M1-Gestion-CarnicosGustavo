"use client";

import { Badge } from "@finopenpos/ui/components/badge";
import { Button } from "@finopenpos/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@finopenpos/ui/components/card";
import { Input } from "@finopenpos/ui/components/input";
import { Label } from "@finopenpos/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@finopenpos/ui/components/select";
import { cn } from "@finopenpos/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
	AlertTriangle,
	BadgeCheck,
	CircleAlert,
	ClipboardCopy,
	Copy,
	Download,
	LoaderCircle,
	RefreshCw,
	Settings2,
	Trash2,
	Unplug,
	Weight,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
	captureNetG,
	computeLineTotals,
	type LineTotals,
} from "@/lib/scale/webserial/line-totals";
import { BAUD_RATES, type ScaleSettings } from "@/lib/scale/webserial/settings";
import { useTRPC } from "@/lib/trpc/client";

import { type CapturePayload, useCaptureQueue } from "./use-capture-queue";
import {
	type CapturedReading,
	type LiveReading,
	useScaleSerial,
} from "./use-scale-serial";

interface ScaleSerialPanelProps {
	line: {
		orderId: number;
		orderItemId: number;
		productName: string;
		requestedPieces: number | null;
	} | null;
	container: {
		id: string;
		label: string;
		tareKg: number;
	};
	containerLabels?: Record<string, string>;
	onCapturesTotal?: (totals: LineTotals) => void;
}

interface LocalCapture {
	eventId: string;
	orderItemId: number;
	weightG: number;
	pieceCount: number | null;
	containerId: string | null;
	tareG: number | null;
	pending: boolean;
	at: number;
}

interface MergedCapture {
	eventId: string;
	weightG: number;
	pieceCount: number | null;
	containerId: string | null;
	tareG: number | null;
	pending: boolean;
	at: number;
	source: string;
}

export function ScaleSerialPanel({
	line,
	container,
	containerLabels,
	onCapturesTotal,
}: ScaleSerialPanelProps) {
	const trpc = useTRPC();
	const {
		supported,
		status,
		statusDetail,
		connect,
		disconnect,
		live,
		frames,
		clearFrames,
		armed,
		setOnAutoCapture,
		captureNow,
		settings,
		setSettings,
	} = useScaleSerial();
	const { pending, enqueueCapture, undoCapture } = useCaptureQueue();

	const [showSettings, setShowSettings] = useState(false);
	const [showDiagnostics, setShowDiagnostics] = useState(false);
	const [pieceCount, setPieceCount] = useState(1);
	const [localCaptures, setLocalCaptures] = useState<LocalCapture[]>([]);
	const [copied, setCopied] = useState(false);
	const lineRef = useRef(line);
	const pieceCountRef = useRef(pieceCount);
	const containerRef = useRef(container);
	const notifiedWithoutLineRef = useRef(false);
	const armedRef = useRef(armed);
	const lastTotalsRef = useRef<LineTotals | null>(null);
	const lineIdRef = useRef<number | null>(null);

	lineRef.current = line;
	pieceCountRef.current = pieceCount;
	containerRef.current = container;

	const lineCapturesQuery = useQuery({
		...trpc.scaleSerial.lineCaptures.queryOptions({
			orderItemId: line?.orderItemId ?? 0,
		}),
		enabled: line !== null,
		refetchInterval: 10000,
	});

	const serverCaptures = lineCapturesQuery.data ?? [];

	useEffect(() => {
		if (lineIdRef.current !== line?.orderItemId) {
			lineIdRef.current = line?.orderItemId ?? null;
			setPieceCount(1);
			pieceCountRef.current = 1;
			notifiedWithoutLineRef.current = false;
			lastTotalsRef.current = null;
		}
	}, [line?.orderItemId]);

	useEffect(() => {
		if (!armedRef.current && armed) {
			armedRef.current = armed;
			notifiedWithoutLineRef.current = false;
		} else {
			armedRef.current = armed;
		}
	}, [armed]);

	// Capturas deshechas en esta sesión: se ocultan aunque el servidor aún no
	// haya procesado el "void" (la cola puede estar sin red).
	const [undoneIds, setUndoneIds] = useState<Set<string>>(() => new Set());

	const captureReading = useCallback(
		(reading: CapturedReading, manual: boolean) => {
			const currentLine = lineRef.current;
			if (!currentLine) {
				return;
			}

			const eventId = createEventId();
			const capturedAt = Date.now();
			const currentPieceCount = pieceCountRef.current;
			const currentContainer = containerRef.current;
			const containerId = currentContainer.id;
			const tareG = Math.max(0, Math.round(currentContainer.tareKg * 1000));
			const payload: CapturePayload = {
				eventId,
				orderItemId: currentLine.orderItemId,
				pieceCount: currentPieceCount,
				weight: reading.weightG / 1000,
				unit: "kg",
				weightG: reading.weightG,
				stable: reading.stable,
				manual,
				raw: reading.raw.slice(0, 128),
				capturedAt: new Date(capturedAt).toISOString(),
				seq: capturedAt,
				containerId,
				tareG,
			};

			setLocalCaptures((current) => [
				...current,
				{
					eventId,
					orderItemId: currentLine.orderItemId,
					weightG: reading.weightG,
					pieceCount: currentPieceCount,
					containerId,
					tareG,
					pending: true,
					at: capturedAt,
				},
			]);

			enqueueCapture(payload);
			toast.success(`Capturado ${formatKg(reading.weightG)} kg`);
		},
		[enqueueCapture],
	);

	useEffect(() => {
		setOnAutoCapture((reading) => {
			const currentLine = lineRef.current;
			if (!currentLine) {
				if (!notifiedWithoutLineRef.current) {
					notifiedWithoutLineRef.current = true;
					toast.info("Elige un pedido y un renglón antes de colocar la carne");
				}
				return;
			}

			captureReading(reading, false);
		});

		return () => setOnAutoCapture(null);
	}, [captureReading, setOnAutoCapture]);

	const mergedCaptures = useMemo<MergedCapture[]>(() => {
		const currentLine = line;
		if (!currentLine) {
			return [];
		}

		// La query ya viene filtrada por el renglón actual (orderItemId).
		const currentServerCaptures = serverCaptures.filter(
			(capture) => !undoneIds.has(capture.eventId),
		);
		const serverByEventId = new Map(
			currentServerCaptures.map((capture) => [capture.eventId, capture]),
		);
		const merged: MergedCapture[] = [];

		for (const capture of localCaptures) {
			if (capture.orderItemId !== currentLine.orderItemId) {
				continue;
			}

			const serverCapture = serverByEventId.get(capture.eventId);
			merged.push({
				eventId: capture.eventId,
				weightG: serverCapture?.weightG ?? capture.weightG,
				pieceCount: serverCapture?.pieceCount ?? capture.pieceCount,
				containerId: serverCapture?.containerId ?? capture.containerId,
				tareG: serverCapture?.tareG ?? capture.tareG,
				pending: !serverCapture,
				at: serverCapture?.capturedAt?.getTime() ?? capture.at,
				source: serverCapture?.source ?? "PC",
			});
			serverByEventId.delete(capture.eventId);
		}

		for (const capture of currentServerCaptures) {
			merged.push({
				eventId: capture.eventId,
				weightG: capture.weightG,
				pieceCount: capture.pieceCount,
				containerId: capture.containerId,
				tareG: capture.tareG,
				pending: false,
				at: capture.capturedAt?.getTime() ?? capture.receivedAt.getTime(),
				source: capture.source,
			});
		}

		return merged.sort((a, b) => a.at - b.at);
	}, [line, localCaptures, serverCaptures, undoneIds]);

	const totals = useMemo<LineTotals>(
		() => computeLineTotals(mergedCaptures),
		[mergedCaptures],
	);

	useEffect(() => {
		if (!line) {
			return;
		}

		const lastTotals = lastTotalsRef.current;
		if (
			lastTotals &&
			lastTotals.count === totals.count &&
			lastTotals.pieces === totals.pieces &&
			lastTotals.grossG === totals.grossG &&
			lastTotals.tareG === totals.tareG &&
			lastTotals.netG === totals.netG
		) {
			return;
		}

		lastTotalsRef.current = totals;
		onCapturesTotal?.(totals);
	}, [line, onCapturesTotal, totals]);

	const statusLabel = getStatusLabel(status, supported, settings.simulator);
	const canManualCapture =
		line !== null &&
		live !== null &&
		!live.overload &&
		live.weightG !== null &&
		live.weightG >= 1;
	const currentTareG = Math.max(0, Math.round(container.tareKg * 1000));
	const estimatedLiveNetKg =
		live?.weightG === null || live?.weightG === undefined
			? 0
			: captureNetG({
					weightG: live.weightG,
					tareG: currentTareG,
				}) / 1000;

	const handleManualCapture = () => {
		if (!line) {
			return;
		}

		const reading = captureNow();
		if (!reading) {
			toast.info("No hay una lectura válida para capturar");
			return;
		}

		captureReading(reading, true);
	};

	const handleUndo = async () => {
		const currentLine = lineRef.current;
		if (!currentLine) {
			return;
		}

		const lastCapture = localCaptures
			.filter((capture) => capture.orderItemId === currentLine.orderItemId)
			.sort((a, b) => b.at - a.at)[0];

		if (!lastCapture) {
			return;
		}

		setLocalCaptures((current) =>
			current.filter((capture) => capture.eventId !== lastCapture.eventId),
		);
		setUndoneIds((current) => new Set(current).add(lastCapture.eventId));
		await undoCapture(lastCapture.eventId);
		toast.success("Captura deshecha");
	};

	const copyDiagnostics = async () => {
		const text = frames
			.map(
				(frame) =>
					`${new Date(frame.at).toLocaleTimeString("es-MX")} | ${frame.text.replace(/\r/g, "␍").replace(/\n/g, "␊")} | ${frame.hex}`,
			)
			.join("\n");

		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			toast.success("Diagnóstico copiado");
			setTimeout(() => setCopied(false), 1500);
		} catch {
			toast.error("No se pudo copiar el diagnóstico");
		}
	};

	return (
		<Card className="border-muted/60 shadow-sm">
			<CardHeader className="gap-3 pb-3">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<CardTitle className="flex items-center gap-2 text-lg">
							<Weight className="size-5" aria-hidden="true" />
							Báscula por cable (Web Serial)
						</CardTitle>
						<CardDescription>
							Conexión local para capturar el peso de cada colocación.
						</CardDescription>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<span aria-live="polite">
							<Badge
								variant={status === "connected" ? "default" : "secondary"}
								className="gap-1"
							>
								{status === "connected" ? (
									<BadgeCheck className="size-3" aria-hidden="true" />
								) : null}
								{statusLabel}
							</Badge>
						</span>
						{pending > 0 ? (
							<Badge variant="outline" className="gap-1">
								<RefreshCw className="size-3" aria-hidden="true" />
								Pendientes por enviar: {pending}
							</Badge>
						) : null}
					</div>
				</div>

				<div className="flex flex-wrap gap-2">
					{status !== "connected" ? (
						<Button
							type="button"
							onClick={connect}
							disabled={supported === false && !settings.simulator}
						>
							<Download className="mr-2 size-4" aria-hidden="true" />
							Conectar báscula
						</Button>
					) : (
						<Button type="button" variant="outline" onClick={disconnect}>
							<Unplug className="mr-2 size-4" aria-hidden="true" />
							Desconectar
						</Button>
					)}
					<Button
						type="button"
						variant="ghost"
						onClick={() => setShowSettings((value) => !value)}
						aria-expanded={showSettings}
					>
						<Settings2 className="mr-2 size-4" aria-hidden="true" />
						Ajustes
					</Button>
					<Button
						type="button"
						variant="ghost"
						onClick={() => setShowDiagnostics((value) => !value)}
						aria-expanded={showDiagnostics}
					>
						<ClipboardCopy className="mr-2 size-4" aria-hidden="true" />
						Diagnóstico
					</Button>
				</div>

				{statusDetail ? (
					<p className="text-muted-foreground text-xs">{statusDetail}</p>
				) : null}
			</CardHeader>

			<CardContent className="space-y-4">
				{supported === false && !settings.simulator ? (
					<div
						role="alert"
						className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950 text-sm dark:bg-amber-950/30 dark:text-amber-100"
					>
						<strong className="flex items-center gap-2">
							<CircleAlert className="size-4" aria-hidden="true" />
							Este navegador no puede leer la báscula.
						</strong>
						<p className="mt-1">
							Usa Google Chrome o Microsoft Edge en una computadora de
							escritorio (Windows, macOS o Linux). En tablets y celulares no
							funciona.
						</p>
						<p className="mt-1">
							Activa el simulador en Ajustes para probar la pantalla.
						</p>
					</div>
				) : null}

				<div className="rounded-lg border bg-muted/20 p-4">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<div className="font-medium text-muted-foreground text-sm">
								Peso en vivo
							</div>
							<div
								className={cn(
									"font-bold font-mono text-7xl tabular-nums tracking-tight",
									live?.overload && "text-destructive",
								)}
							>
								{live && !live.overload && live.weightG !== null
									? formatKg(live.weightG)
									: "— — —"}
								<span className="ml-2 font-medium text-2xl">kg</span>
							</div>
						</div>
						<ReadingStatus live={live} />
					</div>

					<p className="mt-2 text-muted-foreground text-sm">
						Bruto · neto estimado con el recipiente actual:{" "}
						{formatKg(Math.round(estimatedLiveNetKg * 1000))} kg
					</p>

					{live?.net === true ? (
						<div
							role="alert"
							className="mt-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950 text-sm dark:bg-amber-950/30 dark:text-amber-100"
						>
							<AlertTriangle
								className="mt-0.5 size-4 shrink-0"
								aria-hidden="true"
							/>
							<span>
								La báscula reporta peso NETO; si ya restaste la tara en el
								indicador, elige “Sin recipiente” para no restarla dos veces.
							</span>
						</div>
					) : null}
				</div>

				{!line ? (
					<div className="rounded-md border border-dashed p-4 text-muted-foreground text-sm">
						Elige un pedido y un renglón antes de colocar la carne
					</div>
				) : (
					<div className="space-y-3">
						<div>
							<strong>Pesando:</strong> {line.productName} · pedido #
							{line.orderId}
						</div>
						<div className="text-muted-foreground text-sm">
							Recipiente actual: {container.label} (tara{" "}
							{formatKg(currentTareG)} kg) — se aplica a las siguientes capturas
						</div>

						<div className="flex flex-wrap items-end gap-3">
							<div className="w-full max-w-56 space-y-1.5">
								<Label htmlFor="piece-count">Piezas en esta captura</Label>
								<Input
									id="piece-count"
									type="number"
									min={0}
									step={1}
									value={pieceCount}
									onChange={(event) => {
										const value = Number(event.target.value);
										const nextValue = Number.isFinite(value)
											? Math.max(0, Math.floor(value))
											: 0;
										pieceCountRef.current = nextValue;
										setPieceCount(nextValue);
									}}
								/>
							</div>
							<Button
								type="button"
								onClick={handleManualCapture}
								disabled={!canManualCapture}
							>
								Capturar
							</Button>
							<Button
								type="button"
								variant="outline"
								onClick={handleUndo}
								disabled={
									!localCaptures.some(
										(capture) => capture.orderItemId === line.orderItemId,
									)
								}
							>
								Deshacer última
							</Button>
						</div>

						<p className="text-muted-foreground text-sm">
							{armed
								? "Captura automática: lista"
								: "Captura automática: esperando que regrese a cero"}
						</p>
					</div>
				)}

				<div className="rounded-lg border p-3">
					<div className="mb-3">
						<h3 className="font-medium">Capturas del renglón</h3>
					</div>

					{mergedCaptures.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							Aún no hay capturas.
						</p>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<caption className="sr-only">Capturas registradas</caption>
								<thead>
									<tr className="border-b text-left">
										<th className="py-2 pr-3 font-medium">#</th>
										<th className="py-2 pr-3 font-medium">Bruto</th>
										<th className="py-2 pr-3 font-medium">Recipiente</th>
										<th className="py-2 pr-3 font-medium">Tara</th>
										<th className="py-2 pr-3 font-medium">Neto</th>
										<th className="py-2 pr-3 font-medium">Piezas</th>
										<th className="py-2 pr-3 font-medium">Hora</th>
										<th className="py-2 pr-3 font-medium">Origen</th>
									</tr>
								</thead>
								<tbody>
									{mergedCaptures.map((capture, index) => (
										<tr
											key={capture.eventId}
											className="border-b last:border-0"
										>
											<td className="py-2 pr-3">{index + 1}</td>
											<td className="py-2 pr-3 font-mono tabular-nums">
												{formatKg(capture.weightG)} kg
											</td>
											<td className="py-2 pr-3">
												{capture.containerId === null
													? "—"
													: (containerLabels?.[capture.containerId] ??
														capture.containerId)}
											</td>
											<td className="py-2 pr-3 font-mono tabular-nums">
												{formatKg(capture.tareG)} kg
											</td>
											<td className="py-2 pr-3 font-mono tabular-nums">
												{formatKg(captureNetG(capture))} kg
											</td>
											<td className="py-2 pr-3">{capture.pieceCount ?? "—"}</td>
											<td className="py-2 pr-3 tabular-nums">
												{new Date(capture.at).toLocaleTimeString("es-MX", {
													hour: "2-digit",
													minute: "2-digit",
													second: "2-digit",
												})}
											</td>
											<td className="py-2 pr-3">
												{capture.pending
													? "Pendiente de enviar"
													: sourceLabel(capture.source)}
											</td>
										</tr>
									))}
								</tbody>
								<tfoot className="border-t font-medium">
									<tr>
										<td className="py-2 pr-3">Totales</td>
										<td className="py-2 pr-3">{totals.count} capturas</td>
										<td className="py-2 pr-3" />
										<td className="py-2 pr-3 font-mono tabular-nums">
											{formatKg(totals.tareG)} kg
										</td>
										<td className="py-2 pr-3 font-mono tabular-nums">
											{formatKg(totals.netG)} kg
										</td>
										<td className="py-2 pr-3">{totals.pieces} piezas</td>
										<td className="py-2 pr-3" />
										<td className="py-2 pr-3" />
									</tr>
									<tr>
										<td className="py-2 pr-3" />
										<td className="py-2 pr-3 font-mono tabular-nums">
											{formatKg(totals.grossG)} kg bruto
										</td>
										<td className="py-2 pr-3" colSpan={6} />
									</tr>
								</tfoot>
							</table>
						</div>
					)}
				</div>

				{showSettings ? (
					<ScaleSettingsForm settings={settings} setSettings={setSettings} />
				) : null}

				{showDiagnostics ? (
					<DiagnosticsPanel
						frames={frames}
						onCopy={copyDiagnostics}
						onClear={clearFrames}
						copied={copied}
					/>
				) : null}
			</CardContent>
		</Card>
	);
}

function createEventId(): string {
	if (
		typeof crypto !== "undefined" &&
		typeof crypto.randomUUID === "function"
	) {
		return crypto.randomUUID();
	}

	const bytes = new Uint8Array(16);
	if (
		typeof crypto !== "undefined" &&
		typeof crypto.getRandomValues === "function"
	) {
		crypto.getRandomValues(bytes);
	} else {
		for (let index = 0; index < bytes.length; index += 1) {
			bytes[index] = Math.floor(Math.random() * 256);
		}
	}

	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;

	const hex = Array.from(bytes, (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");

	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
		16,
		20,
	)}-${hex.slice(20)}`;
}

function ScaleSettingsForm({
	settings,
	setSettings,
}: {
	settings: ScaleSettings;
	setSettings: (partial: Partial<ScaleSettings>) => void;
}) {
	return (
		<section
			className="space-y-4 rounded-lg border p-4"
			aria-labelledby="scale-settings-title"
		>
			<div>
				<h3 id="scale-settings-title" className="font-medium">
					Ajustes de conexión
				</h3>
				<p className="text-muted-foreground text-sm">
					Por defecto 9600 8N1. Se guarda en este navegador.
				</p>
			</div>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<SettingSelect
					id="baud-rate"
					label="Baudios"
					value={String(settings.baudRate)}
					onValueChange={(value) =>
						setSettings({
							baudRate: Number(value) as ScaleSettings["baudRate"],
						})
					}
					options={BAUD_RATES.map((rate) => ({
						value: String(rate),
						label: String(rate),
					}))}
				/>
				<SettingSelect
					id="data-bits"
					label="Bits de datos"
					value={String(settings.dataBits)}
					onValueChange={(value) =>
						setSettings({
							dataBits: Number(value) as ScaleSettings["dataBits"],
						})
					}
					options={[
						{ value: "7", label: "7" },
						{ value: "8", label: "8" },
					]}
				/>
				<SettingSelect
					id="parity"
					label="Paridad"
					value={settings.parity}
					onValueChange={(value) =>
						setSettings({ parity: value as ScaleSettings["parity"] })
					}
					options={[
						{ value: "none", label: "Ninguna" },
						{ value: "even", label: "Par" },
						{ value: "odd", label: "Impar" },
					]}
				/>
				<SettingSelect
					id="stop-bits"
					label="Bits de parada"
					value={String(settings.stopBits)}
					onValueChange={(value) =>
						setSettings({
							stopBits: Number(value) as ScaleSettings["stopBits"],
						})
					}
					options={[
						{ value: "1", label: "1" },
						{ value: "2", label: "2" },
					]}
				/>
				<SettingSelect
					id="scale-mode"
					label="Modo"
					value={settings.mode}
					onValueChange={(value) =>
						setSettings({ mode: value as ScaleSettings["mode"] })
					}
					options={[
						{ value: "continuous", label: "Continuo (cont)" },
						{ value: "request", label: "Por petición — envía P (req)" },
					]}
				/>
				<SettingSelect
					id="default-unit"
					label="Unidad si la trama no trae"
					value={settings.defaultUnit}
					onValueChange={(value) =>
						setSettings({ defaultUnit: value as ScaleSettings["defaultUnit"] })
					}
					options={[
						{ value: "kg", label: "kg" },
						{ value: "g", label: "g" },
						{ value: "lb", label: "lb" },
					]}
				/>
			</div>

			{settings.mode === "request" ? (
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-1.5">
						<Label htmlFor="request-interval">Intervalo de petición (ms)</Label>
						<Input
							id="request-interval"
							type="number"
							min={300}
							max={500}
							value={settings.requestIntervalMs}
							onChange={(event) => {
								const value = Number(event.target.value);
								setSettings({
									requestIntervalMs: Math.min(500, Math.max(300, value)),
								});
							}}
						/>
					</div>
					<SettingSelect
						id="request-terminator"
						label="Terminador"
						value={settings.requestTerminator}
						onValueChange={(value) =>
							setSettings({
								requestTerminator: value as ScaleSettings["requestTerminator"],
							})
						}
						options={[
							{ value: "none", label: "Ninguno" },
							{ value: "cr", label: "CR" },
							{ value: "crlf", label: "CRLF" },
						]}
					/>
				</div>
			) : null}

			<div className="space-y-1.5">
				<Label htmlFor="resolution">
					Resolución en g para estabilidad por software
				</Label>
				<Input
					id="resolution"
					type="number"
					min={1}
					step={1}
					value={settings.resolutionG}
					onChange={(event) => {
						const value = Number(event.target.value);
						setSettings({
							resolutionG: Number.isFinite(value) ? Math.max(1, value) : 1,
						});
					}}
				/>
			</div>

			<label className="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					checked={settings.simulator}
					onChange={(event) => setSettings({ simulator: event.target.checked })}
				/>
				Simulador (puerto falso para pruebas)
			</label>
		</section>
	);
}

function SettingSelect({
	id,
	label,
	value,
	onValueChange,
	options,
}: {
	id: string;
	label: string;
	value: string;
	onValueChange: (value: string) => void;
	options: Array<{ value: string; label: string }>;
}) {
	return (
		<div className="space-y-1.5">
			<Label htmlFor={id}>{label}</Label>
			<Select value={value} onValueChange={onValueChange}>
				<SelectTrigger id={id}>
					<SelectValue placeholder={label} />
				</SelectTrigger>
				<SelectContent>
					{options.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

function DiagnosticsPanel({
	frames,
	onCopy,
	onClear,
	copied,
}: {
	frames: Array<{ at: number; text: string; hex: string; parsed: boolean }>;
	onCopy: () => void;
	onClear: () => void;
	copied: boolean;
}) {
	return (
		<section
			className="space-y-3 rounded-lg border p-4"
			aria-labelledby="diagnostics-title"
		>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h3 id="diagnostics-title" className="font-medium">
					Diagnóstico de tramas
				</h3>
				<div className="flex gap-2">
					<Button type="button" variant="outline" size="sm" onClick={onCopy}>
						<Copy className="mr-2 size-4" aria-hidden="true" />
						{copied ? "Copiado" : "Copiar"}
					</Button>
					<Button type="button" variant="ghost" size="sm" onClick={onClear}>
						<Trash2 className="mr-2 size-4" aria-hidden="true" />
						Limpiar
					</Button>
				</div>
			</div>

			{frames.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					No hay tramas recibidas.
				</p>
			) : (
				<div className="overflow-x-auto">
					<table className="w-full text-xs">
						<caption className="sr-only">Últimas 30 tramas recibidas</caption>
						<thead>
							<tr className="border-b text-left">
								<th className="py-2 pr-3 font-medium">Hora</th>
								<th className="py-2 pr-3 font-medium">Texto</th>
								<th className="py-2 pr-3 font-medium">Hex</th>
								<th className="py-2 pr-3 font-medium">Interpretada</th>
							</tr>
						</thead>
						<tbody>
							{frames.map((frame, index) => (
								<tr
									key={`${frame.at}-${index}`}
									className="border-b align-top last:border-0"
								>
									<td className="py-2 pr-3 tabular-nums">
										{new Date(frame.at).toLocaleTimeString("es-MX")}
									</td>
									<td className="max-w-xs break-all py-2 pr-3 font-mono">
										{frame.text.replace(/\r/g, "␍").replace(/\n/g, "␊")}
									</td>
									<td className="max-w-xs break-all py-2 pr-3 font-mono">
										{frame.hex}
									</td>
									<td className="py-2 pr-3">{frame.parsed ? "Sí" : "No"}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</section>
	);
}

function ReadingStatus({ live }: { live: LiveReading | null }) {
	if (live?.overload) {
		return (
			<Badge variant="destructive" className="gap-1">
				<CircleAlert className="size-3" aria-hidden="true" />
				Sobrecarga
			</Badge>
		);
	}

	if (live?.stable) {
		return (
			<Badge className="gap-1 bg-green-600 text-white hover:bg-green-600">
				<BadgeCheck className="size-3" aria-hidden="true" />
				Estable
			</Badge>
		);
	}

	return (
		<Badge
			variant="outline"
			className="gap-1 border-amber-500 text-amber-700 dark:text-amber-300"
		>
			<LoaderCircle className="size-3" aria-hidden="true" />
			Moviendo
		</Badge>
	);
}

function getStatusLabel(
	status: string,
	supported: boolean | null,
	simulator: boolean,
): string {
	if (supported === false && !simulator) {
		return "No compatible";
	}

	switch (status) {
		case "connected":
			return "Conectada";
		case "connecting":
			return "Conectando…";
		case "reconnecting":
			return "Reconectando…";
		case "error":
			return "Error";
		default:
			return "Sin conexión";
	}
}

function sourceLabel(source: string): string {
	return source === "pc-webserial" ? "PC" : "T-RSS3";
}

function formatKg(weightG: number | null): string {
	return (weightG === null ? 0 : weightG / 1000).toFixed(3);
}
