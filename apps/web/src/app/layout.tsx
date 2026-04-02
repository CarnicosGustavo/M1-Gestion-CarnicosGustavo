import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { TRPCReactProvider } from "@/components/trpc-provider";
import { CookieConsent } from "@/components/cookie-consent";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { CLIENT_NAME } from "@/lib/constants";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: CLIENT_NAME,
  description: "Open-source point of sale system",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={inter.className}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <TRPCReactProvider>
            <main>{children}</main>
            <Toaster richColors position="bottom-right" />
            <CookieConsent />
          </TRPCReactProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
