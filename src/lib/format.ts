/**
 * Format a number with Western digits and Indian/Nepali (lakh) grouping.
 * Example: 120000 -> "1,20,000"
 */
export function formatNumber(value: unknown): string {
  if (typeof value === "number") return value.toLocaleString("en-IN");
  return Number(value ?? 0).toLocaleString("en-IN");
}
