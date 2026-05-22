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
import { PrinterIcon } from "lucide-react";
import { useLocale } from "next-intl";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@finopenpos/ui/components/skeleton";

interface TicketModalProps {
	orderId: number;
	open: boolean;
	onClose: () => void;
}

export function TicketModal({ orderId, open, onClose }: TicketModalProps) {
	const trpc = useTRPC();
	const locale = useLocale();
	const ticketRef = useRef<HTMLDivElement>(null);

	const { data: ticket, isLoading } = useQuery({
		...trpc.tickets.generateTicket.queryOptions({ orderId }),
		enabled: open,
	});

	// Imprime abriendo una ventana nueva con SOLO el ticket (sin URL/headers)
	const handlePrint = () => {
		if (!ticketRef.current) return;

		const printWin = window.open("", "_blank", "width=350,height=700");
		if (!printWin) return;

		const html = ticketRef.current.innerHTML;

		printWin.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Ticket #${ticket?.ticketNumber ?? ""}</title>
<style>
@page {
  margin: 0;
  size: 80mm auto;
}
html, body {
  margin: 0;
  padding: 0;
  background: white;
  color: black;
}
body {
  font-family: 'Courier New', Courier, monospace;
  font-size: 11px;
  line-height: 1.4;
  padding: 6mm;
  width: 80mm;
  box-sizing: border-box;
}
.ticket-header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
.ticket-header h1 { font-size: 14px; letter-spacing: 2px; margin: 0; }
.ticket-header p { font-size: 10px; color: #555; margin: 2px 0 0; }
.ticket-info { margin-bottom: 6px; }
.ticket-row { display: flex; justify-content: space-between; gap: 4px; }
.ticket-row .label { color: #555; }
.ticket-row .value { font-weight: bold; }
.ticket-items { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 6px 0; margin: 6px 0; }
.ticket-items-header { display: flex; justify-content: space-between; font-size: 9px; color: #555; margin-bottom: 4px; }
.item-line { display: flex; justify-content: space-between; gap: 4px; margin-bottom: 2px; }
.item-line .name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-line .price { font-weight: 600; white-space: nowrap; }
.item-detail { font-size: 9px; color: #555; padding-left: 8px; margin-bottom: 2px; }
.ticket-total { display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; padding-top: 4px; }
.ticket-status { display: flex; justify-content: space-between; font-size: 9px; color: #555; }
.ticket-notes { border-top: 1px dashed #000; padding-top: 6px; margin-top: 6px; font-size: 9px; color: #555; }
.ticket-notes strong { font-weight: 600; }
.ticket-footer { text-align: center; font-size: 9px; color: #555; margin-top: 8px; padding-top: 6px; border-top: 1px dashed #000; }
</style>
</head>
<body>${html}</body>
</html>`);

		printWin.document.close();

		// Esperar a que cargue y luego imprimir
		printWin.onload = () => {
			setTimeout(() => {
				printWin.print();
				printWin.close();
			}, 200);
		};
	};

	// Renderiza el contenido del ticket (se usa tanto en modal como para imprimir)
	const renderTicketContent = () => {
		if (!ticket) return null;

		const statusLabel =
			ticket.status === "completed" || ticket.status === "COMPLETADA"
				? "Completado"
				: ticket.status === "cancelled"
					? "Cancelado"
					: ticket.status === "LISTA_PARA_COBRO"
						? "Listo para cobro"
						: "Pendiente";

		return (
			<>
				<div className="ticket-header">
					<h1>CARNICOS GUSTAVO</h1>
					<p>Nota de Pedido</p>
				</div>

				<div className="ticket-info">
					<div className="ticket-row">
						<span className="value">{ticket.ticketNumber}</span>
						<span>
							{new Date(ticket.date).toLocaleDateString("es-MX", {
								day: "2-digit",
								month: "2-digit",
								year: "2-digit",
							})}{" "}
							{new Date(ticket.date).toLocaleTimeString("es-MX", {
								hour: "2-digit",
								minute: "2-digit",
							})}
						</span>
					</div>
					<div className="ticket-row">
						<span className="label">Cliente</span>
						<span className="value">
							{ticket.customerName ?? "Consumidor Final"}
						</span>
					</div>
				</div>

				<div className="ticket-items">
					<div className="ticket-items-header">
						<span>PRODUCTO</span>
						<span>IMPORTE</span>
					</div>
					{ticket.items.map((item, i) => {
						const hasKg =
							item.quantityKg && parseFloat(item.quantityKg) > 0;
						const subtotal = parseFloat(item.subtotal) || 0;
						return (
							<div key={i}>
								<div className="item-line">
									<span className="name">
										{item.quantityPieces ?? 1}x {item.productName}
									</span>
									<span className="price">
										{subtotal > 0
											? formatCurrency(
													Math.round(subtotal * 100),
													locale,
												)
											: "—"}
									</span>
								</div>
								{hasKg && (
									<div className="item-detail">
										{parseFloat(item.quantityKg!).toFixed(3)} kg
										{item.unitPrice !== "0" && (
											<>
												{" "}@{" "}
												{formatCurrency(
													Math.round(parseFloat(item.unitPrice) * 100),
													locale,
												)}
												/kg
											</>
										)}
									</div>
								)}
							</div>
						);
					})}
				</div>

				<div className="ticket-total">
					<span>TOTAL</span>
					<span>
						{formatCurrency(
							Math.round(parseFloat(ticket.totalAmount) * 100),
							locale,
						)}
					</span>
				</div>

				<div className="ticket-status">
					<span>Estado</span>
					<span>{statusLabel}</span>
				</div>

				{ticket.notes && (
					<div className="ticket-notes">
						<strong>Notas: </strong>
						{ticket.notes}
					</div>
				)}

				<div className="ticket-footer">
					&iexcl;Gracias por su preferencia!
				</div>
			</>
		);
	};

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<PrinterIcon className="w-4 h-4" />
						Ticket de Pedido
					</DialogTitle>
				</DialogHeader>

				{isLoading ? (
					<div className="space-y-2">
						{Array.from({ length: 6 }).map((_, i) => (
							<Skeleton key={i} className="h-4 w-full" />
						))}
					</div>
				) : ticket ? (
					<div
						ref={ticketRef}
						className="font-mono text-xs border rounded-lg p-4 bg-white"
						style={{
							fontFamily: "'Courier New', Courier, monospace",
							fontSize: "11px",
							lineHeight: "1.4",
							color: "#000",
						}}
					>
						{renderTicketContent()}
					</div>
				) : (
					<p className="text-muted-foreground text-sm">
						No se pudo cargar el ticket.
					</p>
				)}

				<div className="flex justify-end gap-2 pt-2">
					<Button variant="secondary" onClick={onClose}>
						Cerrar
					</Button>
					<Button onClick={handlePrint} disabled={!ticket}>
						<PrinterIcon className="w-4 h-4 mr-2" />
						Imprimir
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
