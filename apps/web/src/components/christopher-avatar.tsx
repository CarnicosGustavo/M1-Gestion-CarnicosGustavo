import { cn } from "@finopenpos/ui/lib/utils";
import Image from "next/image";

// Avatar de Christopher (el cerdito con lentes, agente de atención a clientes).
// Line-art negro sobre un círculo claro; se ve bien en tema claro y oscuro.
export function ChristopherAvatar({
	size = 36,
	className,
}: {
	size?: number;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-black/10",
				className,
			)}
			style={{ width: size, height: size, padding: Math.round(size * 0.12) }}
		>
			<Image
				src="/brand/christopher-face.png"
				alt="Christopher"
				width={size}
				height={size}
				className="h-full w-full object-contain"
				priority={size >= 40}
			/>
		</span>
	);
}
