export type Lang = "en" | "ne";

export const content = {
  en: {
    nav: {
      howItWorks: "How it works",
      features: "Features",
      pricing: "Pricing",
      faq: "FAQ",
      login: "Log in",
      startFree: "Start Free",
    },
    hero: {
      eyebrow: "Made for Nepali shop owners & traders",
      h1: "Your entire business in one digital khata",
      sub: "Track customer credits, record expenses, and send SMS reminders — all from your phone. One app for every rupee your business touches.",
      startFree: "Start Free",
      seeHow: "See How It Works",
      trust: ["Free core khata", "Works on any phone", "No app download for customers", "Add to home screen"],
    },
    trust: {
      https: "HTTPS everywhere",
      freeStart: "100% free to start",
      noApp: "Customers scan — no install",
      noTracking: "No tracking cookies",
    },
    howItWorks: {
      label: "How it works",
      title: "From scan to settled in four steps",
      sub: "Customers scan your QR. You approve in realtime. Both sides always know the balance.",
      steps: [
        { title: "Scan", desc: "Customer scans your shop QR. No install, no signup." },
        { title: "Enter", desc: "They enter the amount — or pick a product and it fills itself." },
        { title: "Confirm", desc: "You approve or reject in realtime. They see it instantly." },
        { title: "Done", desc: "Balance updated. Both of you know exactly where you stand." },
      ],
    },
    features: {
      label: "Features",
      title: "Everything a Nepali shop needs",
      sub: "Five tools that replace your paper khata — without the learning curve.",
      tiles: [
        { title: "QR access", desc: "Customers see their balance by scanning your QR. No app install." },
        { title: "Live dashboard", desc: "See who owes what, in realtime, from your phone." },
        { title: "Smart reminders", desc: "Send a polite SMS reminder and get paid faster." },
        { title: "Credit limits & flags", desc: "Give credit with confidence. Stop bad debt." },
        { title: "Offline khata", desc: "Works even where the network doesn't." },
      ],
    },
    offline: {
      label: "Offline",
      title: "Works even when the network doesn't",
      sub: "QR Hisab is a PWA. It caches the app shell and stages entries offline, then syncs safely when you're back online — no double entries.",
      pwa: "Add QR Hisab to your home screen for one-tap access — like an app, without the app store.",
    },
    security: {
      label: "Security",
      title: "Your khata stays yours",
      bullets: [
        "OTP login plus your own PIN.",
        "Sessions signed and enforced; force-logout if your phone is lost.",
        "Database-level access rules — you only ever see your own khata.",
        "Every entry carries a timestamp and who made it — no silent edits.",
        "Works offline, syncs safely — no double entries.",
      ],
    },
    pricing: {
      label: "Pricing",
      title: "Start free. Pay only if you want SMS.",
      framing: "The khata is free. SMS reminders are optional.",
      freeForever: "Core khata — free forever",
      packages: [
        { price: "Rs 101", sms: "50 SMS" },
        { price: "Rs 201", sms: "110 SMS", popular: true },
        { price: "Rs 501", sms: "300 SMS" },
      ],
      footnote: "SMS credits send customer payment reminders. Pay by eSewa or bank. Payment gateway is currently in test mode.",
    },
    faq: {
      label: "FAQ",
      title: "Common questions",
    },
    cta: {
      title: "Start your digital khata today",
      sub: "Set up in minutes. Record your first entry the same day — free.",
      button: "Start Free",
    },
    footer: {
      tagline: "Digital khata for Nepali shops — customer credit, expenses, and SMS reminders in one place.",
      product: "Product",
      legal: "Legal",
      privacy: "Privacy Policy",
      terms: "Terms of Service",
      refund: "Refund Policy",
      comingSoon: "Coming soon",
      pwaHint: "Add QR Hisab to your home screen",
    },
    session: {
      welcome: "Welcome back!",
      choose: "Choose an account to continue",
      merchant: "Continue as Merchant",
      customer: "Continue as Customer",
      different: "Sign in with a different account",
      or: "or",
    },
  },
  ne: {
    nav: {
      howItWorks: "कसरी काम गर्छ",
      features: "सुविधाहरू",
      pricing: "मूल्य",
      faq: "प्रश्नोत्तर",
      login: "लग इन",
      startFree: "निःशुल्क सुरु",
    },
    hero: {
      eyebrow: "नेपाली पसल मालिक र व्यापारीहरूका लागि",
      h1: "तपाईंको सम्पूर्ण व्यवसाय एउटै डिजिटल खातामा",
      sub: "ग्राहकको उधार, खर्च, SMS सम्झना — सबै फोनबाट। तपाईंको व्यवसायको हरेक रुपैयाँ एउटै एपमा।",
      startFree: "निःशुल्क सुरु",
      seeHow: "कसरी काम गर्छ",
      trust: ["मुख्य खाता निःशुल्क", "कुनै पनि फोनमा", "ग्राहकलाई एप चाहिँदैन", "होम स्क्रिनमा थप्नुहोस्"],
    },
    trust: {
      https: "HTTPS सुरक्षा",
      freeStart: "सुरु गर्न १००% निःशुल्क",
      noApp: "स्क्यान गर्नुहोस् — इन्स्टल छैन",
      noTracking: "ट्र्याकिङ कुकी छैन",
    },
    howItWorks: {
      label: "कसरी काम गर्छ",
      title: "स्क्यानदेखि मिलानसम्म — चार चरण",
      sub: "ग्राहकले QR स्क्यान गर्छन्। तपाईं realtime मा स्वीकृत गर्नुहुन्छ। दुवै पक्षलाई ब्यालेन्स थाहा हुन्छ।",
      steps: [
        { title: "स्क्यान", desc: "ग्राहकले तपाईंको पसल QR स्क्यान गर्छ। इन्स्टल वा साइनअप छैन।" },
        { title: "रकम", desc: "रकम हाल्छन् — वा सामान छान्छन् र स्वतः भर्छ।" },
        { title: "पुष्टि", desc: "तपाईं realtime मा स्वीकृत वा अस्वीकृत गर्नुहुन्छ। तुरुन्त देख्छन्।" },
        { title: "सकियो", desc: "ब्यालेन्स अपडेट। दुवै पक्षलाई ठ्याक्क थाहा हुन्छ।" },
      ],
    },
    features: {
      label: "सुविधाहरू",
      title: "नेपाली पसललाई चाहिने सबै",
      sub: "कागजी खाताको साटो — सिक्न गाह्रो छैन।",
      tiles: [
        { title: "QR पहुँच", desc: "ग्राहकले QR स्क्यान गरेर ब्यालेन्स हेर्छन्। एप इन्स्टल छैन।" },
        { title: "लाइभ ड्यासबोर्ड", desc: "कसले कति दिन्छ, realtime मा फोनबाट हेर्नुहोस्।" },
        { title: "SMS सम्झना", desc: "विनम्र SMS सम्झना पठाएर छिटो भुक्तानी लिनुहोस्।" },
        { title: "क्रेडिट सीमा", desc: "विश्वासका साथ उधार दिनुहोस्। नराम्रो ऋण रोक्नुहोस्।" },
        { title: "अफलाइन खाता", desc: "नेटवर्क नभए पनि काम गर्छ।" },
      ],
    },
    offline: {
      label: "अफलाइन",
      title: "नेटवर्क नभए पनि काम गर्छ",
      sub: "QR Hisab एउटा PWA हो। अफलाइनमा entries राख्छ, अनलाइन भएपछि सुरक्षित sync — दोहोरो entry हुँदैन।",
      pwa: "होम स्क्रिनमा QR Hisab थप्नुहोस् — एप जस्तै, app store बिना।",
    },
    security: {
      label: "सुरक्षा",
      title: "तपाईंको खाता तपाईंको नै",
      bullets: [
        "OTP लगइन र आफ्नो PIN।",
        "Session हस्ताक्षरित; फोन हराए force-logout।",
        "डाटाबेस-स्तरको पहुँच — तपाईंको खाता मात्र।",
        "हरेक entry मा समय र कसले गरे — गोप्य सम्पादन छैन।",
        "अफलाइन काम, सुरक्षित sync — दोहोरो entry छैन।",
      ],
    },
    pricing: {
      label: "मूल्य",
      title: "निःशुल्क सुरु। SMS चाहिए मात्र तिर्नुहोस्।",
      framing: "खाता निःशुल्क। SMS सम्झना वैकल्पिक।",
      freeForever: "मुख्य खाता — सधैं निःशुल्क",
      packages: [
        { price: "रु १०१", sms: "५० SMS" },
        { price: "रु २०१", sms: "११० SMS", popular: true },
        { price: "रु ५०१", sms: "३०० SMS" },
      ],
      footnote: "SMS credits ले ग्राहकलाई भुक्तानी सम्झना पठाउँछ। eSewa वा बैंकबाट। Payment gateway हाल test mode मा छ।",
    },
    faq: {
      label: "प्रश्नोत्तर",
      title: "बारम्बार सोधिने प्रश्न",
    },
    cta: {
      title: "आजै डिजिटल खाता सुरु गर्नुहोस्",
      sub: "केही मिनेटमा सेटअप। पहिलो entry आजै — निःशुल्क।",
      button: "निःशुल्क सुरु",
    },
    footer: {
      tagline: "नेपाली पसलका लागि डिजिटल खाता — ग्राहक उधार, खर्च, SMS सम्झना एउटै ठाउँमा।",
      product: "उत्पादन",
      legal: "कानूनी",
      privacy: "गोपनीयता नीति",
      terms: "सेवा सर्त",
      refund: "फिर्ता नीति",
      comingSoon: "छिट्टै",
      pwaHint: "होम स्क्रिनमा QR Hisab थप्नुहोस्",
    },
    session: {
      welcome: "फेरि स्वागत!",
      choose: "जारी राख्न खाता छान्नुहोस्",
      merchant: "व्यापारीको रूपमा जारी",
      customer: "ग्राहकको रूपमा जारी",
      different: "अर्को खाताबाट साइन इन",
      or: "वा",
    },
  },
} as const;

