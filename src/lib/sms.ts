import "server-only";

export async function sendTransactionSMS(
  to: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const authToken = process.env.AAKASH_SMS_TOKEN || "";

  console.log("[SMS] Starting send...");
  console.log("[SMS] Token present:", !!authToken);
  console.log("[SMS] Target number:", to);
  console.log("[SMS] Message:", message);

  if (!authToken) {
    console.warn("[SMS] AAKASH_SMS_TOKEN not configured — skipping SMS");
    return { success: false, error: "AAKASH_SMS_TOKEN not configured" };
  }

  const cleanNumber = to.replace(/\D/g, "").slice(-10);

  if (cleanNumber.length !== 10) {
    console.warn(`[SMS] Invalid phone number: ${to} — cleaned: ${cleanNumber}`);
    return { success: false, error: "Invalid phone number" };
  }

  const payload = new URLSearchParams();
  payload.append("auth_token", authToken);
  payload.append("to", cleanNumber);
  payload.append("text", message);

  const payloadStr = payload.toString();
  console.log("[SMS] Payload (redacted auth):", payloadStr.replace(authToken, "***"));

  try {
    const res = await fetch("https://sms.aakashsms.com/sms/v3/send", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payloadStr,
    });

    const body = await res.text();
    console.log(`[SMS] HTTP ${res.status} response:`, body);

    let parsed: any;
    try {
      parsed = JSON.parse(body);
    } catch {
      console.error("[SMS] Non-JSON response:", body);
      return { success: false, error: `Non-JSON response: ${body}` };
    }

    if (parsed?.error === true) {
      console.error("[SMS] Aakash API error:", parsed.message);
      return { success: false, error: parsed.message || "Aakash API returned error" };
    }

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
