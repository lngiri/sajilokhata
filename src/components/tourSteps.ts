import type { TourStep } from "@/components/OnboardingTour";

type T = (key: string) => string;

export function getMerchantTourSteps(t: T): TourStep[] {
  return [
    {
      target: '[data-tour="stats"]',
      title: t("tour.merchantStatsTitle"),
      body: t("tour.merchantStatsBody"),
    },
    {
      target: '[data-tour="new-entry"]',
      title: t("tour.merchantNewEntryTitle"),
      body: t("tour.merchantNewEntryBody"),
    },
    {
      target: '[data-tour="my-qr"]',
      title: t("tour.merchantQrTitle"),
      body: t("tour.merchantQrBody"),
    },
    {
      target: '[data-tour="customers"]',
      title: t("tour.merchantCustomersTitle"),
      body: t("tour.merchantCustomersBody"),
    },
    {
      target: '[data-tour="history"]',
      title: t("tour.merchantHistoryTitle"),
      body: t("tour.merchantHistoryBody"),
    },
  ];
}

export function getCustomerTourSteps(t: T): TourStep[] {
  return [
    {
      target: '[data-tour="balance"]',
      title: t("tour.customerBalanceTitle"),
      body: t("tour.customerBalanceBody"),
    },
    {
      target: '[data-tour="scan"]',
      title: t("tour.customerScanTitle"),
      body: t("tour.customerScanBody"),
    },
    {
      target: '[data-tour="history"]',
      title: t("tour.customerHistoryTitle"),
      body: t("tour.customerHistoryBody"),
    },
  ];
}
