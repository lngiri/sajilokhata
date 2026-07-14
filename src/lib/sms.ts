import "server-only";

export async function sendTransactionSMS(
  to: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const authToken = process.env.AAKASH_SMS_TOKEN || "";

  if (!authToken) {
    console.warn("[SMS] AAKASH_SMS_TOKEN not configured — skipping SMS");
    return { success: false, error: "AAKASH_SMS_TOKEN not configured" };
  }

  const cleanNumber = to.replace(/\D/g, "").slice(-10);

  if (cleanNumber.length !== 10) {
    console.warn(`[SMS] Invalid phone number: ${to}`);
    return { success: false, error: "Invalid phone number" };
  }

  const payload = new URLSearchParams({
    auth_token: authToken,
    to: cleanNumber,
    text: message,
  });

  try {
    const res = await fetch("https://sms.aakashsms.com/sms/v3/send", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload.toString(),
    });

    const body = await res.text();
    console.log(`[SMS] Response ${res.status}: ${body}`);

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}: ${body}` };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[SMS] Network error:", msg);
    return { success: false, error: msg };
  }
}
