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
	type ModulePage,
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
	config: "Configuración de la estación",
	pedidos: "Cola de pedidos",
	tickets: "Últimos tickets",
	produccion: "Pesaje de producción",
	recetas: "Recetas de despiece",
	frio: "Inventario frío",
	clientes: "Clientes · precios · cobranza",
	cobro: "Cobro",
	voz: "Antonella · voz",
};

/** Pie común de las vistas rápidas: cómo abrir la ventana grande. */
export function DetailHint({ onOpen }: { onOpen: () => void }) {
	return (
		<button
			type="button"
			onClick={onOpen}
			className="mt-3 inline-flex items-center gap-2 rounded border border-[#4d7652] bg-[#13281b] px-3 py-1.5 font-bold text-[#c9ff99] text-[11px] uppercase tracking-wider transition hover:bg-[#1b3a27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f39a1e]"
		>
			Ventana grande ▸
			<kbd className="rounded border border-[#4d7652] bg-[#0b1710] px-1.5 py-0.5 text-[9px]">
				Fn + tecla · Enter
			</kbd>
		</button>
	);
}

/** Qué ofrece cada módulo en la pantalla 7 y en la ventana sobrepuesta. */
export const MODULE_INFO: Record<
	ModulePage,
	{ detail: string; quick: string[] }
> = {
	recetas: {
		detail: "Configurador canal → piezas → variantes",
		quick: [
			"Receta activa por tipo de canal",
			"% de peso por pieza (debe sumar 100 %)",
			"Activar / desactivar piezas",
		],
	},
	frio: {
		detail: "Transferencias fresco ↔ congelado e historial",
		quick: ["Pasar a congelado", "Descongelar", "Existencia por producto"],
	},
	clientes: {
		detail: "Clientes, precios por cliente y cobranza en una sola ventana",
		quick: [
			"Saldo y crédito disponible del cliente",
			"Precio especial y último precio cobrado",
			"Por cobrar hoy · registrar abono",
		],
	},
};

/** Pantalla 7 de un módulo: opciones rápidas + abrir la ventana de detalle. */
export function ModuleQuickPage({
	page,
	customerName,
	onOpenDetail,
}: {
	page: ModulePage;
	customerName: string | null;
	onOpenDetail: () => void;
}) {
	const info = MODULE_INFO[page];
	return (
		<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
			<div>
				{customerName ? (
					<FnScreenRow
						label="Cliente del pedido"
						value={customerName}
						highlight
					/>
				) : null}
				<p className="mt-2 mb-1 text-[10px] uppercase tracking-[0.14em] opacity-60">
					Opciones rápidas (se conectan a datos en la siguiente fase)
				</p>
				<ul className="space-y-1 text-xs">
					{info.quick.map((line) => (
						<li key={line} className="flex gap-2">
							<span aria-hidden="true" className="opacity-50">
								·
							</span>
							{line}
						</li>
					))}
				</ul>
			</div>
			<button
				type="button"
				onClick={onOpenDetail}
				className="flex flex-col items-start justify-center gap-1 rounded-md border border-[#4d7652] bg-[#13281b] px-4 py-3 text-left transition hover:bg-[#1b3a27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f39a1e]"
			>
				<span className="font-bold text-[#c9ff99] text-sm uppercase tracking-wider">
					Abrir detalle ▸
				</span>
				<span className="text-[11px] opacity-80">{info.detail}</span>
				<kbd className="mt-1 rounded border border-[#4d7652] bg-[#0b1710] px-1.5 py-0.5 font-bold text-[9px]">
					Fn + tecla · Enter · Esc regresa
				</kbd>
			</button>
		</div>
	);
}

