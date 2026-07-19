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

export interface SmsChunk {
  texts: string[];
  phones: string[];
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
  imported: number;
  smsChunks: SmsChunk[] | null;
}> {
  const sessionUserId = await requireMerchant().catch(() => null);
  if (!sessionUserId || sessionUserId !== merchantId) {
    return { success: false, error: "Not authenticated", imported: 0, smsChunks: null };
  }

  const admin = getAdminClient();
  if (!admin) return { success: false, error: "Server configuration error", imported: 0, smsChunks: null };

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
    return { success: false, error: "No valid rows to import", imported: 0, smsChunks: null };
  }

  // ── Step 2: Compute SMS texts & parts ──
  // Use app.qrhisab.com as the default domain for SMS verification links
  const domain = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://app.qrhisab.com").hostname;
  let totalSmsParts = 0;
  const smsTexts: string[] = [];
  for (const r of smsRows) {
    const text = buildSmsText(r.name, merchantName, r.amount, r.short_code, domain);
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
        imported: 0,
        smsChunks: null,
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
    return { success: false, error: "Database error during import", imported: 0, smsChunks: null };
  }

  const imported = ((dbResult as { phone: string }[]) || []).length;

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

  // ── Step 6: Build SMS chunks for client-side dispatch ──
  const CHUNK_SIZE = 5;
  const smsChunks: SmsChunk[] = [];
  for (let i = 0; i < smsRows.length; i += CHUNK_SIZE) {
    const chunk = smsRows.slice(i, i + CHUNK_SIZE);
    smsChunks.push({
      phones: chunk.map((r) => r.phone),
      texts: chunk.map((_, idx) => smsTexts[i + idx]),
    });
  }

  return { success: true, imported, smsChunks: smsChunks.length > 0 ? smsChunks : null };
}

/**
 * Send a single chunk of SMS messages (max 5).
 * Called repeatedly by the client to enable per-chunk progress UI.
 * Does NOT decrement balance — that was already done in importCustomersAction.
 */
export async function sendSmsChunkAction(
  chunk: SmsChunk
): Promise<{ sent: number; failed: number; errors: string[] }> {
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  const promises = chunk.phones.map((phone, idx) =>
    sendTransactionSMS(phone, chunk.texts[idx])
      .then((res) => {
        if (res.success) sent++;
        else {
          failed++;
          errors.push(res.error || "Unknown error");
        }
      })
      .catch(() => { failed++; errors.push("Network error"); })
  );

  await Promise.all(promises);
  return { sent, failed, errors };
}
