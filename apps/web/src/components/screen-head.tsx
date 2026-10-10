import { cn } from "@finopenpos/ui/lib/utils";
import type { ReactNode } from "react";

/**
 * Encabezado de pantalla del diseño (cg-ui · ScreenHead): título en fuente
 * display (Anton) + descripción opcional, con una zona de acciones a la derecha.
 * Se usa al inicio de cada módulo del admin.
 */
export function ScreenHead({
	title,
	desc,
	right,
	className,
}: {
	title: ReactNode;
	desc?: ReactNode;
	right?: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"mb-5 flex flex-wrap items-end justify-between gap-4",
				className,
			)}
		>
			<div>
				<h1 className="font-display text-3xl tracking-[0.01em] text-foreground">
					{title}
				</h1>
				{desc ? (
					<p className="mt-2 max-w-[560px] text-muted-foreground text-sm leading-relaxed">
						{desc}
					</p>
				) : null}
			</div>
			{right ? <div className="flex flex-wrap gap-2.5">{right}</div> : null}
		</div>
	);
}
