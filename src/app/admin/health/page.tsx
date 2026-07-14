"use client";

import { useEffect, useState } from "react";

interface HealthCheck {
  label: string;
  ok: boolean;
  detail?: string;
}

interface Health {
  status: "green" | "yellow" | "red";
  message: string;
  lastCheck: string;
  checks: HealthCheck[];
}

export default function HealthPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);

  const check = () => {
    setLoading(true);
    fetch("/api/admin/health", { cache: "no-store" })
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { check(); }, []);

  const statusColor = (s: string) =>
    s === "green" ? "text-emerald-400" : s === "yellow" ? "text-amber-400" : "text-red-400";

  const statusBg = (s: string) =>
    s === "green" ? "bg-emerald-500/10 border-emerald-800/30" : s === "yellow" ? "bg-amber-500/10 border-amber-800/30" : "bg-red-500/10 border-red-800/30";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white mb-1">System Health</h1>
          <p className="text-sm text-gray-400">Monitor application status</p>
        </div>
        <button onClick={check} className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
          Re-check
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : health ? (
        <div className="space-y-4">
          <div className={`rounded-2xl p-6 border ${statusBg(health.status)}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-3 h-3 rounded-full ${health.status === "green" ? "bg-emerald-400" : health.status === "yellow" ? "bg-amber-400" : "bg-red-400"}`} />
              <span className={`text-lg font-bold ${statusColor(health.status)}`}>
                {health.status.toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-gray-300">{health.message}</p>
            <p className="text-[10px] text-gray-600 mt-1">Last check: {new Date(health.lastCheck).toLocaleString()}</p>
          </div>

          <div className="space-y-2">
            {health.checks.map((c, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900/50 p-3">
                <div>
                  <span className="text-sm text-gray-300">{c.label}</span>
                  {c.detail && <p className="text-xs text-gray-500 mt-0.5">{c.detail}</p>}
                </div>
                <span className={`text-xs font-medium ${c.ok ? "text-emerald-400" : "text-red-400"}`}>
                  {c.ok ? "PASS" : "FAIL"}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <p className="text-sm">Could not fetch health data</p>
        </div>
      )}
    </div>
  );
}
