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
}

export function QRScanner({ onScan, onError }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopScanning = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  }, []);

  useEffect(() => {
    let scanning = true;

    const startScanning = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setIsScanning(true);
        }

        // Simple QR detection via canvas
        const detectQR = () => {
          if (!scanning || !videoRef.current || !canvasRef.current) return;

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

          if (scanning) {
            requestAnimationFrame(detectQR);
          }
        };

        requestAnimationFrame(detectQR);
      } catch {
        setError("Camera access denied. Please enable camera permission.");
        onError?.("Camera access denied");
      }
    };

    startScanning();

    return () => {
      scanning = false;
      stopScanning();
    };
  }, [onScan, onError, stopScanning]);

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
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-56 h-56 border-2 border-white/50 rounded-xl" />
      </div>

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
          <p className="text-white text-center text-sm">{error}</p>
        </div>
      )}

      {!isScanning && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      <button
        onClick={stopScanning}
        className="absolute top-3 right-3 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
