"use client";

const CUSTOMER_STORAGE_KEY = "sajilo_customer_session";

export async function setCustomerSession(phone: string, name: string): Promise<void> {
  try {
    localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify({ phone, name }));
  } catch {
    // localStorage full or unavailable
  }
  try {
    await fetch("/api/customer/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, name }),
    });
  } catch {
    // Cookie not set, but localStorage works for client-side
  }
}

export function clearCustomerSession(): void {
  try {
    localStorage.removeItem(CUSTOMER_STORAGE_KEY);
  } catch {
    // Ignore
  }
  fetch("/api/customer/clear-session", { method: "POST" }).catch(() => {});
}

export function loadCustomerSession(): { phone: string; name: string } | null {
  try {
    const raw = localStorage.getItem(CUSTOMER_STORAGE_KEY);
    if (raw) {
      const session = JSON.parse(raw);
      if (session.phone && session.phone.length >= 10) {
        return { phone: session.phone, name: session.name || "" };
      }
    }
  } catch {
    // Corrupted data
  }
  return null;
}
