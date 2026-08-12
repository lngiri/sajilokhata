import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";
import { faqItems } from "@/components/landing/content";

export const metadata: Metadata = {
  title: "QR Hisab — Digital Khata & Credit Ledger App for Nepali Shops",
  description:
    "Replace your paper khata. Track customer credit, shop-to-shop purchases and expenses on your phone. Customers check balances by scanning your QR — no app download. Start free.",
  openGraph: {
    title: "QR Hisab — Digital Khata for Nepali Shops",
    description:
      "Track customer credit, shop-to-shop purchases and expenses on your phone. Start free.",
    type: "website",
    url: "https://qrhisab.com/",
    siteName: "QR Hisab",
  },
  twitter: {
    card: "summary_large_image",
    title: "QR Hisab — Digital Khata for Nepali Shops",
    description: "Your entire business in one digital khata. Start free.",
  },
  alternates: {
    canonical: "https://qrhisab.com/",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "QR Hisab",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: [
        { "@type": "Offer", price: "0", priceCurrency: "NPR", description: "Free core khata" },
        { "@type": "Offer", price: "101", priceCurrency: "NPR", description: "50 SMS reminder credits" },
        { "@type": "Offer", price: "201", priceCurrency: "NPR", description: "110 SMS reminder credits" },
        { "@type": "Offer", price: "501", priceCurrency: "NPR", description: "300 SMS reminder credits" },
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.q.en,
        acceptedAnswer: { "@type": "Answer", text: item.a.en },
      })),
    },
    {
      "@type": "Organization",
      name: "QR Hisab",
      url: "https://qrhisab.com/",
    },
  ],
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LandingPage />
    </>
  );
}
