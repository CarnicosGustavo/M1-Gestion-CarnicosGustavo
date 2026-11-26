import { AntonellaChat } from "@/components/antonella-chat";

export const metadata = {
	title: "Antonella - Asistente IA",
};

export default function AntonellaPage() {
	return (
		<div className="mx-auto max-w-4xl space-y-6 py-6">
			<div>
				<h1 className="font-bold text-2xl">Antonella</h1>
				<p className="text-muted-foreground text-sm">
					Asistente inteligente de inventario, demanda y producción. Acceso a
					todos los módulos del dashboard.
				</p>
			</div>

			<AntonellaChat />
		</div>
	);
}
