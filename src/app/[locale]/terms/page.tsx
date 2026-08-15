import type { Metadata } from "next";
import { getTranslations, getLocale } from "next-intl/server";

export const metadata: Metadata = {
  title: "Terms of Service — QR Hisab",
  description: "Terms of Service for QR Hisab — digital khata for Nepali shops.",
};

export default async function TermsPage() {
  const t = await getTranslations("legal");
  const locale = await getLocale();

  return (
    <div className="min-h-dvh bg-[var(--color-bg)]">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="mb-2 text-3xl font-extrabold text-[var(--color-text)]">{t("termsTitle")}</h1>
        <p className="mb-8 text-sm text-[var(--color-text-muted)]">Effective date: August 2026</p>

        <div className="space-y-8 text-[var(--color-text)] leading-relaxed">
          <section>
            <h2 className="mb-3 text-xl font-bold">1. स्वीकृति</h2>
            <p>QR Hisab प्रयोग गरेर तपाईं यी शर्तहरूसँग सहमत हुनुहुन्छ। यदि तपाईं सहमत हुनुहुन्न भने, सेवा प्रयोग नगर्नुहोस्।</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">2. सेवा विवरण</h2>
            <p>QR Hisab नेपाली पसलहरूको लागि डिजिटल खाता (उधार खाता) हो। यसले व्यापारीहरूलाई ग्राहक उधार रेकर्ड गर्न, खर्च ट्र्याक गर्न, र SMS रिमाइन्डर पठाउन अनुमति दिन्छ। ग्राहकहरूले पसलको QR स्क्यान गरेर आफ्नो शेष रकम हेर्न सक्छन्।</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">3. खाताहरू</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>व्यापारी खाताहरूको लागि मान्य फोन नम्बर र OTP प्रमाणीकरण आवश्यक छ।</li>
              <li>ग्राहक पहुँच तपाईंले सेट गर्नुभएको PIN ले सुरक्षित छ।</li>
              <li>तपाईं आफ्नो फोन र PIN सुरक्षित राख्न जिम्मेवार हुनुहुन्छ।</li>
              <li>एउटै फोन नम्बरसँग व्यापारी र ग्राहक दुवै भूमिका हुन सक्छ।</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">4. तपाईंको डाटा</h2>
            <p>तपाईं तपाईंको खाता डाटाको मालिक हुनुहुन्छ। हामी यसलाई सुरक्षित रूपमा जोगाउँछौं र तेस्रो पक्षसँग बाँड्दैनौं। विवरणहरूको लागि हाम्रो <a href={`/${locale}/privacy`} className="text-[var(--color-primary)] underline">गोपनीयता नीति</a> हेर्नुहोस्।</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">5. SMS क्रेडिट</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>SMS क्रेडिट प्याकेजहरूमा खरिद गरिन्छ (रु १०१ / २०१ / ५०१)।</li>
              <li>क्रेडिट ग्राहकहरूलाई भुक्तानी रिमाइन्डर SMS पठाउन प्रयोग गरिन्छ।</li>
              <li>क्रेडिट स्थानान्तरणयोग्य छैन र प्रयोग भएपछि फिर्ता योग्य छैन।</li>
              <li>प्रयोग नभएका क्रेडिट फिर्ताको लागि <a href={`/${locale}/refund`} className="text-[var(--color-primary)] underline">फिर्ता नीति</a> हेर्नुहोस्।</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">6. उचित प्रयोग</h2>
            <p>तपाईं यी कुराहरू नगर्न सहमत हुनुहुन्छ:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>सेवाको अवैध उद्देश्यको लागि प्रयोग गर्ने।</li>
              <li>अन्य प्रयोगकर्ताहरूको डाटा पहुँच गर्ने प्रयास गर्ने।</li>
              <li>SMS रिमाइन्डर प्रणालीको दुरुपयोग (स्प्याम, उत्पीडन)।</li>
              <li>सेवाको रिभर्स-इन्जिनियरिङ वा शोषण गर्ने।</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">7. दायित्वको सीमा</h2>
            <p>QR Hisab &quot;जस्तो छ&quot; प्रदान गरिन्छ। हामी खाता प्रणालीको प्रयोगबाट उत्पन्न वित्तीय हानिको लागि जिम्मेवार छैनौं। खाता एउटा रेकर्ड-राख्ने उपकरण हो — यसले वित्तीय सल्लाह प्रदान गर्दैन।</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">8. परिवर्तनहरू</h2>
            <p>हामी यी शर्तहरू अपडेट गर्न सक्छौं। परिवर्तनहरूपछि निरन्तर प्रयोगले स्वीकृति जनाउँछ।</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">9. सम्पर्क</h2>
            <p>प्रश्नहरू? हामीलाई WhatsApp मा +977-9763658505 मा सम्पर्क गर्नुहोस्।</p>
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