export const faqItems = [
  {
    q: { en: "What is QR Hisab?", ne: "QR Hisab के हो?" },
    a: {
      en: "A digital khata (credit ledger) for Nepali shops. Record what customers owe you, track expenses, and send payment reminders from your phone.",
      ne: "नेपाली पसलका लागि डिजिटल खाता। ग्राहकको देनदारी, खर्च — सबै फोनबाट।",
    },
  },
  {
    q: { en: "Do customers need to download an app?", ne: "ग्राहकलाई एप डाउनलोड गर्नुपर्छ?" },
    a: {
      en: "No. They scan your shop QR with their phone camera and open their balance in the browser.",
      ne: "होइन। तपाईंको पसल QR स्क्यान गरेर ब्राउजरमा ब्यालेन्स हेर्छन्।",
    },
  },
  {
    q: { en: "Is it really free?", ne: "साँच्चै निःशुल्क हो?" },
    a: {
      en: "Yes. The core khata is free. The only paid feature is optional SMS reminder credits.",
      ne: "हो। मुख्य खाता निःशुल्क। SMS सम्झना credits मात्र वैकल्पिक शुल्क।",
    },
  },
  {
    q: { en: "How does a credit entry work?", ne: "उधार entry कसरी हुन्छ?" },
    a: {
      en: "Customer scans your QR → enters amount (or picks a product) → you approve or reject in realtime → balances update on both sides.",
      ne: "QR स्क्यान → रकम → तपाईं स्वीकृत/अस्वीकृत → दुवै पक्षको ब्यालेन्स अपडेट।",
    },
  },
  {
    q: { en: "Does it work without internet?", ne: "इन्टरनेट बिना काम गर्छ?" },
    a: {
      en: "Yes. It's a PWA that caches the app and stages entries offline, then syncs when you're back online.",
      ne: "हो। PWA ले अफलाइन entries राख्छ, अनलाइन भएपछि sync गर्छ।",
    },
  },
  {
    q: { en: "How do SMS reminders work?", ne: "SMS सम्झना कसरी?" },
    a: {
      en: "Buy SMS credits (Rs 101/201/501 packages) and send payment reminders from your dashboard. Payment gateway is currently in test mode.",
      ne: "SMS credits किन्नुहोस् (रु १०१/२०१/५०१) र dashboard बाट सम्झना पठाउनुहोस्। Gateway हाल test mode मा।",
    },
  },
  {
    q: { en: "Is my data safe?", ne: "मेरो डाटा सुरक्षित छ?" },
    a: {
      en: "OTP login + PIN, cryptographically signed sessions, and database-level access rules mean you only see your own khata. Data is encrypted in transit (HTTPS), not end-to-end encrypted.",
      ne: "OTP + PIN, हस्ताक्षरित session, RLS — तपाईंको खाता मात्र। HTTPS मा encrypted, E2E encrypted होइन।",
    },
  },
];
