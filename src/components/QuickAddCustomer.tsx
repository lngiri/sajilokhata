"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";
import { findOrCreateCustomer, linkCustomerToMerchant } from "@/lib/actions";

interface QuickAddCustomerProps {
  merchantId: string;
  onCustomerAdded: (customer: { id: string; name: string; phone: string }) => void;
  onClose: () => void;
}

export default function QuickAddCustomer({ merchantId, onCustomerAdded, onClose }: QuickAddCustomerProps) {
  const { addToast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName) {
      addToast("Customer name is required", "error");
      return;
    }
    if (!trimmedPhone || trimmedPhone.length < 6) {
      addToast("Enter a valid phone number (at least 6 digits)", "error");
      return;
    }
    setSaving(true);
    try {
      const customer = await findOrCreateCustomer(trimmedPhone, trimmedName);
      await linkCustomerToMerchant(merchantId, customer.id);
      addToast(`${trimmedName} added as a customer!`, "success");
      onCustomerAdded({ id: customer.id, name: customer.name || trimmedName, phone: trimmedPhone });
      onClose();
    } catch (err) {
      addToast("Failed to add customer. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 space-y-5 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--color-text)]">Add Customer</h2>
          <button onClick={onClose} className="p-1 active:scale-90 transition-transform">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-[var(--color-text)]">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ram Sharma"
              maxLength={100}
              autoFocus
              className="w-full mt-1 px-4 py-3 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--color-text)]">Phone Number</label>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-medium text-gray-500">+977</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="98XXXXXXXX"
                className="flex-1 px-4 py-3 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all text-center text-lg font-mono"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium active:scale-[0.98] transition-transform">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !name.trim() || phone.trim().length < 6}
            className="flex-1 py-3 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Add Customer"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
