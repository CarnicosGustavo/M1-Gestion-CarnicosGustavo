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
import { Loader2Icon, SendIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

interface Message {
	id: string;
	role: "user" | "assistant";
	content: string;
	toolCalls?: any[];
	requiresConfirmation?: boolean;
	confirmationData?: Record<string, unknown>;
	timestamp: Date;
}

export function AntonellaChat() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [messages, setMessages] = useState<Message[]>([
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

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	const chatMutation = useMutation(
		trpc.antonella.chat.mutationOptions({
			onSuccess: (data) => {
				const msgId = `msg-${Date.now()}`;
				setMessages((prev) => [
					...prev,
					{
						id: msgId,
						role: "assistant",
						content: data.answer,
						toolCalls: data.toolCalls,
						requiresConfirmation: data.requiresConfirmation,
						confirmationData: data.confirmationData,
						timestamp: new Date(),
					},
				]);
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

		const userMsg: Message = {
			id: `msg-${Date.now()}`,
			role: "user",
			content: input,
			timestamp: new Date(),
		};

		setMessages((prev) => [...prev, userMsg]);
		setInput("");
		setIsLoading(true);

		await chatMutation.mutateAsync({
			message: input.trim(),
		});
	};

	const handleConfirmAction = async (msg: Message) => {
		if (!msg.confirmationData) return;

		toast.info("Acción confirmada (próximamente disponible)");
		// Aquí iría executeAction cuando esté implementado
	};

	return (
		<div className="mx-auto max-w-3xl space-y-4">
			<Card className="flex h-[600px] flex-col">
				<CardHeader>
					<CardTitle>Antonella - Asistente de Inventario</CardTitle>
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
												<div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
													<p className="mb-2 font-semibold text-amber-900 text-xs">
														✋ Acción protegida (requiere confirmación)
													</p>
													<pre className="mb-2 overflow-x-auto text-[10px] text-amber-800">
														{JSON.stringify(msg.confirmationData, null, 2)}
													</pre>
													<Button
														size="sm"
														onClick={() => handleConfirmAction(msg)}
														className="w-full"
													>
														Confirmar acción
													</Button>
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
