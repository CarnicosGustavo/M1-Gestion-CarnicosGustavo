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

// Estilos del ticket, compartidos por la vista previa y la impresión.
const TICKET_STYLE = `
.t-logo { text-align: center; margin-bottom: 2px; }
.t-logo img { width: 72px; height: 72px; object-fit: contain; }
.t-name { text-align: center; font-size: 17px; letter-spacing: 0.5px; line-height: 1.2; }
.t-sub { text-align: center; font-size: 12px; }
.t-orden { text-align: center; font-size: 22px; margin: 8px 0 2px; letter-spacing: 1px; }
.t-datetime { text-align: center; font-size: 12px; }
.t-cliente { text-align: center; font-size: 16px; margin-top: 4px; }
.t-stars { text-align: center; font-size: 12px; margin: 6px 0; overflow: hidden; white-space: nowrap; }
.t-table { font-family: 'Courier New', Courier, monospace; font-size: 13px; line-height: 1.5; white-space: pre; margin: 0; }
.t-sep { border-top: 1px dashed #000; margin: 6px 0; }
.t-kilos { font-size: 14px; margin: 4px 0; }
.t-total { display: flex; justify-content: space-between; font-size: 22px; margin-top: 4px; }
.t-pay { display: flex; justify-content: space-between; font-size: 14px; }
.t-cobrar { display: flex; justify-content: space-between; font-size: 18px; }
.t-notes { font-size: 12px; margin-top: 6px; }
.t-foot { text-align: center; font-size: 13px; margin-top: 10px; padding-top: 6px; border-top: 1px dashed #000; }
`;

// Tabla de productos en monospace para matriz de puntos. Papel angosto: el
// nombre va en su renglón (completo) y debajo CANT · PRECIO · IMPORTE alineados.
const COL = { cant: 10, precio: 10, imp: 12 };
const padR = (s: string, n: number) =>
	s.length >= n ? s : s + " ".repeat(n - s.length);
const padL = (s: string, n: number) =>
	s.length >= n ? s : " ".repeat(n - s.length) + s;

export function TicketModal({ orderId, open, onClose }: TicketModalProps) {
	const trpc = useTRPC();
	const ticketRef = useRef<HTMLDivElement>(null);

	const { data: ticket, isLoading } = useQuery({
		...trpc.tickets.generateTicket.queryOptions({ orderId }),
		enabled: open,
	});

	// Cantidad de un renglón: kg (2 decimales) o piezas
	const lineQty = (it: NonNullable<typeof ticket>["items"][number]) => {
		const kg = it.quantityKg ? parseFloat(it.quantityKg) : 0;
		if (kg > 0) return kg.toFixed(2);
		return String(it.quantityPieces ?? 1);
	};

	// Líneas de la tabla de productos en texto monospace (2 renglones por item)
	const tableText = () => {
		if (!ticket) return "";
		const numsLine = (cant: string, precio: string, imp: string) =>
			padR(cant, COL.cant) + padL(precio, COL.precio) + padL(imp, COL.imp);
		const width = COL.cant + COL.precio + COL.imp;
		const header = numsLine("CANT", "PRECIO", "IMPORTE");
		const sep = "-".repeat(width);
		const lines: string[] = [header, sep];
		for (const it of ticket.items) {
			const precio = money(parseFloat(it.unitPrice) / 100 || 0);
			const imp = money(parseFloat(it.subtotal) / 100 || 0);
			lines.push(`- ${it.productName}`);
			lines.push(numsLine(lineQty(it), precio, imp));
		}
		return lines.join("\n");
	};

	// Arma un ticket en texto y lo abre en WhatsApp hacia el teléfono del cliente
	const handleWhatsApp = () => {
		if (!ticket) return;
		const lines: string[] = [];
		lines.push(`*${BUSINESS.name}*`);
		lines.push(`Orden #${ticket.ticketNumber}`);
		lines.push(`Cliente: ${ticket.customerName ?? "Consumidor Final"}`);
		lines.push("------------------------------");
		for (const it of ticket.items) {
			const sub = parseFloat(it.subtotal) / 100 || 0;
			lines.push(`${lineQty(it)}  ${it.productName}  ${money(sub)}`);
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

	// Imprime 1 copia (la matriz de puntos entrega original + copia)
	const handlePrint = () => {
		if (!ticketRef.current) return;
		const printWin = window.open("", "_blank", "width=380,height=800");
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
  font-weight: bold;
  padding: 0 2mm 2mm 4mm;
  box-sizing: border-box;
}
${TICKET_STYLE}
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
		// URL absoluta para que el logo también cargue en la ventana de impresión
		const origin =
			typeof window !== "undefined" ? window.location.origin : "";
		return (
			<>
				<div className="t-logo">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img src={`${origin}/images/favicon_cerdo.png`} alt="" />
				</div>
				<div className="t-name">{BUSINESS.name}</div>
				<div className="t-sub">{BUSINESS.address}</div>
				<div className="t-sub">{BUSINESS.owner}</div>

				<div className="t-orden">ORDEN #{ticket.ticketNumber}</div>
				<div className="t-datetime">
					{fecha.toLocaleDateString("es-MX", {
						day: "2-digit",
						month: "2-digit",
						year: "numeric",
					})}
					{"  ·  "}
					{fecha.toLocaleTimeString("es-MX", {
						hour: "2-digit",
						minute: "2-digit",
					})}
				</div>
				<div className="t-cliente">
					CLIENTE: {ticket.customerCode}{" "}
					{ticket.customerName ?? "CONSUMIDOR FINAL"}
				</div>

				<div className="t-stars">
					*********************************************
				</div>

				<pre className="t-table">{tableText()}</pre>

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
				<div className="t-cobrar">
					<span>POR COBRAR:</span>
					<span>{money(ticket.amountDue)}</span>
				</div>

				{ticket.notes && <div className="t-notes">Notas: {ticket.notes}</div>}

				<div className="t-foot">¡Gracias por su preferencia!</div>
			</>
		);
	};

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-md">
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: CSS estático del ticket */}
				<style dangerouslySetInnerHTML={{ __html: TICKET_STYLE }} />
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
						className="border rounded-lg p-4 bg-white max-h-[60vh] overflow-y-auto text-black"
						style={{
							fontFamily: "'Courier New', Courier, monospace",
							fontWeight: "bold",
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
