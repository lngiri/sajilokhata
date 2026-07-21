"use server";

import { getAdminClient } from "@/lib/supabase/admin";

export type NotificationType =
  | "entry_created"
  | "entry_approved"
  | "entry_rejected"
  | "entry_disputed"
  | "edit_requested"
  | "edit_accepted"
  | "edit_rejected"
  | "payment_voucher"
  | "customer_linked"
  | "credit_limit_changed"
  | "payment_reminder";

interface CreateNotificationParams {
  userId: string;
  userType: "merchant" | "customer";
  type: NotificationType;
  title: string;
  body?: string;
  referenceId?: string;
  referenceType?: "credit_log" | "customer" | "merchant_customer" | "payment_reminder_log";
}

export async function createNotification(params: CreateNotificationParams): Promise<void> {
  const admin = getAdminClient();
  if (!admin) return;

  try {
    await admin.from("notifications").insert({
      user_id: params.userId,
      user_type: params.userType,
      type: params.type,
      title: params.title,
      body: params.body || null,
      reference_id: params.referenceId || null,
      reference_type: params.referenceType || null,
    });
  } catch (err) {
    console.error("[Notification] create error:", err);
  }
}

export async function getNotifications(
  userId: string,
  userType: "merchant" | "customer",
  limit = 20
): Promise<any[]> {
  const admin = getAdminClient();
  if (!admin) return [];

  try {
    const { data } = await admin
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .eq("user_type", userType)
      .order("created_at", { ascending: false })
      .limit(limit);

    return data || [];
  } catch (err) {
    console.error("[Notification] get error:", err);
    return [];
  }
}

export async function getUnreadCount(
  userId: string,
  userType: "merchant" | "customer"
): Promise<number> {
  const admin = getAdminClient();
  if (!admin) return 0;

  try {
    const { count } = await admin
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("user_type", userType)
      .eq("read", false);

    return count || 0;
  } catch (err) {
    console.error("[Notification] unread count error:", err);
    return 0;
  }
}

export async function markAsRead(
  userId: string,
  userType: "merchant" | "customer",
  notificationIds?: string[]
): Promise<void> {
  const admin = getAdminClient();
  if (!admin) return;

  try {
    let query = admin
      .from("notifications")
      .update({ read: true, read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("user_type", userType);

    if (notificationIds && notificationIds.length > 0) {
      query = query.in("id", notificationIds);
    }

    await query;
  } catch (err) {
    console.error("[Notification] markAsRead error:", err);
  }
}
