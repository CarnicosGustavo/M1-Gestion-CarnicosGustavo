"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@finopenpos/ui/components/button";
import { Card, CardContent } from "@finopenpos/ui/components/card";
import { Input } from "@finopenpos/ui/components/input";
import { cn } from "@finopenpos/ui/lib/utils";
import {
	CalendarIcon,
	CheckIcon,
	CheckCircle2Icon,
	InfoIcon,
	LayoutPanelTopIcon,
	SaveIcon,
	ScissorsIcon,
	SparklesIcon,
	UploadIcon,
	RotateCcwIcon,
	BellIcon,
	ShapesIcon,
	XIcon,
	ArrowRightIcon,
} from "lucide-react";
import { AntonellaAvatar } from "@/components/antonella-avatar";

/* ---------- navigation sections ---------- */
const SECTIONS = [
	{ id: "portada", label: "Portada", icon: "home" },
	{ id: "colores", label: "Colores", icon: "palette" },
	{ id: "tipografia", label: "Tipografía", icon: "type" },
	{ id: "botones", label: "Botones", icon: "square-mouse-pointer" },
	{ id: "campos", label: "Campos", icon: "text-cursor-input" },
	{ id: "estados", label: "Estados", icon: "tags" },
	{ id: "logos", label: "Logos y personajes", icon: "shapes" },
];

/* ---------- helpers ---------- */
function Overline({ children }: { children: React.ReactNode }) {
	return (
		<div className="mb-3.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
			{children}
		</div>
	);
}

function DsCard({
	label,
	children,
}: { label?: string; children: React.ReactNode }) {
	return (
		<Card>
			<CardContent className="p-4">
				{label && <Overline>{label}</Overline>}
				{children}
			</CardContent>
		</Card>
	);
}

function DsSection({
	id,
	title,
	desc,
	children,
}: {
	id: string;
	title: string;
	desc?: string;
	children: React.ReactNode;
}) {
	return (
		<section id={id} className="mb-9 scroll-mt-3">
			<div className="mb-4">
				<h2 className="font-display text-[22px] tracking-wide text-foreground">
					{title}
				</h2>
				{desc && (
					<p className="mt-1.5 max-w-xl text-sm text-muted-foreground">{desc}</p>
				)}
			</div>
			{children}
		</section>
	);
}

/* ---------- status badge ---------- */
type StatusTone = "green" | "blue" | "amber" | "red" | "ghost";
function StatusBadge({
	tone,
	children,
}: { tone: StatusTone; children: React.ReactNode }) {
	const cls: Record<StatusTone, string> = {
		green:
			"bg-[var(--cg-green-wash)] text-[var(--cg-green)] border-[var(--cg-green)]/20",
		blue: "bg-[var(--cg-blue-wash)] text-[var(--cg-blue)] border-[var(--cg-blue)]/20",
		amber:
			"bg-[var(--cg-amber-wash)] text-[var(--cg-amber)] border-[var(--cg-amber)]/20",
		red: "bg-[var(--cg-red-wash)] text-primary border-primary/20",
		ghost: "bg-secondary text-muted-foreground border-border",
	};
	return (
		<span
			className={cn(
				"inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em]",
				cls[tone],
			)}
		>
			{children}
		</span>
	);
}

const ORDER_STATUSES: [string, StatusTone][] = [
	["Pagada", "green"],
	["Lista para cobro", "blue"],
	["Procesando pago", "blue"],
	["Por pesar", "amber"],
	["Parcial", "amber"],
	["Cancelada", "red"],
	["Pendiente", "amber"],
	["Producción", "blue"],
];

const AVAIL_STATUSES: [string, StatusTone][] = [
	["Stock", "green"],
	["Despiece", "blue"],
	["Por pesar", "amber"],
	["Faltante", "red"],
];

/* ---------- color swatches ---------- */
const COLOR_SWATCHES = [
	["Tinta", "var(--foreground)", "#211C19"],
	["Rojo marca", "var(--primary)", "#9E3326"],
	["Crema", "var(--accent)", "#F1E7D6"],
	["Kraft", "var(--cg-tan)", "#B7A88B"],
	["Verde · OK", "var(--cg-green)", "#3F7D54"],
	["Ámbar · pendiente", "var(--cg-amber)", "#C0851F"],
	["Azul · proceso", "var(--cg-blue)", "#3C6E8F"],
	["Chrome", "var(--cg-chrome)", "#211C19"],
] as const;

