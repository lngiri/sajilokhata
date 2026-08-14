const DEVANAGARI_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];

export function toDevanagari(num: string | number): string {
  return String(num).replace(/[0-9]/g, (d) => DEVANAGARI_DIGITS[Number(d)]);
}

export function fromDevanagari(str: string): string {
  return str.replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));
}

export function formatNumber(value: unknown, locale: "en" | "ne" = "en"): string {
  const num = Number(value ?? 0);
  if (locale === "ne") {
    return toDevanagari(num.toLocaleString("ne-NP"));
  }
  return num.toLocaleString("en-IN");
}

export function formatCurrency(value: unknown, locale: "en" | "ne" = "en"): string {
  const formatted = formatNumber(value, locale);
  return locale === "ne" ? `रु ${formatted}` : `Rs. ${formatted}`;
}