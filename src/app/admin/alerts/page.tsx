"use client";

import { useEffect, useState } from "react";

interface Alert {
  id: string;
  merchantName: string;
  type: string;
  message: string;
  severity: "high" | "medium" | "low";
  createdAt: string;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/alerts", { cache: "no-store" })
      .then((r) => r.json())
      .then(setAlerts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const severityClass = (s: string) =>
    s === "high"
      ? "bg-red-500/10 text-red-400 border-red-800/30"
      : s === "medium"
      ? "bg-amber-500/10 text-amber-400 border-amber-800/30"
      : "bg-blue-500/10 text-blue-400 border-blue-800/30";

  return (
    <div>
      <h1 className="text-xl font-bold text-white mb-1">Anomaly Alerts</h1>
      <p className="text-sm text-gray-400 mb-6">Suspicious activity flagged for review</p>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm">No alerts — all clear</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div key={alert.id} className={`rounded-xl p-4 border ${severityClass(alert.severity)}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm">{alert.merchantName}</span>
                <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full border ${severityClass(alert.severity)}`}>
                  {alert.severity}
                </span>
              </div>
              <p className="text-sm opacity-90">{alert.message}</p>
              <p className="text-[10px] opacity-50 mt-1">{new Date(alert.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
