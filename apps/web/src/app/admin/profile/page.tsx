"use client";

import { Button } from "@finopenpos/ui/components/button";
import { Card, CardContent } from "@finopenpos/ui/components/card";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@finopenpos/ui/components/dialog";
import { Input } from "@finopenpos/ui/components/input";
import { Label } from "@finopenpos/ui/components/label";
import {
	KeyIcon,
	LogOutIcon,
	MailIcon,
	MoonIcon,
	SunIcon,
	Trash2Icon,
	UserCircleIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ScreenHead } from "@/components/screen-head";
import { useTheme } from "@/components/theme-provider";
import { authClient } from "@/lib/auth-client";

export default function ProfilePage() {
	const router = useRouter();
	const { data: session } = authClient.useSession();
	const { palette, mode, setPalette, setMode } = useTheme();

	const [emailOpen, setEmailOpen] = useState(false);
	const [passOpen, setPassOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [newEmail, setNewEmail] = useState("");
	const [currentPass, setCurrentPass] = useState("");
	const [newPass, setNewPass] = useState("");
	const [busy, setBusy] = useState(false);

	const user = session?.user;
	const name = user?.name?.trim() || user?.email?.split("@")[0] || "Usuario";
	const email = user?.email ?? "—";
	const memberSince = user?.createdAt
		? new Date(user.createdAt).toLocaleDateString("es-MX", {
				year: "numeric",
				month: "long",
			})
		: "—";

	async function handleChangeEmail() {
		if (!newEmail.includes("@")) return;
		setBusy(true);
		try {
			const res = await authClient.changeEmail({ newEmail });
			if ((res as { error?: unknown })?.error) throw new Error("error");
			toast.success("Solicitud de cambio de email enviada.");
			setEmailOpen(false);
			setNewEmail("");
		} catch {
			toast.error("No se pudo cambiar el email.");
		} finally {
			setBusy(false);
		}
	}

	async function handleChangePassword() {
		if (newPass.length < 8) {
			toast.error("La nueva contraseña debe tener al menos 8 caracteres.");
			return;
		}
		setBusy(true);
		try {
			const res = await authClient.changePassword({
				currentPassword: currentPass,
				newPassword: newPass,
				revokeOtherSessions: true,
			});
			if ((res as { error?: unknown })?.error) throw new Error("error");
			toast.success("Contraseña actualizada.");
			setPassOpen(false);
			setCurrentPass("");
			setNewPass("");
		} catch {
			toast.error("No se pudo cambiar la contraseña. Revisa la actual.");
		} finally {
			setBusy(false);
		}
	}

	async function handleSignOut() {
		await authClient.signOut();
		router.push("/login");
	}

	async function handleDelete() {
		setBusy(true);
		try {
			const res = await authClient.deleteUser();
			if ((res as { error?: unknown })?.error) throw new Error("error");
			toast.success("Cuenta eliminada.");
			router.push("/login");
		} catch {
			toast.error(
				"No se pudo eliminar la cuenta. Contacta al administrador del sistema.",
			);
			setDeleteOpen(false);
		} finally {
			setBusy(false);
		}
	}

	return (
		<div>
			<ScreenHead
				title="Perfil"
				desc="Tu cuenta, preferencias y configuración de la plataforma."
			/>

			<div className="mx-auto max-w-2xl space-y-4">
				{/* Tarjeta de usuario */}
				<Card>
					<CardContent className="flex flex-col gap-4 pt-6 sm:flex-row">
						<span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[var(--cg-red-wash)] text-primary">
							<UserCircleIcon className="h-12 w-12" />
						</span>
						<div className="min-w-0 flex-1">
							<div className="font-bold text-lg text-foreground">{name}</div>
							<div className="mt-0.5 text-muted-foreground text-sm">
								Administrador · Cárnicos Gustavo
							</div>
							<div className="mt-1.5 font-mono text-muted-foreground text-xs">
								{email}
							</div>
							<div className="mt-3 flex flex-wrap gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={() => setEmailOpen(true)}
								>
									<MailIcon className="mr-2 h-4 w-4" />
									Cambiar email
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={() => setPassOpen(true)}
								>
									<KeyIcon className="mr-2 h-4 w-4" />
									Nueva contraseña
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Preferencias */}
				<Card>
					<CardContent className="pt-6">
						<Label className="text-muted-foreground text-xs uppercase tracking-wider">
							Preferencias de la plataforma
						</Label>
						<div className="mt-4 grid gap-5 sm:grid-cols-2">
							<div>
								<div className="mb-2 font-semibold text-muted-foreground text-xs">
									Tema
								</div>
								<div className="flex gap-2">
									<Button
										variant={mode === "light" ? "default" : "outline"}
										size="sm"
										className="flex-1"
										onClick={() => setMode("light")}
									>
										<SunIcon className="mr-2 h-4 w-4" />
										Claro
									</Button>
									<Button
										variant={mode === "dark" ? "default" : "outline"}
										size="sm"
										className="flex-1"
										onClick={() => setMode("dark")}
									>
										<MoonIcon className="mr-2 h-4 w-4" />
										Oscuro
									</Button>
								</div>
							</div>
							<div>
								<div className="mb-2 font-semibold text-muted-foreground text-xs">
									Paleta
								</div>
								<div className="flex gap-2">
									<Button
										variant={palette === "warm" ? "default" : "outline"}
										size="sm"
										className="flex-1"
										onClick={() => setPalette("warm")}
									>
										Cálida
									</Button>
									<Button
										variant={palette === "neutral" ? "default" : "outline"}
										size="sm"
										className="flex-1"
										onClick={() => setPalette("neutral")}
									>
										Neutral
									</Button>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Información de la cuenta */}
				<Card>
					<CardContent className="pt-6">
						<Label className="text-muted-foreground text-xs uppercase tracking-wider">
							Información de la cuenta
						</Label>
						<div className="mt-4 grid gap-4 sm:grid-cols-2">
							<div>
								<div className="mb-1 font-semibold text-muted-foreground text-xs uppercase">
									Empresa
								</div>
								<div className="text-foreground text-sm">Cárnicos Gustavo</div>
							</div>
							<div>
								<div className="mb-1 font-semibold text-muted-foreground text-xs uppercase">
									Miembro desde
								</div>
								<div className="text-foreground text-sm">{memberSince}</div>
							</div>
							<div>
								<div className="mb-1 font-semibold text-muted-foreground text-xs uppercase">
									Rol
								</div>
								<div className="text-foreground text-sm">Administrador</div>
							</div>
							<div>
								<div className="mb-1 font-semibold text-muted-foreground text-xs uppercase">
									Estado
								</div>
								<div className="flex items-center gap-1.5 text-cg-green text-sm">
									<span className="h-2 w-2 rounded-full bg-cg-green" />
									Activo
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Zona de peligro */}
				<Card className="border-destructive/40 bg-[var(--cg-red-wash)]">
					<CardContent className="pt-6">
						<Label className="text-destructive text-xs uppercase tracking-wider">
							Zona de peligro
						</Label>
						<div className="mt-3 grid gap-2.5 sm:grid-cols-2">
							<Button variant="outline" onClick={handleSignOut}>
								<LogOutIcon className="mr-2 h-4 w-4" />
								Cerrar sesión
							</Button>
							<Button
								variant="outline"
								className="border-destructive/50 text-destructive hover:bg-destructive/10"
								onClick={() => setDeleteOpen(true)}
							>
								<Trash2Icon className="mr-2 h-4 w-4" />
								Eliminar cuenta
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Diálogo: cambiar email */}
			<Dialog open={emailOpen} onOpenChange={setEmailOpen}>
				<DialogContent className="sm:max-w-[440px]">
					<DialogHeader>
						<DialogTitle>Cambiar email</DialogTitle>
					</DialogHeader>
					<div className="space-y-1.5">
						<Label htmlFor="new-email">Nuevo email</Label>
						<Input
							id="new-email"
							type="email"
							value={newEmail}
							onChange={(e) => setNewEmail(e.target.value)}
							placeholder="nuevo@correo.com"
						/>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setEmailOpen(false)}>
							Cancelar
						</Button>
						<Button
							onClick={handleChangeEmail}
							disabled={busy || !newEmail.includes("@")}
						>
							Guardar
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Diálogo: cambiar contraseña */}
			<Dialog open={passOpen} onOpenChange={setPassOpen}>
				<DialogContent className="sm:max-w-[440px]">
					<DialogHeader>
						<DialogTitle>Nueva contraseña</DialogTitle>
					</DialogHeader>
					<div className="space-y-3">
						<div className="space-y-1.5">
							<Label htmlFor="cur-pass">Contraseña actual</Label>
							<Input
								id="cur-pass"
								type="password"
								value={currentPass}
								onChange={(e) => setCurrentPass(e.target.value)}
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="new-pass">Nueva contraseña</Label>
							<Input
								id="new-pass"
								type="password"
								value={newPass}
								onChange={(e) => setNewPass(e.target.value)}
								placeholder="Mínimo 8 caracteres"
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setPassOpen(false)}>
							Cancelar
						</Button>
						<Button
							onClick={handleChangePassword}
							disabled={busy || !currentPass || newPass.length < 8}
						>
							Actualizar
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Diálogo: eliminar cuenta */}
			<Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
				<DialogContent className="sm:max-w-[440px]">
					<DialogHeader>
						<DialogTitle className="text-destructive">
							Eliminar cuenta
						</DialogTitle>
					</DialogHeader>
					<p className="text-muted-foreground text-sm">
						Esta acción es permanente y no se puede deshacer. Se cerrará tu
						sesión y se eliminará tu acceso a la plataforma.
					</p>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteOpen(false)}>
							Cancelar
						</Button>
						<Button variant="destructive" onClick={handleDelete} disabled={busy}>
							Sí, eliminar mi cuenta
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
