"use client";

import { Button } from "@finopenpos/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@finopenpos/ui/components/card";
import { Input } from "@finopenpos/ui/components/input";
import { cn } from "@finopenpos/ui/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2Icon, SendIcon, TrashIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
	type AntonellaMessage,
	useAntonellaHistory,
} from "@/hooks/useAntonellaHistory";
import { useTRPC } from "@/lib/trpc/client";

export function AntonellaChat() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const sessionId = `antonella-session-${typeof window !== "undefined" ? window.location.pathname : "web"}`;
	const history = useAntonellaHistory(sessionId);

	const [messages, setMessages] = useState<AntonellaMessage[]>([
		{
			id: "welcome",
			role: "assistant",
			content:
				"¡Hola! Soy Antonella, tu asistente de inventario. Puedo ayudarte con:\n\n📦 Inventario (stock actual, capacidad)\n📋 Demanda (órdenes abiertas, pedidos)\n📊 Análisis (cobertura, forecast)\n✂️ Acciones (despiece, variantes)\n\n¿En qué puedo ayudarte?",
			timestamp: new Date(),
		},
	]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Cargar historial al montar
	useEffect(() => {
		if (history.session && history.session.messages.length > 0) {
			setMessages(history.session.messages);
		}
	}, [history.isLoading]);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	const chatMutation = useMutation(
		trpc.antonella.chat.mutationOptions({
			onSuccess: async (data) => {
				const msgId = `msg-${Date.now()}`;
				const assistantMsg: AntonellaMessage = {
					id: msgId,
					role: "assistant",
					content: data.answer,
					toolCalls: data.toolCalls,
					requiresConfirmation: data.requiresConfirmation,
					confirmationData: data.confirmationData,
					timestamp: new Date(),
				};

				setMessages((prev) => [...prev, assistantMsg]);
				await history.addMessage(assistantMsg);
				setIsLoading(false);
			},
			onError: (error: any) => {
				toast.error(error.message ?? "Error en Antonella");
				setIsLoading(false);
			},
		}),
	);

	const handleSend = async () => {
		if (!input.trim()) return;

		const userMsg: AntonellaMessage = {
			id: `msg-${Date.now()}`,
			role: "user",
			content: input,
			timestamp: new Date(),
		};

		setMessages((prev) => [...prev, userMsg]);
		await history.addMessage(userMsg);
		setInput("");
		setIsLoading(true);

		await chatMutation.mutateAsync({
			message: input.trim(),
		});
	};

	const executeMutation = useMutation(
		trpc.antonella.executeAction.mutationOptions({
			onSuccess: (data) => {
				toast.success(`✅ ${data.message}`);
				setMessages((prev) => [
					...prev,
					{
						id: `result-${Date.now()}`,
						role: "assistant",
						content: `✅ Acción completada:\n\n${data.message}`,
						timestamp: new Date(),
					},
				]);
				setInput("");
			},
			onError: (error: any) => {
				toast.error(error.message ?? "Error al ejecutar acción");
			},
		}),
	);

	const handleConfirmAction = async (msg: Message) => {
		if (!msg.confirmationData) return;

		const { toolName, toolInput } = msg.confirmationData as any;
		const actionName =
			toolName === "execute_despiece"
				? "execute_despiece"
				: "convert_to_variant";

		await executeMutation.mutateAsync({
			actionName: actionName as any,
			actionInput: toolInput,
		});
	};

	return (
		<div className="mx-auto max-w-3xl space-y-4">
			<Card className="flex h-[600px] flex-col">
				<CardHeader className="flex flex-row items-center justify-between">
					<CardTitle>Antonella - Asistente de Inventario</CardTitle>
					<Button
						size="sm"
						variant="ghost"
						onClick={() => {
							if (confirm("¿Borrar el historial de esta sesión?")) {
								history.clearHistory();
								setMessages([
									{
										id: "welcome",
										role: "assistant",
										content:
											"¡Hola de nuevo! Historial borrado. ¿En qué puedo ayudarte?",
										timestamp: new Date(),
									},
								]);
							}
						}}
						className="text-muted-foreground hover:text-foreground"
						title="Borrar historial"
					>
						<TrashIcon className="h-4 w-4" />
					</Button>
				</CardHeader>
				<CardContent className="flex flex-1 flex-col gap-4 overflow-hidden">
					{/* Messages */}
					<div className="flex-1 space-y-3 overflow-y-auto rounded-lg bg-muted/30 p-4">
						{messages.map((msg) => (
							<div key={msg.id} className={cn("flex gap-3")}>
								{msg.role === "assistant" ? (
									<>
										<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground text-xs">
											A
										</div>
										<div className="flex-1 space-y-2">
											<div className="whitespace-pre-wrap rounded-lg bg-primary/10 p-3 text-foreground text-sm">
												{msg.content}
											</div>
											{msg.requiresConfirmation && msg.confirmationData && (
												<div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3">
													<p className="mb-2 font-bold text-amber-900 text-xs uppercase">
														🔒 ¡Acción Protegida! Requiere Confirmación
													</p>
													<div className="mb-3 space-y-1 rounded bg-white/50 p-2 font-mono text-[11px] text-amber-800">
														{Object.entries(msg.confirmationData as any).map(
															([k, v]) => (
																<div key={k}>
																	<span className="font-bold">{k}:</span>{" "}
																	{String(v)}
																</div>
															),
														)}
													</div>
													<div className="flex gap-2">
														<Button
															size="sm"
															onClick={() => handleConfirmAction(msg)}
															disabled={executeMutation.isPending}
															className="flex-1 bg-amber-600 hover:bg-amber-700"
														>
															{executeMutation.isPending
																? "Ejecutando..."
																: "✓ Confirmar"}
														</Button>
														<Button
															size="sm"
															variant="outline"
															onClick={() => {
																setMessages((prev) =>
																	prev.filter((m) => m.id !== msg.id),
																);
															}}
															disabled={executeMutation.isPending}
															className="flex-1"
														>
															✕ Cancelar
														</Button>
													</div>
												</div>
											)}
										</div>
									</>
								) : (
									<>
										<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-accent-foreground text-xs">
											Tú
										</div>
										<div className="flex-1 rounded-lg bg-accent/20 p-3 text-foreground text-sm">
											{msg.content}
										</div>
									</>
								)}
							</div>
						))}
						{isLoading && (
							<div className="flex gap-3">
								<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground text-xs">
									A
								</div>
								<div className="flex items-center gap-2 text-muted-foreground text-sm">
									<Loader2Icon className="h-4 w-4 animate-spin" />
									Pensando...
								</div>
							</div>
						)}
						<div ref={messagesEndRef} />
					</div>

					{/* Input */}
					<div className="flex gap-2">
						<Input
							placeholder="Pregunta sobre inventario, demanda, recetas..."
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !e.shiftKey) {
									e.preventDefault();
									handleSend();
								}
							}}
							disabled={isLoading}
							className="text-sm"
						/>
						<Button
							size="icon"
							onClick={handleSend}
							disabled={!input.trim() || isLoading}
						>
							<SendIcon className="h-4 w-4" />
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* Quick Actions */}
			<Card>
				<CardHeader>
					<CardTitle className="text-sm">Preguntas rápidas</CardTitle>
				</CardHeader>
				<CardContent className="grid grid-cols-2 gap-2">
					{[
						"¿Cuánto stock tengo?",
						"¿Qué se pidió esta semana?",
						"¿Cubre mi stock los pedidos?",
						"¿Cómo se despieza PIERNA?",
						"Forecast de demanda (7 días)",
						"¿Cuántos canales necesito comprar?",
					].map((question) => (
						<Button
							key={question}
							variant="outline"
							size="sm"
							onClick={() => {
								setInput(question);
								setTimeout(() => {
									const btn = document.querySelector(
										"button:has(svg[class*=SendIcon])",
									) as HTMLButtonElement;
									if (btn && !btn.disabled) btn.click();
								}, 0);
							}}
							disabled={isLoading}
							className="h-auto justify-start py-2 text-xs"
						>
							{question}
						</Button>
					))}
				</CardContent>
			</Card>
		</div>
	);
}
