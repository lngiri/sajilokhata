import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import { Nunito } from "next/font/google";
import { ToastProvider } from "@/components/Toast";
import NetworkStatus from "@/components/NetworkStatus";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import ActionHub from "@/components/ActionHub";
import SessionGuard from "@/components/SessionGuard";
import SessionHeartbeat from "@/components/SessionHeartbeat";
import VersionGuard from "@/components/VersionGuard";
import OfflineSync from "@/components/OfflineSync";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import "../globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  weight: ["400", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "QR Hisab — Your Digital Khata",
  description: "A mobile-first credit ledger for small retail shops in Nepal",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "QR Hisab",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#16A34A",
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

interface Props {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${nunito.variable} font-sans`} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/logo.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="font-sans antialiased bg-[var(--color-bg)] text-[var(--color-text)]">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <NextIntlClientProvider messages={messages}>
            <VersionGuard />
            <SessionHeartbeat />
            <SessionGuard />
            <ServiceWorkerRegistrar />
            <ToastProvider>
              <NetworkStatus />
              <OfflineSync />
              <main className="min-h-dvh">{children}</main>
              <PWAInstallBanner />
              <ActionHub />
            </ToastProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}