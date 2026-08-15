import type { Metadata } from "next";
import { getTranslations, getLocale } from "next-intl/server";

export const metadata: Metadata = {
  title: "Refund Policy — QR Hisab",
  description: "Refund Policy for QR Hisab SMS credits.",
};

export default async function RefundPolicyPage() {
  const t = await getTranslations("legal");
  const locale = await getLocale();

  return (
    <div className="min-h-dvh bg-[var(--color-bg)]">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="mb-2 text-3xl font-extrabold text-[var(--color-text)]">{t("refundTitle")}</h1>
        <p className="mb-8 text-sm text-[var(--color-text-muted)]">Effective date: August 2026</p>

        <div className="space-y-8 text-[var(--color-text)] leading-relaxed">
          <section>
            <h2 className="mb-3 text-xl font-bold">1. मुख्य खाता</h2>
            <p>मुख्य खाता (उधार खाता) <strong>निःशुल्क</strong> छ। निःशुल्क तहको लागि फिर्ता गर्ने केही छैन।</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">2. SMS क्रेडिट प्याकेजहरू</h2>
            <p>SMS क्रेडिट निम्न प्याकेजहरूमा बिक्री गरिन्छ:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>रु १०१ — ५० SMS क्रेडिट</li>
              <li>रु २०१ — ११० SMS क्रेडिट (लोकप्रिय)</li>
              <li>रु ५०१ — ३०० SMS क्रेडिट</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">3. फिर्ता पात्रता</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>प्रयोग नभएका क्रेडिट:</strong> यदि तपाईंले खरिदपछि कुनै SMS रिमाइन्डर पठाउनु भएन भने, तपाईंले खरिदको ७ दिनभित्र पूर्ण फिर्ताको अनुरोध गर्न सक्नुहुन्छ।</li>
              <li><strong>आंशिक रूपमा प्रयोग गरिएका क्रेडिट:</strong> आंशिक रूपमा प्रयोग गरिएका प्याकेजहरूको लागि फिर्ता उपलब्ध छैन।</li>
              <li><strong>प्रयोग गरिएका क्रेडिट:</strong> SMS रिमाइन्डरहरू पठाइसकेपछि, क्रेडिट फिर्ता गर्न सकिँदैन।</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">4. फिर्ता कसरी अनुरोध गर्ने</h2>
            <p>तपाईंको खरिद विवरणहरूसहित हामीलाई WhatsApp मा +977-9763658505 मा सम्पर्क गर्नुहोस्। हामी तपाईंको अनुरोध ३ कार्य दिवसभित्र समीक्षा गर्नेछौं।</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">5. भुक्तानी गेटवे</h2>
            <p>भुक्तानी गेटवे अहिले परीक्षण मोडमा छ। परीक्षण मोडमा, कुनै वास्तविक शुल्क लगाइँदैन। गेटवे लाइभ हुँदा, यो फिर्ता नीति वास्तविक खरिदहरूमा लागू हुनेछ।</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">6. परिवर्तनहरू</h2>
            <p>हामी यो नीति अपडेट गर्न सक्छौं। तपाईंको खरिदको समयमा प्रभावमा रहेको नीति तपाईंको फिर्ता अनुरोधमा लागू हुन्छ।</p>
          </section>
        </div>

        <div className="mt-12 text-center">
          <a href={`/${locale}`} className="text-sm font-medium text-[var(--color-primary)] hover:underline">
            &larr; मुख्य पृष्ठमा फर्कनुहोस्
          </a>
        </div>
      </div>
    </div>
  );
}
