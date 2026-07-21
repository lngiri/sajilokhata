"use server";

import { getAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";
import { createNotification } from "@/app/actions/notifications";
import type { Database } from "@/lib/types/database";

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
type CreditLogRow = Database["public"]["Tables"]["credit_logs"]["Row"];
type CreditLogInsert = Database["public"]["Tables"]["credit_logs"]["Insert"];
type CreditLogItemInsert = Database["public"]["Tables"]["credit_log_items"]["Insert"];
type MerchantCustomerRow = Database["public"]["Tables"]["merchant_customers"]["Row"];

// ──────────────────────────────────────────────
// Helper: find or create a customer row (admin client bypasses RLS)
// ──────────────────────────────────────────────
async function findOrCreateCustomerAdmin(
  phone: string,
  name?: string | null
): Promise<{ id: string; name: string | null }> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Admin client unavailable");

  const normalized = normalizePhone(phone);

  let { data: customer } = await (admin.from("customers")
    .select("id, name")
    .eq("phone", normalized)
    .maybeSingle() as Promise<{ data: Pick<CustomerRow, "id" | "name"> | null; error: any }>);

  if (!customer) {
    const { data: inserted, error } = await (admin.from("customers")
      .insert({ phone: normalized, name: name || null })
      .select("id, name")
      .single() as Promise<{ data: Pick<CustomerRow, "id" | "name">; error: any }>);
    if (error) {
      console.error("[Entry] Customer insert error:", error);
      throw new Error(`Failed to create customer: ${error.message}`);
    }
    customer = inserted;
  }

  return { id: customer.id, name: customer.name };
}

// ──────────────────────────────────────────────
// Helper: link a customer to a merchant (admin client bypasses RLS)
// ──────────────────────────────────────────────
async function linkCustomerToMerchantAdmin(
  merchantId: string,
  customerId: string,
  creditLimit = 5000
): Promise<void> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Admin client unavailable");

  const { data: existing } = await (admin.from("merchant_customers")
    .select("id")
    .eq("merchant_id", merchantId)
    .eq("customer_id", customerId)
    .maybeSingle() as Promise<{ data: Pick<MerchantCustomerRow, "id"> | null; error: any }>);

  if (existing) return; // already linked

  const { error } = await admin.from("merchant_customers")
    .insert({ merchant_id: merchantId, customer_id: customerId, credit_limit: creditLimit });

  if (error) {
    console.error("[Entry] Link customer error:", error);
    throw new Error(`Failed to link customer: ${error.message}`);
  }
}

