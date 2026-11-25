import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Entrar · Cárnicos Gustavo",
	referrer: "no-referrer",
};

export default function LoginSectionLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
