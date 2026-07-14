"use client";

import { useState, useEffect, useRef, useCallback } from "react";

import { useToast } from "@/components/Toast";
import {
  isOnline,
  saveDeliveryLog,
  getDeliveryLogs,
  syncDeliveryLogs,
  onOnlineStatusChange,
} from "@/lib/offline/db";
import { createCreditLog } from "@/lib/actions";
import { getCurrentMerchantId } from "@/lib/auth";

// ================================================================
// Haversine distance (meters) between two GPS coordinates
// ================================================================
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ================================================================
// Interface for a delivery stop
// ================================================================
interface DeliveryStop {
  merchantCustomerId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  location: { lat: number; lng: number } | null;
  distance: number | null; // from current GPS position
}

const GEOFENCE_RADIUS = 500; // meters
const SYNC_INTERVAL = 15_000; // 15 seconds

export default function DeliveryPage() {
  const { addToast } = useToast();

  // Identity & data
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [stops, setStops] = useState<DeliveryStop[]>([]);
  const [loading, setLoading] = useState(true);

  // GPS
  const [currentPos, setCurrentPos] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const gpsInitializedRef = useRef(false);

  // Delivery state
  const [selectedStop, setSelectedStop] = useState<DeliveryStop | null>(null);
  const [quantity, setQuantity] = useState("");
  const [delivering, setDelivering] = useState(false);
  const [geofenceError, setGeofenceError] = useState(false);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  // Offline queue
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // ================================================================
  // Fetch customers and get GPS position on mount
  // ================================================================
  useEffect(() => {
    const init = async () => {
      const id = await getCurrentMerchantId();
      setMerchantId(id);

      if (id) {
        try {
          const { getDeliveryCustomers } = await import("@/lib/actions");
          const customers = await getDeliveryCustomers(id);
          const mapped: DeliveryStop[] = (customers || []).map((mc: any) => ({
            merchantCustomerId: mc.id,
            customerId: mc.customer_id,
            customerName: mc.customers?.name || "Unknown",
            customerPhone: mc.customers?.phone || "",
            location: mc.home_location || null,
            distance: null,
          }));
          setStops(mapped);
        } catch {
          addToast("Could not load delivery customers.", "error");
        }
      }
      setLoading(false);
    };

    init();
    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5_000);
    return () => clearInterval(interval);
  }, [addToast]);

  // ================================================================
  // GPS watch — tracks live position for distance updates
  // ================================================================
  useEffect(() => {
    if (gpsInitializedRef.current) return;
    gpsInitializedRef.current = true;

    if (!navigator.geolocation) {
      setGpsError("GPS not available on this device.");
      return;
    }

    // Get initial position
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsError(null);
      },
      () => setGpsError("Could not get GPS. Enable location services."),
      { enableHighAccuracy: true, timeout: 10_000 }
    );

    // Watch for continuous updates
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCurrentPos({ lat, lng });
        setGpsError(null);
      },
      () => {
        /* silent */
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // ================================================================
  // Recalculate distances when GPS position or stops change
  // ================================================================
  useEffect(() => {
    if (!currentPos) return;
    setStops((prev) =>
      prev.map((s) => ({
        ...s,
        distance:
          s.location !== null
            ? haversineDistance(
                currentPos.lat,
                currentPos.lng,
                s.location.lat,
                s.location.lng
              )
            : null,
      }))
    );
  }, [currentPos]);

  // ================================================================
  // Sort stops by proximity (nearest first) when distances update
  // ================================================================
  const sortedStops = [...stops].sort((a, b) => {
    // Completed stops go to the bottom
    const aDone = completedIds.has(a.merchantCustomerId);
    const bDone = completedIds.has(b.merchantCustomerId);
    if (aDone !== bDone) return aDone ? 1 : -1;
    // Then sort by distance (null = no GPS, push to end)
    const dA = a.distance ?? Infinity;
    const dB = b.distance ?? Infinity;
    return dA - dB;
  });

  // ================================================================
  // Sync pending deliveries when back online
  // ================================================================
  useEffect(() => {
    const unsubscribe = onOnlineStatusChange(async (online) => {
      if (online) {
        await autoSync();
        updatePendingCount();
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Periodic sync
  useEffect(() => {
    const interval = setInterval(() => {
      if (isOnline()) {
        autoSync();
      }
    }, SYNC_INTERVAL);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const autoSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const result = await syncDeliveryLogs(createCreditLog);
      if (result.synced > 0) {
        addToast(`Synced ${result.synced} delivery entries.`, "success");
      }
    } catch {
      // Silent — will retry on next interval
    } finally {
      setSyncing(false);
    }
  };

  const updatePendingCount = async () => {
    const logs = await getDeliveryLogs();
    setPendingCount(logs.length);
  };

  // ================================================================
  // Select a customer for delivery
  // ================================================================
  const handleSelectStop = (stop: DeliveryStop) => {
    setSelectedStop(stop);
    setQuantity("");
    setGeofenceError(false);
  };

  // ================================================================
  // Verify geofence + log delivery (online or offline)
  // ================================================================
  const handleDeliver = useCallback(async () => {
    if (!selectedStop || !quantity || Number(quantity) <= 0) return;
    if (!selectedStop.location) {
      addToast("Customer has no registered address.", "error");
      return;
    }

    setDelivering(true);
    setGeofenceError(false);

    try {
      // Get GPS position — either from currentPos state or fresh Geolocation query
      let posLat: number, posLng: number;
      if (currentPos) {
        posLat = currentPos.lat;
        posLng = currentPos.lng;
      } else {
        const geoPos = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10_000,
            });
          }
        );
        posLat = geoPos.coords.latitude;
        posLng = geoPos.coords.longitude;
      }

      const distance = haversineDistance(
        posLat,
        posLng,
        selectedStop.location.lat,
        selectedStop.location.lng
      );

      if (distance > GEOFENCE_RADIUS) {
        setGeofenceError(true);
        setDelivering(false);
        addToast(
          `You are ${Math.round(distance)}m from ${selectedStop.customerName}. Must be within ${GEOFENCE_RADIUS}m.`,
          "warning"
        );
        return;
      }

      const logId = crypto.randomUUID();
      const amount = Number(quantity) * 60; // base rate Rs. 60/unit
      const now = new Date().toISOString();

      if (isOnline()) {
        // Save directly to Supabase
        await createCreditLog({
          merchant_id: merchantId || "unknown",
          customer_id: selectedStop.customerId,
          amount,
          quantity: Number(quantity),
          unit: "npr",
          description: `Delivery: ${quantity} units to ${selectedStop.customerName}`,
          type: "debit",
          status: "pending",
          sync_status: "online",
          device_info: navigator.userAgent,
          created_at: now,
        });
      } else {
        // Save offline — will sync later
        await saveDeliveryLog({
          id: logId,
          merchantId: merchantId || "unknown",
          customerId: selectedStop.customerId,
          customerName: selectedStop.customerName,
          amount,
          quantity: Number(quantity),
          unit: "npr",
          description: `Delivery: ${quantity} units to ${selectedStop.customerName}`,
          completedAt: now,
        });
      }

      // Mark as completed (compute new set to avoid stale closure)
      const newCompletedIds = new Set(completedIds);
      newCompletedIds.add(selectedStop.merchantCustomerId);
      setCompletedIds(newCompletedIds);

      const progress = (newCompletedIds.size / stops.length) * 100;
      addToast(
        `✅ Delivery logged for ${selectedStop.customerName}! ${Math.round(progress)}% complete.`,
        "success"
      );

      setSelectedStop(null);
      setQuantity("");
      updatePendingCount();
    } catch {
      setGeofenceError(true);
      addToast("Could not get GPS. Please enable location.", "error");
    } finally {
      setDelivering(false);
    }
  }, [selectedStop, quantity, currentPos, merchantId, completedIds, stops.length, addToast]);

  // ================================================================
  // Reset for a new session
  // ================================================================
  const resetSession = () => {
    setCompletedIds(new Set());
    setSelectedStop(null);
    setQuantity("");
    setGeofenceError(false);
    addToast("Route reset. All stops marked incomplete.", "info");
  };

  // ================================================================
  // Render
  // ================================================================
  const progressPct =
    stops.length > 0
      ? Math.round((completedIds.size / stops.length) * 100)
      : 0;

  const formatDistance = (meters: number): string => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] pb-8">

      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center px-4 py-3">
          <a href="/" className="mr-3 p-1 active:scale-95 transition-transform">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </a>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-[var(--color-text)]">
              Delivery Route
            </h1>
            <p className="text-xs text-[var(--color-text-muted)]">
              {currentPos
                ? `GPS: ${currentPos.lat.toFixed(4)}, ${currentPos.lng.toFixed(4)}`
                : gpsError || "Acquiring GPS..."}
            </p>
          </div>
          {/* Status badges */}
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <button
                onClick={autoSync}
                disabled={syncing || !isOnline()}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 rounded-full border border-amber-200 active:scale-95 transition-transform disabled:opacity-50"
              >
                {syncing ? (
                  <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isOnline() ? "bg-green-500" : "bg-amber-500 animate-pulse"
                    }`}
                  />
                )}
                <span className="text-[10px] font-medium text-amber-700">
                  {pendingCount}
                </span>
              </button>
            )}
            {stops.length > 0 && (
              <span className="text-[10px] text-[var(--color-text-muted)]">
                {completedIds.size}/{stops.length}
              </span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {stops.length > 0 && (
          <div className="px-4 pb-3">
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !selectedStop ? (
          /* ================================================================ */
          /* Route List — sorted by proximity */
          /* ================================================================ */
          <div className="space-y-1.5">
            {/* GPS error banner */}
            {gpsError && (
              <div className="bg-amber-50 rounded-xl px-4 py-2.5 mb-3 flex items-center gap-2 border border-amber-200">
                <svg
                  className="w-4 h-4 text-amber-600 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                  />
                </svg>
                <p className="text-xs text-amber-700">
                  {gpsError} Distance-based sorting unavailable.
                </p>
              </div>
            )}

            {/* Section header */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                Today&apos;s Route
                {currentPos && ` · Sorted by proximity`}
              </p>
              {completedIds.size > 0 && (
                <button
                  onClick={resetSession}
                  className="text-[10px] text-[var(--color-text-muted)] underline active:opacity-70"
                >
                  Reset
                </button>
              )}
            </div>

            {sortedStops.length === 0 ? (
              <div className="text-center py-12 text-[var(--color-text-muted)]">
                <svg
                  className="w-16 h-16 mx-auto mb-3 opacity-20"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0H21M3.375 14.25h17.25m-17.25 0V5.625A2.25 2.25 0 015.625 3.375h2.25a.75.75 0 00.75-.75V3.375m4.5 0a.75.75 0 00.75.75h2.25A2.25 2.25 0 0117.25 5.625v5.625m0 0H3.375"
                  />
                </svg>
                <p className="font-medium">No delivery customers</p>
                <p className="text-sm mt-1">
                  Add customers to your ledger to see them here.
                </p>
              </div>
            ) : (
              sortedStops.map((stop, idx) => {
                const isCompleted = completedIds.has(stop.merchantCustomerId);
                const isInRange =
                  stop.distance !== null && stop.distance <= GEOFENCE_RADIUS;

                return (
                  <button
                    key={stop.merchantCustomerId}
                    onClick={() => handleSelectStop(stop)}
                    disabled={isCompleted}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left active:scale-[0.99] ${
                      isCompleted
                        ? "bg-green-50 border-green-200 opacity-60"
                        : "bg-white border-gray-50 shadow-sm"
                    }`}
                  >
                    {/* Stop number */}
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        isCompleted
                          ? "bg-green-500 text-white"
                          : idx < 3
                            ? "bg-[var(--color-primary)] text-white"
                            : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      {isCompleted ? (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.5 12.75l6 6 9-13.5"
                          />
                        </svg>
                      ) : (
                        idx + 1
                      )}
                    </div>

                    {/* Customer info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-[var(--color-text)] truncate">
                        {stop.customerName}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {stop.customerPhone}
                      </p>
                    </div>

                    {/* Distance */}
                    <div className="text-right flex-shrink-0">
                      {stop.distance !== null ? (
                        <p
                          className={`text-xs font-semibold ${
                            isInRange
                              ? "text-green-600"
                              : stop.distance > GEOFENCE_RADIUS * 2
                                ? "text-red-500"
                                : "text-amber-600"
                          }`}
                        >
                          {formatDistance(stop.distance)}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-300">--</p>
                      )}
                      <p className="text-[9px] text-[var(--color-text-muted)]">
                        {isInRange ? "In range" : "Far"}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        ) : (
          /* ================================================================ */
          /* Customer Detail — delivery logging */
          /* ================================================================ */
          <div className="space-y-4 animate-fade-in">
            {/* Customer info card */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center text-xl font-bold">
                  {selectedStop.customerName.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-[var(--color-text)]">
                    {selectedStop.customerName}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {selectedStop.customerPhone}
                  </p>
                </div>
              </div>

              {/* Distance indicator */}
              {selectedStop.location && currentPos && (
                <div
                  className={`rounded-xl px-3 py-2 flex items-center gap-2 text-sm ${
                    (selectedStop.distance ?? Infinity) <= GEOFENCE_RADIUS
                      ? "bg-green-50 text-green-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  <svg
                    className="w-5 h-5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                    />
                  </svg>
                  <span>
                    {(selectedStop.distance ?? 0) <= GEOFENCE_RADIUS
                      ? `📍 ${formatDistance(selectedStop.distance ?? 0)} — In delivery range`
                      : `📍 ${formatDistance(selectedStop.distance ?? 0)} — Too far (max ${GEOFENCE_RADIUS}m)`}
                  </span>
                </div>
              )}

              {!selectedStop.location && (
                <div className="bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-500 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  No GPS address registered
                </div>
              )}

              {/* Delivery form */}
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-sm font-medium text-[var(--color-text)]">
                    Quantity (units)
                  </label>
                  <div className="flex gap-2 mt-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setQuantity(String(n))}
                        className={`flex-1 py-3 rounded-xl font-medium text-sm transition-all active:scale-95 ${
                          quantity === String(n)
                            ? "bg-[var(--color-primary)] text-white shadow-sm"
                            : "bg-gray-50 text-[var(--color-text)] border border-gray-100 hover:bg-gray-100"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    placeholder="Custom"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full mt-2 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:ring-2 focus:ring-blue-400/20 outline-none text-center text-lg font-bold transition-all"
                  />
                </div>

                {quantity && Number(quantity) > 0 && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 text-center border border-blue-100">
                    <p className="text-xs text-blue-600 font-medium mb-1">
                      Delivery Total
                    </p>
                    <p className="text-3xl font-bold text-blue-700">
                      Rs. {(Number(quantity) * 60).toLocaleString()}
                    </p>
                    <p className="text-xs text-blue-500 mt-1">
                      {quantity} unit{Number(quantity) !== 1 ? "s" : ""} × Rs. 60
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Geofence error */}
            {geofenceError && (
              <div className="bg-red-50 rounded-xl p-4 flex items-start gap-3 border border-red-200">
                <svg
                  className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  />
                </svg>
                <div>
                  <p className="text-sm font-medium text-red-700">
                    Location mismatch
                  </p>
                  <p className="text-xs text-red-500 mt-0.5">
                    You must be within {GEOFENCE_RADIUS}m of the customer&apos;s
                    registered address to log this delivery. Current distance:{" "}
                    {selectedStop.distance !== null
                      ? formatDistance(selectedStop.distance)
                      : "unknown"}
                    .
                  </p>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedStop(null);
                  setQuantity("");
                  setGeofenceError(false);
                }}
                className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-medium active:scale-[0.98] transition-transform"
              >
                Back
              </button>
              <button
                onClick={handleDeliver}
                disabled={!quantity || Number(quantity) <= 0 || delivering}
                className="flex-1 py-3.5 bg-blue-500 text-white rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {delivering ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0H21M3.375 14.25h17.25m-17.25 0V5.625A2.25 2.25 0 015.625 3.375h2.25a.75.75 0 00.75-.75V3.375m4.5 0a.75.75 0 00.75.75h2.25A2.25 2.25 0 0117.25 5.625v5.625m0 0H3.375"
                      />
                    </svg>
                    Log Delivery {!isOnline() && "(Offline)"}
                  </>
                )}
              </button>
            </div>

            {/* Offline indicator */}
            {!isOnline() && (
              <div className="bg-amber-50 rounded-xl px-4 py-3 flex items-center gap-2.5 border border-amber-200">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                <p className="text-xs text-amber-700 flex-1">
                  You&apos;re offline. This delivery will be saved locally and
                  synced when you reconnect.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Sync status footer */}
        {pendingCount > 0 && !selectedStop && (
          <div className="mt-4 px-4 py-2.5 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  isOnline() ? "bg-green-500" : "bg-amber-500 animate-pulse"
                }`}
              />
              <span className="text-xs font-medium text-amber-700">
                {pendingCount} delivery{pendingCount !== 1 ? "ies" : "y"} pending
                sync
              </span>
            </div>
            <button
              onClick={autoSync}
              disabled={syncing || !isOnline()}
              className="text-xs text-amber-700 font-medium underline active:opacity-70 disabled:opacity-40"
            >
              {syncing ? "Syncing..." : "Sync now"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