// ──────────────────────────────────────────────
// Main entry point: save entry with optional customer creation
// ──────────────────────────────────────────────
export async function saveEntry(params: {
  merchant_id: string;
  customer_id?: string | null;
  customer_phone?: string | null;
  customer_name?: string | null;
  amount: number;
  type: "debit" | "credit" | "cash";
  description?: string | null;
  quantity?: number | null;
  unit?: "liter" | "jar" | "kg" | "piece" | "npr" | null;
  attachment_url?: string | null;
  idempotency_key?: string;
  items?: Array<{
    product_id?: string | null;
    product_name: string;
    quantity: number;
    unit: string;
    unit_price: number;
    description?: string;
  }>;
}): Promise<{
  success: boolean;
  error?: string;
  fullError?: any;
  entry?: {
    id: string;
    verification_token?: string | null;
    status: string;
  };
}> {
  console.log("[Entry] saveEntry called:", JSON.stringify(params));

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
    const admin = getAdminClient();
    if (!admin) {
      return { success: false, error: "Database connection unavailable" };
    }

    // ── Step 1: Resolve customer ──
    let resolvedCustomerId = params.customer_id || null;
    let resolvedCustomerName = params.customer_name || null;

    // If we have a phone but no customer_id yet, find or create
    if (!resolvedCustomerId && params.customer_phone) {
      try {
        const cust = await findOrCreateCustomerAdmin(params.customer_phone, params.customer_name);
        resolvedCustomerId = cust.id;
        resolvedCustomerName = cust.name;
        await linkCustomerToMerchantAdmin(params.merchant_id, cust.id);
      } catch (custErr) {
        const msg = custErr instanceof Error ? custErr.message : String(custErr);
        console.error("[Entry] Customer creation/linking failed:", msg);
        // For cash sales, proceed without customer
        if (!isCash) {
          return { success: false, error: `Customer error: ${msg}` };
        }
      }
    }

    // Non-cash must have a customer at this point
    if (!isCash && !resolvedCustomerId) {
      return { success: false, error: "Customer is required for debit/credit transactions" };
    }

    // ── Step 2: Idempotency check ──
    if (params.idempotency_key) {
      const { data: existingLog } = await (admin.from("credit_logs")
        .select("id, status, verification_token")
        .eq("merchant_id", params.merchant_id)
        .eq("idempotency_key", params.idempotency_key)
        .maybeSingle() as Promise<{ data: { id: string; status: string; verification_token: string | null } | null; error: any }>);

      if (existingLog) {
        return {
          success: true,
          entry: {
            id: existingLog.id,
            verification_token: existingLog.verification_token,
            status: existingLog.status,
          },
        };
      }
    }

    // ── Step 3: Insert credit_log entry ──
    const insertData: Record<string, unknown> = {
      merchant_id: params.merchant_id,
      customer_id: isCash ? null : resolvedCustomerId,
      amount: params.amount,
      type: params.type,
      description: params.description || null,
      status: isCash ? "approved" : "unverified",
      approved_at: isCash ? new Date().toISOString() : null,
    };
    if (params.quantity != null) {
      insertData.quantity = params.quantity;
    }
    if (params.unit) {
      insertData.unit = params.unit;
    }
    if (params.idempotency_key) {
      insertData.idempotency_key = params.idempotency_key;
    }
    // Only include attachment_url if it has a value — avoids 42703 crash
    // when the column has not been deployed yet (migration 024).
    if (params.attachment_url) {
      insertData.attachment_url = params.attachment_url;
    }
    const { data, error } = await (admin.from("credit_logs")
      .insert(insertData)
      .select()
      .single() as Promise<{ data: CreditLogRow; error: any }>);

    if (error) {
      console.error("[Entry] DB insert error — full payload:", JSON.stringify(error));
      return {
        success: false,
        error: `Database error: ${error.message}`,
        fullError: { code: error.code, message: error.message, details: error.details, hint: error.hint },
      };
    }

    console.log("[Entry] Entry saved successfully:", data?.id, "status:", data?.status);

    // ── Step 4: Insert credit_log_items (if provided) ──
    if (params.items && params.items.length > 0) {
      const itemRows: CreditLogItemInsert[] = params.items.map((item, index) => ({
        credit_log_id: data.id,
        product_id: item.product_id || null,
        product_name: item.product_name,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        description: item.description || null,
        sort_order: index,
      }));

      const { error: itemError } = await admin.from("credit_log_items").insert(itemRows);

      if (itemError) {
        console.error("[Entry] Items insert error (entry still saved):", JSON.stringify(itemError));
        // Entry is already saved — log error but don't fail the whole operation
      }
    }

    if (!isCash && resolvedCustomerId) {
      const { data: shop } = await (admin.from("merchants") as any)
        .select("name")
        .eq("id", params.merchant_id)
        .single()
        .catch(() => ({ data: null }));
      const shopName = shop?.name || "Shop";
      createNotification({
        userId: resolvedCustomerId,
        userType: "customer",
        type: "entry_created",
        title: `New entry at ${shopName}`,
        body: `Rs. ${Number(params.amount).toLocaleString()} ${params.type} added`,
        referenceId: data.id,
        referenceType: "credit_log",
      });
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
    console.error("[Entry] Unexpected error in saveEntry:", msg, err);
    return { success: false, error: msg, fullError: err };
  }
}

export async function updateEntryAttachment(
  entryId: string,
  attachmentUrl: string
): Promise<{ success: boolean; error?: string; fullError?: any }> {
  try {
    const admin = getAdminClient();
    if (!admin) {
      return { success: false, error: "Database connection unavailable" };
    }

    const updateData: Record<string, unknown> = { attachment_url: attachmentUrl };
    const { error } = await admin.from("credit_logs")
      .update(updateData)
      .eq("id", entryId);

    if (error) {
      // 42703 = missing column — skip silently so the entry still saves
      if (error.code === "42703") {
        console.warn("[Entry] attachment_url column missing (42703) — skip update");
        return { success: true };
      }
      console.error("[Entry] Attachment update error — full:", JSON.stringify(error));
      return { success: false, error: error.message, fullError: error };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Entry] Unexpected error in updateEntryAttachment:", msg, err);
    return { success: false, error: msg, fullError: err };
  }
}
