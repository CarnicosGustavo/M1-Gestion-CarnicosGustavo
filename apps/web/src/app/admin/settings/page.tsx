"use client";

import { Button } from "@finopenpos/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@finopenpos/ui/components/card";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	BotIcon,
	CreditCardIcon,
	GitBranchIcon,
	PackageIcon,
	SnowflakeIcon,
	TagIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ScreenHead } from "@/components/screen-head";
import { useTRPC } from "@/lib/trpc/client";

export default function SettingsPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [resetPassword, setResetPassword] = useState("");
	const [resetConfirm, setResetConfirm] = useState("");
	const [resetOpen, setResetOpen] = useState(false);

	// Reset de clientes y pedidos
	const [cliPassword, setCliPassword] = useState("");
	const [cliConfirm, setCliConfirm] = useState("");
	const [cliOpen, setCliOpen] = useState(false);

	const resetCustomersMutation = useMutation(
		trpc.inventory.resetCustomersAndOrders.mutationOptions({
			onSuccess: (data: any) => {
				toast.success(
					`Listo: ${data.deletedCustomers} clientes y ${data.deletedOrders} pedidos borrados. Respaldo: ${data.backupSuffix}`,
				);
				setCliPassword("");
				setCliConfirm("");
				setCliOpen(false);
				queryClient.invalidateQueries({
					queryKey: trpc.customers.list.queryKey(),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.orders.list.queryKey(),
				});
			},
			onError: (e: any) => toast.error(e.message),
		}),
	);

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
			<ScreenHead
				title="Configuración"
				desc="Catálogo, recetas, precios y parámetros del sistema. Cada acceso abre su módulo."
			/>

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{[
					{
						href: "/admin/products",
						label: "Productos",
						desc: "Catálogo de piezas padre (se despiezan) e hijas (se venden).",
						icon: PackageIcon,
					},
					{
						href: "/admin/inventory/recipes",
						label: "Recetas",
						desc: "Define el despiece: canal → piezas → variantes.",
						icon: GitBranchIcon,
					},
					{
						href: "/admin/prices",
						label: "Precios por cliente",
						desc: "Lista de precios propia de cada cliente.",
						icon: TagIcon,
					},
					{
						href: "/admin/cold-inventory",
						label: "Inventario frío",
						desc: "Transferencias entre fresco y congelado.",
						icon: SnowflakeIcon,
					},
					{
						href: "/admin/payment-methods",
						label: "Métodos de pago",
						desc: "Formas de cobro disponibles al cerrar un pedido.",
						icon: CreditCardIcon,
					},
					{
						href: "/admin/settings/antonella",
						label: "Antonella (IA)",
						desc: "Configura el asistente de inteligencia artificial.",
						icon: BotIcon,
					},
				].map((a) => (
					<Link key={a.href} href={a.href}>
						<Card className="h-full transition-colors hover:border-primary/40 hover:bg-accent/40">
							<CardContent className="flex items-start gap-3 pt-6">
								<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--cg-red-wash)] text-primary">
									<a.icon className="h-5 w-5" />
								</span>
								<div>
									<p className="font-semibold text-foreground">{a.label}</p>
									<p className="mt-0.5 text-muted-foreground text-sm">
										{a.desc}
									</p>
								</div>
							</CardContent>
						</Card>
					</Link>
				))}
			</div>

			<Card className="border-blue-200 bg-blue-50">
				<CardContent className="pt-6">
					<p className="text-blue-900 text-sm">
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

			<Card className="border-orange-200 bg-orange-50">
				<CardHeader>
					<CardTitle className="text-orange-900">
						Reset de Clientes y Pedidos
					</CardTitle>
					<CardDescription className="text-orange-900/80">
						Borra clientes, pedidos, cobranza y precios por cliente (datos de
						prueba). Genera un respaldo en la base de datos (tablas con fecha)
						antes de borrar. Requiere contraseña de administrador.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div className="space-y-1">
							<Label>Contraseña admin</Label>
							<Input
								type="password"
								value={cliPassword}
								onChange={(e) => setCliPassword(e.target.value)}
								placeholder="••••••••"
							/>
						</div>
						<div className="space-y-1">
							<Label>Confirmación</Label>
							<Input
								value={cliConfirm}
								onChange={(e) => setCliConfirm(e.target.value)}
								placeholder='Escribe "RESET"'
							/>
						</div>
					</div>
					<div className="flex justify-end">
						<Button
							className="bg-orange-600 hover:bg-orange-700"
							onClick={() => setCliOpen(true)}
							disabled={
								resetCustomersMutation.isPending ||
								cliPassword.trim().length === 0 ||
								cliConfirm.trim().toUpperCase() !== "RESET"
							}
						>
							{resetCustomersMutation.isPending
								? "Reseteando..."
								: "Resetear clientes y pedidos"}
						</Button>
					</div>
				</CardContent>
			</Card>

			<Dialog open={cliOpen} onOpenChange={setCliOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Confirmar reset de clientes y pedidos</DialogTitle>
						<DialogDescription>
							Se respaldan los datos (tablas con fecha) y luego se borran
							clientes, pedidos, cobranza y precios por cliente. El catálogo y
							recetas no se tocan.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="secondary" onClick={() => setCliOpen(false)}>
							Cancelar
						</Button>
						<Button
							className="bg-orange-600 hover:bg-orange-700"
							onClick={() =>
								resetCustomersMutation.mutate({ adminPassword: cliPassword })
							}
							disabled={resetCustomersMutation.isPending}
						>
							Confirmar reset
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

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
