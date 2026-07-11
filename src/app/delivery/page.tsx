"use client";

import { useState, useEffect } from "react";
import NetworkStatus from "@/components/NetworkStatus";
import { useToast } from "@/components/Toast";
import { isOnline, savePendingLog, getPendingLogs } from "@/lib/offline/db";
import { getCurrentMerchantId } from "@/lib/auth";

interface DeliveryCustomer {
  id: string;
  name: string;
  phone: string;
  baseRate: number;
  unit: string;
  homeLat: number;
  homeLng: number;
}

export default function DeliveryPage() {
  const { addToast } = useToast();
  const [customers] = useState<DeliveryCustomer[]>([
    { id: "1", name: "Ram Shrestha", phone: "9841234567", baseRate: 60, unit: "liter", homeLat: 27.7172, homeLng: 85.324 },
    { id: "2", name: "Sita Devi", phone: "9851234567", baseRate: 60, unit: "liter", homeLat: 27.7185, homeLng: 85.322 },
    { id: "3", name: "Hari Bahadur", phone: "9861234567", baseRate: 50, unit: "liter", homeLat: 27.7195, homeLng: 85.325 },
    { id: "4", name: "Gita Poudel", phone: "9871234567", baseRate: 60, unit: "jar", homeLat: 27.7160, homeLng: 85.321 },
  ]);

  const [selectedCustomer, setSelectedCustomer] = useState<DeliveryCustomer | null>(null);
  const [quantity, setQuantity] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [delivering, setDelivering] = useState(false);
  const [geofenceError, setGeofenceError] = useState(false);

  useEffect(() => {
    updatePendingCount();
  }, []);

  const updatePendingCount = async () => {
    const logs = await getPendingLogs();
    setPendingCount(logs.length);
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const handleDeliver = async () => {
    if (!selectedCustomer || !quantity) return;

    setDelivering(true);
    setGeofenceError(false);

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
      });

      const distance = calculateDistance(
        pos.coords.latitude,
        pos.coords.longitude,
        selectedCustomer.homeLat,
        selectedCustomer.homeLng
      );

      if (distance > 500) {
        setGeofenceError(true);
        setDelivering(false);
        addToast("You are too far from the customer's location", "warning");
        return;
      }

      const logId = crypto.randomUUID();
      const merchantId = await getCurrentMerchantId();
      const amount = Number(quantity) * selectedCustomer.baseRate;

      await savePendingLog({
        id: logId,
        merchant_id: merchantId || "unknown",
        customer_id: selectedCustomer.id,
        amount,
        quantity: Number(quantity),
        unit: selectedCustomer.unit as "liter" | "jar",
        description: `${quantity} ${selectedCustomer.unit} milk delivery`,
        type: "debit",
        status: "pending",
        sync_status: "offline_pending",
        device_info: navigator.userAgent,
        created_at: new Date().toISOString(),
      });

      await updatePendingCount();
      setSelectedCustomer(null);
      setQuantity("");
      addToast("Delivery logged! Will sync when online.", "success");
    } catch {
      setGeofenceError(true);
      addToast("Could not get your location. Please enable GPS.", "error");
    } finally {
      setDelivering(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[var(--color-bg)]">
      <NetworkStatus />

      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center px-4 py-3">
          <a href="/" className="mr-3 p-1 active:scale-95 transition-transform">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </a>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-[var(--color-text)]">Delivery Route</h1>
            <p className="text-xs text-[var(--color-text-muted)]">Dairy/Water delivery tracker</p>
          </div>
          {pendingCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 rounded-full border border-amber-200">
              <div className={`w-2 h-2 rounded-full ${isOnline() ? "bg-green-500" : "bg-amber-500 animate-pulse"}`} />
              <span className="text-xs font-medium text-amber-700">{pendingCount} pending</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-4">
        {!selectedCustomer ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
              Today&apos;s Route ({customers.length} stops)
            </p>
            {customers.map((customer, idx) => (
              <button
                key={customer.id}
                onClick={() => setSelectedCustomer(customer)}
                className="w-full flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-50 active:scale-[0.99] transition-transform text-left"
              >
                <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-[var(--color-text)]">{customer.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{customer.phone}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-[var(--color-text)]">
                    NPR {customer.baseRate}/{customer.unit}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                  {selectedCustomer.name.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-[var(--color-text)]">{selectedCustomer.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{selectedCustomer.phone}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-[var(--color-text)]">
                    Quantity ({selectedCustomer.unit}s)
                  </label>
                  <div className="flex gap-2 mt-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setQuantity(String(n))}
                        className={`flex-1 py-3 rounded-xl font-medium text-sm transition-colors ${
                          quantity === String(n)
                            ? "bg-[var(--color-primary)] text-white"
                            : "bg-gray-50 text-[var(--color-text)] border border-gray-100"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    placeholder="Custom quantity"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full mt-2 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:ring-2 focus:ring-blue-400/20 outline-none text-center text-lg font-bold"
                  />
                </div>

                {quantity && (
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-blue-600 mb-1">Total Amount</p>
                    <p className="text-2xl font-bold text-blue-700">
                      NPR {(Number(quantity) * selectedCustomer.baseRate).toLocaleString()}
                    </p>
                    <p className="text-xs text-blue-500">
                      {quantity} {selectedCustomer.unit}s × NPR {selectedCustomer.baseRate}
                    </p>
                  </div>
                )}

                {geofenceError && (
                  <div className="bg-red-50 rounded-xl p-3 flex items-start gap-2">
                    <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-red-700">Location mismatch</p>
                      <p className="text-xs text-red-500">You are too far from the customer&apos;s registered address.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setSelectedCustomer(null); setQuantity(""); setGeofenceError(false); }}
                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium active:scale-[0.98]"
              >
                Back
              </button>
              <button
                onClick={handleDeliver}
                disabled={!quantity || delivering}
                className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-medium active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {delivering ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Log Delivery
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
