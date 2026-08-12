import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { defaultLocale } from "@/i18n";

export const metadata: Metadata = {
  title: "QR Hisab — Your Digital Khata",
  description: "A mobile-first credit ledger for small retail shops in Nepal",
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

export default function RootLayout() {
  redirect(`/${defaultLocale}`);
}