/**
 * Normalize a Nepali phone number to +977XXXXXXXXX format.
 * Handles both +977-prefixed and bare 10-digit numbers.
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("977")) return `+${digits}`;
  return `+977${digits}`;
}
