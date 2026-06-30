"use client";

import { Badge } from "@finopenpos/ui/components/badge";
import { Button } from "@finopenpos/ui/components/button";
import { Card, CardContent } from "@finopenpos/ui/components/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@finopenpos/ui/components/dialog";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import {
	ArrowLeftIcon,
	CheckCircle2Icon,
	CheckIcon,
	ClockIcon,
	FileXIcon,
	PartyPopperIcon,
	SearchIcon,
	ShieldCheckIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useCrudMutation } from "@/hooks/use-crud-mutation";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/router";
import { formatCurrency } from "@/lib/utils";

type Cliente = RouterOutputs["validacion"]["list"][number];
type Filtro = "Pendiente" | "Validado" | "Todos";

const docBadge: Record<
	string,
	"destructive" | "secondary" | "outline" | "income"
> = {
	Vencido: "destructive",
	Parcial: "secondary",
	Aplicado: "outline",
	Pagado: "income",
	Pendiente: "secondary",
};

export default function ValidacionSaldosPage() {
	const trpc = useTRPC();
	const { data: clientes = [], isLoading } = useQuery(
		trpc.validacion.list.queryOptions(),
	);
	const invalidateKeys = trpc.validacion.list.queryOptions().queryKey;

	const validateMutation = useCrudMutation({
		mutationOptions: trpc.validacion.validate.mutationOptions(),
		invalidateKeys,
		successMessage: "Saldo validado y agregado a crédito",
		errorMessage: "No se pudo validar el saldo",
		onSuccess: () => setConfirm(null),
	});

	const [view, setView] = useState<"list" | "detail">("list");
	const [selId, setSelId] = useState<string | null>(null);
	const [confirm, setConfirm] = useState<Cliente | null>(null);
	const [filtro, setFiltro] = useState<Filtro>("Pendiente");
	const [q, setQ] = useState("");

	const sel = clientes.find((c) => c.id === selId) ?? null;

	const pend = clientes.filter((c) => !c.validado && c.saldo > 0);
	const val = clientes.filter((c) => c.validado);
	const totalPend = pend.reduce((s, c) => s + c.saldo, 0);
	const totalProm = val.reduce((s, c) => s + c.saldo, 0);

	const visible = useMemo(() => {
		return clientes
			.filter((c) =>
				filtro === "Todos"
					? true
					: filtro === "Pendiente"
						? !c.validado && c.saldo > 0
						: c.validado,
			)
			.filter((c) => c.nombre.toLowerCase().includes(q.trim().toLowerCase()))
			.sort((a, b) => b.saldo - a.saldo);
	}, [clientes, filtro, q]);

	const openDetail = (c: Cliente) => {
		setSelId(c.id);
		setView("detail");
		if (typeof window !== "undefined") window.scrollTo(0, 0);
	};

	const doValidate = (c: Cliente) =>
		validateMutation.mutate({ customerId: c.customerId });

	// ---------- Detalle ----------
	if (view === "detail" && sel) {
		const cli = sel;
		return (
			<div className="mx-auto w-full max-w-5xl">
				<button
					type="button"
					onClick={() => setView("list")}
					className="mb-4 inline-flex items-center gap-2 font-medium text-muted-foreground text-sm hover:text-foreground"
				>
					<ArrowLeftIcon className="h-4 w-4" /> Bandeja de validación
				</button>

				<Card className="mb-4">
					<CardContent className="flex flex-wrap items-start justify-between gap-4 pt-6">
						<div>
							<div className="mb-1 flex items-center gap-3">
								<h2 className="font-semibold text-2xl tracking-tight">
									{cli.nombre}
								</h2>
								<Badge variant={cli.validado ? "income" : "secondary"}>
									{cli.validado ? "Validado" : "Pendiente"}
								</Badge>
							</div>
							<div className="font-mono text-muted-foreground text-xs">
								Referencia legacy · MBPOS:{cli.id}
							</div>
							<div className="mt-4 flex gap-8">
								<div>
									<div className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wide">
										Límite de crédito
									</div>
									<div className="mt-1 font-mono text-sm">
										{formatCurrency(cli.limite)}
									</div>
								</div>
								<div>
									<div className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wide">
										Plazo
									</div>
									<div className="mt-1 font-mono text-sm">{cli.dias} días</div>
								</div>
								<div>
									<div className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wide">
										Documentos
									</div>
									<div className="mt-1 font-mono text-sm">{cli.ndoc}</div>
								</div>
							</div>
						</div>
						<div className="text-right">
							<div className="mb-2 font-semibold text-[11px] text-muted-foreground uppercase tracking-wide">
								{cli.validado ? "Saldo en crédito" : "Saldo anterior total"}
							</div>
							<div
								className={`font-mono font-semibold text-4xl tabular-nums ${
									cli.validado ? "text-green-600" : "text-red-600"
								}`}
							>
								{formatCurrency(cli.saldo)}
							</div>
							{cli.validado && cli.validadoPor && (
								<div className="mt-2 text-green-600 text-xs">
									Validado por {cli.validadoPor}
									{cli.validadoAt ? ` · ${cli.validadoAt}` : ""}
								</div>
							)}
						</div>
					</CardContent>
				</Card>

				{cli.docs.length === 0 ? (
					<Card>
						<CardContent className="flex flex-col items-center py-10 text-center">
							<FileXIcon className="h-8 w-8 text-muted-foreground" />
							<div className="mt-3 text-muted-foreground text-sm">
								Sin documentos para este cliente
							</div>
						</CardContent>
					</Card>
				) : (
					<Card>
						<div className="border-b px-5 py-4 font-bold text-muted-foreground text-xs uppercase tracking-wider">
							Documentos del sistema anterior
						</div>
						<div className="overflow-x-auto">
							<table className="w-full border-collapse text-sm">
								<thead>
									<tr className="bg-muted/50 text-left text-[11px] text-muted-foreground uppercase">
										<th className="px-4 py-3">Fecha</th>
										<th className="px-4 py-3">Vence</th>
										<th className="px-4 py-3">Tipo</th>
										<th className="px-4 py-3">Referencia</th>
										<th className="px-4 py-3 text-right">Importe</th>
										<th className="px-4 py-3 text-right">Saldo</th>
										<th className="px-4 py-3">Estado</th>
										<th className="px-4 py-3">Observación</th>
									</tr>
								</thead>
								<tbody>
									{cli.docs.map((d, i) => (
										<tr key={i} className="border-t">
											<td className="px-4 py-3 font-mono text-xs">
												{d.fecha ?? "—"}
											</td>
											<td className="px-4 py-3 font-mono text-xs">
												{d.venc ?? "—"}
											</td>
											<td className="px-4 py-3 font-bold text-muted-foreground text-xs">
												{d.tipo ?? "—"}
											</td>
											<td className="px-4 py-3 font-mono text-xs">
												{d.ref ?? "—"}
											</td>
											<td className="px-4 py-3 text-right font-mono">
												{formatCurrency(d.importe)}
											</td>
											<td
												className={`px-4 py-3 text-right font-mono font-semibold ${
													d.saldo > 0 ? "text-red-600" : "text-muted-foreground"
												}`}
											>
												{formatCurrency(d.saldo)}
											</td>
											<td className="px-4 py-3">
												<Badge variant={docBadge[d.estado] ?? "outline"}>
													{d.estado}
												</Badge>
											</td>
											<td className="max-w-[200px] px-4 py-3 text-muted-foreground text-xs">
												{d.obs || "—"}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</Card>
				)}

				{!cli.validado && cli.saldo > 0 && (
					<div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-5">
						<div className="max-w-md text-muted-foreground text-sm">
							Al validar, se crea la cuenta de crédito de <b>{cli.nombre}</b> y
							se registra el saldo inicial de{" "}
							<b className="text-red-600">{formatCurrency(cli.saldo)}</b>.
						</div>
						<Button
							onClick={() => setConfirm(cli)}
							disabled={validateMutation.isPending}
							className="bg-green-600 hover:bg-green-700"
						>
							<ShieldCheckIcon className="mr-2 h-4 w-4" />
							Validar y pasar al sistema principal
						</Button>
					</div>
				)}

				<ConfirmDialog
					confirm={confirm}
					onClose={() => setConfirm(null)}
					onConfirm={doValidate}
					pending={validateMutation.isPending}
				/>
			</div>
		);
	}

	// ---------- Bandeja ----------
	return (
		<div className="mx-auto w-full max-w-6xl">
			<div className="mb-1 font-semibold text-2xl tracking-tight">
				Validación de saldos — sistema anterior
			</div>
			<p className="mb-5 text-muted-foreground text-sm">
				Revisa y aprueba los saldos heredados de MyBusinessPOS antes de pasarlos
				a crédito.
			</p>

			<div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
				<Card>
					<CardContent className="pt-6">
						<div className="mb-2 flex items-center justify-between">
							<span className="font-semibold text-[11px] text-amber-600 uppercase tracking-wide">
								Por validar
							</span>
							<ClockIcon className="h-4 w-4 text-amber-600" />
						</div>
						<div className="font-mono font-semibold text-3xl tabular-nums">
							{formatCurrency(totalPend)}
						</div>
						<div className="mt-2 font-medium text-amber-600 text-xs">
							{pend.length} clientes pendientes
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<div className="mb-2 flex items-center justify-between">
							<span className="font-semibold text-[11px] text-green-600 uppercase tracking-wide">
								Promovido a crédito
							</span>
							<CheckCircle2Icon className="h-4 w-4 text-green-600" />
						</div>
						<div className="font-mono font-semibold text-3xl tabular-nums">
							{formatCurrency(totalProm)}
						</div>
						<div className="mt-2 font-medium text-green-600 text-xs">
							{val.length} clientes validados
						</div>
					</CardContent>
				</Card>
			</div>

			<div className="mb-4 flex flex-wrap items-center gap-3">
				<div className="flex flex-1 items-center gap-2 rounded-lg border bg-background px-3 py-2">
					<SearchIcon className="h-4 w-4 text-muted-foreground" />
					<input
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder="Buscar cliente…"
						className="flex-1 bg-transparent text-sm outline-none"
					/>
				</div>
				<div className="flex gap-2">
					{(["Pendiente", "Validado", "Todos"] as Filtro[]).map((f) => (
						<Button
							key={f}
							size="sm"
							variant={filtro === f ? "default" : "outline"}
							onClick={() => setFiltro(f)}
						>
							{f}
						</Button>
					))}
				</div>
			</div>

			{isLoading ? (
				<div className="space-y-2">
					{[0, 1, 2, 3, 4].map((i) => (
						<Skeleton key={i} className="h-12 w-full" />
					))}
				</div>
			) : visible.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center py-12 text-center">
						<PartyPopperIcon className="h-10 w-10 text-green-600" />
						<div className="mt-3 font-medium text-lg">
							No quedan saldos pendientes por validar
						</div>
						<div className="mt-1 text-muted-foreground text-sm">
							Todos los clientes de esta vista están al día.
						</div>
					</CardContent>
				</Card>
			) : (
				<Card>
					<div className="overflow-x-auto">
						<table className="w-full border-collapse text-sm">
							<thead>
								<tr className="bg-muted/50 text-left text-[11px] text-muted-foreground uppercase">
									<th className="px-4 py-3">Cliente</th>
									<th className="px-4 py-3 text-right">Saldo anterior</th>
									<th className="px-4 py-3 text-center">Docs</th>
									<th className="px-4 py-3 text-right">Límite</th>
									<th className="px-4 py-3 text-center">Días</th>
									<th className="px-4 py-3">Estado</th>
									<th className="px-4 py-3 text-right">Acción</th>
								</tr>
							</thead>
							<tbody>
								{visible.map((c) => (
									<tr
										key={c.id}
										className="cursor-pointer border-t hover:bg-muted/40"
										onClick={() => openDetail(c)}
									>
										<td className="px-4 py-3">
											<div className="font-semibold">{c.nombre}</div>
											<div className="font-mono text-[11px] text-muted-foreground">
												MBPOS:{c.id}
											</div>
										</td>
										<td
											className={`px-4 py-3 text-right font-mono font-semibold ${
												c.saldo > 0 ? "text-red-600" : "text-muted-foreground"
											}`}
										>
											{formatCurrency(c.saldo)}
										</td>
										<td className="px-4 py-3 text-center font-mono">
											{c.ndoc}
										</td>
										<td className="px-4 py-3 text-right font-mono">
											{formatCurrency(c.limite)}
										</td>
										<td className="px-4 py-3 text-center font-mono">
											{c.dias}
										</td>
										<td className="px-4 py-3">
											{c.saldo === 0 ? (
												<Badge variant="outline">Sin saldo</Badge>
											) : c.validado ? (
												<Badge variant="income">Validado</Badge>
											) : (
												<Badge variant="secondary">Pendiente</Badge>
											)}
										</td>
										<td
											className="px-4 py-3 text-right"
											onClick={(e) => e.stopPropagation()}
										>
											{c.validado ? (
												<span className="inline-flex items-center gap-1 font-semibold text-green-600 text-xs">
													<CheckIcon className="h-4 w-4" /> Validado
												</span>
											) : c.saldo > 0 ? (
												<Button
													size="sm"
													className="bg-green-600 hover:bg-green-700"
													onClick={() => setConfirm(c)}
												>
													<CheckIcon className="mr-1 h-3.5 w-3.5" /> Validar
												</Button>
											) : (
												<span className="text-muted-foreground text-xs">—</span>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</Card>
			)}

			<ConfirmDialog
				confirm={confirm}
				onClose={() => setConfirm(null)}
				onConfirm={doValidate}
				pending={validateMutation.isPending}
			/>
		</div>
	);
}

function ConfirmDialog({
	confirm,
	onClose,
	onConfirm,
	pending,
}: {
	confirm: Cliente | null;
	onClose: () => void;
	onConfirm: (c: Cliente) => void;
	pending: boolean;
}) {
	return (
		<Dialog open={!!confirm} onOpenChange={(o) => !o && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Confirmar validación</DialogTitle>
					<DialogDescription>
						Vas a pasar el saldo de <b>{confirm?.nombre}</b> al sistema de
						crédito. Esta acción crea su cuenta y registra el saldo inicial.
					</DialogDescription>
				</DialogHeader>
				{confirm && (
					<div className="flex items-center justify-between rounded-lg border bg-muted/40 p-4">
						<div>
							<div className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wide">
								Saldo a promover
							</div>
							<div className="mt-1 font-mono text-[11px] text-muted-foreground">
								MBPOS:{confirm.id} · {confirm.ndoc} documentos
							</div>
						</div>
						<div className="font-bold font-mono text-red-600 text-xl">
							{formatCurrency(confirm.saldo)}
						</div>
					</div>
				)}
				<DialogFooter>
					<Button variant="outline" onClick={onClose} disabled={pending}>
						Cancelar
					</Button>
					<Button
						className="bg-green-600 hover:bg-green-700"
						disabled={pending}
						onClick={() => confirm && onConfirm(confirm)}
					>
						<CheckIcon className="mr-2 h-4 w-4" />
						Confirmar y pasar a crédito
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
