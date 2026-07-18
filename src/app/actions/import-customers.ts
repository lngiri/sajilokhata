"use server";

import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/supabase/admin";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { buildSmsText, calculateParts } from "@/lib/gsm-7";
import { sendTransactionSMS } from "./sms";

async function requireMerchant(): Promise<string> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) throw new Error("Not logged in");
  const session = await verifySessionToken(raw);
  const userId = session?.userId ?? null;
  if (!userId) throw new Error("Session expired");
  return userId;
}

export interface ImportRow {
  name: string;
  phone: string;
  amount: number;
  sendSms: boolean;
}

interface ImportPayload {
  phone: string;
  name: string;
  amount: number;
  merchant_id: string;
  short_code: string | null;
}

function validateNepaliPhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-\(\)]/g, "").replace(/^\+977/, "").slice(-10);
  if (!/^9[876]\d{8}$/.test(cleaned)) return null;
  return cleaned;
}

function generateShortCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function importCustomersAction(
  merchantId: string,
  payload: ImportRow[],
  merchantName: string
): Promise<{
  success: boolean;
  error?: string;
  imported?: number;
  smsSent?: number;
  smsFailed?: number;
  results?: { phone: string; success: boolean; error?: string }[];
}> {
  const sessionUserId = await requireMerchant().catch(() => null);
  if (!sessionUserId || sessionUserId !== merchantId) {
    return { success: false, error: "Not authenticated" };
  }

  const admin = getAdminClient();
  if (!admin) return { success: false, error: "Server configuration error" };

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://qrhisab.com";

  // ── Step 1: Validate & normalize ──
  const validRows: { name: string; phone: string; amount: number; short_code: string | null }[] = [];
  const smsRows: { name: string; phone: string; amount: number; short_code: string }[] = [];

  for (const row of payload) {
    const name = (row.name || "").trim();
    const amount = Number(row.amount) || 0;
    if (!name) continue;
    if (amount <= 0) continue;

    const phone = validateNepaliPhone(row.phone);
    if (!phone) continue;

    if (row.sendSms) {
      const shortCode = generateShortCode();
      smsRows.push({ name, phone, amount, short_code: shortCode });
      validRows.push({ name, phone, amount, short_code: shortCode });
    } else {
      validRows.push({ name, phone, amount, short_code: null });
    }
  }

  if (validRows.length === 0) {
    return { success: false, error: "No valid rows to import" };
  }

  // ── Step 2: Compute total SMS parts ──
  let totalSmsParts = 0;
  const smsTexts: string[] = [];
  for (const r of smsRows) {
    const text = buildSmsText(r.name, merchantName, r.amount, r.short_code);
    smsTexts.push(text);
    totalSmsParts += calculateParts(text);
  }

  // ── Step 3: Check SMS balance ──
  if (smsRows.length > 0) {
    const { data: merchant } = await (admin.from("merchants") as any)
      .select("sms_balance")
      .eq("id", merchantId)
      .single();

    const balance = (merchant as { sms_balance: number } | null)?.sms_balance ?? 0;
    if (balance < totalSmsParts) {
      return {
        success: false,
        error: `Insufficient SMS credit. Required: ${totalSmsParts} parts, Available: ${balance}.`,
      };
    }
  }

  // ── Step 4: Atomic DB transaction via PG function ──
  const dbPayload: ImportPayload[] = validRows.map((r) => ({
    phone: r.phone,
    name: r.name,
    amount: r.amount,
    merchant_id: merchantId,
    short_code: r.short_code,
  }));

  const { data: dbResult, error: dbError } = await (admin.rpc as any)(
    "import_customers",
    { p_payload: JSON.stringify(dbPayload) }
  );

  if (dbError) {
    console.error("[Import] DB transaction failed:", dbError);
    return { success: false, error: "Database error during import" };
  }

  const results = (dbResult as { phone: string; customer_id: string; log_id: string }[]) || [];
  const imported = results.length;

  // ── Step 5: Deduct SMS balance ──
  if (totalSmsParts > 0) {
    const { error: deductError } = await (admin.rpc as any)("decrement_sms_balance_bulk", {
      p_merchant_id: merchantId,
      p_amount: totalSmsParts,
    });
    if (deductError) {
      console.error("[Import] Failed to deduct SMS balance:", deductError);
    }
  }

  // ── Step 6: Batch SMS dispatch (chunks of 5) ──
  let smsSent = 0;
  let smsFailed = 0;
  const CHUNK_SIZE = 5;

  for (let i = 0; i < smsRows.length; i += CHUNK_SIZE) {
    const chunk = smsRows.slice(i, i + CHUNK_SIZE);
    const smsPromises = chunk.map((row, idx) =>
      sendTransactionSMS(row.phone, smsTexts[i + idx], merchantId)
        .then((res) => ({ phone: row.phone, success: res.success, error: res.error }))
        .catch(() => ({ phone: row.phone, success: false, error: "Network error" }))
    );

    const chunkResults = await Promise.all(smsPromises);
    for (const r of chunkResults) {
      if (r.success) smsSent++;
      else smsFailed++;
    }

    if (i + CHUNK_SIZE < smsRows.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return {
    success: true,
    imported,
    smsSent,
    smsFailed,
    results: results.map((r) => ({
      phone: r.phone,
      success: true,
    })),
  };
}
