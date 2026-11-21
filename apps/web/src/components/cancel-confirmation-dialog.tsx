"use client";

import { Button } from "@finopenpos/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@finopenpos/ui/components/dialog";

interface CancelConfirmationDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
	summaryText?: string;
	isLoading?: boolean;
	blocked?: boolean;
	blockedMessage?: string;
	isPending?: boolean;
}

export function CancelConfirmationDialog({
	open,
	onOpenChange,
	onConfirm,
	summaryText,
	isLoading,
	blocked,
	blockedMessage,
	isPending,
}: CancelConfirmationDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>¿Cancelar este pedido?</DialogTitle>
					<DialogDescription className="whitespace-pre-line">
						{isLoading
							? "Cargando el resumen…"
							: blocked
								? (blockedMessage ??
									"No se puede cancelar este pedido. Pese primero o ajuste inventario.")
								: (summaryText ?? "")}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="secondary" onClick={() => onOpenChange(false)}>
						Volver
					</Button>
					<Button
						variant="destructive"
						disabled={Boolean(isLoading || blocked || isPending)}
						onClick={onConfirm}
					>
						{isPending ? "Cancelando…" : "Sí, cancelar"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
