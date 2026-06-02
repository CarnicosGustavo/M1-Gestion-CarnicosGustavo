"use client";

import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@finopenpos/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@finopenpos/ui/components/dialog";
import { PrinterIcon, FileTextIcon } from "lucide-react";
import { Skeleton } from "@finopenpos/ui/components/skeleton";

interface DebtVoucherModalProps {
	customerId: number;
	customerName: string | null;
	open: boolean;
	onClose: () => void;
}

const money = (n: number) =>
	n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

/**
 * Vale / Comprobante de adeudo firmado.
 * Imprime DOS copias (cliente + negocio) en la impresora de punto Canon:
 * monospace, todo en negro, papel angosto. El cliente firma de conformidad
 * y se lleva su copia; la del negocio queda para archivo documental.
 */
export function DebtVoucherModal({
	customerId,
	customerName,
	open,
	onClose,
}: DebtVoucherModalProps) {
	const trpc = useTRPC();
	const voucherRef = useRef<HTMLDivElement>(null);

	const { data: statement, isLoading } = useQuery({
		...trpc.collections.getStatement.queryOptions({ customerId }),
		enabled: open,
	});

	const folio = `V-${customerId}-${new Date()
		.toISOString()
		.slice(2, 16)
		.replace(/[-:T]/g, "")}`;
	const fecha = new Date();

	const handlePrint = () => {
		if (!voucherRef.current) return;
		const printWin = window.open("", "_blank", "width=360,height=760");
		if (!printWin) return;

		// Dos copias en el mismo trabajo de impresión
		const oneCopy = voucherRef.current.innerHTML;
		const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Vale de adeudo ${folio}</title>
<style>
@page { margin: 4mm 4mm 4mm 9mm; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; }
* { color: #000 !important; }
body {
  font-family: 'Courier New', Courier, monospace;
  font-size: 12px;
  line-height: 1.5;
  padding: 0 2mm 2mm 4mm;
  width: auto;
  box-sizing: border-box;
  font-weight: bold;
}
.v-header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
.v-header h1 { font-size: 16px; letter-spacing: 1px; margin: 0; }
.v-header p { font-size: 12px; margin: 2px 0 0; }
.v-row { display: flex; justify-content: space-between; gap: 4px; }
.v-meta { font-size: 11px; margin-bottom: 6px; }
.v-items { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 6px 0; margin: 6px 0; font-size: 11px; }
.v-item { display: flex; justify-content: space-between; gap: 6px; margin-bottom: 2px; }
.v-item .c { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.v-balance { display: flex; justify-content: space-between; font-size: 15px; padding-top: 4px; }
.v-legal { font-size: 10px; margin: 8px 0 14px; line-height: 1.4; }
.v-sign { margin-top: 18px; font-size: 11px; }
.v-sign .line { border-top: 1px solid #000; margin-top: 22px; padding-top: 2px; text-align: center; }
.v-copy { text-align: center; font-size: 11px; margin-top: 8px; padding-top: 4px; border-top: 1px dashed #000; }
.cut { text-align: center; font-size: 10px; margin: 10px 0; letter-spacing: 2px; }
</style>
</head>
<body>
${oneCopy.replace("__COPY_LABEL__", "COPIA CLIENTE")}
<div class="cut">— — — — — ✂ — — — — —</div>
${oneCopy.replace("__COPY_LABEL__", "COPIA NEGOCIO / ARCHIVO")}
</body>
</html>`;

		printWin.document.write(html);
		printWin.document.close();
		printWin.onload = () => {
			setTimeout(() => {
				printWin.print();
				printWin.close();
			}, 200);
		};
	};

	const renderVoucher = () => {
		if (!statement) return null;
		const cargos = statement.ledger.filter((l) => l.cargo > 0);
		return (
			<>
				<div className="v-header">
					<h1>CARNICOS GUSTAVO</h1>
					<p>VALE DE ADEUDO</p>
				</div>
				<div className="v-meta">
					<div className="v-row">
						<span>{folio}</span>
						<span>
							{fecha.toLocaleDateString("es-MX", {
								day: "2-digit",
								month: "2-digit",
								year: "2-digit",
							})}{" "}
							{fecha.toLocaleTimeString("es-MX", {
								hour: "2-digit",
								minute: "2-digit",
							})}
						</span>
					</div>
					<div className="v-row">
						<span>Cliente:</span>
						<span>{customerName ?? `Cliente #${customerId}`}</span>
					</div>
				</div>

				<div className="v-items">
					{cargos.length === 0 ? (
						<div>Sin cargos registrados</div>
					) : (
						cargos.map((l, i) => (
							<div key={i} className="v-item">
								<span className="c">
									{l.fecha ? `${String(l.fecha).slice(5, 10)} ` : ""}
									{l.concepto}
								</span>
								<span>{money(l.cargo)}</span>
							</div>
						))
					)}
					{statement.totalAbonos > 0 && (
						<div className="v-item" style={{ marginTop: 4 }}>
							<span className="c">(–) Abonos</span>
							<span>{money(statement.totalAbonos)}</span>
						</div>
					)}
				</div>

				<div className="v-balance">
					<span>SALDO ADEUDADO</span>
					<span>{money(statement.balance)}</span>
				</div>

				<div className="v-legal">
					Reconozco y acepto el adeudo aquí indicado por la cantidad de{" "}
					{money(statement.balance)} y me comprometo a liquidarlo.
				</div>

				<div className="v-sign">
					<div className="line">Firma del cliente</div>
					<div className="line">Nombre y fecha</div>
				</div>

				<div className="v-copy">__COPY_LABEL__</div>
			</>
		);
	};

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<FileTextIcon className="w-4 h-4" />
						Vale de adeudo
					</DialogTitle>
				</DialogHeader>

				{isLoading ? (
					<div className="space-y-2">
						{Array.from({ length: 6 }).map((_, i) => (
							<Skeleton key={i} className="h-4 w-full" />
						))}
					</div>
				) : statement ? (
					<div
						ref={voucherRef}
						className="font-mono text-xs border rounded-lg p-4 bg-white"
						style={{
							fontFamily: "'Courier New', Courier, monospace",
							fontSize: "11px",
							lineHeight: "1.4",
							color: "#000",
						}}
					>
						{renderVoucher()}
					</div>
				) : (
					<p className="text-muted-foreground text-sm">
						No se pudo cargar la cuenta.
					</p>
				)}

				<p className="text-[11px] text-muted-foreground">
					Se imprimen 2 copias: una para el cliente (firmada) y otra para
					archivo del negocio.
				</p>

				<div className="flex justify-end gap-2 pt-2">
					<Button variant="secondary" onClick={onClose}>
						Cerrar
					</Button>
					<Button onClick={handlePrint} disabled={!statement}>
						<PrinterIcon className="w-4 h-4 mr-2" />
						Imprimir 2 copias
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
