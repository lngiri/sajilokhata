"use server";

import { getAdminClient } from "@/lib/supabase/admin";
import { sendTransactionNotification } from "./sms";

export async function saveEntry(params: {
  merchant_id: string;
  customer_id?: string | null;
  amount: number;
  type: "debit" | "credit" | "cash";
  description?: string | null;
  attachment_url?: string | null;
  customerPhone?: string | null;
  customerName?: string | null;
}): Promise<{
  success: boolean;
  error?: string;
  entry?: {
    id: string;
    verification_token?: string | null;
    status: string;
  };
}> {
  console.log("[Entry] saveEntry called:", params);

  try {
    if (!params.merchant_id) {
      return { success: false, error: "merchant_id is required" };
    }
    if (!params.amount || typeof params.amount !== "number" || params.amount <= 0) {
      return { success: false, error: "Amount must be a positive number" };
    }
    if (!["debit", "credit", "cash"].includes(params.type)) {
      return { success: false, error: "Invalid transaction type" };
    }

    const isCash = params.type === "cash";

    if (!isCash && !params.customer_id) {
      return { success: false, error: "Customer is required for debit/credit transactions" };
    }

    const admin = getAdminClient();
    if (!admin) {
      return { success: false, error: "Database connection unavailable" };
    }

    const { data, error } = await (admin.from("credit_logs") as any)
      .insert({
        merchant_id: params.merchant_id,
        customer_id: isCash ? null : params.customer_id,
        amount: params.amount,
        type: params.type,
        description: params.description || null,
        status: isCash ? "approved" : "unverified",
        approved_at: isCash ? new Date().toISOString() : null,
        sync_status: "online",
        attachment_url: params.attachment_url || null,
      })
      .select()
      .single();

    if (error) {
      console.error("[Entry] DB insert error:", error);
      return { success: false, error: `Database error: ${error.message}` };
    }

    console.log("[Entry] Entry saved:", data?.id, "status:", data?.status);

    // Fire-and-forget SMS notification
    if (params.customerPhone && params.merchant_id) {
      sendTransactionNotification({
        to: params.customerPhone,
        merchantId: params.merchant_id,
        amount: params.amount,
        type: params.type,
        customerName: params.customerName,
      }).catch((err) => console.warn("[Entry] SMS notify failed:", err));
    }

    return {
      success: true,
      entry: {
        id: data.id,
        verification_token: data.verification_token,
        status: data.status,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Entry] Unexpected error in saveEntry:", msg);
    return { success: false, error: msg };
  }
}

export async function updateEntryAttachment(
  entryId: string,
  attachmentUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = getAdminClient();
    if (!admin) {
      return { success: false, error: "Database connection unavailable" };
    }

    const { error } = await (admin.from("credit_logs") as any)
      .update({ attachment_url: attachmentUrl })
      .eq("id", entryId);

    if (error) {
      console.error("[Entry] Attachment update error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Entry] Unexpected error in updateEntryAttachment:", msg);
    return { success: false, error: msg };
  }
}
