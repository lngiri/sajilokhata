"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { APP_VERSION } from "@/lib/version";
import AppLogo from "./AppLogo";

interface Props {
  open: boolean;
  onClose: () => void;
}

const FEATURES = [
  "Digital Khata",
  "Customer Management",
  "Merchant Dashboard",
  "Credit Tracking",
  "QR Payment Ready",
  "AI Assisted Features",
  "Secure PIN Authentication",
  "Reports",
];

const SOCIALS = [
  "Facebook",
  "TikTok",
  "Instagram",
  "YouTube",
  "LinkedIn",
] as const;

export default function AboutSheet({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-black/40"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl"
          >
            {/* Drag handle */}
            <div className="sticky top-0 z-10 pt-3 pb-2 bg-white dark:bg-gray-900">
              <div className="w-10 h-1 mx-auto rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-4 z-20 p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="px-6 pb-8 pt-2 space-y-6">
              {/* Header */}
              <div className="text-center">
                <div className="flex justify-center mb-3">
                  <AppLogo size={64} showAnimation={false} clickable={false} />
                </div>
                <h2 className="text-xl font-extrabold text-[var(--color-text)]">QR Hisab</h2>
                <p className="text-xs font-semibold text-[var(--color-primary)] mt-0.5">v{APP_VERSION}</p>
                <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-xs mx-auto leading-relaxed">
                  Simple Digital Khata for Every Business
                </p>
              </div>

              {/* Features */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
                  Features
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {FEATURES.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-sm text-[var(--color-text)]">
                      <svg className="w-3.5 h-3.5 shrink-0 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {f}
                    </div>
                  ))}
                </div>
              </div>

              {/* Support */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
                  Support
                </h3>
                <div className="space-y-2">
                  <a
                    href="https://wa.me/9779763658505"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[var(--color-primary)]/10 text-sm font-semibold text-[var(--color-primary-dark)] hover:bg-[var(--color-primary)]/20 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    WhatsApp
                  </a>
                  <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm text-[var(--color-text-muted)]">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    Email
                    <span className="ml-auto text-xs">Coming Soon</span>
                  </div>
                </div>
              </div>

              {/* Social */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
                  Social
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {SOCIALS.map((s) => (
                    <div
                      key={s}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm text-[var(--color-text-muted)]"
                    >
                      <span>{s}</span>
                      <span className="ml-auto text-[10px]">Coming Soon</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Legal */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
                  Legal
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm text-[var(--color-text-muted)]">
                    Privacy Policy
                    <span className="text-xs">Coming Soon</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm text-[var(--color-text-muted)]">
                    Terms &amp; Conditions
                    <span className="text-xs">Coming Soon</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
