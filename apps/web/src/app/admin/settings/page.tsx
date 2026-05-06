"use client";

import { useState } from "react";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@finopenpos/ui/components/card";
import { Button } from "@finopenpos/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@finopenpos/ui/components/dialog";
import { Input } from "@finopenpos/ui/components/input";
import { Label } from "@finopenpos/ui/components/label";
import { SettingsIcon } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import Link from "next/link";

export default function SettingsPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [resetPassword, setResetPassword] = useState("");
	const [resetConfirm, setResetConfirm] = useState("");
	const [resetOpen, setResetOpen] = useState(false);

	const resetMutation = useMutation(
		trpc.inventory.resetAllStock.mutationOptions({
			onSuccess: (data) => {
				toast.success(
					`Inventario reseteado: ${data.productsReset} productos (transacciones: ${data.transactionsLogged})`,
				);
				setResetPassword("");
				setResetConfirm("");
				setResetOpen(false);
				queryClient.invalidateQueries({
					queryKey: trpc.products.list.queryKey(),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.products.disassemblyDashboard.queryKey(),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.products.disassemblyDashboardRecipes.queryKey(),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.inventory.status.queryKey(),
				});
			},
			onError: (e) => {
				toast.error(e.message);
			},
		}),
	);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2">
				<SettingsIcon className="h-6 w-6" />
				<h1 className="text-3xl font-bold">Configuración</h1>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Configuración del Sistema</CardTitle>
					<CardDescription>
						Gestiona todos los parámetros del sistema desde aquí
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
						<Button asChild variant="outline" className="justify-start">
							<Link href="/admin/inventory/recipes">Recetas</Link>
						</Button>
						<Button asChild variant="outline" className="justify-start">
							<Link href="/admin/payment-methods">Métodos de pago</Link>
						</Button>
					</div>
					<div className="text-muted-foreground text-sm">
						Usa estos accesos para administrar recetas e información de cobro.
					</div>
				</CardContent>
			</Card>

			<Card className="bg-blue-50 border-blue-200">
				<CardContent className="pt-6">
					<p className="text-sm text-blue-900">
						💡 <strong>Consejo:</strong> Todos los cambios en esta sección se
						guardan automáticamente. Los ajustes de configuración afectan al
						funcionamiento del sistema.
					</p>
				</CardContent>
			</Card>

			<Card className="border-red-200 bg-red-50">
				<CardHeader>
					<CardTitle className="text-red-900">Reset de Inventario</CardTitle>
					<CardDescription className="text-red-900/80">
						Pone en cero el stock de todos los productos y registra auditoría
						(RESET). Requiere contraseña de administrador.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div className="space-y-1">
							<Label>Contraseña admin</Label>
							<Input
								type="password"
								value={resetPassword}
								onChange={(e) => setResetPassword(e.target.value)}
								placeholder="••••••••"
							/>
						</div>
						<div className="space-y-1">
							<Label>Confirmación</Label>
							<Input
								value={resetConfirm}
								onChange={(e) => setResetConfirm(e.target.value)}
								placeholder='Escribe "RESET"'
							/>
						</div>
					</div>

					<div className="flex justify-end">
						<Button
							variant="destructive"
							onClick={() => setResetOpen(true)}
							disabled={
								resetMutation.isPending ||
								resetPassword.trim().length === 0 ||
								resetConfirm.trim().toUpperCase() !== "RESET"
							}
						>
							{resetMutation.isPending
								? "Reseteando..."
								: "Resetear inventario"}
						</Button>
					</div>
				</CardContent>
			</Card>

			<Dialog open={resetOpen} onOpenChange={setResetOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Confirmar reset de inventario</DialogTitle>
						<DialogDescription>
							Esta acción no se puede deshacer. Se pondrá en cero el stock de
							todos los productos.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="secondary" onClick={() => setResetOpen(false)}>
							Cancelar
						</Button>
						<Button
							variant="destructive"
							onClick={() =>
								resetMutation.mutate({ adminPassword: resetPassword })
							}
							disabled={resetMutation.isPending}
						>
							Confirmar reset
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
