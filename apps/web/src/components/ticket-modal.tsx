"use client";

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

	const { data: ticket, isLoading } = useQuery({
		...trpc.tickets.generateTicket.queryOptions({ orderId }),
		enabled: open,
	});

	const handlePrint = () => {
		window.print();
	};

	return (
		<>
			{/* Estilos de impresión: solo muestra el área del ticket */}
			<style>{`
        @media print {
          body > * { display: none !important; }
          #ticket-print-area {
            display: block !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 80mm !important;
            padding: 6mm !important;
            font-family: monospace !important;
            font-size: 11px !important;
            background: white !important;
            color: black !important;
          }
          #ticket-print-area * {
            visibility: visible !important;
          }
        }
      `}</style>

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
							id="ticket-print-area"
							className="font-mono text-xs border rounded-lg p-4 bg-white space-y-0"
						>
							{/* Encabezado */}
							<div className="text-center border-b border-dashed pb-2 mb-2">
								<p className="font-bold text-sm tracking-widest">
									CARNICOS GUSTAVO
								</p>
								<p className="text-[10px] text-muted-foreground">
									Nota de Pedido
								</p>
							</div>

							{/* Datos del ticket */}
							<div className="mb-2 space-y-0.5">
								<div className="flex justify-between">
									<span className="font-bold">{ticket.ticketNumber}</span>
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
								<div className="flex justify-between">
									<span className="text-muted-foreground">Cliente</span>
									<span className="font-medium">
										{ticket.customerName ?? "Consumidor Final"}
									</span>
								</div>
							</div>

							{/* Artículos */}
							<div className="border-t border-dashed border-b border-dashed py-2 my-2 space-y-1">
								<div className="flex justify-between text-[10px] text-muted-foreground mb-1">
									<span>ARTÍCULO</span>
									<span>KG / PRECIO</span>
								</div>
								{ticket.items.map((item, i) => {
									const hasKg =
										item.quantityKg && parseFloat(item.quantityKg) > 0;
									const subtotal = parseFloat(item.subtotal) || 0;
									return (
										<div key={i} className="space-y-0">
											<div className="flex justify-between gap-1">
												<span className="flex-1 truncate">
													{item.quantityPieces ?? 1}x {item.productName}
												</span>
												<span className="font-medium whitespace-nowrap">
													{subtotal > 0
														? formatCurrency(Math.round(subtotal * 100), locale)
														: "—"}
												</span>
											</div>
											{hasKg && (
												<div className="text-muted-foreground text-[10px] ml-2">
													{parseFloat(item.quantityKg!).toFixed(3)} kg @{" "}
													{item.unitPrice !== "0"
														? formatCurrency(
																Math.round(parseFloat(item.unitPrice) * 100),
																locale,
															)
														: "—"}
													/kg
												</div>
											)}
										</div>
									);
								})}
							</div>

							{/* Total */}
							<div className="flex justify-between font-bold text-sm pt-1">
								<span>TOTAL</span>
								<span>
									{formatCurrency(
										Math.round(parseFloat(ticket.totalAmount) * 100),
										locale,
									)}
								</span>
							</div>

							{/* Estado */}
							<div className="flex justify-between text-[10px] text-muted-foreground pt-0.5">
								<span>Estado</span>
								<span>
									{ticket.status === "completed"
										? "Completado"
										: ticket.status === "cancelled"
											? "Cancelado"
											: "Pendiente"}
								</span>
							</div>

							{/* Notas */}
							{ticket.notes && (
								<div className="mt-2 pt-2 border-t border-dashed text-[10px] text-muted-foreground">
									<span className="font-medium">Notas: </span>
									{ticket.notes}
								</div>
							)}

							{/* Pie de página */}
							<div className="text-center text-[10px] text-muted-foreground mt-2 pt-2 border-t border-dashed">
								¡Gracias por su preferencia!
							</div>
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
		</>
	);
}
