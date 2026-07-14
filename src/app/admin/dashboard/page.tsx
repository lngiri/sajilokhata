"use client";

import { useEffect, useState, useMemo } from "react";
import { getAdminStats, getAdminMerchants, getAdminDisputes } from "@/app/actions/admin";

interface Stats {
  totalMerchants: number;
  totalCustomers: number;
  activeTransactions: number;
}

interface Merchant {
  id: string;
  name: string;
  businessName: string;
  phone: string;
  status: string;
  transactionCount: number;
  createdAt: string;
}

interface Dispute {
  id: string;
  merchantName: string;
  amount: number;
  status: string;
  createdAt: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    setName(localStorage.getItem("admin_name") || "Admin");
    getAdminStats().then(setStats).catch(() => {});
    getAdminMerchants().then(setMerchants).catch(() => {});
    getAdminDisputes().then(setDisputes).catch(() => {});
  }, []);

  const totalTx = useMemo(() => merchants.reduce((s, m) => s + m.transactionCount, 0), [merchants]);

  const cards = [
    { label: "Merchants", value: stats?.totalMerchants ?? "-", sub: `${merchants.length} registered`, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "End Customers", value: stats?.totalCustomers ?? "-", sub: "total accounts", color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Transactions", value: totalTx.toLocaleString(), sub: `${stats?.activeTransactions ?? 0} pending`, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "Disputes", value: disputes.length, sub: "open cases", color: "text-red-400", bg: "bg-red-500/10" },
  ];

  const recentMerchants = merchants.slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Dashboard</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Welcome back, {name}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-600">{new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
        </div>
      </div>

      {/* ── Stats row: 4 compact cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((card) => (
          <div key={card.label} className={`${card.bg} rounded-lg border border-gray-800/50 px-3.5 py-3`}>
            <div className={`text-lg font-bold ${card.color}`}>{card.value}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">{card.label}</div>
            <div className="text-[10px] text-gray-600">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── 3-column grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Column 1: Recent Merchants */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recent Merchants</h2>
            <a href="/admin/users" className="text-[11px] text-emerald-500 hover:text-emerald-400 transition-colors">View all</a>
          </div>
          <div className="overflow-hidden rounded-lg border border-gray-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800/50 bg-gray-900/50">
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Business</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Phone</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">Txns</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentMerchants.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-600">No merchants yet</td></tr>
                ) : recentMerchants.map((m) => (
                  <tr key={m.id} className="border-b border-gray-800/30 hover:bg-gray-900/30 transition-colors">
                    <td className="px-3 py-2.5 text-gray-300">{m.businessName || m.name || "Unnamed"}</td>
                    <td className="px-3 py-2.5 text-gray-500 font-mono">{m.phone}</td>
                    <td className="px-3 py-2.5 text-right text-gray-400">{m.transactionCount}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        m.status === "suspended" ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
                      }`}>
                        {m.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Column 2: Quick Actions */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5">Quick Actions</h2>
          <div className="space-y-1">
            {[
              { label: "Alerts", href: "/admin/alerts", icon: "M12 9v2m0 4h.01", color: "text-amber-400" },
              { label: "Disputes", href: "/admin/disputes", icon: "M9 12h6m-6 4h6", color: "text-red-400" },
              { label: "Analytics", href: "/admin/analytics", icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75z", color: "text-blue-400" },
              { label: "Storage", href: "/admin/storage", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4", color: "text-emerald-400" },
              { label: "Health", href: "/admin/health", icon: "M13 10V3L4 14h7v7l9-11h-7z", color: "text-gray-400" },
              { label: "Sessions", href: "/admin/sessions", icon: "M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75", color: "text-purple-400" },
            ].map((a) => (
              <a
                key={a.href}
                href={a.href}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-900/50 transition-colors"
              >
                <svg className={`w-4 h-4 ${a.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={a.icon} />
                </svg>
                {a.label}
              </a>
            ))}
          </div>
        </div>

      </div>

      {/* ── Bottom: Disputes table ── */}
      {disputes.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5">Open Disputes</h2>
          <div className="overflow-hidden rounded-lg border border-gray-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800/50 bg-gray-900/50">
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Merchant</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">Amount</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">Status</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {disputes.slice(0, 5).map((d) => (
                  <tr key={d.id} className="border-b border-gray-800/30 hover:bg-gray-900/30 transition-colors">
                    <td className="px-3 py-2.5 text-gray-300">{d.merchantName}</td>
                    <td className="px-3 py-2.5 text-right text-gray-400">NPR {d.amount.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">{d.status}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-500">{new Date(d.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
