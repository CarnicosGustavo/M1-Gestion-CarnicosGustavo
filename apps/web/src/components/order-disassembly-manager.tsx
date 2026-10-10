"use client";

import { Badge } from "@finopenpos/ui/components/badge";
import { Button } from "@finopenpos/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@finopenpos/ui/components/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@finopenpos/ui/components/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangleIcon,
	CheckCircle2Icon,
	ChevronRightIcon,
	Loader2Icon,
	PackageIcon,
	ScissorsIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { trpcClient, useTRPC } from "@/lib/trpc/client";

interface OrderDisassemblyManagerProps {
	orderId: number;
	orderStatus?: string | null;
	orderItems: Array<{
		status: string | null;
		quantity_pieces: number | null;
		product: { stock_pieces?: number | null } | null;
	}>;
	onSuccess?: () => void;
}

export function OrderDisassemblyManager({
	orderId,
	orderStatus,
	orderItems,
	onSuccess,
}: OrderDisassemblyManagerProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const t = useTranslations("orders");

	const [selectedStyle, setSelectedStyle] = useState<string>("AMERICANO");
	const [leaveWholeIds, setLeaveWholeIds] = useState<number[]>([]);

	// Estilos comunes (estos podrían venir de la DB en el futuro)
	const styles = [
		{ value: "AMERICANO", label: "Americano" },
		// Deben coincidir con product_transformations.transformation_type
		{ value: "NACIONAL_LOMO", label: "Nacional Lomo" },
		{ value: "NACIONAL_ESPILOMO", label: "Nacional Espilomo" },
		{ value: "POLINESIO", label: "Polinesio" },
	];

	// Pedido cerrado/cancelado: no se ofrece despiece.
	const isClosed = ["COMPLETADA", "completed", "paid", "cancelled"].includes(
		orderStatus ?? "",
	);

	const hasShortages =
		!isClosed &&
		orderItems.some(
			(item) =>
				item.status === "PENDIENTE_COMPRA" ||
				(item.product != null &&
					(item.product.stock_pieces ?? 0) < (item.quantity_pieces || 0)),
		);

	// validateDisassemblyRecipes es una mutation de solo lectura en el servidor
	// (POST en la API); se consulta con el cliente tRPC directo.
	const validationInput = {
		orderId,
		transformationType: selectedStyle,
		productsToLeaveWhole: leaveWholeIds,
	};
	const { data: validation, isLoading: isValidating } = useQuery({
		queryKey: ["orders.validateDisassemblyRecipes", validationInput],
		queryFn: () =>
			trpcClient.orders.validateDisassemblyRecipes.mutate(validationInput),
		enabled: hasShortages,
	});

	const prepareMutation = useMutation(
		trpc.orders.prepareDisassemblyForOrder.mutationOptions({
			onSuccess: () => {
				toast.success("Despiece ejecutado correctamente");
				queryClient.invalidateQueries({
					queryKey: ["orders.validateDisassemblyRecipes"],
				});
				onSuccess?.();
			},
			onError: (error) => {
				toast.error(`Error al preparar despiece: ${error.message}`);
			},
		}),
	);

	const toggleLeaveWhole = (id: number) => {
		setLeaveWholeIds((prev) =>
			prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
		);
	};

	if (!hasShortages) return null;

	return (
		<Card className="border-yellow-200 bg-yellow-50/30">
			<CardHeader className="pb-3">
				<CardTitle className="flex items-center gap-2 font-semibold text-lg text-yellow-900">
					<ScissorsIcon className="h-5 w-5" />
					{t("disassemblyManagement")}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-end">
					<div className="flex-1 space-y-2">
						<label
							htmlFor="disassembly-style"
							className="font-medium text-sm text-yellow-900"
						>
							Estilo de Despiece (Canal)
						</label>
						<Select value={selectedStyle} onValueChange={setSelectedStyle}>
							<SelectTrigger
								id="disassembly-style"
								className="border-yellow-200 bg-white"
							>
								<SelectValue placeholder="Selecciona un estilo" />
							</SelectTrigger>
							<SelectContent>
								{styles.map((style) => (
									<SelectItem key={style.value} value={style.value}>
										{style.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<Button
						className="bg-yellow-600 text-white hover:bg-yellow-700"
						onClick={() =>
							prepareMutation.mutate({
								orderId,
								transformationType: selectedStyle,
								productsToLeaveWhole: leaveWholeIds,
							})
						}
						disabled={prepareMutation.isPending || !validation?.ok}
					>
						{prepareMutation.isPending ? (
							<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<CheckCircle2Icon className="mr-2 h-4 w-4" />
						)}
						Ejecutar Despiece Automático
					</Button>
				</div>

				{isValidating ? (
					<div className="flex items-center gap-2 text-sm text-yellow-700">
						<Loader2Icon className="h-4 w-4 animate-spin" />
						Validando recetas para este estilo...
					</div>
				) : validation ? (
					<div className="space-y-3">
						{!validation.ok && (
							<div className="flex items-start gap-2 rounded-md border border-red-100 bg-red-50 p-3 text-red-800 text-sm">
								<AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
								<div>
									<p className="font-semibold">Recetas incompletas</p>
									<p className="mt-1">
										No hay recetas suficientes para generar todos los productos
										faltantes con el estilo {selectedStyle}.
									</p>
								</div>
							</div>
						)}

						<div className="overflow-hidden rounded-md border border-yellow-200 bg-white">
							<div className="flex items-center justify-between border-yellow-200 border-b bg-yellow-100/50 px-3 py-2">
								<span className="font-bold text-xs text-yellow-900 uppercase tracking-wider">
									Genera (al ejecutar)
								</span>
								{validation.canal && (
									<Badge
										variant="outline"
										className="border-yellow-200 bg-yellow-50 text-yellow-700"
									>
										Desde: {validation.canal.name}
									</Badge>
								)}
							</div>
							<div className="divide-y divide-yellow-100">
								{validation.items.map((item, idx) => (
									<div key={idx} className="px-3 py-2 text-sm">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2">
												<PackageIcon className="h-3.5 w-3.5 text-yellow-600" />
												<span className="font-medium text-slate-700">
													{item.productName}
												</span>
											</div>
											<span className="font-bold text-yellow-700">
												+{item.demandPieces} pzas
											</span>
										</div>
										{item.path && item.path.length > 0 && (
											<div className="mt-1 flex items-center gap-1 overflow-x-auto whitespace-nowrap pb-1 text-[10px] text-slate-400">
												{item.path.map((step, sIdx) => (
													<span key={sIdx} className="flex items-center gap-1">
														{sIdx > 0 && (
															<ChevronRightIcon className="h-3 w-3" />
														)}
														<span
															className={
																sIdx === (item.path?.length ?? 0) - 1
																	? "font-medium text-yellow-600"
																	: ""
															}
														>
															{step.parentName}
														</span>
														{sIdx < (item.path?.length ?? 0) - 1 && (
															<button
																type="button"
																onClick={() => toggleLeaveWhole(step.childId)}
																className={`rounded border px-1 transition-colors ${
																	leaveWholeIds.includes(step.childId)
																		? "border-red-200 bg-red-100 text-red-700"
																		: "border-slate-200 bg-slate-100 hover:border-yellow-200 hover:bg-yellow-100"
																}`}
																title={
																	leaveWholeIds.includes(step.childId)
																		? "No despiezar (Dejar completo)"
																		: "Haga clic para dejar completo"
																}
															>
																{leaveWholeIds.includes(step.childId)
																	? "Dejar completo"
																	: "Separar"}
															</button>
														)}
													</span>
												))}
											</div>
										)}
										{item.reason === "BLOQUEADO_POR_USUARIO" && (
											<span className="font-medium text-[10px] text-red-500 italic">
												BLOQUEADO: Se dejará completo el paso intermedio.
											</span>
										)}
										{item.reason === "RECETA_INCOMPLETA" && (
											<span className="font-medium text-[10px] text-red-500">
												Sin receta para este estilo
											</span>
										)}
									</div>
								))}
							</div>
						</div>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}
