"use client";

export type CustomerSessionResult =
  | { success: true }
  | { success: false; reason: "http-error" | "network-error" | "invalid-response" };

const CUSTOMER_STORAGE_KEY = "sajilo_customer_session";

async function postSession(phone: string, name: string): Promise<CustomerSessionResult> {
  try {
    const res = await fetch("/api/customer/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, name }),
    });
    if (!res.ok) return { success: false, reason: "http-error" };
    const body = await res.json();
    if (!body || body.success !== true) return { success: false, reason: "invalid-response" };
    return { success: true };
  } catch {
    return { success: false, reason: "network-error" };
  }
}

export async function setCustomerSession(phone: string, name: string): Promise<CustomerSessionResult> {
  try {
    localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify({ phone, name }));
  } catch {
    // localStorage full or unavailable
  }
  let result = await postSession(phone, name);
  if (!result.success) {
    await new Promise((r) => setTimeout(r, 500));
    result = await postSession(phone, name);
  }
  return result;
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