/** Config: agrupa las páginas técnicas de la estación en un solo menú. */
export function ConfigPage({
	fontLabel,
	onCycleFont,
	onOpen,
	onClassic,
	onExit,
}: {
	fontLabel: string;
	onCycleFont: () => void;
	onOpen: (page: FnPage) => void;
	onClassic: () => void;
	onExit: () => void;
}) {
	const items: Array<{
		label: string;
		hint: string;
		shortcut: string;
		run: () => void;
	}> = [
		{
			label: `Tamaño de letra · ${fontLabel}`,
			hint: "normal → mediano → grande",
			shortcut: "Súper+⇧A",
			run: onCycleFont,
		},
		{
			label: "Recipiente y tara",
			hint: "tambos, cubetas, tara manual",
			shortcut: "Súper+C",
			run: () => onOpen("recipiente"),
		},
		{
			label: "Conexión serial",
			hint: "puerto RS-232 de la I-QY",
			shortcut: "Súper+B",
			run: () => onOpen("conexion"),
		},
		{
			label: "Diagnóstico de tramas",
			hint: "lo que manda la báscula",
			shortcut: "Súper+X",
			run: () => onOpen("diagnostico"),
		},
		{
			label: "Teclado · peso manual",
			hint: "si la báscula no responde",
			shortcut: "—",
			run: () => onOpen("teclado"),
		},
		{
			label: "Tema",
			hint: "colores de la estación",
			shortcut: "Súper+M",
			run: () => onOpen("tema"),
		},
		{
			label: "Atajos de teclado",
			hint: "lista completa",
			shortcut: "Súper+/",
			run: () => onOpen("atajos"),
		},
		{
			label: "Báscula clásica",
			hint: "pantalla anterior",
			shortcut: "Súper+V",
			run: onClassic,
		},
		{
			label: "Salir al dashboard",
			hint: "menú completo del sistema",
			shortcut: "—",
			run: onExit,
		},
	];
	return (
		<div className="grid gap-x-6 md:grid-cols-2">
			{items.map((item) => (
				<FnScreenOption
					key={item.label}
					selected={false}
					label={item.label}
					hint={item.hint}
					shortcut={item.shortcut}
					onSelect={item.run}
				/>
			))}
		</div>
	);
}

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

/** Pedidos: vista rápida de la cola (la lista completa va en la ventana). */
export function PedidosQuickPage({
	orders,
	onPick,
	onOpenDetail,
}: {
	orders: Array<{ id: number; title: string; pending: number; isNew: boolean }>;
	onPick: (id: number) => void;
	onOpenDetail: () => void;
}) {
	const pendingTotal = orders.reduce((sum, order) => sum + order.pending, 0);
	return (
		<div>
			<FnScreenRow label="Pedidos en cola" value={orders.length} highlight />
			<FnScreenRow label="Renglones por pesar" value={pendingTotal} />
			<div className="mt-2 grid gap-x-6 md:grid-cols-2">
				{orders.slice(0, 6).map((order, index) => (
					<FnScreenOption
						key={order.id}
						selected={false}
						label={`#${order.id} ${order.title}`}
						hint={`${order.pending} por pesar${order.isNew ? " · nuevo" : ""}`}
						shortcut={String(index + 1)}
						onSelect={() => onPick(order.id)}
					/>
				))}
			</div>
			<DetailHint onOpen={onOpenDetail} />
		</div>
	);
}

/** Tickets: últimos cobrados; clic abre el ticket (imprimir / WhatsApp). */
export function TicketsQuickPage({
	tickets,
	loading,
	onOpenTicket,
	onOpenDetail,
}: {
	tickets: Array<{ id: number; title: string; total: string; when: string }>;
	loading: boolean;
	onOpenTicket: (id: number) => void;
	onOpenDetail: () => void;
}) {
	return (
		<div>
			{loading ? (
				<p className="text-xs opacity-70">Cargando…</p>
			) : tickets.length === 0 ? (
				<p className="text-xs opacity-70">Todavía no hay tickets cobrados.</p>
			) : (
				<div className="grid gap-x-6 md:grid-cols-2">
					{tickets.map((ticket, index) => (
						<FnScreenOption
							key={ticket.id}
							selected={false}
							label={`#${ticket.id} ${ticket.title}`}
							hint={`${ticket.total} · ${ticket.when}`}
							shortcut={String(index + 1)}
							onSelect={() => onOpenTicket(ticket.id)}
						/>
					))}
				</div>
			)}
			<p className="mt-2 text-[10px] opacity-60">
				Clic en un ticket para verlo, imprimirlo o mandarlo por WhatsApp. La
				ventana grande muestra las capturas del pedido en báscula.
			</p>
			<DetailHint onOpen={onOpenDetail} />
		</div>
	);
}

/** Producción: qué es y cómo se usa. */
export function ProduccionQuickPage({
	onOpenDetail,
}: {
	onOpenDetail: () => void;
}) {
	return (
		<div className="space-y-1 text-xs">
			<p className="text-[#c9ff99]">
				Pesar producto SIN pedido de cliente (p. ej. 20 piernas del despiece).
			</p>
			<p>· «Al inventario»: suma piezas + kg a existencias en ese momento.</p>
			<p>
				· «A la cola»: crea un pedido de producción que aparece en 1 y se pesa
				renglón por renglón; al terminar suma al inventario.
			</p>
			<DetailHint onOpen={onOpenDetail} />
		</div>
	);
}

