"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";

interface QRDisplayProps {
  merchantId: string;
  merchantName: string;
  businessType: string;
}

export function QRDisplay({
  merchantId,
  merchantName,
  businessType,
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
      <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100">
        <QRCodeSVG
          value={qrData}
          size={240}
          level="H"
          bgColor="#ffffff"
          fgColor="#0f172a"
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
  const qrData = `sajilokhata:customer:${customerId}`;

  return (
    <div className="flex flex-col items-center p-6 bg-[var(--color-primary)]/5 rounded-2xl">
      <p className="text-sm font-medium text-[var(--color-primary)] mb-4">
        Show this QR to your merchant
      </p>
      <div className="bg-white p-4 rounded-2xl shadow-md">
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
   *  Defaults to redirecting to `/dashboard`. */
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

      // Simple QR detection via canvas
      const detectQR = () => {
        if (!scanningRef.current || !videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        if (ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);

          // Use BarcodeDetector API if available
          if ("BarcodeDetector" in window) {
            const detector = new BarcodeDetector({
              formats: ["qr_code"],
            });
            detector
              .detect(canvas)
              .then((results) => {
                if (results.length > 0) {
                  onScan(results[0].rawValue);
                  stopScanning();
                }
              })
              .catch(() => {});
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
      window.location.replace("/dashboard");
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
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm transition-colors active:scale-[0.97]"
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
            <p className="text-white text-sm mb-4">{error}</p>
            <button
              onClick={() => { setCameraStarted(false); setError(null); }}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors"
            >
              Back
            </button>
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
        className="absolute top-3 right-3 w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors z-10"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
