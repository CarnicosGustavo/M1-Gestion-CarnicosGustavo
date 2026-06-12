"use client";

import { Button } from "@finopenpos/ui/components/button";
import { cn } from "@finopenpos/ui/lib/utils";
import {
	BrainIcon,
	CheckIcon,
	LockIcon,
	SparklesIcon,
	XIcon,
} from "lucide-react";
import { useState } from "react";
import { AntonellaAvatar } from "@/components/antonella-avatar";

// ───── AiTag: marca compacta "iA" (chispa) ─────
export function AiTag({
	label = "iA",
	className,
}: {
	label?: string;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 font-extrabold text-[11px] text-primary tracking-[0.04em]",
				className,
			)}
		>
			<SparklesIcon className="h-3 w-3" strokeWidth={2.4} />
			{label}
		</span>
	);
}

// ───── AiField: campo numérico con valor propuesto por iA (se confirma) ─────
// iA propone → el usuario acepta (✓) o escribe el suyo. Filosofía "con OK".
export function AiField({
	suggestion,
	unit = "kg",
	value,
	onCommit,
	placeholder = "0",
	hint,
	className,
}: {
	suggestion?: number | null;
	unit?: string;
	value?: number | string | null;
	onCommit?: (value: number, source: "ia" | "user") => void;
	placeholder?: string;
	hint?: string;
	className?: string;
}) {
	const [val, setVal] = useState<string>(value != null ? String(value) : "");
	const [accepted, setAccepted] = useState(value != null && value !== "");
	const hasSug =
		suggestion != null && !accepted && (val === "" || val == null);

	const accept = () => {
		setVal(String(suggestion));
		setAccepted(true);
		onCommit?.(Number(suggestion), "ia");
	};

	return (
		<div
			className={cn("inline-flex items-center gap-1.5", className)}
			title={hint}
		>
			<div className="relative w-[92px]">
				<input
					value={val}
					placeholder={hasSug ? "" : placeholder}
					inputMode="decimal"
					onChange={(e) => {
						setVal(e.target.value);
						setAccepted(false);
					}}
					onBlur={(e) => {
						const n = Number.parseFloat(e.target.value);
						if (!Number.isNaN(n)) {
							setAccepted(true);
							onCommit?.(n, "user");
						}
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter") (e.target as HTMLInputElement).blur();
					}}
					className={cn(
						"w-full rounded-[9px] border-[1.5px] bg-secondary py-2.5 pr-7 pl-2.5 text-right font-mono font-bold text-[13.5px] text-foreground outline-none",
						accepted
							? "border-[var(--cg-green)]"
							: hasSug
								? "border-primary/70"
								: "border-border",
					)}
				/>
				{hasSug && (
					<span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 font-mono font-bold text-[13.5px] text-primary/80">
						{suggestion}
					</span>
				)}
				<span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 font-medium text-[10px] text-muted-foreground">
					{unit}
				</span>
			</div>
			{hasSug ? (
				<button
					type="button"
					onClick={accept}
					title={`iA propone ${suggestion} ${unit} · clic para aceptar`}
					className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg bg-[var(--cg-chrome)]"
				>
					<SparklesIcon className="h-[15px] w-[15px] text-primary" />
				</button>
			) : accepted ? (
				<span className="grid h-[30px] w-[30px] shrink-0 place-items-center">
					<CheckIcon className="h-4 w-4 text-[var(--cg-green)]" />
				</span>
			) : (
				<span className="w-[30px] shrink-0" />
			)}
		</div>
	);
}

// ───── AiSuggestBar: acción propuesta a nivel de sección ─────
type Tone = "ok" | "sugerencia" | "aviso" | "alerta" | "info";
const TONE_EDGE: Record<Tone, string> = {
	ok: "var(--cg-green)",
	sugerencia: "var(--primary)",
	aviso: "var(--cg-amber)",
	alerta: "var(--primary)",
	info: "var(--cg-blue)",
};

export function AiSuggestBar({
	tone = "sugerencia",
	title,
	text,
	primary,
	onPrimary,
	secondary,
	onSecondary,
	onDismiss,
	busy,
}: {
	tone?: Tone;
	title: string;
	text: string;
	primary?: string;
	onPrimary?: () => void;
	secondary?: string;
	onSecondary?: () => void;
	onDismiss?: () => void;
	busy?: boolean;
}) {
	return (
		<div
			className="flex items-start gap-3 rounded-[13px] border border-l-[3px] bg-card px-4 py-3"
			style={{ borderLeftColor: TONE_EDGE[tone] }}
		>
			<AntonellaAvatar size={34} />
			<div className="min-w-0 flex-1">
				<div className="mb-1 flex items-center gap-2">
					<AiTag />
					<span className="font-extrabold text-[13px] text-foreground">
						{title}
					</span>
				</div>
				<p className="mb-2.5 text-pretty text-[13px] text-foreground/85 leading-relaxed">
					{text}
				</p>
				<div className="flex flex-wrap gap-2">
					{primary && (
						<Button
							size="sm"
							onClick={onPrimary}
							disabled={busy}
							className="rounded-full bg-[var(--cg-chrome)] text-[var(--cg-chrome-fg)] hover:bg-[var(--cg-chrome2)]"
						>
							<SparklesIcon className="mr-1.5 h-3.5 w-3.5 text-primary" />
							{busy ? "Aplicando…" : primary}
						</Button>
					)}
					{secondary && (
						<Button
							size="sm"
							variant="outline"
							onClick={onSecondary}
							className="rounded-full"
						>
							{secondary}
						</Button>
					)}
				</div>
			</div>
			{onDismiss && (
				<button
					type="button"
					onClick={onDismiss}
					className="p-0.5 text-muted-foreground"
				>
					<XIcon className="h-4 w-4" />
				</button>
			)}
		</div>
	);
}