/** Cobro de contado o a crédito: confirmar sin salir de la báscula. */
export function CobroPage({
	type,
	customerName,
	total,
	lineCount,
	methods,
	methodId,
	onMethod,
	onConfirm,
	busy,
}: {
	type: "contado" | "credito";
	customerName: string;
	total: string;
	lineCount: number;
	methods: Array<{ id: number; name: string }>;
	methodId: number | null;
	onMethod: (id: number) => void;
	onConfirm: () => void;
	busy: boolean;
}) {
	return (
		<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
			<div>
				<FnScreenRow
					label={type === "contado" ? "Cobro de contado" : "Cobro a crédito"}
					value={customerName}
				/>
				<FnScreenRow label="Renglones" value={lineCount} />
				<FnScreenRow label="Total a cobrar" value={total} highlight />
				{type === "contado" ? (
					<div className="mt-2 grid gap-x-6 md:grid-cols-2">
						{methods.map((method, index) => (
							<FnScreenOption
								key={method.id}
								selected={method.id === methodId}
								label={method.name}
								shortcut={String(index + 1)}
								onSelect={() => onMethod(method.id)}
							/>
						))}
					</div>
				) : (
					<p className="mt-2 text-xs">
						Se carga a la cuenta del cliente; queda en Cobranza.
					</p>
				)}
			</div>
			<button
				type="button"
				onClick={onConfirm}
				disabled={busy || (type === "contado" && methodId === null)}
				className="flex flex-col items-start justify-center gap-1 rounded-md border border-[#6fdc7a] bg-[#1d4a2a] px-4 py-3 text-left transition hover:bg-[#25603a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f39a1e] disabled:opacity-40"
			>
				<span className="font-black text-[#d5ffd1] text-base uppercase tracking-wider">
					{busy
						? "Cobrando…"
						: type === "contado"
							? "Cobrar de contado ▸"
							: "Cargar a crédito ▸"}
				</span>
				<span className="text-[11px] opacity-80">
					Abre el ticket al terminar (imprimir / WhatsApp)
				</span>
				<kbd className="mt-1 rounded border border-[#4d7652] bg-[#0b1710] px-1.5 py-0.5 font-bold text-[9px]">
					Enter confirma · Esc cancela
				</kbd>
			</button>
		</div>
	);
}

/** Voz (solo micrófono): onda mientras escucha; luego Antonella actúa o responde. */
export function VozPage({
	status,
	transcript,
	answer,
	supported,
}: {
	status: "idle" | "listening" | "thinking" | "answered" | "error";
	transcript: string;
	answer: string;
	supported: boolean;
}) {
	const bars = Array.from({ length: 32 }, (_, index) => index);
	return (
		<div className="grid h-full gap-4 lg:grid-cols-[minmax(18rem,26rem)_minmax(0,1fr)]">
			<div className="flex flex-col justify-center gap-2">
				<div className="flex h-14 items-center justify-center gap-1">
					{bars.map((bar) => (
						<span
							key={bar}
							className={
								status === "listening"
									? "pz-voice-bar block w-1.5 rounded-full bg-[#9be59b] shadow-[0_0_6px_#9be59b]"
									: status === "thinking"
										? "block h-2 w-1.5 animate-pulse rounded-full bg-[#9be59b]/60"
										: "block h-1 w-1.5 rounded-full bg-[#9be59b]/30"
							}
							style={
								status === "listening"
									? {
											height: `${30 + ((bar * 37) % 70)}%`,
											animationDelay: `${(bar % 7) * 0.11}s`,
										}
									: status === "thinking"
										? { animationDelay: `${(bar % 8) * 0.08}s` }
										: undefined
							}
						/>
					))}
				</div>
				<p className="text-center text-[11px] uppercase tracking-[0.18em] opacity-70">
					{!supported
						? "Este navegador no tiene dictado: usa Google Chrome"
						: status === "listening"
							? "Escuchando… suelta 🎤 o pulsa Espacio"
							: status === "thinking"
								? "Antonella está pensando…"
								: "Mantén 🎤 o Alt+Espacio para hablar"}
				</p>
			</div>
			<div className="min-h-0 space-y-2 overflow-y-auto border-[#355440] lg:border-l lg:pl-4">
				{transcript ? (
					<p className="text-xs">
						<span className="mr-2 font-bold text-[#72b777] uppercase tracking-[0.14em]">
							Tú
						</span>
						<span className="text-[#c9ff99]">{transcript}</span>
					</p>
				) : (
					<p className="text-xs opacity-50">
						Ej.: «Nuevo pedido para Mercado San Juan: 8 piernas, 5 pechos y 3
						cabezas». Antonella arma el pedido y tú lo confirmas con Enter.
					</p>
				)}
				{answer ? (
					<div className="pz-zoom whitespace-pre-wrap rounded border border-[#355440] bg-[#0b1710]/70 p-3 text-[#d5ffd1] text-xs leading-relaxed">
						<span className="mb-1 block font-bold text-[#72b777] text-[10px] uppercase tracking-[0.14em]">
							Antonella
						</span>
						{answer}
					</div>
				) : null}
			</div>
		</div>
	);
}
