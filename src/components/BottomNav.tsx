"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { QRDisplay } from "@/components/QRCode";
import { createClient } from "@/lib/supabase/client";
import { getCurrentMerchantId } from "@/lib/auth";

interface NavItem {
  href: string;
  label: string;
  isFab?: boolean;
  icon: (active: boolean) => React.ReactNode;
}

const navItems: NavItem[] = [
  {
    href: "/merchant/dashboard",
    label: "Home",
    icon: (active: boolean) => (
      <svg className={`w-6 h-6 ${active ? "text-[var(--color-primary)]" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    href: "/merchant/customers",
    label: "Customers",
    icon: (active: boolean) => (
      <svg className={`w-6 h-6 ${active ? "text-[var(--color-primary)]" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    href: "#",
    label: "My QR",
    isFab: true,
    icon: () => (
      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
      </svg>
    ),
  },
  {
    href: "/merchant/logs",
    label: "History",
    icon: (active: boolean) => (
      <svg className={`w-6 h-6 ${active ? "text-[var(--color-primary)]" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

interface MerchantProfile {
  id: string;
  name: string;
  business_type: string;
  business_name: string | null;
}

export default function BottomNav() {
  const pathname = usePathname();
  const [showQRModal, setShowQRModal] = useState(false);
  const [merchantProfile, setMerchantProfile] = useState<MerchantProfile | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  useEffect(() => {
    if (!showQRModal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowQRModal(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showQRModal]);

  useEffect(() => {
    if (!showQRModal) return;
    setQrLoading(true);
    setMerchantProfile(null);
    (async () => {
      const id = await getCurrentMerchantId();
      console.log("[BottomNav-QR] getCurrentMerchantId returned:", id);

      const supabase = createClient();

      // Try 1: Lookup by merchant ID (from localStorage or auth)
      if (id) {
        const { data, error } = await supabase
          .from("merchants")
          .select("id, name, business_type, business_name")
          .eq("id", id)
          .maybeSingle();
        console.log("[BottomNav-QR] Lookup by ID:", id, "→ data:", data, "error:", error);
        if (data) {
          setMerchantProfile(data);
          setQrLoading(false);
          return;
        }
      }

      // Try 2: Fallback — lookup by phone (in case ID is stale or RLS blocks ID-based query)
      const phone = localStorage.getItem("merchant_phone");
      console.log("[BottomNav-QR] Fallback — phone from localStorage:", phone);
      if (phone) {
        const { data, error } = await supabase
          .from("merchants")
          .select("id, name, business_type, business_name")
          .eq("phone", phone)
          .maybeSingle();
        console.log("[BottomNav-QR] Lookup by phone:", phone, "→ data:", data, "error:", error);
        if (data) {
          localStorage.setItem("merchant_id", data.id);
          setMerchantProfile(data);
          setQrLoading(false);
          return;
        }
      }

      // Try 3: If we have an ID but DB queries fail, create a minimal profile from localStorage
      if (id) {
        console.log("[BottomNav-QR] Using fallback profile from localStorage with id:", id);
        setMerchantProfile({ id, name: "My Shop", business_type: "general", business_name: null });
        setQrLoading(false);
        return;
      }

      console.error("[BottomNav-QR] All lookups failed — no merchant profile found");
      setQrLoading(false);
    })();
  }, [showQRModal]);

  const fabItem = navItems.find((i) => i.isFab)!;

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 safe-area-bottom z-50">
        <div className="flex items-center justify-around max-w-md mx-auto h-16">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href) && item.href !== "#";
            return item.isFab ? (
              <button
                key={item.label}
                onClick={() => setShowQRModal(true)}
                className="flex flex-col items-center justify-center w-full h-full gap-0.5 active:scale-95 transition-transform"
              >
                <div className="w-12 h-12 -mt-4 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] shadow-lg flex items-center justify-center ring-4 ring-white">
                  {item.icon(true)}
                </div>
                <span className="text-[10px] font-medium text-[var(--color-primary)] -mt-0.5">
                  {item.label}
                </span>
              </button>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center w-full h-full gap-0.5 active:scale-95 transition-transform"
              >
                {item.icon(isActive)}
                <span className={`text-[10px] font-medium ${isActive ? "text-[var(--color-primary)]" : "text-gray-400"}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* QR Modal */}
      {showQRModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowQRModal(false)}
        >
          <div
            className="relative bg-white rounded-3xl p-6 mx-4 max-w-sm w-full shadow-2xl animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close X button */}
            <button
              onClick={() => setShowQRModal(false)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-lg border border-gray-100 flex items-center justify-center active:scale-90 transition-transform text-gray-400 hover:text-gray-600"
              aria-label="Close QR"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {qrLoading ? (
              <div className="py-10 flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-[3px] border-gray-200 border-t-[var(--color-primary)] rounded-full animate-spin" />
                <p className="text-sm text-[var(--color-text-muted)]">Loading your QR...</p>
              </div>
            ) : merchantProfile ? (
              <>
                <div className="text-center mb-2">
                  <h2 className="text-lg font-bold text-[var(--color-text)]">
                    {merchantProfile.name}
                  </h2>
                  <p className="text-sm text-[var(--color-text-muted)] capitalize">
                    {merchantProfile.business_type} Shop
                  </p>
                </div>

                <QRDisplay
                  merchantId={merchantProfile.id}
                  merchantName={merchantProfile.name}
                  businessType={merchantProfile.business_type}
                />

                <div className="bg-[var(--color-primary)]/10 rounded-xl p-4 mt-4">
                  <p className="text-sm text-[var(--color-text)] text-center font-medium leading-relaxed">
                    Ask your customer to scan this QR code
                  </p>
                </div>
              </>
            ) : (
              <div className="py-10 text-center">
                <p className="text-sm text-[var(--color-text-muted)]">Could not load merchant profile.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
