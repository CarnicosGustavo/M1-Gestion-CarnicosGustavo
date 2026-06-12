"use client";

import { Button } from "@finopenpos/ui/components/button";
import { Input } from "@finopenpos/ui/components/input";
import { cn } from "@finopenpos/ui/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { ArrowUpIcon, Loader2Icon, XIcon } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AntonellaAvatar } from "@/components/antonella-avatar";
import {
	type AntonellaMessage,
	useAntonellaHistory,
} from "@/hooks/useAntonellaHistory";
import { useTRPC } from "@/lib/trpc/client";

interface AntonellaCtx {
	open: () => void;
	close: () => void;
	ask: (question: string) => void;
}
const Ctx = createContext<AntonellaCtx | null>(null);

export function useAntonella() {
	const ctx = useContext(Ctx);
	if (!ctx) throw new Error("useAntonella debe usarse dentro de AntonellaProvider");
	return ctx;
}

// Chips sugeridos por defecto en el dock
const DEFAULT_CHIPS = [
	"¿Cuánto stock tengo?",
	"¿Qué se pidió esta semana?",
	"¿Cubre mi stock los pedidos?",
	"¿Cuántos canales necesito comprar?",
];

export function AntonellaProvider({ children }: { children: React.ReactNode }) {
	const trpc = useTRPC();
	const sessionId = "antonella-dock";
	const history = useAntonellaHistory(sessionId);

	const [open, setOpen] = useState(false);
	const [messages, setMessages] = useState<AntonellaMessage[]>([
		{
			id: "welcome",
			role: "assistant",
			content:
				"¡Hola! Soy iAntonella, el cerebro del sistema. Conozco inventario, despiece, pesaje, pedidos y cobranza. ¿En qué te ayudo?",
			timestamp: new Date(),
		},
	]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const bodyRef = useRef<HTMLDivElement>(null);
	const pendingSeed = useRef<string | null>(null);

	useEffect(() => {
		if (history.session && history.session.messages.length > 0) {
			setMessages(history.session.messages);
		}
	}, [history.isLoading]);

	useEffect(() => {
		if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
	}, [messages, open]);

	const chatMutation = useMutation(
		trpc.antonella.chat.mutationOptions({
			onSuccess: async (data) => {
				const msg: AntonellaMessage = {
					id: `msg-${Date.now()}`,
					role: "assistant",
					content: data.answer,
					requiresConfirmation: data.requiresConfirmation,
					confirmationData: data.confirmationData,
					timestamp: new Date(),
				};
				setMessages((prev) => [...prev, msg]);
				await history.addMessage(msg);
				setIsLoading(false);
			},
			onError: (e: any) => {
				toast.error(e.message ?? "Error en iAntonella");
				setIsLoading(false);
			},
		}),
	);

	const executeMutation = useMutation(
		trpc.antonella.executeAction.mutationOptions({
			onSuccess: (data) => {
				toast.success(`✅ ${data.message}`);
				setMessages((prev) => [
					...prev,
					{
						id: `res-${Date.now()}`,
						role: "assistant",
						content: `✅ ${data.message}`,
						timestamp: new Date(),
					},
				]);
			},
			onError: (e: any) => toast.error(e.message ?? "Error al ejecutar"),
		}),
	);

	const send = async (q?: string) => {
		const v = (q ?? input).trim();
		if (!v) return;
		const userMsg: AntonellaMessage = {
			id: `msg-${Date.now()}`,
			role: "user",
			content: v,
			timestamp: new Date(),
		};
		setMessages((prev) => [...prev, userMsg]);
		await history.addMessage(userMsg);
		setInput("");
		setIsLoading(true);
		await chatMutation.mutateAsync({ message: v });
	};

	// API expuesta a slots: abrir y preguntar
	const ctx: AntonellaCtx = {
		open: () => setOpen(true),
		close: () => setOpen(false),
		ask: (q: string) => {
			setOpen(true);
			pendingSeed.current = q;
		},
	};

	// Cuando se abre con una pregunta sembrada, enviarla
	useEffect(() => {
		if (open && pendingSeed.current) {
			const q = pendingSeed.current;
			pendingSeed.current = null;
			send(q);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	const confirmAction = (msg: AntonellaMessage) => {
		if (!msg.confirmationData) return;
		const { toolName, toolInput } = msg.confirmationData as any;
		executeMutation.mutate({ actionName: toolName, actionInput: toolInput });
	};

	return (
		<Ctx.Provider value={ctx}>
			{children}

			{/* Launcher flotante */}
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				aria-label="Abrir iAntonella"
				className={cn(
					"fixed right-5 bottom-5 z-[80] flex h-[58px] items-center gap-3 rounded-full border border-[var(--cg-chrome)] bg-[var(--cg-chrome)] shadow-2xl transition-all",
					open ? "p-0" : "py-2 pr-4 pl-2",
				)}
			>
				<span className="relative">
					<AntonellaAvatar size={42} />
					{!open && (
						<span className="absolute -top-px -right-px h-3 w-3 rounded-full border-2 border-[var(--cg-chrome)] bg-primary" />
					)}
				</span>
				{!open && (
					<span className="pr-1 font-bold text-[var(--cg-chrome-fg)] text-sm">
						iAntonella
					</span>
				)}
			</button>

			{/* Overlay */}
			{open && (
				<button
					type="button"
					aria-label="Cerrar"
					className="fixed inset-0 z-[85] cursor-default bg-black/30"
					onClick={() => setOpen(false)}
				/>
			)}

			{/* Drawer */}
			<aside
				className={cn(
					"fixed inset-y-0 right-0 z-[90] flex w-[min(420px,92vw)] flex-col border-l bg-background shadow-2xl transition-transform duration-300",
					open ? "translate-x-0" : "translate-x-[106%]",
				)}
			>
				{/* Header */}
				<div className="flex items-center gap-3 bg-[var(--cg-chrome)] px-4 py-4 text-[var(--cg-chrome-fg)]">
					<AntonellaAvatar size={44} />
					<div className="min-w-0 flex-1">
						<div className="font-bold text-base">iAntonella</div>
						<div className="flex items-center gap-1.5 text-[var(--cg-chrome-fg)]/70 text-xs">
							<span className="h-1.5 w-1.5 rounded-full bg-[var(--cg-green)]" />
							El cerebro del sistema · en línea
						</div>
					</div>
					<button
						type="button"
						onClick={() => setOpen(false)}
						className="text-[var(--cg-chrome-fg)]"
					>
						<XIcon className="h-5 w-5" />
					</button>
				</div>

				{/* Cuerpo */}
				<div ref={bodyRef} className="flex-1 overflow-y-auto px-4 pt-4 pb-1.5">
					<p className="mb-4 text-center text-[11px] text-muted-foreground tracking-wide">
						Conoce inventario · despiece · pesaje · pedidos · cobranza
					</p>
					{messages.map((m) => (
						<MessageBubble key={m.id} msg={m} onConfirm={() => confirmAction(m)} />
					))}
					{isLoading && (
						<div className="mb-3 flex items-center gap-2 text-muted-foreground text-sm">
							<AntonellaAvatar size={28} />
							<Loader2Icon className="h-4 w-4 animate-spin" />
							Pensando…
						</div>
					)}
				</div>

				{/* Chips */}
				<div className="flex gap-2 overflow-x-auto px-4 pt-1 pb-3">
					{DEFAULT_CHIPS.map((c) => (
						<button
							key={c}
							type="button"
							onClick={() => send(c)}
							disabled={isLoading}
							className="shrink-0 whitespace-nowrap rounded-full border bg-card px-3 py-2 font-bold text-foreground text-xs"
						>
							{c}
						</button>
					))}
				</div>

				{/* Input */}
				<div className="flex items-center gap-2 px-3.5 pb-4">
					<Input
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") send();
						}}
						disabled={isLoading}
						placeholder="Pregunta o da una instrucción…"
						className="flex-1"
					/>
					<Button
						type="button"
						size="icon"
						onClick={() => send()}
						disabled={!input.trim() || isLoading}
						className="h-11 w-11 shrink-0 rounded-xl"
					>
						<ArrowUpIcon className="h-5 w-5" />
					</Button>
				</div>
			</aside>
		</Ctx.Provider>
	);
}

function MessageBubble({
	msg,
	onConfirm,
}: {
	msg: AntonellaMessage;
	onConfirm: () => void;
}) {
	const mine = msg.role === "user";
	return (
		<div
			className={cn(
				"mb-3 flex",
				mine ? "justify-end" : "items-start justify-start gap-2",
			)}
		>
			{!mine && <AntonellaAvatar size={28} className="mt-0.5" />}
			<div className="max-w-[80%] space-y-2">
				<div
					className={cn(
						"whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm",
						mine
							? "rounded-br-sm bg-[var(--cg-chrome)] text-[var(--cg-chrome-fg)]"
							: "rounded-bl-sm border bg-secondary text-foreground",
					)}
				>
					{msg.content}
				</div>
				{msg.requiresConfirmation && msg.confirmationData && (
					<div className="rounded-xl border-2 border-[var(--cg-amber)] bg-[var(--cg-amber-wash)] p-3">
						<p className="mb-2 font-bold text-[var(--cg-amber)] text-xs uppercase">
							🔒 Acción protegida · confirma
						</p>
						<div className="mb-2 space-y-0.5 font-mono text-[11px] text-foreground/80">
							{Object.entries(msg.confirmationData as any).map(([k, v]) => (
								<div key={k}>
									<span className="font-bold">{k}:</span> {String(v)}
								</div>
							))}
						</div>
						<Button size="sm" className="w-full" onClick={onConfirm}>
							✓ Confirmar
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}
