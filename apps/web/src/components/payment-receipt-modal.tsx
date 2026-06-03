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
import { PrinterIcon, ReceiptIcon } from "lucide-react";
import { Skeleton } from "@finopenpos/ui/components/skeleton";

interface PaymentReceiptModalProps {
	customerId: number;
	customerName: string | null;
	paymentId: number;
	open: boolean;
	onClose: () => void;
}

const money = (n: number) =>
	n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

/**
 * Recibo de abono. Comprobante del pago que un cliente hace a su deuda.
 * Muestra saldo anterior, abono y nuevo saldo. Imprime DOS copias (cliente +
 * negocio) en la impresora de punto. Re-imprimible: se reconstruye desde el
 * estado de cuenta calculando el saldo corrido hasta ese abono.
 */
export function PaymentReceiptModal({
	customerId,
	customerName,
	paymentId,
	open,
	onClose,
}: PaymentReceiptModalProps) {
	const trpc = useTRPC();
	const receiptRef = useRef<HTMLDivElement>(null);

	const { data: statement, isLoading } = useQuery({
		...trpc.collections.getStatement.queryOptions({ customerId }),
		enabled: open,
	});

	// Reconstruye el abono y el saldo corrido a ese punto del ledger
	const computed = (() => {
		if (!statement) return null;
		const idx = statement.ledger.findIndex(
			(l) => l.tipo === "abono" && l.id === paymentId,
		);
		if (idx < 0) return null;
		let saldoAntes = 0;
		for (let i = 0; i < idx; i++) {
			saldoAntes += statement.ledger[i].cargo - statement.ledger[i].abono;
		}
		const entry = statement.ledger[idx];
		return {
			entry,
			abono: entry.abono,
			saldoAntes,
			saldoNuevo: saldoAntes - entry.abono,
			saldoActual: statement.balance,
		};
	})();

	const folio = `R-${paymentId}`;
	const fecha = computed?.entry.fecha
		? new Date(String(computed.entry.fecha))
		: new Date();

	const handlePrint = () => {
		if (!receiptRef.current) return;
		const printWin = window.open("", "_blank", "width=360,height=760");
		if (!printWin) return;
		// 1 copia: la impresora de punto entrega original + copia (autocopiante)
		const oneCopy = receiptRef.current.innerHTML.replace(
			"__COPY_LABEL__",
			"Original: cliente  ·  Copia: archivo",
		);
		const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Recibo de abono ${folio}</title>
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
.r-header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
.r-header h1 { font-size: 16px; letter-spacing: 1px; margin: 0; }
.r-header p { font-size: 12px; margin: 2px 0 0; }
.r-row { display: flex; justify-content: space-between; gap: 4px; }
.r-meta { font-size: 11px; margin-bottom: 6px; }
.r-box { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 6px 0; margin: 6px 0; }
.r-line { display: flex; justify-content: space-between; gap: 6px; margin-bottom: 2px; font-size: 12px; }
.r-abono { display: flex; justify-content: space-between; font-size: 16px; padding: 4px 0; }
.r-legal { font-size: 10px; margin: 8px 0 14px; line-height: 1.4; }
.r-sign { margin-top: 16px; font-size: 11px; }
.r-sign .line { border-top: 1px solid #000; margin-top: 22px; padding-top: 2px; text-align: center; }
.r-copy { text-align: center; font-size: 11px; margin-top: 8px; padding-top: 4px; border-top: 1px dashed #000; }
</style>
</head>
<body>${oneCopy}</body>
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

	const renderReceipt = () => {
		if (!computed) return null;
		return (
			<>
				<div className="r-header">
					<h1>CARNICOS GUSTAVO</h1>
					<p>RECIBO DE ABONO</p>
				</div>
				<div className="r-meta">
					<div className="r-row">
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
					<div className="r-row">
						<span>Cliente:</span>
						<span>{customerName ?? `Cliente #${customerId}`}</span>
					</div>
					<div className="r-row">
						<span>Concepto:</span>
						<span>{computed.entry.concepto}</span>
					</div>
				</div>

				<div className="r-abono">
					<span>ABONO RECIBIDO</span>
					<span>{money(computed.abono)}</span>
				</div>

				<div className="r-box">
					<div className="r-line">
						<span>Saldo anterior</span>
						<span>{money(computed.saldoAntes)}</span>
					</div>
					<div className="r-line">
						<span>(–) Abono</span>
						<span>{money(computed.abono)}</span>
					</div>
					<div className="r-line" style={{ fontWeight: "bold" }}>
						<span>Saldo después</span>
						<span>{money(computed.saldoNuevo)}</span>
					</div>
				</div>

				<div className="r-line">
					<span>Saldo actual del cliente</span>
					<span>{money(computed.saldoActual)}</span>
				</div>

				<div className="r-legal">
					Recibo del abono arriba indicado a cuenta del adeudo del cliente.
				</div>

				<div className="r-sign">
					<div className="line">Recibió (negocio)</div>
					<div className="line">Firma del cliente</div>
				</div>

				<div className="r-copy">__COPY_LABEL__</div>
			</>
		);
	};

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<ReceiptIcon className="w-4 h-4" />
						Recibo de abono
					</DialogTitle>
				</DialogHeader>

				{isLoading ? (
					<div className="space-y-2">
						{Array.from({ length: 6 }).map((_, i) => (
							<Skeleton key={i} className="h-4 w-full" />
						))}
					</div>
				) : computed ? (
					<div
						ref={receiptRef}
						className="font-mono text-xs border rounded-lg p-4 bg-white"
						style={{
							fontFamily: "'Courier New', Courier, monospace",
							fontSize: "11px",
							lineHeight: "1.4",
							color: "#000",
						}}
					>
						{renderReceipt()}
					</div>
				) : (
					<p className="text-muted-foreground text-sm">
						No se encontró el abono.
					</p>
				)}

				<p className="text-[11px] text-muted-foreground">
					Se imprime 1 vez; la impresora de punto entrega original (cliente) y
					copia (archivo).
				</p>

				<div className="flex justify-end gap-2 pt-2">
					<Button variant="secondary" onClick={onClose}>
						Cerrar
					</Button>
					<Button onClick={handlePrint} disabled={!computed}>
						<PrinterIcon className="w-4 h-4 mr-2" />
						Imprimir 2 copias
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
