import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Privacy Policy — QR Hisab",
  description: "Privacy Policy for QR Hisab — digital khata for Nepali shops.",
};

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function PrivacyPolicyPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations("legal");

  return (
    <div className="min-h-dvh bg-[var(--color-bg)]">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="mb-2 text-3xl font-extrabold text-[var(--color-text)]">{t("privacyTitle")}</h1>
        <p className="mb-8 text-sm text-[var(--color-text-muted)]">Effective date: August 2026</p>

        <div className="space-y-8 text-[var(--color-text)] leading-relaxed">
          <section>
            <h2 className="mb-3 text-xl font-bold">1. हामीले के संकलन गर्छौं</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>फोन नम्बर</strong> — OTP लगइन र व्यापारी/ग्राहक पहिचानको लागि प्रयोग गरिन्छ।</li>
              <li><strong>पसलको नाम र प्रोफाइल</strong> — तपाईंको QR पृष्ठ र ड्यासबोर्डमा प्रदर्शन गरिन्छ।</li>
              <li><strong>लेनदेन प्रविष्टिहरू</strong> — उधार रकम, उत्पादनहरू, मितिहरू, र तपाईंले रेकर्ड गर्नुभएको अनुमोदन स्थिति।</li>
              <li><strong>SMS क्रेडिट खरिद</strong> — eSewa वा बैंक ट्रान्सफर मार्फत भुक्तानी रेकर्ड।</li>
              <li><strong>PIN</strong> — सल्टेड ह्यासमा सुरक्षित; ग्राहक पहुँच लक गर्न प्रयोग गरिन्छ।</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">2. हामी यसलाई कसरी प्रयोग गर्छौं</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>खाता (उधार खाता) सेवा प्रदान गर्न।</li>
              <li>OTP र PIN मार्फत तपाईंको प्रमाणीकरण गर्न।</li>
              <li>तपाईंका ग्राहकहरूलाई SMS भुक्तानी रिमाइन्डर पठाउन (जब तपाईंले SMS क्रेडिट खरिद गर्नुहुन्छ)।</li>
              <li>जालसाजी रोक्न र पहुँच नियमहरू लागू गर्न (RLS — row-level security)।</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">3. हामीले के गर्दैनौं</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>हामी तपाईंको डाटा तेस्रो पक्षलाई बेच्दैनौं।</li>
              <li>हामी ल्यान्डिङ पृष्ठमा ट्र्याकिङ कुकीज वा एनालिटिक्स प्रयोग गर्दैनौं।</li>
              <li>हामी तपाईंको लेनदेन डाटा अन्य व्यापारी वा ग्राहकहरूसँग बाँड्दैनौं।</li>
              <li>हामी लक्षित विज्ञापन चलाउँदैनौं।</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">4. डाटा सुरक्षा</h2>
            <p className="mb-2">सबै डाटा ट्रान्जिटमा एन्क्रिप्ट गरिन्छ (HTTPS)। डाटाबेस पहुँच row-level security (RLS) द्वारा सीमित छ — तपाईंले आफ्नो खाता मात्र हेर्न सक्नुहुन्छ।</p>
            <p>सत्रहरू क्रिप्टोग्राफिक रूपमा साइन गरिन्छन्। यदि तपाईंको फोन हराउँछ भने, सत्रहरू फोर्स-लग-आउट गर्न सकिन्छ।</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">5. डाटा संरक्षण</h2>
            <p>तपाईंको लेनदेन डाटा तपाईंको खाता सक्रिय रहेसम्म जोगाइन्छ। तपाईंले सहायता सम्पर्क गरेर तपाईंको खाता र सम्बन्धित सबै डाटा मेटाउन अनुरोध गर्न सक्नुहुन्छ।</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">6. SMS क्रेडिट</h2>
            <p>SMS रिमाइन्डर क्रेडिट eSewa वा बैंक ट्रान्सफर मार्फत खरिद गरिन्छ। क्रेडिट स्थानान्तरणयोग्य छैन। क्रेडिट फिर्ता सर्तहरूको लागि <a href={`/${locale}/refund`} className="text-[var(--color-primary)] underline">फिर्ता नीति</a> हेर्नुहोस्।</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">7. परिवर्तनहरू</h2>
            <p>हामी यो नीति अपडेट गर्न सक्छौं। परिवर्तनहरूपछि QR Hisab को निरन्तर प्रयोगले अद्यावधिक नीतिको स्वीकृति जनाउँछ।</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">8. सम्पर्क</h2>
            <p>गोपनीयता-सम्बन्धी प्रश्नहरूको लागि, हामीलाई WhatsApp मा +977-9763658505 मा सम्पर्क गर्नुहोस्।</p>
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
