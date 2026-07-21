"use client";

import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Detect if PWA is already installed using multiple browser signals.
 * Sync signals first (fast), then async signals (thorough).
 *
 * Signal priority:
 *  1. display-mode: standalone  — launched from home screen (Android/iOS/Edge)
 *  2. display-mode: fullscreen   — iOS Safari Add to Home Screen
 *  3. getInstalledRelatedApps()  — Chrome/Edge Android (async, works even in browser tab)
 *  4. appinstalled event          — fires immediately after a successful install
 *  5. localStorage fallback       — persists across sessions if user clears SW/cookies
 */
function detectInstalledSync(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
  return false;
}

async function detectInstalledAsync(): Promise<boolean> {
  // getInstalledRelatedApps: Chrome/Edge on Android — detects PWA even when opened via browser URL
  try {
    const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<Array<unknown>> };
    if (nav.getInstalledRelatedApps) {
      const apps = await nav.getInstalledRelatedApps();
      if (apps.length > 0) return true;
    }
  } catch {
    // API not available or rejected
  }
  return false;
}

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // ── Fast exit: persistent dismiss flag ──
    try {
      if (localStorage.getItem("pwa-install-dismissed")) {
        setIsDismissed(true);
        return;
      }
    } catch {
      // localStorage unavailable (private browsing)
    }

    // ── Fast exit: persistent install flag (fallback if browser signals missed) ──
    try {
      if (localStorage.getItem("pwa-installed")) {
        setIsInstalled(true);
        return;
      }
    } catch {
      // localStorage unavailable
    }

    // ── Sync detection: display-mode media queries ──
    if (detectInstalledSync()) {
      setIsInstalled(true);
      return;
    }

    // ── Session-level dismiss (dismiss-without-installing in same tab) ──
    try {
      if (sessionStorage.getItem("pwa-install-dismissed-session")) {
        setIsDismissed(true);
        return;
      }
    } catch {
      // sessionStorage unavailable
    }

    // ── Detect iOS Safari ──
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as typeof window & { MSStream?: unknown }).MSStream;
    setIsIOS(ios);

    // ── Async detection: getInstalledRelatedApps (Chrome/Edge Android) ──
    detectInstalledAsync().then((installed) => {
      if (installed) {
        setIsInstalled(true);
        try {
          localStorage.setItem("pwa-installed", "true");
        } catch {
          // ignore
        }
      }
    });

    // ── Listen for appinstalled (fires after successful install) ──
    const handleInstalled = () => {
      setIsInstalled(true);
      setShowBanner(false);
      try {
        localStorage.setItem("pwa-installed", "true");
      } catch {
        // ignore
      }
    };
    window.addEventListener("appinstalled", handleInstalled);

    // ── Capture beforeinstallprompt (Android/Chrome/Edge) ──
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowBanner(true), 2000);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // ── iOS: show banner after delay (no beforeinstallprompt support) ──
    let iosTimer: ReturnType<typeof setTimeout> | undefined;
    if (ios) {
      iosTimer = setTimeout(() => setShowBanner(true), 3000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", handleInstalled);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    setIsInstalling(true);
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setShowBanner(false);
      // Mark as installed so banner never reappears even if appinstalled event is delayed
      try {
        localStorage.setItem("pwa-installed", "true");
      } catch {
        // ignore
      }
    }
    setIsInstalling(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setIsDismissed(true);
    try {
      localStorage.setItem("pwa-install-dismissed", "true");
      sessionStorage.setItem("pwa-install-dismissed-session", "true");
    } catch {
      // localStorage unavailable
    }
  };

  // Don't render if dismissed, already installed, or not ready
  if (isDismissed || isInstalled || !showBanner) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[90] p-4 animate-slide-up">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 max-w-md mx-auto">
        {/* App Icon */}
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] flex items-center justify-center flex-shrink-0 shadow-lg">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-[var(--color-text)] text-sm">
              Install QR Hisab App
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
              {isIOS ? (
                <>Tap the Share button in Safari → &quot;Add to Home Screen&quot;</>
              ) : (
                <>A digital ledger that works offline too. Manage your daily accounts easily.</>
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleDismiss}
            className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium active:scale-[0.98] transition-transform"
          >
            Dismiss
          </button>
          {!isIOS && (
            <button
              onClick={handleInstall}
              disabled={isInstalling}
              className="flex-1 py-2.5 bg-[var(--color-primary)] text-white rounded-xl text-sm font-medium active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isInstalling ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Install
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
