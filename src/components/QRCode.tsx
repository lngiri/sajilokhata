"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import jsQR from "jsqr";

interface QRDisplayProps {
  merchantId: string;
  merchantName: string;
  businessType: string;
  svgRef?: React.Ref<SVGSVGElement>;
}

export function QRDisplay({
  merchantId,
  merchantName,
  businessType,
  svgRef,
}: QRDisplayProps) {
  const qrData = JSON.stringify({
    type: "merchant_scan",
    merchantId,
    merchantName: merchantName || "Shop",
    businessType,
    timestamp: Date.now(),
  });

  return (
    <div className="flex flex-col items-center p-6">
      <div className="bg-white dark:bg-[var(--color-surface)] p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700">
        <QRCodeSVG
          ref={svgRef}
          value={qrData}
          size={260}
          level="H"
          bgColor="#FFFFFF"
          fgColor="#000000"
          includeMargin={true}
        />
      </div>
      <p className="mt-4 text-sm text-[var(--color-text-muted)]">
        Scan this QR to log a credit entry
      </p>
    </div>
  );
}

// ============================================================
// Customer QR - Customer shows their phone, merchant scans it
// ============================================================
interface CustomerQRProps {
  customerId: string;
}

export function CustomerQR({ customerId }: CustomerQRProps) {
  // Simple format: no merchant ID, no amount — just the customer's phone
  const qrData = `QR Hisab:customer:${customerId}`;

  return (
    <div className="flex flex-col items-center p-6 bg-[var(--color-primary)]/5 rounded-2xl">
      <p className="text-sm font-medium text-[var(--color-primary)] mb-4">
        Show this QR to your merchant
      </p>
      <div className="bg-white dark:bg-[var(--color-surface)] p-4 rounded-2xl shadow-md">
        <QRCodeSVG
          value={qrData}
          size={180}
          level="H"
          bgColor="#ffffff"
          fgColor="#059669"
          includeMargin={true}
        />
      </div>
      <p className="mt-3 text-sm text-[var(--color-text-muted)]">
        Customer ID: {customerId}
      </p>
    </div>
  );
}

// ============================================================
// QR Scanner
// ============================================================
interface QRScannerProps {
  onScan: (data: string) => void;
  onError?: (error: string) => void;
  /** Called when the user clicks the X button.
   *  Defaults to going back in history (window.history.back). */
  onClose?: () => void;
}

export function QRScanner({ onScan, onError, onClose }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const decodeLockRef = useRef(false);
  const frameCountRef = useRef(0);
  const hasScannedRef = useRef(false);

  const stopScanning = useCallback(() => {
    scanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    hasScannedRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsScanning(true);
        scanningRef.current = true;
      }

      // Simple QR detection via canvas.
      // Decode is throttled to every 2nd frame to keep the main thread
      // responsive; jsQR runs on a downscaled frame so it stays fast on Safari.
      const DETECT_EVERY_N_FRAMES = 2;
      const detectQR = () => {
        if (!scanningRef.current || !videoRef.current || !canvasRef.current) return;

        frameCountRef.current += 1;
        if (frameCountRef.current % DETECT_EVERY_N_FRAMES !== 0) {
          if (scanningRef.current) requestAnimationFrame(detectQR);
          return;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        if (ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);

          // BarcodeDetector is native on Chrome/Edge/Android Chromium.
          // jsQR is the pure-JS fallback for Safari (iPhone/iPad) where
          // BarcodeDetector is not available.
          if ("BarcodeDetector" in window) {
            if (!detectorRef.current) {
              detectorRef.current = new BarcodeDetector({
                formats: ["qr_code"],
              });
            }
            detectorRef.current
              .detect(canvas)
              .then((results) => {
                if (results.length > 0 && !hasScannedRef.current && scanningRef.current) {
                  hasScannedRef.current = true;
                  onScan(results[0].rawValue);
                  stopScanning();
                }
              })
              .catch(() => {});
          } else if (!decodeLockRef.current) {
            decodeLockRef.current = true;
            // Async decode (setTimeout) keeps rAF running and makes the lock
            // actually guard against overlapping jsQR scans.
            setTimeout(() => {
              try {
                const scale = Math.min(1, 400 / (canvas.width || 1));
                const w = Math.max(1, Math.round(canvas.width * scale));
                const h = Math.max(1, Math.round(canvas.height * scale));
                const temp = document.createElement("canvas");
                temp.width = w;
                temp.height = h;
                const tctx = temp.getContext("2d");
                if (tctx) {
                  tctx.drawImage(canvas, 0, 0, w, h);
                  const imageData = tctx.getImageData(0, 0, w, h);
                  const code = jsQR(imageData.data, imageData.width, imageData.height);
                  if (code && !hasScannedRef.current && scanningRef.current) {
                    hasScannedRef.current = true;
                    onScan(code.data);
                    stopScanning();
                  }
                }
              } finally {
                decodeLockRef.current = false;
              }
            }, 0);
          }
        }

        if (scanningRef.current) {
          requestAnimationFrame(detectQR);
        }
      };

      requestAnimationFrame(detectQR);
    } catch {
      setError("Camera access denied. Please enable camera permission.");
      onError?.("Camera access denied");
    }
  }, [onScan, onError, stopScanning]);

  const handleClose = useCallback(() => {
    stopScanning();
    if (onClose) {
      onClose();
    } else {
      window.history.back();
    }
  }, [stopScanning, onClose]);

  // Stop camera on unmount
  useEffect(() => {
    return () => {
      scanningRef.current = false;
      stopScanning();
    };
  }, [stopScanning]);

  if (!cameraStarted) {
    return (
      <div className="relative w-full aspect-square max-w-sm mx-auto overflow-hidden rounded-2xl bg-gray-900 flex flex-col items-center justify-center p-6">
        <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary)]/10 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-[var(--color-primary-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.16a15.53 15.53 0 01-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
          </svg>
        </div>
        <p className="text-white text-sm font-medium mb-1">Camera Required</p>
        <p className="text-gray-400 text-xs text-center mb-5 max-w-[200px]">
          Grant camera access to scan QR codes
        </p>
        <button
          onClick={() => { setCameraStarted(true); requestAnimationFrame(startCamera); }}
          className="px-6 py-2.5 bg-[var(--color-primary-surface)] hover:bg-[var(--color-primary-surface-hover)] text-[var(--color-primary-foreground)] font-semibold rounded-xl text-sm transition-colors active:scale-[0.97]"
        >
          Start Scanning
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-square max-w-sm mx-auto overflow-hidden rounded-2xl bg-black">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Scanning overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-56 h-56 border-2 border-white/50 rounded-xl" />
      </div>

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
          <div className="text-center">
            <p className="text-white text-sm mb-1">{error}</p>
            <p className="text-gray-400 text-xs mb-4 max-w-[240px]">
              Enable camera access in your browser settings, then try again.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => { setCameraStarted(false); setError(null); }}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => { setError(null); startCamera(); }}
                className="px-4 py-2 bg-[var(--color-primary-surface)] hover:bg-[var(--color-primary-surface-hover)] text-[var(--color-primary-foreground)] rounded-lg text-sm transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {!isScanning && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      <button
        onClick={handleClose}
        aria-label="Close scanner"
        className="absolute top-3 right-3 w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors z-10"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
