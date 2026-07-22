"use client";

import { useEffect, useState } from "react";
import { getSystemHealth } from "@/app/actions/admin";

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
    getSystemHealth().then(setHealth).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { check(); }, []);

  const statusBg = (s: string) =>
    s === "green" ? "bg-[var(--color-primary)]/10 border-[var(--color-primary-dark)]/30"
    : s === "yellow" ? "bg-amber-500/10 border-amber-800/30"
    : "bg-red-500/10 border-red-800/30";

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--a-text)] tracking-tight mb-1">System Health</h1>
          <p className="text-sm text-[var(--a-muted)]">Monitor application status</p>
        </div>
        <button onClick={check} className="text-xs text-[var(--a-muted)] hover:text-[var(--a-text)] px-3 py-1.5 rounded-lg hover:bg-[var(--a-hover)] transition-colors">
          Re-check
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : health ? (
        <div className="space-y-6">
          <div className={`rounded-xl shadow-lg p-6 border ${statusBg(health.status)}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-3 h-3 rounded-full ${health.status === "green" ? "bg-[var(--color-primary-light)]" : health.status === "yellow" ? "bg-amber-400" : "bg-red-400"}`} />
              <span className={`text-lg font-bold ${health.status === "green" ? "text-[var(--color-primary-light)]" : health.status === "yellow" ? "text-amber-400" : "text-red-400"}`}>
                {health.status.toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-[var(--a-text-2)]">{health.message}</p>
            <p className="text-[10px] text-[var(--a-muted)] mt-2">Last check: {new Date(health.lastCheck).toLocaleString()}</p>
          </div>

          <div className="space-y-2">
            {health.checks.map((c, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl border border-[var(--a-border)] bg-[var(--a-surface-2)]/50 shadow-lg p-4">
                <div>
                  <span className="text-sm font-medium text-[var(--a-text)]">{c.label}</span>
                  {c.detail && <p className="text-xs text-[var(--a-muted)] mt-0.5">{c.detail}</p>}
                </div>
                <span className={`text-xs font-semibold ${c.ok ? "text-[var(--color-primary-light)]" : "text-red-400"}`}>
                  {c.ok ? "PASS" : "FAIL"}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-16 text-[var(--a-muted)]">
          <p className="text-sm font-medium">Could not fetch health data</p>
        </div>
      )}
    </div>
  );
}