/* ---------- logo tile ---------- */
function LogoTile({
	src,
	label,
	bg,
	h = 120,
}: { src: string; label: string; bg: string; h?: number }) {
	return (
		<div className="overflow-hidden rounded-2xl border">
			<div
				className="grid place-items-center p-4"
				style={{ height: h, background: bg }}
			>
				<Image
					src={src}
					alt={label}
					width={200}
					height={h - 32}
					className="h-full max-h-full w-auto object-contain"
				/>
			</div>
			<div className="bg-card px-3 py-2 text-[12px] font-semibold text-muted-foreground">
				{label}
			</div>
		</div>
	);
}

/* ---------- character tile ---------- */
function CharacterTile({
	src,
	name,
	role,
	accentCls,
}: { src: string; name: string; role: string; accentCls: string }) {
	return (
		<div className="rounded-2xl border bg-card p-4 text-center">
			<div
				className="mx-auto mb-3 h-24 w-24 overflow-hidden rounded-full bg-cover bg-center"
				style={{ backgroundImage: `url(${src})` }}
			/>
			<div className="text-[15px] font-bold text-foreground">{name}</div>
			<div className={cn("mt-1 text-[11.5px] font-semibold", accentCls)}>
				{role}
			</div>
		</div>
	);
}

/* ---------- iAntonella chat bubble (preview) ---------- */
function AiBubble({ text }: { text: string }) {
	return (
		<div className="flex gap-2.5">
			<AntonellaAvatar size={28} />
			<div className="max-w-[85%] rounded-[14px_14px_14px_4px] border bg-secondary px-3 py-2.5 text-[14px] leading-relaxed text-foreground/85">
				{text}
			</div>
		</div>
	);
}