// ───── AiConfirmCard: confirmación de acción protegida ─────
export function AiConfirmCard({
	title = "Acción protegida",
	rows = [],
	onConfirm,
	onCancel,
	confirmLabel = "Confirmar",
}: {
	title?: string;
	rows?: [string, string][];
	onConfirm?: () => void;
	onCancel?: () => void;
	confirmLabel?: string;
}) {
	return (
		<div className="overflow-hidden rounded-[14px] border border-[var(--cg-amber)] bg-[var(--cg-amber-wash)]">
			<div className="flex items-center gap-2.5 border-[var(--cg-amber)]/20 border-b px-4 py-3">
				<LockIcon className="h-4 w-4 text-[var(--cg-amber)]" />
				<span className="font-extrabold text-[13px] text-[var(--cg-amber)]">
					{title}
				</span>
			</div>
			<div className="px-4 py-3">
				{rows.map(([k, v], i) => (
					<div
						key={k}
						className={cn(
							"flex justify-between gap-3 py-1.5",
							i < rows.length - 1 && "border-[var(--cg-amber)]/15 border-b",
						)}
					>
						<span className="font-medium text-[12.5px] text-foreground/80">
							{k}
						</span>
						<span className="font-mono font-bold text-[12.5px] text-foreground">
							{v}
						</span>
					</div>
				))}
				<div className="mt-3 flex gap-2.5">
					<Button
						onClick={onConfirm}
						className="flex-1 bg-[var(--cg-green)] text-white hover:bg-[var(--cg-green)]/90"
					>
						<CheckIcon className="mr-1.5 h-4 w-4" />
						{confirmLabel}
					</Button>
					<Button
						variant="outline"
						onClick={onCancel}
						className="border-[var(--cg-amber)]"
					>
						Cancelar
					</Button>
				</div>
			</div>
		</div>
	);
}

// ───── AiLearned: píldora "iA aprendió …" con deshacer ─────
export function AiLearned({
	children,
	onUndo,
}: {
	children: React.ReactNode;
	onUndo?: () => void;
}) {
	return (
		<div className="inline-flex items-center gap-2.5 rounded-full border border-[var(--cg-blue)]/20 bg-[var(--cg-blue-wash)] px-3 py-2">
			<BrainIcon className="h-3.5 w-3.5 text-[var(--cg-blue)]" />
			<span className="text-[12px] text-foreground/85">
				<b className="text-[var(--cg-blue)]">iA aprendió:</b> {children}
			</span>
			{onUndo && (
				<button
					type="button"
					onClick={onUndo}
					className="font-bold text-[11px] text-[var(--cg-blue)] underline"
				>
					deshacer
				</button>
			)}
		</div>
	);
}

// ───── AiPresenceBar: iA vigilando varios módulos a la vez ─────
export function AiPresenceBar({
	items = [],
	onOpen,
}: {
	items?: { id: string; label: string; tone?: Tone; count?: number }[];
	onOpen?: (id: string) => void;
}) {
	const dot = (tone?: Tone) =>
		tone === "alerta"
			? "var(--primary)"
			: tone === "aviso"
				? "var(--cg-amber)"
				: tone === "ok"
					? "var(--cg-green)"
					: "var(--cg-tan)";
	return (
		<div className="flex items-center gap-3 rounded-[13px] border bg-[var(--cg-chrome)] px-4 py-3">
			<AntonellaAvatar size={36} />
			<div className="min-w-0 flex-1">
				<div className="mb-2 font-extrabold text-[12.5px] text-[var(--cg-cream)]">
					iAntonella vigilando {items.length} módulos
				</div>
				<div className="flex flex-wrap gap-1.5">
					{items.map((it) => (
						<button
							key={it.id}
							type="button"
							onClick={() => onOpen?.(it.id)}
							className="inline-flex items-center gap-1.5 rounded-full border border-[var(--cg-cream)]/20 bg-[var(--cg-cream)]/10 px-2.5 py-1.5 font-bold text-[11px] text-[var(--cg-cream)]"
						>
							<span
								className="h-1.5 w-1.5 shrink-0 rounded-full"
								style={{ background: dot(it.tone) }}
							/>
							{it.label}
							{it.count ? (
								<span className="opacity-70">· {it.count}</span>
							) : null}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
