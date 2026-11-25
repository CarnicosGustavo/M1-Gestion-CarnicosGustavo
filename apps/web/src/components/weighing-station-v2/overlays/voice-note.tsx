"use client";

import { cn } from "@finopenpos/ui/lib/utils";
import localFont from "next/font/local";
import { useEffect, useRef } from "react";
import { matchVoiceNoteKey } from "../shortcuts";
import type { DraftLine } from "./new-order-overlay";

// Letra a mano (Caveat, OFL) empaquetada local: el build no depende de la red.
const handwriting = localFont({
	src: [
		{ path: "../../../app/fonts/caveat-latin-500-normal.woff2", weight: "500" },
		{ path: "../../../app/fonts/caveat-latin-700-normal.woff2", weight: "700" },
	],
	display: "swap",
});

/** Alto de cada cuadro de la libreta; cada renglón ocupa exactamente uno. */
const ROW = 40;

export interface NoteCustomer {
	name: string;
	contact: string | null;
	phone: string | null;
}

/** «PIERNA» → «Piernas» (8 pzs); los nombres compuestos se dejan igual. */
export function noteProductName(name: string, pieces: number): string {
	const title = name
		.toLowerCase()
		.replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
	if (pieces <= 1 || /\s|\//.test(title) || /s$/i.test(title)) return title;
	return /[aeiou]$/i.test(title) ? `${title}s` : `${title}es`;
}

export function noteQuantity(line: DraftLine): string {
	if (line.kg && !line.pieces) return `${line.kg} kg`;
	return `${line.pieces} ${line.pieces === 1 ? "pz" : "pzs"}`;
}

/**
 * Nota de voz con aspecto de libreta de cuadrícula: parece apuntada a mano,
 * pero cada dato va en su renglón (cliente, contacto, teléfono, fecha y
 * productos). Abajo: Cancelar (fue un error), Editar o Confirmar pedido.
 */
export function VoiceNote({
	status,
	transcript,
	answer,
	customer,
	customerQuery,
	lines,
	unmatched,
	productName,
	busy,
	onConfirm,
	onEdit,
	onClose,
}: {
	status: "idle" | "listening" | "thinking" | "answered" | "error";
	transcript: string;
	answer: string;
	customer: NoteCustomer | null;
	customerQuery: string;
	lines: DraftLine[];
	unmatched: string[];
	productName: (productId: number) => string;
	busy: boolean;
	onConfirm: () => void;
	onEdit: () => void;
	onClose: () => void;
}) {
	const hasOrder = lines.length > 0 || customer !== null;
	const canConfirm = customer !== null && lines.length > 0 && !busy;
	const today = new Date().toLocaleDateString("es-MX", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});

	const submittedRef = useRef(false);
	useEffect(() => {
		if (!busy) submittedRef.current = false;
	}, [busy]);

	// Enter confirma, E edita (Esc lo cierra la estación).
	const actions = useRef({ onConfirm, onEdit, canConfirm, hasOrder });
	actions.current = { onConfirm, onEdit, canConfirm, hasOrder };
	const triggerConfirm = () => {
		if (!actions.current.canConfirm || submittedRef.current) return;
		submittedRef.current = true;
		actions.current.onConfirm();
	};
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.repeat) {
				if (event.key === "Enter") event.preventDefault();
				return;
			}
			const intent = matchVoiceNoteKey(event, {
				canConfirm: actions.current.canConfirm,
				hasOrder: actions.current.hasOrder,
			});
			if (intent === "confirm") {
				if (submittedRef.current) return;
				event.preventDefault();
				submittedRef.current = true;
				actions.current.onConfirm();
			} else if (intent === "edit") {
				event.preventDefault();
				actions.current.onEdit();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	// Cada renglón se escribe un poco después del anterior.
	let order = 0;
	const write = () => ({ animationDelay: `${(order++ * 0.35).toFixed(2)}s` });

	const label = "text-[#7d8794] text-[0.8em]";
	const ink = "text-[#1d3b8a]";

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-[3vh_4vw]">
			<button
				type="button"
				aria-label="Cerrar nota"
				onClick={onClose}
				className="absolute inset-0 bg-black/45"
			/>
			<section
				role="dialog"
				aria-modal="true"
				aria-label="Nota de voz para Antonella"
				className={cn(
					handwriting.className,
					"relative z-10 flex max-h-[92vh] w-[min(64rem,92vw)] rotate-[-0.4deg] flex-col overflow-hidden rounded-sm text-[1.9rem] leading-none shadow-[0_18px_40px_rgba(0,0,0,0.55),0_2px_0_#d8d2c2]",
				)}
				style={{
					backgroundColor: "#fdfcf6",
					backgroundImage:
						"linear-gradient(90deg, transparent 5.6rem, #e2554f 5.6rem, #e2554f calc(5.6rem + 2px), transparent calc(5.6rem + 2px)), linear-gradient(#c6d8e8 1px, transparent 1px), linear-gradient(90deg, #c6d8e8 1px, transparent 1px)",
					backgroundSize: `100% 100%, ${ROW}px ${ROW}px, ${ROW}px ${ROW}px`,
				}}
			>
				{/* Encabezado impreso de la libreta */}
				<header
					className="box-border flex shrink-0 items-end justify-between border-[#1f4f7a] border-b-4 bg-[#fdfcf6] px-[5.6rem] pb-2 font-sans"
					style={{ height: ROW * 2 }}
				>
					<span className="font-black text-2xl text-[#1f4f7a] uppercase italic tracking-[0.08em]">
						Cárnicos Gustavo
					</span>
					<span className="font-semibold text-[#7d8794] text-xs uppercase tracking-[0.3em]">
						Notas · Antonella 🎤
					</span>
				</header>

				<div className="relative min-h-0 flex-1 overflow-y-auto pr-8 pl-[6.6rem]">
					<div className="space-y-0" style={{ lineHeight: `${ROW}px` }}>
						<p className={cn(ink, "pz-write font-bold")} style={write()}>
							Nota…
						</p>

						{hasOrder ? (
							<>
								<div className="pz-write flex gap-8" style={write()}>
									<span className="min-w-0 flex-1">
										<span className={label}>Cliente.. </span>
										<span
											className={cn(
												customer ? ink : "text-[#c0392b]",
												"font-bold",
											)}
										>
											{customer?.name ?? `¿${customerQuery || "quién"}?`}
										</span>
									</span>
									<span className="shrink-0">
										<span className={label}>Fecha </span>
										<span className={ink}>{today}</span>
									</span>
								</div>
								<p className="pz-write" style={write()}>
									<span className={label}>Contacto. </span>
									<span className={ink}>{customer?.contact || "—"}</span>
								</p>
								<p className="pz-write" style={write()}>
									<span className={label}>Teléfono. </span>
									<span className={ink}>{customer?.phone || "—"}</span>
								</p>
								<div
									className="pz-write -ml-[1rem] h-[2px] bg-[#e2554f]"
									style={{ ...write(), margin: `${ROW / 2 - 1}px 0` }}
								/>
								{lines.map((line) => (
									<p
										key={line.productId}
										className="pz-write flex gap-6"
										style={write()}
									>
										<span
											className={cn(ink, "w-[6.5rem] text-right font-bold")}
										>
											{noteQuantity(line)}
										</span>
										<span className={ink}>
											{noteProductName(
												productName(line.productId),
												line.pieces,
											)}
										</span>
									</p>
								))}
								{unmatched.map((text) => (
									<p
										key={text}
										className="pz-write text-[#c0392b]"
										style={write()}
									>
										¿{text}?{" "}
										<span className="text-[0.7em]">(no lo encontré)</span>
									</p>
								))}
							</>
						) : status === "answered" && answer ? (
							<p
								className={cn(ink, "pz-write whitespace-pre-wrap")}
								style={write()}
							>
								<span className={label}>Antonella: </span>
								{answer}
							</p>
						) : (
							<p className="text-[#9aa4ae] italic">
								{status === "listening"
									? transcript || "te escucho…"
									: status === "thinking"
										? transcript
										: status === "error"
											? "No te entendí, inténtalo otra vez."
											: "Mantén 🎤 y dicta el pedido…"}
							</p>
						)}
					</div>
				</div>

				{/* Pie: cancelar, editar o confirmar */}
				<footer className="flex items-center justify-between gap-4 border-[#d8d2c2] border-t bg-[#fdfcf6]/95 px-[5.6rem] py-3 font-sans">
					<span className="text-[#7d8794] text-sm">
						{status === "listening"
							? "🎤 Escuchando… suelta el botón o pulsa Espacio"
							: status === "thinking"
								? "✍️ Antonella está anotando…"
								: hasOrder
									? "Revisa la nota"
									: ""}
					</span>
					{hasOrder ? (
						<div className="flex gap-3">
							<button
								type="button"
								onClick={onClose}
								className="rounded-md border-2 border-[#c0392b] px-5 py-2 font-bold text-[#c0392b] text-base hover:bg-[#c0392b]/10"
							>
								Cancelar · Esc
							</button>
							<button
								type="button"
								onClick={onEdit}
								className="rounded-md border-2 border-[#1f4f7a] px-5 py-2 font-bold text-[#1f4f7a] text-base hover:bg-[#1f4f7a]/10"
							>
								Editar · E
							</button>
							<button
								type="button"
								data-voice-confirm="true"
								onClick={triggerConfirm}
								disabled={!canConfirm}
								className="rounded-md bg-gradient-to-b from-[#4cc35d] to-[#2f9a3f] px-6 py-2 font-bold text-[#06210b] text-base shadow disabled:opacity-40"
							>
								{busy ? "Guardando…" : "Confirmar pedido · Enter"}
							</button>
						</div>
					) : null}
				</footer>
			</section>
		</div>
	);
}
