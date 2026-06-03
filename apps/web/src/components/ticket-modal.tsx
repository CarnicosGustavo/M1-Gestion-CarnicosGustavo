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
import { Skeleton } from "@finopenpos/ui/components/skeleton";

interface TicketModalProps {
	orderId: number;
	open: boolean;
	onClose: () => void;
}

// Datos del negocio (encabezado del recibo). Ajustables luego desde Ajustes.
const BUSINESS = {
	name: "CENTRO DE DIST. DE CÁRNICOS",
	address: "FFCC. ACAMBARO #16 NAUCALPAN",
	owner: "GUSTAVO CASTRO - CEL. 55-4328-7020",
};

const money = (pesos: number) =>
	pesos.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export function TicketModal({ orderId, open, onClose }: TicketModalProps) {
	const trpc = useTRPC();
	const ticketRef = useRef<HTMLDivElement>(null);

	const { data: ticket, isLoading } = useQuery({
		...trpc.tickets.generateTicket.queryOptions({ orderId }),
		enabled: open,
	});

	// Cantidad mostrada de un renglón: kg (2 decimales como en el ticket) o piezas
	const lineQty = (it: NonNullable<typeof ticket>["items"][number]) => {
		const kg = it.quantityKg ? parseFloat(it.quantityKg) : 0;
		if (kg > 0)
			return kg.toLocaleString("es-MX", {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			});
		return String(it.quantityPieces ?? 1);
	};

	// Arma un ticket en texto y lo abre en WhatsApp hacia el teléfono del cliente
	const handleWhatsApp = () => {
		if (!ticket) return;
		const lines: string[] = [];
		lines.push(`*${BUSINESS.name}*`);
		lines.push(
			`Ticket *${ticket.ticketNumber}* · Pedido #${ticket.orderNumber}`,
		);
		lines.push(`Cliente: ${ticket.customerName ?? "Consumidor Final"}`);
		lines.push("------------------------------");
		for (const it of ticket.items) {
			const sub = parseFloat(it.subtotal) / 100 || 0;
			lines.push(`${it.productName} — ${lineQty(it)} — ${money(sub)}`);
		}
		lines.push("------------------------------");
		lines.push(
			`Total de kilos: ${ticket.totalKg.toLocaleString("es-MX", {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			})}`,
		);
		lines.push(`*TOTAL: ${money(parseFloat(ticket.totalAmount) / 100 || 0)}*`);
		if (ticket.amountDue > 0)
			lines.push(`POR COBRAR: ${money(ticket.amountDue)}`);
		lines.push("¡Gracias por su preferencia!");

		const phone = (ticket.customerPhone ?? "").replace(/[^\d]/g, "");
		const text = encodeURIComponent(lines.join("\n"));
		const url = phone
			? `https://wa.me/52${phone.replace(/^52/, "")}?text=${text}`
			: `https://wa.me/?text=${text}`;
		window.open(url, "_blank", "noopener,noreferrer");
	};

	// Imprime abriendo una ventana nueva con SOLO el ticket (1 copia: la
	// impresora de punto ya entrega original + copia en papel autocopiante).
	const handlePrint = () => {
		if (!ticketRef.current) return;
		const printWin = window.open("", "_blank", "width=360,height=760");
		if (!printWin) return;
		const html = ticketRef.current.innerHTML;

		printWin.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Ticket ${ticket?.ticketNumber ?? ""}</title>
<style>
@page { margin: 4mm 4mm 4mm 9mm; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; }
* { color: #000 !important; }
body {
  font-family: 'Courier New', Courier, monospace;
  font-size: 12px;
  line-height: 1.45;
  padding: 0 2mm 2mm 4mm;
  width: auto;
  box-sizing: border-box;
  font-weight: bold;
}
.t-logo { text-align: center; margin-bottom: 2px; }
.t-logo img { width: 54px; height: 54px; }
.t-head { text-align: center; margin-bottom: 6px; }
.t-head .name { font-size: 14px; letter-spacing: 0.5px; }
.t-head .sub { font-size: 11px; font-weight: bold; }
.t-meta { font-size: 11px; margin: 6px 0; }
.t-row { display: flex; justify-content: space-between; gap: 6px; }
.t-stars { text-align: center; font-size: 11px; letter-spacing: 1px; margin: 4px 0; overflow: hidden; white-space: nowrap; }
.t-colhead { display: flex; justify-content: space-between; font-size: 11px; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 4px; }
.t-item { margin-bottom: 4px; }
.t-item .desc { font-size: 12px; }
.t-item .nums { display: flex; justify-content: space-between; gap: 6px; font-size: 12px; }
.t-item .nums .qty { width: 32%; }
.t-item .nums .price { width: 30%; text-align: right; }
.t-item .nums .imp { width: 38%; text-align: right; }
.t-sep { border-top: 1px dashed #000; margin: 6px 0; }
.t-kilos { font-size: 12px; margin: 4px 0; }
.t-total { display: flex; justify-content: space-between; font-size: 16px; margin-top: 4px; }
.t-pay { display: flex; justify-content: space-between; font-size: 13px; }
.t-foot { text-align: center; font-size: 11px; margin-top: 10px; padding-top: 6px; border-top: 1px dashed #000; }
</style>
</head>
<body>${html}</body>
</html>`);
		printWin.document.close();
		printWin.onload = () => {
			setTimeout(() => {
				printWin.print();
				printWin.close();
			}, 200);
		};
	};

	const renderTicketContent = () => {
		if (!ticket) return null;
		const fecha = new Date(ticket.date);
		return (
			<>
				<div className="t-logo">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img src="/images/favicon_cerdo.png" alt="" />
				</div>
				<div className="t-head">
					<div className="name">{BUSINESS.name}</div>
					<div className="sub">{BUSINESS.address}</div>
					<div className="sub">{BUSINESS.owner}</div>
				</div>

				<div className="t-meta">
					<div className="t-row">
						<span>Ticket:</span>
						<span>*{ticket.ticketNumber}*</span>
					</div>
					<div className="t-row">
						<span>
							{fecha.toLocaleDateString("es-MX", {
								day: "2-digit",
								month: "2-digit",
								year: "numeric",
							})}
						</span>
						<span>
							Hora:{" "}
							{fecha.toLocaleTimeString("es-MX", {
								hour: "2-digit",
								minute: "2-digit",
								second: "2-digit",
							})}
						</span>
					</div>
					<div className="t-row">
						<span>CLIENTE:</span>
						<span>
							{ticket.customerCode} {ticket.customerName ?? "CONSUMIDOR FINAL"}
						</span>
					</div>
				</div>

				<div className="t-stars">
					*********************************************
				</div>

				<div className="t-colhead">
					<span>CANT. DESCRIP</span>
					<span>PRECIO</span>
					<span>IMPORTE</span>
				</div>

				{ticket.items.map((item, i) => {
					const price = parseFloat(item.unitPrice) / 100 || 0;
					const sub = parseFloat(item.subtotal) / 100 || 0;
					return (
						<div key={i} className="t-item">
							<div className="desc">- {item.productName}</div>
							<div className="nums">
								<span className="qty">{lineQty(item)}</span>
								<span className="price">{price > 0 ? money(price) : "—"}</span>
								<span className="imp">{money(sub)}</span>
							</div>
						</div>
					);
				})}

				<div className="t-sep" />

				<div className="t-kilos">
					TOTAL DE KILOS:{" "}
					{ticket.totalKg.toLocaleString("es-MX", {
						minimumFractionDigits: 2,
						maximumFractionDigits: 2,
					})}
				</div>

				<div className="t-total">
					<span>TOTAL</span>
					<span>{money(parseFloat(ticket.totalAmount) / 100 || 0)}</span>
				</div>
				<div className="t-pay">
					<span>PAGADO:</span>
					<span>{money(ticket.amountPaid)}</span>
				</div>
				<div className="t-pay">
					<span>POR COBRAR:</span>
					<span>{money(ticket.amountDue)}</span>
				</div>

				{ticket.notes && (
					<div className="t-kilos" style={{ marginTop: 6 }}>
						Notas: {ticket.notes}
					</div>
				)}

				<div className="t-foot">¡Gracias por su preferencia!</div>
			</>
		);
	};

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<PrinterIcon className="w-4 h-4" />
						Recibo de compra
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
						className="font-mono text-xs border rounded-lg p-4 bg-white max-h-[60vh] overflow-y-auto"
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

				<div className="flex flex-wrap justify-end gap-2 pt-2">
					<Button variant="secondary" onClick={onClose}>
						Cerrar
					</Button>
					<Button
						variant="outline"
						className="border-[#25D366] text-[#1da851] hover:bg-[#25D366]/10"
						onClick={handleWhatsApp}
						disabled={!ticket}
					>
						WhatsApp
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