/* ====================================================================== */
export default function DesignSystemPage() {
	const [activeSection, setActiveSection] = useState("portada");
	const [showDialog, setShowDialog] = useState(false);
	const [showToast, setShowToast] = useState(false);
	const [switchOn, setSwitchOn] = useState(true);
	const [checkOn, setCheckOn] = useState(true);

	const scrollTo = (id: string) => {
		const el = document.getElementById(id);
		if (!el) return;
		el.scrollIntoView({ behavior: "smooth", block: "start" });
		setActiveSection(id);
	};

	const fireToast = () => {
		setShowToast(true);
		setTimeout(() => setShowToast(false), 2600);
	};

	return (
		<div className="relative">
			{/* ------------------------------------------------------------ */}
			{/* 2-column layout: fixed side nav + content                     */}
			{/* ------------------------------------------------------------ */}
			<div className="flex gap-5 items-start">
				{/* Side nav (sticky) */}
				<nav className="sticky top-0 hidden w-48 shrink-0 lg:block">
					<Card>
						<CardContent className="p-2">
							{SECTIONS.map(({ id, label }) => {
								const on = activeSection === id;
								return (
									<button
										key={id}
										type="button"
										onClick={() => scrollTo(id)}
										className={cn(
											"mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left font-semibold text-[12.5px] transition-colors",
											on
												? "bg-primary text-primary-foreground"
												: "text-muted-foreground hover:bg-secondary hover:text-foreground",
										)}
									>
										{label}
									</button>
								);
							})}
						</CardContent>
					</Card>
				</nav>

				{/* Main content */}
				<div className="min-w-0 flex-1">
					{/* ---- PORTADA ---- */}
					<div id="portada" className="mb-6 scroll-mt-3">
						<Card>
							<CardContent className="grid place-items-center p-10 bg-[#F1E7D6] rounded-t-2xl">
								<Image
									src="/brand/logo-principal.png"
									alt="Cárnicos Gustavo"
									width={340}
									height={200}
									className="h-40 w-auto object-contain"
								/>
							</CardContent>
						</Card>
						<div className="mt-4 flex flex-wrap items-end justify-between gap-4">
							<div>
								<h1 className="font-display text-[34px] tracking-wide text-foreground">
									Sistema de Diseño
								</h1>
								<p className="mt-2 max-w-xl text-sm text-muted-foreground">
									La caja de herramientas de Cárnicos Gustavo: cada botón,
									campo, selector, estado y personaje listos para reusar en
									cualquier módulo.
								</p>
							</div>
							<StatusBadge tone="green">Librería lista</StatusBadge>
						</div>
					</div>

					{/* ---- COLORES ---- */}
					<DsSection
						id="colores"
						title="Colores"
						desc="Paleta de marca (negro cálido + rojo ladrillo + crema) y semántica de estado."
					>
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
							{COLOR_SWATCHES.map(([name, cssVar, hex]) => (
								<div
									key={name}
									className="overflow-hidden rounded-xl border"
								>
									<div
										className="h-14"
										style={{ background: cssVar }}
									/>
									<div className="bg-card px-2.5 py-2">
										<div className="text-[12px] font-bold text-foreground">
											{name}
										</div>
										<div className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">
											{hex}
										</div>
									</div>
								</div>
							))}
						</div>
					</DsSection>

					{/* ---- TIPOGRAFÍA ---- */}
					<DsSection
						id="tipografia"
						title="Tipografía"
						desc="Anton para titulares y números de báscula, Archivo para interfaz, JetBrains Mono para pesos y precios."
					>
						<DsCard>
							<div className="flex flex-col gap-4">
								<div>
									<span className="font-display text-[38px] text-foreground">
										GUSTAVO 105 kg
									</span>
									<div className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
										Anton · display
									</div>
								</div>
								<div>
									<span className="text-xl font-bold text-foreground">
										Texto de interfaz en negrita
									</span>
									<div className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
										Archivo 700
									</div>
								</div>
								<div>
									<span className="text-base text-foreground/80">
										Texto corrido para descripciones y ayuda al operario.
									</span>
									<div className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
										Archivo 400
									</div>
								</div>
								<div>
									<span className="font-mono text-[18px] font-semibold text-foreground">
										$ 1,284.50 · 24.9% · 26.10 kg
									</span>
									<div className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
										JetBrains Mono · cifras
									</div>
								</div>
							</div>
						</DsCard>
					</DsSection>

					{/* ---- BOTONES ---- */}
					<DsSection
						id="botones"
						title="Botones"
						desc="5 variantes × 4 tamaños. Mínimo 44 px de alto para uso táctil en báscula y POS."
					>
						<DsCard label="Variantes">
							<div className="flex flex-wrap items-center gap-3">
								<Button size="default">
									<SparklesIcon className="h-4 w-4" />
									Primario
								</Button>
								<Button
									size="default"
									className="bg-[var(--cg-chrome)] text-[var(--cg-chrome-fg)] hover:brightness-110"
								>
									<SaveIcon className="h-4 w-4" />
									Oscuro
								</Button>
								<Button
									size="default"
									className="bg-[var(--cg-green)] text-white hover:brightness-95"
								>
									<CheckIcon className="h-4 w-4" />
									Confirmar
								</Button>
								<Button size="default" variant="outline">
									<UploadIcon className="h-4 w-4" />
									Contorno
								</Button>
								<Button size="default" variant="ghost">
									<RotateCcwIcon className="h-4 w-4" />
									Fantasma
								</Button>
								<Button
									size="default"
									variant="outline"
									className="border-primary/40 text-primary"
								>
									Eliminar
								</Button>
							</div>
						</DsCard>
						<div className="mt-3" />
						<DsCard label="Tamaños · sm / md / lg">
							<div className="flex flex-wrap items-center gap-3">
								<Button size="sm">
									<ScissorsIcon className="h-3.5 w-3.5" />
									sm
								</Button>
								<Button size="default">
									<ScissorsIcon className="h-4 w-4" />
									md
								</Button>
								<Button size="lg">
									<ScissorsIcon className="h-5 w-5" />
									lg
								</Button>
								<Button
									size="icon"
									variant="outline"
									className="h-11 w-11"
								>
									<BellIcon className="h-5 w-5" />
								</Button>
							</div>
						</DsCard>
					</DsSection>

					{/* ---- CAMPOS ---- */}
					<DsSection
						id="campos"
						title="Campos de captura"
						desc="Texto, búsqueda, número con unidad, precio, peso y switch/check."
					>
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<DsCard label="Texto">
								<Input placeholder="Nombre del negocio" />
							</DsCard>
							<DsCard label="Búsqueda">
								<div className="relative">
									<Input placeholder="Buscar pieza…" className="pl-9" />
									<ShapesIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
								</div>
							</DsCard>
							<DsCard label="Peso (kg)">
								<div className="flex items-center gap-2">
									<Input placeholder="0.000" className="flex-1 font-mono" />
									<span className="text-sm text-muted-foreground">kg</span>
								</div>
							</DsCard>
							<DsCard label="Precio">
								<div className="flex items-center gap-2">
									<span className="text-sm text-muted-foreground">$</span>
									<Input placeholder="0.00" className="flex-1 font-mono" />
									<span className="text-sm text-muted-foreground">/kg</span>
								</div>
							</DsCard>
							<DsCard label="Switch">
								<div className="flex items-center gap-3">
									<button
										type="button"
										onClick={() => setSwitchOn((o) => !o)}
										className="relative h-6 w-11 rounded-full transition-colors"
										style={{
											background: switchOn
												? "var(--cg-green)"
												: "var(--cg-tan)",
										}}
									>
										<span
											className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
											style={{ left: switchOn ? "calc(100% - 22px)" : 2 }}
										/>
									</button>
									<span className="text-sm font-semibold text-foreground">
										{switchOn ? "Activo" : "Inactivo"}
									</span>
								</div>
							</DsCard>
							<DsCard label="Checkbox">
								<button
									type="button"
									onClick={() => setCheckOn((o) => !o)}
									className="flex items-center gap-2.5"
								>
									<span
										className={cn(
											"flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.5px]",
											checkOn
												? "border-primary bg-primary"
												: "border-border bg-secondary",
										)}
									>
										{checkOn && <CheckIcon className="h-3.5 w-3.5 text-white" />}
									</span>
									<span className="text-sm font-semibold text-foreground">
										Factura (NFC-e)
									</span>
								</button>
							</DsCard>
						</div>
					</DsSection>

					{/* ---- ESTADOS ---- */}
					<DsSection
						id="estados"
						title="Estados y etiquetas"
						desc="Lenguaje de estado del pedido y disponibilidad de pieza. Consistentes en todos los módulos."
					>
						<DsCard label="Estados de pedido">
							<div className="flex flex-wrap gap-2">
								{ORDER_STATUSES.map(([label, tone]) => (
									<StatusBadge key={label} tone={tone}>
										{label}
									</StatusBadge>
								))}
							</div>
						</DsCard>
						<div className="mt-3" />
						<DsCard label="Disponibilidad de pieza (POS / Despiece)">
							<div className="flex flex-wrap gap-2">
								{AVAIL_STATUSES.map(([label, tone]) => (
									<StatusBadge key={label} tone={tone}>
										{label}
									</StatusBadge>
								))}
							</div>
						</DsCard>
						<div className="mt-3" />
						<DsCard label="Diálogos y avisos">
							<div className="flex flex-wrap gap-3">
								<Button
									variant="outline"
									onClick={() => setShowDialog(true)}
								>
									<LayoutPanelTopIcon className="h-4 w-4" />
									Ver diálogo
								</Button>
								<Button variant="outline" onClick={fireToast}>
									<BellIcon className="h-4 w-4" />
									Lanzar toast
								</Button>
							</div>
						</DsCard>
						<div className="mt-3" />
						<DsCard label="Presencia de iAntonella">
							<div className="flex flex-col gap-3">
								<AiBubble text="Hoy no te conviene despiezar americanos: 0 pedidos los demandan." />
								<div className="flex flex-wrap gap-2">
									<button
										type="button"
										className="inline-flex items-center gap-1.5 rounded-full bg-[var(--cg-chrome)] px-3 py-2 font-bold text-[12.5px] text-[var(--cg-chrome-fg)]"
									>
										<SparklesIcon className="h-3.5 w-3.5 text-primary" />
										Despiezar solo lo pedido
									</button>
									<button
										type="button"
										className="inline-flex items-center gap-1.5 rounded-full border px-3 py-2 font-bold text-[12.5px] text-foreground"
									>
										Ver pedidos
									</button>
								</div>
							</div>
						</DsCard>
					</DsSection>

					{/* ---- LOGOS Y PERSONAJES ---- */}
					<DsSection
						id="logos"
						title="Logos y personajes"
						desc="El logo en sus versiones, y los personajes del universo Cárnicos Gustavo."
					>
						<DsCard label="Logotipo de marca">
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
								<LogoTile
									src="/brand/logo-principal.png"
									label="Principal · apilado (sobre claro)"
									bg="#F1E7D6"
									h={140}
								/>
								<LogoTile
									src="/brand/logo-christopher-horizontal.png"
									label="Horizontal · sobre oscuro"
									bg="#211C19"
									h={140}
								/>
								<LogoTile
									src="/brand/pig-head.png"
									label="Isotipo · insignia del rail"
									bg="#211C19"
									h={140}
								/>
							</div>
						</DsCard>
						<div className="mt-3" />
						<DsCard label="Personajes">
							<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
								<CharacterTile
									src="/brand/iantonella-rojo.png"
									name="iAntonella"
									role="Inteligencia del sistema"
									accentCls="text-primary"
								/>
								<CharacterTile
									src="/brand/gustavo-icono.png"
									name="Gustavo"
									role="Marca / fundador"
									accentCls="text-foreground"
								/>
								<CharacterTile
									src="/brand/logo-christopher-apilado.png"
									name="Christopher"
									role="Agente de atención"
									accentCls="text-primary"
								/>
							</div>
							<div className="mt-3 flex items-center gap-2.5 rounded-xl bg-[var(--cg-blue-wash)] px-3.5 py-2.5">
								<InfoIcon className="h-4 w-4 shrink-0 text-[var(--cg-blue)]" />
								<span className="text-[12.5px] text-foreground/80">
									El ícono de iAntonella (cerdita con monóculo) es su avatar en
									todo el sistema: slots, chat y launcher. Versión roja y versión
									sobre claro.
								</span>
							</div>
						</DsCard>
					</DsSection>
				</div>
			</div>

			{/* ---------------------------------------------------------------- */}
			{/* Dialog                                                           */}
			{/* ---------------------------------------------------------------- */}
			{showDialog && (
				<div
					className="fixed inset-0 z-50 grid place-items-center bg-foreground/45 p-5"
					onClick={() => setShowDialog(false)}
				>
					<div
						className="w-[min(420px,94vw)] overflow-hidden rounded-2xl border bg-card shadow-2xl"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex items-center justify-between border-b px-4 py-4">
							<span className="text-[16px] font-bold text-foreground">
								Editar pedido
							</span>
							<button
								type="button"
								onClick={() => setShowDialog(false)}
								className="text-muted-foreground"
							>
								<XIcon className="h-5 w-5" />
							</button>
						</div>
						<div className="flex flex-col gap-3 p-4">
							<Input defaultValue="Carnicería Marenco" />
							<Input placeholder="Total MXN" className="font-mono" />
							<div className="flex justify-end gap-2 pt-1">
								<Button variant="ghost" onClick={() => setShowDialog(false)}>
									Cancelar
								</Button>
								<Button
									className="bg-[var(--cg-chrome)] text-[var(--cg-chrome-fg)]"
									onClick={() => setShowDialog(false)}
								>
									<SaveIcon className="h-4 w-4" />
									Actualizar
								</Button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* ---------------------------------------------------------------- */}
			{/* Toast                                                            */}
			{/* ---------------------------------------------------------------- */}
			<div
				className={cn(
					"pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2 transition-all duration-300",
					showToast ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
				)}
			>
				<div className="flex items-center gap-2.5 rounded-xl bg-[var(--cg-chrome)] px-4 py-3 font-semibold text-[13.5px] text-[var(--cg-chrome-fg)] shadow-xl">
					<CheckCircle2Icon className="h-[18px] w-[18px] text-[var(--cg-green)]" />
					Compra del día guardada
				</div>
			</div>
		</div>
	);
}
