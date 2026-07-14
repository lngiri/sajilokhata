"use client";

import { useState, useEffect } from "react";
import BottomNav from "@/components/BottomNav";
import PullToRefresh from "@/components/PullToRefresh";
import { getMerchantCustomers } from "@/lib/actions";
import { getCurrentMerchantId } from "@/lib/auth";
import { useToast } from "@/components/Toast";

interface CustomerRow {
  id: string;
  credit_limit: number;
  current_balance: number;
  customers: {
    id: string;
    name: string | null;
    phone: string;
  } | null;
}

export default function CustomersPage() {
  const { addToast } = useToast();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const id = await getCurrentMerchantId();
      if (id) {
        const data = await getMerchantCustomers(id);
        setCustomers(data as CustomerRow[]);
      }
    } catch {
      addToast("Failed to load customers.", "error");
    } finally {
      setLoading(false);
    }
  };

  const filtered = customers.filter((c) => {
    if (!debouncedQuery) return true;
    const q = debouncedQuery.toLowerCase();
    return (
      c.customers?.name?.toLowerCase().includes(q) ||
      c.customers?.phone.includes(q)
    );
  });

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center px-4 py-3">
          <a
            href="/merchant/dashboard"
            className="mr-3 p-1 active:scale-95 transition-transform"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </a>
          <h1 className="text-lg font-bold text-[var(--color-text)]">
            Customers
          </h1>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <label htmlFor="customer-search" className="sr-only">Search customers</label>
            <input
              id="customer-search"
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-xl text-sm border-0 focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
            />
          </div>
        </div>
      </div>

      <PullToRefresh onRefresh={loadCustomers}>
      <div className="px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-[var(--color-text-muted)]">
            <svg className="w-16 h-16 mx-auto mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <p className="font-medium">No customers found</p>
            <p className="text-sm mt-1">Customers will appear here after they scan your QR</p>
            <a
              href="/merchant/qr"
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-xl text-sm font-medium active:scale-[0.98] transition-transform"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
              </svg>
              Show My QR
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((mc) => (
              <a
                key={mc.id}
                href={mc.customers?.id ? `/merchant/customers/${mc.customers.id}` : "#"}
                className="block bg-white rounded-xl p-4 shadow-sm border border-gray-50 active:scale-[0.99] transition-transform"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-[var(--color-primary)] text-sm">
                      {(mc.customers?.name || mc.customers?.phone || "?").charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-[var(--color-text)] truncate">
                      {mc.customers?.name || "Unknown"}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {mc.customers?.phone}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-sm ${mc.current_balance > 0 ? "text-[var(--color-danger)]" : "text-[var(--color-primary)]"}`}>
                      Rs. {mc.current_balance.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">
                      / Rs. {mc.credit_limit.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Balance bar */}
                <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  {mc.credit_limit > 0 && (
                    <div
                      className={`h-full rounded-full transition-all ${
                        mc.current_balance / mc.credit_limit > 0.8
                          ? "bg-[var(--color-danger)]"
                          : mc.current_balance / mc.credit_limit > 0.5
                          ? "bg-[var(--color-accent)]"
                          : "bg-[var(--color-primary)]"
                      }`}
                      style={{ width: `${Math.min(100, (mc.current_balance / mc.credit_limit) * 100)}%` }}
                    />
                  )}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
      </PullToRefresh>

      <BottomNav />
    </div>
  );
}
