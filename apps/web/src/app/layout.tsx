import type { Metadata } from "next";
import { Anton, Archivo, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { TRPCReactProvider } from "@/components/trpc-provider";
import { CookieConsent } from "@/components/cookie-consent";
import { ThemeProvider, ThemeScript } from "@/components/theme-provider";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { CLIENT_NAME } from "@/lib/constants";

// Tipografía de marca Cárnicos Gustavo
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-archivo",
});
const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
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
