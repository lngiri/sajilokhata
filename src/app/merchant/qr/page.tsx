"use client";

import { useState, useEffect } from "react";
import { QRDisplay } from "@/components/QRCode";
import BottomNav from "@/components/BottomNav";
import { getCurrentMerchantId } from "@/lib/auth";
import { getMerchantProfile } from "@/lib/actions";
import { useToast } from "@/components/Toast";

interface MerchantData {
  id: string;
  name: string;
  business_type: string;
}

export default function MerchantQRPage() {
  const { addToast } = useToast();
  const [merchant, setMerchant] = useState<MerchantData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMerchant();
  }, []);

  const loadMerchant = async () => {
    try {
      const id = await getCurrentMerchantId();
      if (id) {
        const profile = await getMerchantProfile(id).catch(() => null);
        setMerchant(profile || { id, name: "My Shop", business_type: "kirana" });
      }
    } catch {
      addToast("Failed to load QR code data.", "error");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const merchantData = merchant || {
    id: "unknown",
    name: "My Shop",
    business_type: "kirana",
  };

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center px-4 py-3">
          <a href="/merchant/dashboard" className="mr-3 p-1 active:scale-95 transition-transform">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </a>
          <h1 className="text-lg font-bold text-[var(--color-text)]">
            Shop QR Code
          </h1>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Merchant Info */}
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] flex items-center justify-center shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[var(--color-text)]">
            {merchantData.name}
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] capitalize">
            {merchantData.business_type} Shop
          </p>
        </div>

        {/* QR Code */}
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-50">
          <QRDisplay
            merchantId={merchantData.id}
            merchantName={merchantData.name}
            businessType={merchantData.business_type}
          />
        </div>

        {/* Instructions */}
        <div className="bg-[var(--color-primary)]/5 rounded-2xl p-4 space-y-3">
          <h3 className="font-semibold text-sm text-[var(--color-text)]">
            How it works
          </h3>
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</div>
              <p className="text-sm text-[var(--color-text-muted)]">Customer scans this QR code with their phone</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</div>
              <p className="text-sm text-[var(--color-text-muted)]">They enter the credit amount and description</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</div>
              <p className="text-sm text-[var(--color-text-muted)]">You review and approve the entry from your dashboard</p>
            </div>
          </div>
        </div>

        {/* Print Button */}
        <button
          onClick={() => window.print()}
          className="w-full py-3 bg-white border border-gray-200 rounded-xl font-medium text-sm text-[var(--color-text)] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
          </svg>
          Print QR for Shop Counter
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
