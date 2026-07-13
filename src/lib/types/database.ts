// ============================================================
// QR Hisab - Auto-generated Database Types
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type BusinessType = "kirana" | "dairy" | "meat";
export type CreditUnit = "liter" | "jar" | "kg" | "piece" | "npr";
export type TransactionType = "debit" | "credit" | "cash";
export type TransactionStatus = "pending" | "unverified" | "approved" | "disputed" | "rejected" | "edit_requested";
export type SyncStatus = "online" | "offline_pending";
export type ActorType = "merchant" | "customer" | "admin";
export type AuditAction = "created" | "approved" | "disputed" | "rejected" | "modified" | "edit_requested" | "edit_accepted" | "edit_rejected";

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
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone: string;
          business_type: BusinessType;
          business_name?: string | null;
          address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string;
          business_type?: BusinessType;
          business_name?: string | null;
          address?: string | null;
          created_at?: string;
        };
      };
      customers: {
        Row: {
          id: string;
          name: string | null;
          phone: string;
          home_location_gps: unknown | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name?: string | null;
          phone: string;
          home_location_gps?: unknown | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string | null;
          phone?: string;
          home_location_gps?: unknown | null;
          created_at?: string;
        };
      };
      merchant_customers: {
        Row: {
          id: string;
          merchant_id: string;
          customer_id: string;
          credit_limit: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          customer_id: string;
          credit_limit?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          customer_id?: string;
          credit_limit?: number;
          created_at?: string;
          updated_at?: string;
        };
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
          created_at?: string;
          approved_at?: string | null;
          updated_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          credit_log_id: string;
          action: AuditAction;
          actor_id: string | null;
          actor_type: ActorType | null;
          ip_address: string | null;
          device_info: string | null;
          previous_values: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          credit_log_id: string;
          action: AuditAction;
          actor_id?: string | null;
          actor_type?: ActorType | null;
          ip_address?: string | null;
          device_info?: string | null;
          previous_values?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          credit_log_id?: string;
          action?: AuditAction;
          actor_id?: string | null;
          actor_type?: ActorType | null;
          ip_address?: string | null;
          device_info?: string | null;
          previous_values?: Json | null;
          created_at?: string;
        };
      };
      sessions: {
        Row: {
          id: string;
          merchant_id: string;
          device_info: string;
          last_active: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          device_info: string;
          last_active?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          device_info?: string;
          last_active?: string;
          created_at?: string;
        };
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

export type MerchantInsert = Database["public"]["Tables"]["merchants"]["Insert"];
export type CustomerInsert = Database["public"]["Tables"]["customers"]["Insert"];
export type MerchantCustomerInsert = Database["public"]["Tables"]["merchant_customers"]["Insert"];
export type CreditLogInsert = Database["public"]["Tables"]["credit_logs"]["Insert"];

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
