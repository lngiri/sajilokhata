"use server";

import { cookies } from "next/headers";
import crypto from "crypto";
import { getAdminClient } from "@/lib/supabase/admin";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { SMS_PACKAGES, type SmsPackageType, type EsewaInitResponse, type EsewaVerifyResponse } from "@/lib/types/sms-billing";

// ─── eSewa Configuration ──────────────────────────────────
const ESEWA_PRODUCT_CODE = process.env.ESEWA_PRODUCT_CODE || "EPAYTEST";
const ESEWA_SECRET_KEY = process.env.ESEWA_SECRET_KEY || "8g8M8maxQPm86ksx";
const ESEWA_UAT_URL = "https://uat.esewa.com.np/epay/main";

// ─── Auth Helper ────────────────────────────────────────────
async function requireMerchant(): Promise<string> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) throw new Error("Not logged in");

  const userId = await verifySessionToken(raw);
  if (!userId) throw new Error("Session expired");

  return userId;
}

// ─── HMAC-SHA256 Signature Generator ───────────────────────
function generateEsewaSignature(totalAmount: number, transactionUuid: string, productCode: string): string {
  const dataString = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`;
  return crypto.createHmac("sha256", ESEWA_SECRET_KEY).update(dataString).digest("base64");
}

// ─── Initiate eSewa Payment ────────────────────────────────
export async function initiateEsewaPayment(
  merchantId: string,
  packageType: SmsPackageType
): Promise<EsewaInitResponse> {
  const admin = getAdminClient();
  if (!admin) return { success: false, error: "Server configuration error" };

  // Verify session
  const sessionUserId = await requireMerchant().catch(() => null);
  if (!sessionUserId || sessionUserId !== merchantId) {
    return { success: false, error: "Not logged in" };
  }

  const pkg = SMS_PACKAGES[packageType];
  if (!pkg) return { success: false, error: "Invalid package type" };

  const totalAmount = pkg.amount;
  const transactionUuid = `${merchantId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Create pending log entry
  const { error: insertError } = await (admin.from("sms_recharge_logs") as any).insert({
    merchant_id: merchantId,
    amount: totalAmount,
    sms_count: pkg.sms_count,
    transaction_uuid: transactionUuid,
    status: "pending",
  });

  if (insertError) {
    console.error("[SMS-BILLING] Failed to create recharge log:", insertError);
    return { success: false, error: "Database error" };
  }

  // Generate signature
  const signature = generateEsewaSignature(totalAmount, transactionUuid, ESEWA_PRODUCT_CODE);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.qrhisab.com";

  const formParams: Record<string, string> = {
    amt: String(pkg.amount),
    psc: "0",
    pdc: "0",
    txAmt: "0",
    tAmt: String(totalAmount),
    pid: transactionUuid,
    scd: ESEWA_PRODUCT_CODE,
    su: `${baseUrl}/api/merchant/billing/callback`,
    fu: `${baseUrl}/merchant/billing`,
  };

  return {
    success: true,
    formParams,
    esewaUrl: ESEWA_UAT_URL,
  };
}

// ─── Verify eSewa Payment ──────────────────────────────────
export async function verifyEsewaPayment(
  encodedData: string
): Promise<EsewaVerifyResponse> {
  const admin = getAdminClient();
  if (!admin) return { success: false, error: "Server configuration error" };

  let decoded: Record<string, string>;
  try {
    const jsonStr = Buffer.from(encodedData, "base64").toString("utf-8");
    decoded = JSON.parse(jsonStr);
  } catch {
    return { success: false, error: "Invalid encoded data" };
  }

  const { transaction_code, status, total_amount, transaction_uuid, signature } = decoded;

  if (status !== "COMPLETE") {
    return { success: false, error: `Payment status: ${status}` };
  }

  if (!transaction_uuid || !transaction_code) {
    return { success: false, error: "Missing transaction details" };
  }

  // Verify signature
  const expectedSignature = generateEsewaSignature(
    Number(total_amount),
    transaction_uuid,
    ESEWA_PRODUCT_CODE
  );
  if (signature !== expectedSignature) {
    console.error("[SMS-BILLING] Signature mismatch");
    return { success: false, error: "Signature verification failed" };
  }

  // Idempotency check
  const { data: existingLog } = await (admin.from("sms_recharge_logs") as any)
    .select("id, status, sms_count, merchant_id")
    .eq("transaction_uuid", transaction_uuid)
    .single();

  if (!existingLog) {
    return { success: false, error: "Transaction not found" };
  }

  if (existingLog.status === "completed") {
    return { success: true, smsAdded: existingLog.sms_count };
  }

  // Check if esewa_ref_id already used
  if (transaction_code) {
    const { data: dupRef } = await (admin.from("sms_recharge_logs") as any)
      .select("id")
      .eq("esewa_ref_id", transaction_code)
      .maybeSingle();
    if (dupRef) {
      return { success: false, error: "Duplicate payment reference" };
    }
  }

  // Update log to completed
  const { error: updateError } = await (admin.from("sms_recharge_logs") as any)
    .update({
      status: "completed",
      esewa_ref_id: transaction_code || null,
    })
    .eq("id", existingLog.id);

  if (updateError) {
    console.error("[SMS-BILLING] Failed to update recharge log:", updateError);
    return { success: false, error: "Database update failed" };
  }

  // Increment merchant's SMS balance
  const totalSms = existingLog.sms_count;
  const { error: balanceError } = await (admin.rpc as any)("increment_sms_balance", {
    p_merchant_id: existingLog.merchant_id,
    p_amount: totalSms,
  });

  if (balanceError) {
    console.warn("[SMS-BILLING] Failed to increment balance via RPC, trying direct update:", balanceError);
    const { data: merchant } = await (admin.from("merchants") as any)
      .select("sms_balance")
      .eq("id", existingLog.merchant_id)
      .single();
    if (merchant) {
      await (admin.from("merchants") as any)
        .update({ sms_balance: (merchant.sms_balance || 0) + totalSms })
        .eq("id", existingLog.merchant_id);
    }
  }

  return { success: true, smsAdded: totalSms };
}

// ─── Get Merchant SMS Balance ──────────────────────────────
export async function getMerchantSmsBalance(merchantId: string): Promise<number> {
  const admin = getAdminClient();
  if (!admin) return 0;

  const sessionUserId = await requireMerchant().catch(() => null);
  if (!sessionUserId || sessionUserId !== merchantId) return 0;

  const { data } = await (admin.from("merchants") as any)
    .select("sms_balance")
    .eq("id", merchantId)
    .single();

  return data?.sms_balance ?? 0;
}

// ─── Get Recharge History ──────────────────────────────────
export async function getMerchantRechargeHistory(
  merchantId: string
): Promise<{ success: boolean; error?: string; logs?: any[] }> {
  const admin = getAdminClient();
  if (!admin) return { success: false, error: "Server configuration error" };

  const sessionUserId = await requireMerchant().catch(() => null);
  if (!sessionUserId || sessionUserId !== merchantId) {
    return { success: false, error: "Not logged in" };
  }

  const { data, error } = await (admin.from("sms_recharge_logs") as any)
    .select("*")
    .eq("merchant_id", merchantId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return { success: false, error: error.message };
  return { success: true, logs: data || [] };
}
