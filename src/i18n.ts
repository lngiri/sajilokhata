import { getRequestConfig } from "next-intl/server";

export const locales = ["en", "ne"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !isValidLocale(locale)) locale = defaultLocale;

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});