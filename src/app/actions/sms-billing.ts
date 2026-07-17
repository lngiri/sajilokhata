"use server";

import { cookies } from "next/headers";
import crypto from "crypto";
import { getAdminClient } from "@/lib/supabase/admin";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { requireAdmin } from "@/app/actions/admin";
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

  const session = await verifySessionToken(raw);
  const userId = session?.userId ?? null;
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

// ─── Request Types ──────────────────────────────────────────
export type SmsRequestRecord = {
  id: string;
  merchant_id: string;
  amount: number;
  sms_count: number;
  transaction_id: string | null;
  screenshot_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  merchants?: { name: string; phone: string; business_name: string | null } | null;
};

// ─── Create Manual SMS Request (Merchant) ──────────────────
export async function createManualSmsRequest(
  formData: FormData
): Promise<{ success: boolean; error?: string; requestId?: string }> {
  const admin = getAdminClient();
  if (!admin) return { success: false, error: "Server configuration error" };

  const sessionUserId = await requireMerchant().catch(() => null);
  if (!sessionUserId) return { success: false, error: "Not logged in" };

  const merchantId = formData.get("merchantId") as string;
  const amount = Number(formData.get("amount"));
  const smsCount = Number(formData.get("smsCount"));
  const transactionId = formData.get("transactionId") as string;
  const screenshotBase64 = formData.get("screenshot") as string;

  if (!merchantId || merchantId !== sessionUserId) {
    return { success: false, error: "Session mismatch" };
  }
  if (!amount || amount <= 0) return { success: false, error: "Invalid amount" };
  if (!smsCount || smsCount <= 0) return { success: false, error: "Invalid SMS count" };
  if (!transactionId?.trim()) return { success: false, error: "Transaction ID is required" };
  if (!screenshotBase64) return { success: false, error: "Screenshot is required" };

  // Decode and upload screenshot
  let screenshotUrl: string;
  try {
    const matches = screenshotBase64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!matches) return { success: false, error: "Invalid image data" };

    const mimeType = matches[1];
    const ext = mimeType.split("/")[1];
    const buffer = Buffer.from(matches[2], "base64");
    const fileName = `${merchantId}/${crypto.randomUUID()}.${ext}`;

    const { data: uploadData, error: uploadError } = await (admin.storage
      .from("payment-proofs") as any).upload(fileName, buffer, {
      contentType: mimeType,
      upsert: false,
    });

    if (uploadError) {
      console.error("[SMS-BILLING] Screenshot upload failed:", uploadError);
      return { success: false, error: "Failed to upload screenshot" };
    }

    // Get public URL (bucket is not public, but service role can generate signed URL)
    const { data: urlData } = await (admin.storage
      .from("payment-proofs") as any).getPublicUrl(fileName);
    screenshotUrl = urlData?.publicUrl || fileName;
  } catch (err) {
    console.error("[SMS-BILLING] Screenshot processing error:", err);
    return { success: false, error: "Failed to process screenshot" };
  }

  // Insert sms_requests record
  const { data: newRequest, error: insertError } = await (admin
    .from("sms_requests") as any)
    .insert({
      merchant_id: merchantId,
      amount,
      sms_count: smsCount,
      transaction_id: transactionId.trim(),
      screenshot_url: screenshotUrl,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[SMS-BILLING] Failed to create request:", insertError);
    return { success: false, error: "Database error" };
  }

  return { success: true, requestId: newRequest?.id };
}

// ─── Get Pending SMS Requests (Admin) ──────────────────────
export async function getPendingSmsRequests(): Promise<{
  success: boolean;
  error?: string;
  requests?: SmsRequestRecord[];
}> {
  const admin = getAdminClient();
  if (!admin) return { success: false, error: "Server configuration error" };

  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const { data, error } = await (admin
    .from("sms_requests") as any)
    .select("*, merchants!inner(name, phone, business_name)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[SMS-BILLING] Failed to fetch pending requests:", error);
    return { success: false, error: error.message };
  }

  return { success: true, requests: data || [] };
}

// ─── Approve SMS Request (Admin) ────────────────────────────
export async function approveSmsRequest(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  const admin = getAdminClient();
  if (!admin) return { success: false, error: "Server configuration error" };

  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  // Get the request
  const { data: request, error: fetchError } = await (admin
    .from("sms_requests") as any)
    .select("*")
    .eq("id", requestId)
    .single();

  if (fetchError || !request) {
    return { success: false, error: "Request not found" };
  }

  if (request.status !== "pending") {
    return { success: false, error: `Request already ${request.status}` };
  }

  // Update status to approved
  const { error: updateError } = await (admin
    .from("sms_requests") as any)
    .update({ status: "approved" })
    .eq("id", requestId);

  if (updateError) {
    console.error("[SMS-BILLING] Failed to approve request:", updateError);
    return { success: false, error: "Failed to update request" };
  }

  // Increment merchant's SMS balance
  const { error: balanceError } = await (admin.rpc as any)("increment_sms_balance", {
    p_merchant_id: request.merchant_id,
    p_amount: request.sms_count,
  });

  if (balanceError) {
    console.warn("[SMS-BILLING] RPC failed, trying direct update:", balanceError);
    const { data: merchant } = await (admin.from("merchants") as any)
      .select("sms_balance")
      .eq("id", request.merchant_id)
      .single();
    if (merchant) {
      await (admin.from("merchants") as any)
        .update({ sms_balance: (merchant.sms_balance || 0) + request.sms_count })
        .eq("id", request.merchant_id);
    }
  }

  return { success: true };
}

// ─── Reject SMS Request (Admin) ─────────────────────────────
export async function rejectSmsRequest(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  const admin = getAdminClient();
  if (!admin) return { success: false, error: "Server configuration error" };

  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const { data: request, error: fetchError } = await (admin
    .from("sms_requests") as any)
    .select("status")
    .eq("id", requestId)
    .single();

  if (fetchError || !request) {
    return { success: false, error: "Request not found" };
  }

  if (request.status !== "pending") {
    return { success: false, error: `Request already ${request.status}` };
  }

  const { error: updateError } = await (admin
    .from("sms_requests") as any)
    .update({ status: "rejected" })
    .eq("id", requestId);

  if (updateError) {
    console.error("[SMS-BILLING] Failed to reject request:", updateError);
    return { success: false, error: "Failed to update request" };
  }

  return { success: true };
}
