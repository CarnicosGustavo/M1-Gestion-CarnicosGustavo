"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@finopenpos/ui/components/card";
import { Button } from "@finopenpos/ui/components/button";
import { Input } from "@finopenpos/ui/components/input";
import { Label } from "@finopenpos/ui/components/label";
import { Badge } from "@finopenpos/ui/components/badge";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@finopenpos/ui/components/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@finopenpos/ui/components/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@finopenpos/ui/components/table";
import {
	PlusIcon,
	BanknoteIcon,
	FileTextIcon,
	PrinterIcon,
	MessageCircleIcon,
	PencilIcon,
	Trash2Icon,
} from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DebtVoucherModal } from "@/components/debt-voucher-modal";
import { PaymentReceiptModal } from "@/components/payment-receipt-modal";

const fmt = (n: number) =>
	n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function CollectionsPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const [chargeOpen, setChargeOpen] = useState(false);
	const [payOpen, setPayOpen] = useState<{ customerId: number; name: string } | null>(null);
	const [stmtOpen, setStmtOpen] = useState<{ customerId: number; name: string } | null>(null);
	const [voucherFor, setVoucherFor] = useState<{ customerId: number; name: string | null } | null>(null);
	const [receiptFor, setReceiptFor] = useState<{ customerId: number; name: string | null; paymentId: number } | null>(null);
	// Edición de un movimiento (cargo o abono)
	const [editMov, setEditMov] = useState<
		| { kind: "cargo" | "abono"; id: number; amount: string; concept: string; date: string }
		| null
	>(null);

	// Form: cargo / ticket viejo
	const [chCustomer, setChCustomer] = useState("");
	const [chAmount, setChAmount] = useState("");
	const [chConcept, setChConcept] = useState("");
	const [chDate, setChDate] = useState("");

	// Form: abono
	const [payAmount, setPayAmount] = useState("");
	const [payMethod, setPayMethod] = useState("");

	const accountsKey = trpc.collections.listAccounts.queryOptions().queryKey;
	const { data: accounts } = useQuery(trpc.collections.listAccounts.queryOptions());
	const { data: customers } = useQuery(trpc.customers.list.queryOptions()) as {
		data: { id: number; name: string | null }[] | undefined;
	};

	const statement = useQuery({
		...trpc.collections.getStatement.queryOptions({
			customerId: stmtOpen?.customerId ?? 0,
		}),
		enabled: !!stmtOpen,
	});

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: accountsKey });

	// Invalida el estado de cuenta del cliente abierto (tras editar/eliminar)
	const invalidateStmt = () => {
		invalidate();
		if (stmtOpen) {
			queryClient.invalidateQueries({
				queryKey: trpc.collections.getStatement.queryOptions({
					customerId: stmtOpen.customerId,
				}).queryKey,
			});
		}
	};

	// Envía recordatorio de pago por WhatsApp con el saldo pendiente
	const sendReminder = (a: any) => {
		const phone = String(a.phone ?? "").replace(/[^\d]/g, "");
		const text =
			`Hola ${a.name ?? ""}, le saluda *Cárnicos Gustavo*. ` +
			`Le recordamos que tiene un saldo pendiente de *${fmt(a.balance)}*. ` +
			`Agradecemos mucho su pago. ¡Gracias por su preferencia!`;
		const url = phone
			? `https://wa.me/52${phone.replace(/^52/, "")}?text=${encodeURIComponent(text)}`
			: `https://wa.me/?text=${encodeURIComponent(text)}`;
		if (!phone) toast.info("El cliente no tiene teléfono; elige el contacto en WhatsApp");
		window.open(url, "_blank", "noopener,noreferrer");
	};

	const updateChargeMut = useMutation(
		trpc.collections.updateCharge.mutationOptions({
			onSuccess: () => {
				toast.success("Cargo actualizado");
				setEditMov(null);
				invalidateStmt();
			},
			onError: (e: any) => toast.error(e.message ?? "Error"),
		}),
	);
	const updatePaymentMut = useMutation(
		trpc.collections.updatePayment.mutationOptions({
			onSuccess: () => {
				toast.success("Abono actualizado");
				setEditMov(null);
				invalidateStmt();
			},
			onError: (e: any) => toast.error(e.message ?? "Error"),
		}),
	);
	const deleteChargeMut = useMutation(
		trpc.collections.deleteCharge.mutationOptions({
			onSuccess: () => {
				toast.success("Cargo eliminado");
				invalidateStmt();
			},
			onError: (e: any) => toast.error(e.message ?? "Error"),
		}),
	);
	const deletePaymentMut = useMutation(
		trpc.collections.deletePayment.mutationOptions({
			onSuccess: () => {
				toast.success("Abono eliminado");
				invalidateStmt();
			},
			onError: (e: any) => toast.error(e.message ?? "Error"),
		}),
	);

	const deleteMovement = (l: any) => {
		const tipo = l.tipo === "abono" ? "abono" : "cargo";
		if (!window.confirm(`¿Eliminar este ${tipo} de ${fmt(l.cargo || l.abono)}? Esta acción no se puede deshacer.`)) return;
		if (l.tipo === "abono") deletePaymentMut.mutate({ id: l.id });
		else deleteChargeMut.mutate({ id: l.id });
	};

	const openEditMovement = (l: any) => {
		setEditMov({
			kind: l.tipo === "abono" ? "abono" : "cargo",
			id: l.id,
			amount: String(l.cargo || l.abono || ""),
			concept: l.tipo === "abono" ? "" : (l.concepto ?? ""),
			date: l.fecha ? String(l.fecha).slice(0, 10) : "",
		});
	};

	const saveEditMovement = () => {
		if (!editMov) return;
		const amount = parseFloat(editMov.amount) || 0;
		if (amount <= 0) {
			toast.error("El monto debe ser mayor a 0");
			return;
		}
		if (editMov.kind === "cargo") {
			updateChargeMut.mutate({
				id: editMov.id,
				amount,
				concept: editMov.concept || undefined,
				chargeDate: editMov.date || undefined,
			});
		} else {
			updatePaymentMut.mutate({
				id: editMov.id,
				amount,
				method: editMov.concept || undefined,
				paymentDate: editMov.date || undefined,
			});
		}
	};

	const chargeMut = useMutation(
		trpc.collections.addCharge.mutationOptions({
			onSuccess: () => {
				const custId = parseInt(chCustomer);
				const custName =
					(customers ?? []).find((c) => c.id === custId)?.name ?? null;
				toast.success("Cargo registrado");
				setChargeOpen(false);
				setChCustomer("");
				setChAmount("");
				setChConcept("");
				setChDate("");
				invalidate();
				// Abre el vale para imprimir y que el cliente lo firme
				if (custId) setVoucherFor({ customerId: custId, name: custName });
			},
			onError: (e: any) => toast.error(e.message ?? "Error"),
		}),
	);

	const payMut = useMutation(
		trpc.collections.addPayment.mutationOptions({
			onSuccess: (data: any) => {
				const cust = payOpen;
				toast.success("Abono registrado");
				setPayOpen(null);
				setPayAmount("");
				setPayMethod("");
				invalidate();
				// Abre el recibo de abono para imprimir y entregar al cliente
				if (cust && data?.id) {
					queryClient.invalidateQueries({
						queryKey: trpc.collections.getStatement.queryOptions({
							customerId: cust.customerId,
						}).queryKey,
					});
					setReceiptFor({
						customerId: cust.customerId,
						name: cust.name,
						paymentId: data.id,
					});
				}
			},
			onError: (e: any) => toast.error(e.message ?? "Error"),
		}),
	);

	const accountsList = (accounts ?? []) as any[];
	const conSaldo = accountsList.filter((a) => a.balance > 0.001);
	const totalPorCobrar = conSaldo.reduce((s, a) => s + a.balance, 0);

	return (
		<div className="space-y-6 max-w-5xl">
			<div className="flex items-center justify-between gap-4 flex-wrap">
				<div>
					<h1 className="text-2xl font-bold">Cobranza</h1>
					<p className="text-sm text-muted-foreground">
						Cuentas por cobrar: pedidos a crédito y tickets viejos. Registra abonos.
					</p>
				</div>
				<Button onClick={() => setChargeOpen(true)}>
					<PlusIcon className="w-4 h-4 mr-2" />
					Capturar ticket viejo
				</Button>
			</div>

			{/* Total por cobrar */}
			<Card>
				<CardContent className="pt-6 flex items-center justify-between">
					<div>
						<p className="text-xs text-muted-foreground">Total por cobrar</p>
						<p className="text-3xl font-bold text-red-600">{fmt(totalPorCobrar)}</p>
					</div>
					<div className="text-right">
						<p className="text-xs text-muted-foreground">Clientes con saldo</p>
						<p className="text-3xl font-bold">{conSaldo.length}</p>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Cuentas por cobrar</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow className="bg-muted/50">
									<TableHead>Cliente</TableHead>
									<TableHead className="text-right">Cargos</TableHead>
									<TableHead className="text-right">Abonos</TableHead>
									<TableHead className="text-right">Saldo</TableHead>
									<TableHead className="text-center">Antigüedad</TableHead>
									<TableHead className="text-center">Acciones</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{conSaldo.length === 0 ? (
									<TableRow>
										<TableCell colSpan={6} className="text-center text-muted-foreground py-6">
											Sin cuentas por cobrar
										</TableCell>
									</TableRow>
								) : (
									conSaldo.map((a) => (
										<TableRow key={a.customerId}>
											<TableCell className="font-medium">
												{a.name ?? `Cliente #${a.customerId}`}
											</TableCell>
											<TableCell className="text-right">{fmt(a.totalCharges)}</TableCell>
											<TableCell className="text-right text-green-700">
												{fmt(a.totalPayments)}
											</TableCell>
											<TableCell className="text-right font-bold text-red-600">
												{fmt(a.balance)}
											</TableCell>
											<TableCell className="text-center">
												{a.diasVencido > 0 ? (
													<Badge
														className={`border-0 ${
															a.diasVencido > 60
																? "bg-red-100 text-red-800"
																: a.diasVencido > 30
																	? "bg-orange-100 text-orange-800"
																	: "bg-yellow-100 text-yellow-800"
														}`}
													>
														{a.diasVencido} días
													</Badge>
												) : (
													"—"
												)}
											</TableCell>
											<TableCell>
												<div className="flex justify-center gap-2">
													<Button
														size="sm"
														className="bg-green-600 hover:bg-green-700"
														onClick={() =>
															setPayOpen({ customerId: a.customerId, name: a.name })
														}
													>
														<BanknoteIcon className="w-4 h-4 mr-1" />
														Abonar
													</Button>
													<Button
														variant="outline"
														size="sm"
														onClick={() =>
															setStmtOpen({ customerId: a.customerId, name: a.name })
														}
													>
														<FileTextIcon className="w-4 h-4 mr-1" />
														Estado
													</Button>
													<Button
														variant="outline"
														size="sm"
														className="border-amber-400 text-amber-700 hover:bg-amber-50"
														onClick={() =>
															setVoucherFor({ customerId: a.customerId, name: a.name })
														}
													>
														<PrinterIcon className="w-4 h-4 mr-1" />
														Vale
													</Button>
													<Button
														variant="outline"
														size="sm"
														className="border-[#25D366] text-[#1da851] hover:bg-[#25D366]/10"
														title="Enviar recordatorio de pago por WhatsApp"
														onClick={() => sendReminder(a)}
													>
														<MessageCircleIcon className="w-4 h-4 mr-1" />
														Recordar
													</Button>
												</div>
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>

			{/* Dialog: capturar cargo / ticket viejo */}
			<Dialog open={chargeOpen} onOpenChange={(o) => !o && setChargeOpen(false)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Capturar ticket viejo / cargo</DialogTitle>
					</DialogHeader>
					<div className="grid gap-4 py-2">
						<div className="space-y-1">
							<Label>Cliente</Label>
							<Select value={chCustomer} onValueChange={setChCustomer}>
								<SelectTrigger>
									<SelectValue placeholder="Selecciona cliente" />
								</SelectTrigger>
								<SelectContent>
									{(customers ?? []).map((c) => (
										<SelectItem key={c.id} value={c.id.toString()}>
											{c.name ?? `Cliente #${c.id}`}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1">
							<Label>Monto</Label>
							<Input type="number" value={chAmount} onChange={(e) => setChAmount(e.target.value)} placeholder="0.00" />
						</div>
						<div className="space-y-1">
							<Label>Concepto</Label>
							<Input value={chConcept} onChange={(e) => setChConcept(e.target.value)} placeholder="Ej. Nota 1234 del 5/mar" />
						</div>
						<div className="space-y-1">
							<Label>Fecha del cargo (opcional)</Label>
							<Input type="date" value={chDate} onChange={(e) => setChDate(e.target.value)} />
						</div>
					</div>
					<DialogFooter>
						<Button variant="secondary" onClick={() => setChargeOpen(false)}>
							Cancelar
						</Button>
						<Button
							disabled={chargeMut.isPending || !chCustomer || !chAmount}
							onClick={() =>
								chargeMut.mutate({
									customerId: parseInt(chCustomer),
									amount: parseFloat(chAmount) || 0,
									concept: chConcept || undefined,
									chargeDate: chDate || undefined,
									source: "ticket_viejo",
								})
							}
						>
							Guardar cargo
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Dialog: abono */}
			<Dialog open={!!payOpen} onOpenChange={(o) => !o && setPayOpen(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Registrar abono — {payOpen?.name}</DialogTitle>
					</DialogHeader>
					<div className="grid gap-4 py-2">
						<div className="space-y-1">
							<Label>Monto del abono</Label>
							<Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0.00" />
						</div>
						<div className="space-y-1">
							<Label>Método (opcional)</Label>
							<Input value={payMethod} onChange={(e) => setPayMethod(e.target.value)} placeholder="Efectivo, transferencia…" />
						</div>
					</div>
					<DialogFooter>
						<Button variant="secondary" onClick={() => setPayOpen(null)}>
							Cancelar
						</Button>
						<Button
							className="bg-green-600 hover:bg-green-700"
							disabled={payMut.isPending || !payAmount}
							onClick={() =>
								payOpen &&
								payMut.mutate({
									customerId: payOpen.customerId,
									amount: parseFloat(payAmount) || 0,
									method: payMethod || undefined,
								})
							}
						>
							Registrar abono
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Dialog: estado de cuenta */}
			<Dialog open={!!stmtOpen} onOpenChange={(o) => !o && setStmtOpen(null)}>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>Estado de cuenta — {stmtOpen?.name}</DialogTitle>
					</DialogHeader>
					{statement.data ? (
						<div className="space-y-3">
							<div className="overflow-x-auto max-h-80 overflow-y-auto">
								<Table>
									<TableHeader>
										<TableRow className="bg-muted/50">
											<TableHead>Fecha</TableHead>
											<TableHead>Concepto</TableHead>
											<TableHead className="text-right">Cargo</TableHead>
											<TableHead className="text-right">Abono</TableHead>
											<TableHead className="text-center">Acciones</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{statement.data.ledger.map((l: any, i: number) => (
											<TableRow key={i}>
												<TableCell>{l.fecha ?? "—"}</TableCell>
												<TableCell>{l.concepto}</TableCell>
												<TableCell className="text-right">
													{l.cargo > 0 ? fmt(l.cargo) : ""}
												</TableCell>
												<TableCell className="text-right text-green-700">
													{l.abono > 0 ? fmt(l.abono) : ""}
												</TableCell>
												<TableCell>
													<div className="flex items-center justify-center gap-1">
														{l.tipo === "abono" ? (
															<Button
																variant="ghost"
																size="sm"
																title="Re-imprimir recibo de abono"
																onClick={() =>
																	stmtOpen &&
																	setReceiptFor({
																		customerId: stmtOpen.customerId,
																		name: stmtOpen.name,
																		paymentId: l.id,
																	})
																}
															>
																<PrinterIcon className="w-4 h-4" />
															</Button>
														) : (
															<Button
																variant="ghost"
																size="sm"
																title="Imprimir vale de adeudo"
																onClick={() =>
																	stmtOpen &&
																	setVoucherFor({
																		customerId: stmtOpen.customerId,
																		name: stmtOpen.name,
																	})
																}
															>
																<FileTextIcon className="w-4 h-4" />
															</Button>
														)}
														<Button
															variant="ghost"
															size="sm"
															title="Corregir movimiento"
															onClick={() => openEditMovement(l)}
														>
															<PencilIcon className="w-4 h-4" />
														</Button>
														<Button
															variant="ghost"
															size="sm"
															className="text-red-600 hover:text-red-700"
															title="Eliminar movimiento"
															onClick={() => deleteMovement(l)}
														>
															<Trash2Icon className="w-4 h-4" />
														</Button>
													</div>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
							<div className="grid grid-cols-3 gap-3 border-t pt-3">
								<div className="rounded-lg bg-slate-50 p-3">
									<p className="text-xs text-muted-foreground">Cargos</p>
									<p className="font-bold">{fmt(statement.data.totalCargos)}</p>
								</div>
								<div className="rounded-lg bg-slate-50 p-3">
									<p className="text-xs text-muted-foreground">Abonos</p>
									<p className="font-bold text-green-700">{fmt(statement.data.totalAbonos)}</p>
								</div>
								<div className="rounded-lg bg-red-50 p-3">
									<p className="text-xs text-muted-foreground">Saldo</p>
									<p className="font-bold text-red-600">{fmt(statement.data.balance)}</p>
								</div>
							</div>
							<div className="flex justify-end border-t pt-3">
								<Button
									variant="outline"
									className="border-amber-400 text-amber-700 hover:bg-amber-50"
									onClick={() =>
										stmtOpen &&
										setVoucherFor({
											customerId: stmtOpen.customerId,
											name: stmtOpen.name,
										})
									}
								>
									<PrinterIcon className="w-4 h-4 mr-2" />
									Imprimir vale firmado
								</Button>
							</div>
						</div>
					) : (
						<p className="text-sm text-muted-foreground py-4">Cargando…</p>
					)}
				</DialogContent>
			</Dialog>

			{/* Vale de adeudo (2 copias: cliente + negocio) */}
			{voucherFor && (
				<DebtVoucherModal
					customerId={voucherFor.customerId}
					customerName={voucherFor.name}
					open={!!voucherFor}
					onClose={() => setVoucherFor(null)}
				/>
			)}

			{/* Recibo de abono (2 copias: cliente + negocio) */}
			{receiptFor && (
				<PaymentReceiptModal
					customerId={receiptFor.customerId}
					customerName={receiptFor.name}
					paymentId={receiptFor.paymentId}
					open={!!receiptFor}
					onClose={() => setReceiptFor(null)}
				/>
			)}

			{/* Dialog: corregir movimiento (cargo / abono) */}
			<Dialog open={!!editMov} onOpenChange={(o) => !o && setEditMov(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							Corregir {editMov?.kind === "abono" ? "abono" : "cargo"}
						</DialogTitle>
					</DialogHeader>
					{editMov && (
						<div className="grid gap-4 py-2">
							<div className="space-y-1">
								<Label>Monto</Label>
								<Input
									type="number"
									value={editMov.amount}
									onChange={(e) =>
										setEditMov({ ...editMov, amount: e.target.value })
									}
									placeholder="0.00"
								/>
							</div>
							<div className="space-y-1">
								<Label>
									{editMov.kind === "abono" ? "Método (opcional)" : "Concepto"}
								</Label>
								<Input
									value={editMov.concept}
									onChange={(e) =>
										setEditMov({ ...editMov, concept: e.target.value })
									}
									placeholder={
										editMov.kind === "abono"
											? "Efectivo, transferencia…"
											: "Ej. Nota 1234"
									}
								/>
							</div>
							<div className="space-y-1">
								<Label>Fecha</Label>
								<Input
									type="date"
									value={editMov.date}
									onChange={(e) =>
										setEditMov({ ...editMov, date: e.target.value })
									}
								/>
							</div>
						</div>
					)}
					<DialogFooter>
						<Button variant="secondary" onClick={() => setEditMov(null)}>
							Cancelar
						</Button>
						<Button
							disabled={
								updateChargeMut.isPending || updatePaymentMut.isPending
							}
							onClick={saveEditMovement}
						>
							Guardar cambios
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
