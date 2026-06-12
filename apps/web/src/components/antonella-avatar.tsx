import Image from "next/image";
import { cn } from "@finopenpos/ui/lib/utils";

// Avatar de iAntonella (la cerdita con monóculo en círculo rojo).
// Autocontenido: se ve bien en tema claro y oscuro.
export function AntonellaAvatar({
	size = 36,
	className,
}: {
	size?: number;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
				className,
			)}
			style={{ width: size, height: size }}
		>
			<Image
				src="/brand/iantonella-rojo.png"
				alt="iAntonella"
				width={size}
				height={size}
				className="h-full w-full object-cover"
				priority={size >= 40}
			/>
		</span>
	);
}
