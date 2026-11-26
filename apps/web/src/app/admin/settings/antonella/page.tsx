"use client";

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
import { cn } from "@finopenpos/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	BotIcon,
	PlusIcon,
	RotateCcwIcon,
	SaveIcon,
	TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

interface CustomTool {
	name: string;
	description: string;
}

const MODELS = [
	{ id: "claude-opus-4-8", label: "Opus 4.8 — máxima capacidad (recomendado)" },
	{ id: "claude-sonnet-4-6", label: "Sonnet 4.6 — equilibrado" },
	{ id: "claude-haiku-4-5-20251001", label: "Haiku 4.5 — rápido y económico" },
];

export default function AntonellaSettingsPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const { data: toolsData } = useQuery(trpc.antonella.listTools.queryOptions());
	const { data: config } = useQuery(trpc.antonella.getConfig.queryOptions());

	const [systemPrompt, setSystemPrompt] = useState("");
	const [disabledTools, setDisabledTools] = useState<Set<string>>(new Set());
	const [customTools, setCustomTools] = useState<CustomTool[]>([]);
	const [model, setModel] = useState("claude-opus-4-8");
	const [newTool, setNewTool] = useState<CustomTool>({
		name: "",
		description: "",
	});

	// Cargar config al montar
	useEffect(() => {
		if (config) {
			setSystemPrompt(config.systemPrompt);
			setDisabledTools(new Set(config.disabledTools));
			setCustomTools(config.customTools as CustomTool[]);
			setModel(config.model);
		}
	}, [config]);

	const saveMutation = useMutation(
		trpc.antonella.saveConfig.mutationOptions({
			onSuccess: () => {
				toast.success("Configuración de Antonella guardada");
				queryClient.invalidateQueries({
					queryKey: trpc.antonella.getConfig.queryKey(),
				});
			},
			onError: (e: any) => toast.error(e.message ?? "Error al guardar"),
		}),
	);

	const handleSave = () => {
		saveMutation.mutate({
			systemPrompt,
			disabledTools: Array.from(disabledTools),
			customTools: customTools.filter((t) => t.name && t.description),
			model,
		});
	};

	const toggleTool = (name: string) => {
		setDisabledTools((prev) => {
			const next = new Set(prev);
			if (next.has(name)) next.delete(name);
			else next.add(name);
			return next;
		});
	};

	const addCustomTool = () => {
		if (!newTool.name.trim() || !newTool.description.trim()) {
			toast.error("Ponle nombre y descripción a la herramienta");
			return;
		}
		// Normalizar nombre a snake_case para el tool-use
		const normalized = newTool.name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "_")
			.replace(/^_+|_+$/g, "");
		setCustomTools((prev) => [
			...prev,
			{ name: normalized, description: newTool.description.trim() },
		]);
		setNewTool({ name: "", description: "" });
	};

	const readTools = (toolsData?.tools ?? []).filter(
		(t) => t.category === "lectura",
	);
	const actionTools = (toolsData?.tools ?? []).filter(
		(t) => t.category === "accion",
	);

	return (
		<div className="mx-auto max-w-4xl space-y-6 py-2">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<BotIcon className="h-6 w-6 text-primary" />
					<div>
						<h1 className="font-bold text-2xl">Configurar Antonella</h1>
						<p className="text-muted-foreground text-sm">
							Define cómo piensa, qué herramientas puede usar y enséñale
							habilidades nuevas.
						</p>
					</div>
				</div>
				<div className="flex gap-2">
					<Button asChild variant="outline" size="sm">
						<Link href="/admin/antonella">Abrir chat</Link>
					</Button>
					<Button
						onClick={handleSave}
						disabled={saveMutation.isPending}
						size="sm"
					>
						<SaveIcon className="mr-1.5 h-4 w-4" />
						{saveMutation.isPending ? "Guardando…" : "Guardar"}
					</Button>
				</div>
			</div>

			{/* ¿Qué es Antonella? */}
			<Card className="border-primary/20 bg-primary/5">
				<CardContent className="pt-6 text-sm">
					<p className="font-semibold">¿Qué es Antonella?</p>
					<p className="mt-1 text-muted-foreground">
						Es un asistente de IA (Claude de Anthropic) que vive dentro del
						dashboard. Tiene acceso en tiempo real a tu inventario, recetas,
						demanda y producción. Puede responder preguntas, hacer cálculos y —
						con tu confirmación — ejecutar acciones como despiece o conversión
						de variantes. Aquí controlas su comportamiento.
					</p>
				</CardContent>
			</Card>

			{/* Modelo */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Modelo de IA</CardTitle>
					<CardDescription>
						Qué tan capaz (y costoso) es el motor que responde.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid gap-2 sm:grid-cols-3">
						{MODELS.map((m) => (
							<button
								key={m.id}
								type="button"
								onClick={() => setModel(m.id)}
								className={cn(
									"rounded-lg border p-3 text-left text-xs transition-colors",
									model === m.id
										? "border-primary bg-primary/10 font-medium"
										: "hover:border-foreground/30",
								)}
							>
								{m.label}
							</button>
						))}
					</div>
				</CardContent>
			</Card>

			{/* System prompt */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="text-base">
								Instrucción principal (system prompt)
							</CardTitle>
							<CardDescription>
								Define la personalidad, las reglas y el contexto del negocio.
							</CardDescription>
						</div>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								if (toolsData) setSystemPrompt(toolsData.defaultSystemPrompt);
							}}
							title="Restaurar el texto por defecto"
						>
							<RotateCcwIcon className="mr-1.5 h-4 w-4" />
							Restaurar
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					<textarea
						value={systemPrompt}
						onChange={(e) => setSystemPrompt(e.target.value)}
						rows={14}
						className="w-full rounded-lg border bg-background p-3 font-mono text-xs leading-relaxed"
						placeholder="Eres Antonella, un asistente…"
					/>
					<p className="mt-1 text-[11px] text-muted-foreground">
						{systemPrompt.length} caracteres
					</p>
				</CardContent>
			</Card>

			{/* Herramientas integradas */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Herramientas integradas</CardTitle>
					<CardDescription>
						Activa o desactiva lo que Antonella puede consultar o hacer.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div>
						<p className="mb-2 font-semibold text-[11px] text-muted-foreground uppercase tracking-wide">
							📖 Lectura (consultas, sin riesgo)
						</p>
						<div className="space-y-1.5">
							{readTools.map((t) => (
								<ToolRow
									key={t.name}
									name={t.name}
									label={t.label}
									description={t.description}
									danger={t.danger}
									enabled={!disabledTools.has(t.name)}
									onToggle={() => toggleTool(t.name)}
								/>
							))}
						</div>
					</div>
					<div>
						<p className="mb-2 font-semibold text-[11px] text-amber-700 uppercase tracking-wide">
							⚡ Acciones (modifican inventario · piden confirmación)
						</p>
						<div className="space-y-1.5">
							{actionTools.map((t) => (
								<ToolRow
									key={t.name}
									name={t.name}
									label={t.label}
									description={t.description}
									danger={t.danger}
									enabled={!disabledTools.has(t.name)}
									onToggle={() => toggleTool(t.name)}
								/>
							))}
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Herramientas personalizadas */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">
						Enseñar algo nuevo (habilidades personalizadas)
					</CardTitle>
					<CardDescription>
						Declara una habilidad con un nombre y una descripción. Antonella la
						tendrá disponible y la usará cuando aplique. La ejecución automática
						(conexión real) se conecta después.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{customTools.length > 0 && (
						<div className="space-y-1.5">
							{customTools.map((t, i) => (
								<div
									key={`${t.name}-${i}`}
									className="flex items-start gap-2 rounded-lg border bg-muted/30 p-2.5"
								>
									<div className="min-w-0 flex-1">
										<p className="font-mono font-semibold text-xs">{t.name}</p>
										<p className="text-[11px] text-muted-foreground">
											{t.description}
										</p>
									</div>
									<Button
										variant="ghost"
										size="icon"
										className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-600"
										onClick={() =>
											setCustomTools((prev) =>
												prev.filter((_, idx) => idx !== i),
											)
										}
									>
										<TrashIcon className="h-4 w-4" />
									</Button>
								</div>
							))}
						</div>
					)}

					<div className="rounded-lg border border-dashed p-3">
						<div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
							<div className="space-y-1">
								<Label className="text-xs">Nombre de la habilidad</Label>
								<Input
									value={newTool.name}
									onChange={(e) =>
										setNewTool((p) => ({ ...p, name: e.target.value }))
									}
									placeholder="ej. consultar clima"
									className="text-sm"
								/>
							</div>
							<div className="space-y-1">
								<Label className="text-xs">Qué hace / cuándo usarla</Label>
								<Input
									value={newTool.description}
									onChange={(e) =>
										setNewTool((p) => ({ ...p, description: e.target.value }))
									}
									placeholder="Describe la habilidad para que Antonella sepa cuándo usarla"
									className="text-sm"
								/>
							</div>
						</div>
						<div className="mt-2 flex justify-end">
							<Button variant="outline" size="sm" onClick={addCustomTool}>
								<PlusIcon className="mr-1.5 h-4 w-4" />
								Agregar habilidad
							</Button>
						</div>
					</div>

					<p className="text-[11px] text-muted-foreground">
						💡 Para conexiones reales (APIs externas, WhatsApp, bases de datos
						adicionales) avísame y las cableamos al backend.
					</p>
				</CardContent>
			</Card>

			{/* Guardar abajo también */}
			<div className="flex justify-end">
				<Button onClick={handleSave} disabled={saveMutation.isPending}>
					<SaveIcon className="mr-1.5 h-4 w-4" />
					{saveMutation.isPending ? "Guardando…" : "Guardar configuración"}
				</Button>
			</div>
		</div>
	);
}

function ToolRow({
	label,
	description,
	danger,
	enabled,
	onToggle,
}: {
	name: string;
	label: string;
	description: string;
	danger: boolean;
	enabled: boolean;
	onToggle: () => void;
}) {
	return (
		<div
			className={cn(
				"flex items-center gap-3 rounded-lg border p-2.5",
				enabled ? "bg-background" : "bg-muted/40 opacity-60",
			)}
		>
			<div className="min-w-0 flex-1">
				<p className="flex items-center gap-1.5 font-medium text-sm">
					{label}
					{danger && (
						<span className="rounded bg-amber-100 px-1 font-bold text-[9px] text-amber-700">
							ACCIÓN
						</span>
					)}
				</p>
				<p className="text-[11px] text-muted-foreground">{description}</p>
			</div>
			<button
				type="button"
				onClick={onToggle}
				className={cn(
					"relative h-6 w-11 shrink-0 rounded-full transition-colors",
					enabled ? "bg-primary" : "bg-muted-foreground/30",
				)}
				title={enabled ? "Activada" : "Desactivada"}
			>
				<span
					className={cn(
						"absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
						enabled ? "translate-x-[22px]" : "translate-x-0.5",
					)}
				/>
			</button>
		</div>
	);
}
