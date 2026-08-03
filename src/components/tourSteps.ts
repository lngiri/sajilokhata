import type { TourStep } from "@/components/OnboardingTour";

export const MERCHANT_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="stats"]',
    title: "Your shop at a glance",
    body: "This is your dashboard. Today's cash sales, credit, and money owed on market — all in one place. Tap any card to see the full breakdown.",
  },
  {
    target: '[data-tour="new-entry"]',
    title: "Record your first entry",
    body: "Tap 'New Entry' when a customer buys on credit, pays cash, or you have an expense. It's the button you'll use the most.",
  },
  {
    target: '[data-tour="my-qr"]',
    title: "Share your shop QR",
    body: "This is your shop's QR code. Show it to customers — they scan it to send you credit requests from their own phone.",
  },
  {
    target: '[data-tour="customers"]',
    title: "Manage customers",
    body: "See every customer who buys on credit, what they owe, and add new ones. Tap a customer to view their full khata.",
  },
  {
    target: '[data-tour="history"]',
    title: "History & reports",
    body: "Every entry is saved here. Filter by today, credit, or cash, and download reports whenever you need them.",
  },
];

export const CUSTOMER_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="balance"]',
    title: "Your outstanding balance",
    body: "This shows how much you owe across all shops. Tap it to see the breakdown shop by shop.",
  },
  {
    target: '[data-tour="scan"]',
    title: "Scan a shop QR",
    body: "Point your camera at a shop's QR code to send a credit or payment request instantly — no cash register required.",
  },
  {
    target: '[data-tour="history"]',
    title: "Track your requests",
    body: "Every request you send is recorded here, along with its status — pending, approved, or rejected.",
  },
];
