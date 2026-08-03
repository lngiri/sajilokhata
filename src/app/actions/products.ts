"use server";

import { getAdminClient } from "@/lib/supabase/admin";
import { requireMerchant } from "@/app/actions/merchant";

function requireAdmin() {
  const admin = getAdminClient();
  if (!admin) throw new Error("Database connection unavailable");
  return admin;
}

const NAME_MAX_LENGTH = 100;
const CATEGORY_MAX_LENGTH = 50;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

function assertValidProductParams(name: string, defaultRate: number) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Product name is required");
  if (trimmed.length > NAME_MAX_LENGTH) {
    throw new Error(`Product name must be ${NAME_MAX_LENGTH} characters or less`);
  }
  if (typeof defaultRate !== "number" || isNaN(defaultRate) || defaultRate < 0) {
    throw new Error("Rate must be a non-negative number");
  }
  return trimmed;
}

async function assertOwnsProduct(
  admin: ReturnType<typeof requireAdmin>,
  productId: string,
  merchantId: string
): Promise<void> {
  const { data, error } = await admin
    .from("merchant_products")
    .select("id, merchant_id")
    .eq("id", productId)
    .maybeSingle();

  if (error || !data) throw new Error("Product not found");
  if (data.merchant_id !== merchantId) {
    throw new Error("You are not authorized to modify this product");
  }
}

export interface ProductCreateParams {
  merchant_id: string;
  name: string;
  unit?: string;
  default_rate: number;
  category?: string | null;
}

export interface ProductUpdateParams {
  name?: string;
  unit?: string;
  default_rate?: number;
  category?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

export async function getMerchantProducts(merchantId: string) {
  const sessionUserId = await requireMerchant();
  if (sessionUserId !== merchantId) throw new Error("Not logged in");

  const admin = requireAdmin();
  const { data, error } = await admin
    .from("merchant_products")
    .select("*")
    .eq("merchant_id", merchantId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getAllMerchantProducts(merchantId: string) {
  const sessionUserId = await requireMerchant();
  if (sessionUserId !== merchantId) throw new Error("Not logged in");

  const admin = requireAdmin();
  const { data, error } = await admin
    .from("merchant_products")
    .select("*")
    .eq("merchant_id", merchantId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createMerchantProduct(params: ProductCreateParams) {
  const sessionUserId = await requireMerchant();
  if (sessionUserId !== params.merchant_id) throw new Error("Not logged in");

  const name = assertValidProductParams(params.name, params.default_rate);
  const category = params.category?.trim() || null;
  if (category && category.length > CATEGORY_MAX_LENGTH) {
    throw new Error(`Category must be ${CATEGORY_MAX_LENGTH} characters or less`);
  }

  const admin = requireAdmin();

  // Duplicate-name guard (case-insensitive), scoped to this merchant.
  const pattern = escapeLike(name);
  const { data: existing } = await admin
    .from("merchant_products")
    .select("id")
    .eq("merchant_id", params.merchant_id)
    .ilike("name", pattern)
    .maybeSingle();

  if (existing) {
    throw new Error("A product with this name already exists");
  }

  const { data, error } = await admin
    .from("merchant_products")
    .insert({
      merchant_id: params.merchant_id,
      name,
      unit: params.unit || "piece",
      default_rate: params.default_rate,
      category,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateMerchantProduct(
  productId: string,
  params: ProductUpdateParams
) {
  const sessionUserId = await requireMerchant();

  const admin = requireAdmin();
  await assertOwnsProduct(admin, productId, sessionUserId);

  const updates: Record<string, unknown> = {};
  let nameUpdated = false;

  if (params.name !== undefined) {
    const name = assertValidProductParams(params.name, params.default_rate ?? 0);
    updates.name = name;
    nameUpdated = true;
  }
  if (params.unit !== undefined) {
    updates.unit = params.unit;
  }
  if (params.category !== undefined) {
    const category = params.category?.trim() || null;
    if (category && category.length > CATEGORY_MAX_LENGTH) {
      throw new Error(`Category must be ${CATEGORY_MAX_LENGTH} characters or less`);
    }
    updates.category = category;
  }
  if (params.default_rate !== undefined) {
    if (typeof params.default_rate !== "number" || isNaN(params.default_rate) || params.default_rate < 0) {
      throw new Error("Rate must be a non-negative number");
    }
    updates.default_rate = params.default_rate;
  }
  if (params.is_active !== undefined) {
    updates.is_active = params.is_active;
  }
  if (params.sort_order !== undefined) {
    updates.sort_order = params.sort_order;
  }

  // Duplicate-name guard (case-insensitive), scoped to this merchant.
  if (nameUpdated) {
    const pattern = escapeLike(updates.name as string);
    const { data: existing } = await admin
      .from("merchant_products")
      .select("id")
      .eq("merchant_id", sessionUserId)
      .ilike("name", pattern)
      .neq("id", productId)
      .maybeSingle();

    if (existing) {
      throw new Error("A product with this name already exists");
    }
  }

  const { data, error } = await admin
    .from("merchant_products")
    .update(updates)
    .eq("id", productId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteMerchantProduct(productId: string) {
  const sessionUserId = await requireMerchant();

  const admin = requireAdmin();
  await assertOwnsProduct(admin, productId, sessionUserId);

  const { error } = await admin
    .from("merchant_products")
    .update({ is_active: false })
    .eq("id", productId);

  if (error) throw error;
}

export async function insertCreditLogItems(
  creditLogId: string,
  items: Array<{
    product_id?: string;
    product_name: string;
    quantity: number;
    unit: string;
    unit_price: number;
    description?: string;
    sort_order?: number;
  }>
) {
  if (!items.length) return;

  const admin = requireAdmin();
  const rows = items.map((item, index) => ({
    credit_log_id: creditLogId,
    product_id: item.product_id || null,
    product_name: item.product_name,
    quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unit_price,
    description: item.description || null,
    sort_order: item.sort_order ?? index,
  }));

  const { error } = await admin
    .from("credit_log_items")
    .insert(rows);

  if (error) throw error;
}

export async function getCreditLogItems(creditLogId: string) {
  const admin = requireAdmin();
  const { data, error } = await admin
    .from("credit_log_items")
    .select("*")
    .eq("credit_log_id", creditLogId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data || [];
}
