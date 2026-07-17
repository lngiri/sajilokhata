"use server";

import { getAdminClient } from "@/lib/supabase/admin";

export async function sendTransactionSMS(
  to: string,
  message: string,
  merchantId?: string
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

  // ─── SMS Credit Guard ──────────────────────────────────────
  if (merchantId) {
    const admin = getAdminClient();
    if (admin) {
      const { data: merchant } = await (admin.from("merchants") as any)
        .select("sms_balance")
        .eq("id", merchantId)
        .single();
      if (!merchant || merchant.sms_balance <= 0) {
        console.warn(`[SMS] Merchant ${merchantId} has insufficient SMS credits`);
        return { success: false, error: "INSUFFICIENT_SMS_CREDIT" };
      }
    }
  }

  const payload = new URLSearchParams();
  payload.append("auth_token", authToken);
  payload.append("to", cleanNumber);
  payload.append("text", message);

  const payloadStr = payload.toString();
  console.log("[SMS] Payload (redacted auth):", payloadStr.replace(authToken, "***"));

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch("https://sms.aakashsms.com/sms/v3/send", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payloadStr,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const body = await res.text();
    console.log(`[SMS] HTTP ${res.status} response:`, body);

    // Aakash SMS returns HTTP 200 even for errors, with {error:true} in body
    let parsed: any;
    try {
      parsed = JSON.parse(body);
    } catch {
      console.error("[SMS] Non-JSON response:", body);
      return { success: false, error: `SMS gateway returned an unexpected response.` };
    }

    if (parsed?.error === true) {
      console.error("[SMS] Aakash API error:", parsed.message);
      return { success: false, error: parsed.message || "SMS gateway error" };
    }

    // Check for invalid recipient (API returns error:false even for invalid numbers)
    if (parsed?.data?.invalid?.length > 0) {
      const rejected = parsed.data.invalid.map((r: any) => r.mobile).join(", ");
      console.error("[SMS] Recipient number rejected by gateway:", rejected);
      return { success: false, error: "Could not send SMS to this number. Please check and try again." };
    }

    if (!res.ok) {
      console.error("[SMS] Non-OK response:", res.status, body);
      return { success: false, error: `SMS gateway error (HTTP ${res.status})` };
    }

    console.log("[SMS] Sent successfully:", body);

    // ─── Decrement SMS balance for merchant-initiated sends ──
    if (merchantId) {
      const admin = getAdminClient();
      if (admin) {
        await (admin.rpc as any)("decrement_sms_balance", { p_merchant_id: merchantId });
      }
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[SMS] Network/fetch error:", msg);
    return { success: false, error: msg };
  }
}

export async function sendTransactionNotification(params: {
  to: string;
  merchantId: string;
  amount: number;
  type: "debit" | "credit" | "cash";
  customerName?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  const { to, merchantId, amount, type, customerName } = params;

  console.log("[SMS-NOTIFICATION] Starting for merchant:", merchantId);

  const client = getAdminClient();
  if (!client) {
    console.warn("[SMS-NOTIFICATION] Admin client unavailable, skipping merchant lookup");
  }

  let shopName = "Shop";
  if (client) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: merchant } = await (client.from("merchants") as any)
      .select("name, business_name")
      .eq("id", merchantId)
      .single();
    shopName = merchant?.business_name || merchant?.name || "Shop";
  }

  const formattedAmount = `Rs. ${Number(amount).toLocaleString()}`;

  let message: string;
  if (type === "cash") {
    message = `Thank you for shopping at ${shopName}! Cash payment received: ${formattedAmount}.`;
  } else if (type === "debit") {
    const greeting = customerName ? `Dear ${customerName}, ` : "";
    message = `${greeting}${formattedAmount} has been added to your ledger at ${shopName}.`;
  } else {
    const greeting = customerName ? `Dear ${customerName}, ` : "";
    message = `${greeting}${formattedAmount} has been credited to your account at ${shopName}.`;
  }

  return sendTransactionSMS(to, message, merchantId);
}
