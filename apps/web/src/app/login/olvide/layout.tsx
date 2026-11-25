import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Olvidé mi contraseña · Cárnicos Gustavo",
	referrer: "no-referrer",
};

export default function ForgotLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
