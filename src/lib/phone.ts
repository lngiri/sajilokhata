/**
 * Normalize a Nepali phone number to +977XXXXXXXXX format.
 * Handles both +977-prefixed and bare 10-digit numbers.
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("977")) return `+${digits}`;
  return `+977${digits}`;
}

/**
 * Strip all non-digit characters from a phone number for use in URLs.
 * Ensures no +, spaces, dashes, or parentheses remain.
 */
export function sanitizePhoneForUrl(phone: string): string {
  return phone.replace(/\D/g, "");
}
