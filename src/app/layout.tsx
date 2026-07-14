import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ToastProvider } from "@/components/Toast";
import NetworkStatus from "@/components/NetworkStatus";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import SessionGuard from "@/components/SessionGuard";
import SessionHeartbeat from "@/components/SessionHeartbeat";
import VersionGuard from "@/components/VersionGuard";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "QR Hisab - Digital Credit Ledger",
  description:
    "A mobile-first credit ledger and delivery diary for small retail shops in Nepal",
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
  themeColor: "#059669",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="font-sans antialiased bg-[var(--color-bg)] text-[var(--color-text)]">
        <VersionGuard />
        <SessionHeartbeat />
        <SessionGuard />
        <ServiceWorkerRegistrar />
        <ToastProvider>
          <NetworkStatus />
          <main className="min-h-dvh">{children}</main>
          <PWAInstallBanner />
        </ToastProvider>
      </body>
    </html>
  );
}
