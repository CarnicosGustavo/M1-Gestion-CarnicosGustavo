import type { Metadata } from "next";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Toaster } from "sonner";
import { CookieConsent } from "@/components/cookie-consent";
import { ThemeProvider, ThemeScript } from "@/components/theme-provider";
import { TRPCReactProvider } from "@/components/trpc-provider";
import "./globals.css";
import { CLIENT_NAME } from "@/lib/constants";

// Fuentes OFL de fontsource empaquetadas localmente para que el build no dependa de la red.
const archivo = localFont({
	src: [
		{
			path: "./fonts/archivo-latin-400-normal.woff2",
			weight: "400",
			style: "normal",
		},
		{
			path: "./fonts/archivo-latin-500-normal.woff2",
			weight: "500",
			style: "normal",
		},
		{
			path: "./fonts/archivo-latin-600-normal.woff2",
			weight: "600",
			style: "normal",
		},
		{
			path: "./fonts/archivo-latin-700-normal.woff2",
			weight: "700",
			style: "normal",
		},
		{
			path: "./fonts/archivo-latin-800-normal.woff2",
			weight: "800",
			style: "normal",
		},
	],
	display: "swap",
	fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
	variable: "--font-archivo",
});
const anton = localFont({
	src: [
		{
			path: "./fonts/anton-latin-400-normal.woff2",
			weight: "400",
			style: "normal",
		},
	],
	display: "swap",
	fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
	variable: "--font-anton",
});
const jetbrains = localFont({
	src: [
		{
			path: "./fonts/jetbrains-mono-latin-400-normal.woff2",
			weight: "400",
			style: "normal",
		},
		{
			path: "./fonts/jetbrains-mono-latin-500-normal.woff2",
			weight: "500",
			style: "normal",
		},
		{
			path: "./fonts/jetbrains-mono-latin-700-normal.woff2",
			weight: "700",
			style: "normal",
		},
	],
	display: "swap",
	fallback: ["ui-monospace", "monospace"],
	variable: "--font-jetbrains",
});

export const metadata: Metadata = {
	title: CLIENT_NAME,
	description: "Sistema de Gestión de Inventario y Despiece",
};

export default async function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const locale = await getLocale();
	const messages = await getMessages();

	return (
		<html
			lang={locale}
			className={`${archivo.variable} ${anton.variable} ${jetbrains.variable}`}
			suppressHydrationWarning
		>
			<head>
				<ThemeScript />
			</head>
			<body className={archivo.className}>
				<NextIntlClientProvider locale={locale} messages={messages}>
					<ThemeProvider>
						<TRPCReactProvider>
							<main>{children}</main>
							<Toaster richColors position="bottom-right" />
							<CookieConsent />
						</TRPCReactProvider>
					</ThemeProvider>
				</NextIntlClientProvider>
			</body>
		</html>
	);
}
