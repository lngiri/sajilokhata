"use server";

import { getAdminClient } from "@/lib/supabase/admin";

function requireAdmin() {
  const admin = getAdminClient();
  if (!admin) throw new Error("Database connection unavailable");
  return admin;
}

export interface ProductCreateParams {
  merchant_id: string;
  name: string;
  unit?: string;
  default_rate: number;
  category?: string;
}

export interface ProductUpdateParams {
  name?: string;
  unit?: string;
  default_rate?: number;
  category?: string;
  is_active?: boolean;
  sort_order?: number;
}

export async function getMerchantProducts(merchantId: string) {
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
  const admin = requireAdmin();
  const { data, error } = await admin
    .from("merchant_products")
    .insert({
      merchant_id: params.merchant_id,
      name: params.name,
      unit: params.unit || "piece",
      default_rate: params.default_rate,
      category: params.category || null,
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
  const admin = requireAdmin();
  const { data, error } = await admin
    .from("merchant_products")
    .update(params)
    .eq("id", productId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteMerchantProduct(productId: string) {
  const admin = requireAdmin();
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
