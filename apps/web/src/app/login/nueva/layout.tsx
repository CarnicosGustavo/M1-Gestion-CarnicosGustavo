import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Contraseña nueva · Cárnicos Gustavo",
	referrer: "no-referrer",
};

export default function NewPasswordLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
