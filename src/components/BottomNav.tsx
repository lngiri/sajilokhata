"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { QRDisplay } from "@/components/QRCode";
import { getCurrentMerchantId } from "@/lib/auth";
import { getMerchantProfile } from "@/app/actions/merchant";
import BottomNavBar, { type NavItem } from "@/components/BottomNavBar";
import { HomeIcon, CustomersIcon, HistoryIcon, SettingsIcon, QRIcon } from "@/components/NavIcons";

const navItems: NavItem[] = [
  { href: "/merchant/dashboard", label: "Home", icon: HomeIcon },
  { href: "/merchant/customers", label: "Customers", icon: CustomersIcon },
  { href: "#", label: "My QR", isFab: true, icon: QRIcon },
  { href: "/merchant/logs", label: "History", icon: HistoryIcon },
  { href: "/merchant/settings", label: "Settings", icon: SettingsIcon },
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
  const [qrError, setQrError] = useState(false);

  const loadQR = useCallback(async () => {
    setQrLoading(true);
    setQrError(false);
    setMerchantProfile(null);
    try {
      const id = await getCurrentMerchantId();
      if (id) {
        try {
          const profile = await getMerchantProfile(id, "id, name, business_type, business_name");
          if (profile) {
            setMerchantProfile(profile);
            setQrLoading(false);
            return;
          }
        } catch {
          // fall through to localStorage fallback below
        }

        // Fallback: minimal profile from localStorage so the QR still renders
        setMerchantProfile({ id, name: "My Shop", business_type: "general", business_name: null });
        setQrLoading(false);
        return;
      }
    } catch {
      // fall through to error state
    }
    setQrError(true);
    setQrLoading(false);
  }, []);

  useEffect(() => {
    if (!showQRModal) return;
    loadQR();
  }, [showQRModal, loadQR]);

  // Lock body scroll while the modal is open (prevents background scrolling on iOS)
  useEffect(() => {
    if (!showQRModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showQRModal]);

  useEffect(() => {
    if (!showQRModal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowQRModal(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showQRModal]);

  return (
    <>
      <BottomNavBar
        items={navItems}
        isActive={(href) => pathname.startsWith(href) && href !== "#"}
        navLabel="Main navigation"
        fabLabel="Show my QR code"
        onFabClick={() => setShowQRModal(true)}
      />

      {/* QR Modal */}
      {showQRModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="My QR code"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowQRModal(false)}
        >
          <div
            className="relative bg-[var(--color-surface)] rounded-3xl p-6 mx-4 max-w-sm w-full shadow-2xl animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close X button */}
            <button
              onClick={() => setShowQRModal(false)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-[var(--color-bg)] rounded-full shadow-lg border border-[var(--color-border)] flex items-center justify-center active:scale-90 transition-transform text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              aria-label="Close QR"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {qrLoading ? (
              <div className="py-10 flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-[3px] border-gray-200 dark:border-gray-700 border-t-[var(--color-primary)] rounded-full animate-spin" />
                <p className="text-sm text-[var(--color-text-muted)]">Loading your QR...</p>
              </div>
            ) : merchantProfile ? (
              <>
                <div className="text-center mb-2">
                  <h2 className="text-lg font-bold text-[var(--color-text)]">
                    {merchantProfile.business_name?.trim() || merchantProfile.name || "Shop"}
                  </h2>
                  {merchantProfile.business_name && merchantProfile.business_name !== merchantProfile.name && (
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {merchantProfile.name}
                    </p>
                  )}
                  <p className="text-sm text-[var(--color-text-muted)] capitalize">
                    {merchantProfile.business_type} Shop
                  </p>
                </div>

                <QRDisplay
                  merchantId={merchantProfile.id}
                  merchantName={merchantProfile.business_name?.trim() || merchantProfile.name || "Shop"}
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
                <p className="text-sm text-[var(--color-text-muted)] mb-4">Could not load merchant profile.</p>
                <button
                  onClick={loadQR}
                  className="px-5 py-2.5 bg-[var(--color-primary-surface)] hover:bg-[var(--color-primary-surface-hover)] text-[var(--color-primary-foreground)] rounded-xl font-medium text-sm transition-colors active:scale-[0.97]"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
