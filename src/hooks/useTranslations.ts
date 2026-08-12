"use client";

import { useTranslations } from "next-intl";

export function useCommonTranslations() {
  return useTranslations("common");
}

export function useNavigationTranslations() {
  return useTranslations("navigation");
}

export function useDashboardTranslations() {
  return useTranslations("dashboard");
}

export function useScanTranslations() {
  return useTranslations("scan");
}

export function useHistoryTranslations() {
  return useTranslations("history");
}

export function useSettingsTranslations() {
  return useTranslations("settings");
}

export function useOnboardingTranslations() {
  return useTranslations("onboarding");
}

export function usePinGateTranslations() {
  return useTranslations("pinGate");
}

export function useNotificationsTranslations() {
  return useTranslations("notifications");
}

export function useModalTranslations() {
  return useTranslations("modals");
}

export function useToastTranslations() {
  return useTranslations("toast");
}

export function useBottomNavTranslations() {
  return useTranslations("bottomNav");
}

export function useProductPickerTranslations() {
  return useTranslations("productPicker");
}

export function useErrorTranslations() {
  return useTranslations("errors");
}

export function useCurrencyTranslations() {
  return useTranslations("currency");
}

export function useDateTranslations() {
  return useTranslations("date");
}