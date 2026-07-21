// ============================================================
// Sajilo Khata - Auto-generated Database Types
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type BusinessType = "kirana" | "dairy" | "meat" | "hardware" | "clothing" | "pharmacy" | "restaurant" | "other";
export type TrustStatus = "good" | "warning" | "defaulter";
export type MerchantStatus = "active" | "suspended";
export type CreditUnit = "liter" | "jar" | "kg" | "piece" | "npr";
export type TransactionType = "debit" | "credit" | "cash";
export type TransactionStatus = "pending" | "unverified" | "approved" | "disputed" | "rejected" | "edit_requested";
export type SyncStatus = "online" | "offline_pending" | "syncing" | "failed";
export type ActorType = "merchant" | "customer" | "admin";
export type AuditAction = "created" | "approved" | "disputed" | "rejected" | "modified" | "edit_requested" | "edit_accepted" | "edit_rejected" | "pin_reset";
export type InitiatedBy = "merchant" | "customer";

export type PaymentMethodType = "fonepay" | "esewa" | "khalti" | "nepalpay" | "bank_deposit" | "cash";
export type ReminderType = "sms" | "share_link";

export interface Database {
  public: {
    Tables: {
      merchants: {
        Row: {
          id: string;
          name: string;
          phone: string;
          business_type: BusinessType;
          business_name: string | null;
          address: string | null;
          photo_url: string | null;
          pin_hash: string | null;
          status: MerchantStatus;
          suspended_at: string | null;
          force_logout_at: string | null;
          sms_balance: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone: string;
          business_type: BusinessType;
          business_name?: string | null;
          address?: string | null;
          photo_url?: string | null;
          pin_hash?: string | null;
          status?: MerchantStatus;
          suspended_at?: string | null;
          force_logout_at?: string | null;
          sms_balance?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string;
          business_type?: BusinessType;
          business_name?: string | null;
          address?: string | null;
          photo_url?: string | null;
          pin_hash?: string | null;
          status?: MerchantStatus;
          suspended_at?: string | null;
          force_logout_at?: string | null;
          sms_balance?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          name: string | null;
          phone: string;
          pin_hash: string | null;
          home_location_gps: unknown | null;
          trust_status: TrustStatus;
          trust_notes: string | null;
          flagged_by_merchant_id: string | null;
          flagged_at: string | null;
          avatar_url: string | null;
          address: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name?: string | null;
          phone: string;
          pin_hash?: string | null;
          home_location_gps?: unknown | null;
          trust_status?: TrustStatus;
          trust_notes?: string | null;
          flagged_by_merchant_id?: string | null;
          flagged_at?: string | null;
          avatar_url?: string | null;
          address?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string | null;
          phone?: string;
          pin_hash?: string | null;
          home_location_gps?: unknown | null;
          trust_status?: TrustStatus;
          trust_notes?: string | null;
          flagged_by_merchant_id?: string | null;
          flagged_at?: string | null;
          avatar_url?: string | null;
          address?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      merchant_customers: {
        Row: {
          id: string;
          merchant_id: string;
          customer_id: string;
          credit_limit: number;
          nickname: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          customer_id: string;
          credit_limit?: number;
          nickname?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          customer_id?: string;
          credit_limit?: number;
          nickname?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      credit_logs: {
        Row: {
          id: string;
          merchant_id: string;
          customer_id: string | null;
          amount: number;
          quantity: number | null;
          unit: CreditUnit | null;
          description: string | null;
          type: TransactionType;
          status: TransactionStatus;
          sync_status: SyncStatus;
          ip_address: string | null;
          device_info: string | null;
          verification_token: string | null;
          disputed_reason: string | null;
          proposed_amount: number | null;
          attachment_url: string | null;
          initiated_by: InitiatedBy;
          created_at: string;
          approved_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          customer_id?: string | null;
          amount: number;
          quantity?: number | null;
          unit?: CreditUnit | null;
          description?: string | null;
          type: TransactionType;
          status?: TransactionStatus;
          sync_status?: SyncStatus;
          ip_address?: string | null;
          device_info?: string | null;
          verification_token?: string | null;
          disputed_reason?: string | null;
          proposed_amount?: number | null;
          attachment_url?: string | null;
          initiated_by?: InitiatedBy;
          created_at?: string;
          approved_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          customer_id?: string | null;
          amount?: number;
          quantity?: number | null;
          unit?: CreditUnit | null;
          description?: string | null;
          type?: TransactionType;
          status?: TransactionStatus;
          sync_status?: SyncStatus;
          ip_address?: string | null;
          device_info?: string | null;
          verification_token?: string | null;
          disputed_reason?: string | null;
          proposed_amount?: number | null;
          attachment_url?: string | null;
          initiated_by?: InitiatedBy;
          created_at?: string;
          approved_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          inserted_at: string;
          merchant_id: string | null;
          actor_id: string;
          actor_type: string;
          action_type: string;
          table_name: string;
          record_id: string;
          old_data: Json | null;
          new_data: Json | null;
        };
        Insert: {
          id?: string;
          inserted_at?: string;
          merchant_id?: string | null;
          actor_id: string;
          actor_type: string;
          action_type: string;
          table_name: string;
          record_id: string;
          old_data?: Json | null;
          new_data?: Json | null;
        };
        Update: {
          id?: string;
          inserted_at?: string;
          merchant_id?: string | null;
          actor_id?: string;
          actor_type?: string;
          action_type?: string;
          table_name?: string;
          record_id?: string;
          old_data?: Json | null;
          new_data?: Json | null;
        };
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          merchant_id: string;
          device_info: string;
          ip_address: string;
          last_active: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          device_info: string;
          ip_address?: string;
          last_active?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          device_info?: string;
          ip_address?: string;
          last_active?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      admins: {
        Row: {
          id: string;
          email: string;
          name: string;
          password_hash: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name?: string;
          password_hash?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          password_hash?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      app_settings: {
        Row: {
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      merchant_payment_methods: {
        Row: {
          id: string;
          merchant_id: string;
          method_type: PaymentMethodType;
          label: string | null;
          qr_url: string | null;
          account_holder: string | null;
          account_number: string | null;
          bank_name: string | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          method_type: PaymentMethodType;
          label?: string | null;
          qr_url?: string | null;
          account_holder?: string | null;
          account_number?: string | null;
          bank_name?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          method_type?: PaymentMethodType;
          label?: string | null;
          qr_url?: string | null;
          account_holder?: string | null;
          account_number?: string | null;
          bank_name?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      merchant_reminder_settings: {
        Row: {
          id: string;
          merchant_id: string;
          auto_reminder_enabled: boolean;
          reminder_message_template: string | null;
          reminder_day_of_month: number;
          last_reminder_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          auto_reminder_enabled?: boolean;
          reminder_message_template?: string | null;
          reminder_day_of_month?: number;
          last_reminder_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          auto_reminder_enabled?: boolean;
          reminder_message_template?: string | null;
          reminder_day_of_month?: number;
          last_reminder_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payment_reminder_logs: {
        Row: {
          id: string;
          merchant_id: string;
          customer_id: string;
          credit_log_id: string | null;
          type: ReminderType;
          message: string;
          sent_at: string;
          status: string;
          error_message: string | null;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          customer_id: string;
          credit_log_id?: string | null;
          type: ReminderType;
          message: string;
          sent_at?: string;
          status?: string;
          error_message?: string | null;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          customer_id?: string;
          credit_log_id?: string | null;
          type?: ReminderType;
          message?: string;
          sent_at?: string;
          status?: string;
          error_message?: string | null;
        };
        Relationships: [];
      };
      sms_recharge_logs: {
        Row: {
          id: string;
          merchant_id: string;
          amount: number;
          sms_count: number;
          transaction_uuid: string;
          status: string;
          esewa_ref_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          amount: number;
          sms_count: number;
          transaction_uuid: string;
          status?: string;
          esewa_ref_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          amount?: number;
          sms_count?: number;
          transaction_uuid?: string;
          status?: string;
          esewa_ref_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      short_links: {
        Row: {
          id: string;
          code: string;
          destination_url: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          destination_url: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          destination_url?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      merchant_ai_usage: {
        Row: {
          id: string;
          merchant_id: string;
          model_name: string;
          input_tokens: number;
          output_tokens: number;
          parse_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          model_name?: string;
          input_tokens?: number;
          output_tokens?: number;
          parse_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          model_name?: string;
          input_tokens?: number;
          output_tokens?: number;
          parse_count?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      merchant_products: {
        Row: {
          id: string;
          merchant_id: string;
          name: string;
          unit: string;
          default_rate: number;
          category: string | null;
          is_active: boolean;
          sort_order: number;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          name: string;
          unit?: string;
          default_rate: number;
          category?: string | null;
          is_active?: boolean;
          sort_order?: number;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          name?: string;
          unit?: string;
          default_rate?: number;
          category?: string | null;
          is_active?: boolean;
          sort_order?: number;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      credit_log_items: {
        Row: {
          id: string;
          credit_log_id: string;
          product_id: string | null;
          product_name: string;
          quantity: number;
          unit: string;
          unit_price: number;
          line_total: number;
          description: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          credit_log_id: string;
          product_id?: string | null;
          product_name: string;
          quantity: number;
          unit?: string;
          unit_price: number;
          description?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          credit_log_id?: string;
          product_id?: string | null;
          product_name?: string;
          quantity?: number;
          unit?: string;
          unit_price?: number;
          description?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
    };
  };
}

// Helper types
export type Merchant = Database["public"]["Tables"]["merchants"]["Row"];
export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type MerchantCustomer = Database["public"]["Tables"]["merchant_customers"]["Row"];
export type CreditLog = Database["public"]["Tables"]["credit_logs"]["Row"];
export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];
export type Session = Database["public"]["Tables"]["sessions"]["Row"];
export type Admin = Database["public"]["Tables"]["admins"]["Row"];
export type AppSetting = Database["public"]["Tables"]["app_settings"]["Row"];

export type MerchantInsert = Database["public"]["Tables"]["merchants"]["Insert"];
export type CustomerInsert = Database["public"]["Tables"]["customers"]["Insert"];
export type MerchantCustomerInsert = Database["public"]["Tables"]["merchant_customers"]["Insert"];
export type CreditLogInsert = Database["public"]["Tables"]["credit_logs"]["Insert"];

export type MerchantPaymentMethod = Database["public"]["Tables"]["merchant_payment_methods"]["Row"];
export type MerchantReminderSetting = Database["public"]["Tables"]["merchant_reminder_settings"]["Row"];
export type PaymentReminderLog = Database["public"]["Tables"]["payment_reminder_logs"]["Row"];
export type SmsRechargeLog = Database["public"]["Tables"]["sms_recharge_logs"]["Row"];
export type ShortLink = Database["public"]["Tables"]["short_links"]["Row"];
export type MerchantAiUsage = Database["public"]["Tables"]["merchant_ai_usage"]["Row"];
export type MerchantProduct = Database["public"]["Tables"]["merchant_products"]["Row"];
export type CreditLogItem = Database["public"]["Tables"]["credit_log_items"]["Row"];

// Customer Summary (from materialized view)
export interface CustomerSummary {
  merchant_id: string;
  customer_id: string;
  customer_name: string | null;
  customer_phone: string;
  credit_limit: number;
  current_balance: number;
  pending_entries: number;
  total_debit_entries: number;
  total_credit_entries: number;
  total_debit_amount: number;
  total_credit_amount: number;
  last_transaction_at: string | null;
}
