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

const QUICK_ACTIONS = [
  { label: "Alerts", href: "/admin/alerts", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z", desc: "Review flagged activity" },
  { label: "Disputes", href: "/admin/disputes", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", desc: "Resolve open cases" },
  { label: "Analytics", href: "/admin/analytics", icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z", desc: "Merchant usage metrics" },
  { label: "Sessions", href: "/admin/sessions", icon: "M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75", desc: "Monitor & force logout" },
  { label: "Storage", href: "/admin/storage", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4", desc: "DB usage estimates" },
  { label: "Users", href: "/admin/users", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z", desc: "Manage merchants" },
];

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
    { label: "Merchants", value: stats?.totalMerchants ?? "-", sub: `${merchants.length} registered`, accent: "text-blue-400" },
    { label: "End Customers", value: stats?.totalCustomers ?? "-", sub: "total accounts", accent: "text-emerald-400" },
    { label: "Transactions", value: totalTx.toLocaleString(), sub: `${stats?.activeTransactions ?? 0} pending`, accent: "text-amber-400" },
    { label: "Disputes", value: disputes.length, sub: "open cases", accent: "text-red-400" },
  ];

  const recentMerchants = merchants.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-50 tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">Welcome back, {name}</p>
      </div>

      {/* ── Metrics row: 4 large cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => {
          const href =
            card.label === "Merchants" ? "/admin/users?role=merchant" :
            card.label === "End Customers" ? "/admin/users?role=customer" :
            card.label === "Transactions" ? "/admin/users" :
            card.label === "Disputes" ? "/admin/disputes" : "/admin/users";
          return (
            <a
              key={card.label}
              href={href}
              className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-6 transition-all hover:border-slate-600 hover:bg-slate-700/50 block"
            >
              <div className={`text-5xl font-bold tracking-tight ${card.accent}`}>
                {card.value}
              </div>
              <div className="text-sm font-medium text-slate-400 mt-2">{card.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{card.sub}</div>
            </a>
          );
        })}
      </div>

      {/* ── 3-column grid: merchants + quick actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Column 1: Recent Merchants (span 2) */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300">Recent Merchants</h2>
            <a href="/admin/users" className="text-xs font-medium text-red-400 hover:text-red-300 transition-colors">
              View all &rarr;
            </a>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/50 shadow-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Business</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Phone</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Txns</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentMerchants.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-600">No merchants yet</td></tr>
                ) : recentMerchants.map((m) => (
                  <tr key={m.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-200">{m.businessName || m.name || "Unnamed"}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 font-mono">{m.phone}</td>
                    <td className="px-4 py-3 text-sm text-right text-slate-400">{m.transactionCount}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
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

        {/* Column 2: Quick Actions — grid of cards */}
        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_ACTIONS.map((a) => (
              <a
                key={a.href}
                href={a.href}
                className="flex flex-col items-center justify-center gap-2 bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-4 text-center transition-all hover:scale-105 hover:border-slate-600 hover:bg-slate-700/60"
              >
                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={a.icon} />
                </svg>
                <span className="text-xs font-medium text-slate-300">{a.label}</span>
                <span className="text-[10px] text-slate-500 leading-tight">{a.desc}</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ── Disputes table ── */}
      {disputes.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Open Disputes</h2>
          <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/50 shadow-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Merchant</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Amount</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody>
                {disputes.slice(0, 5).map((d) => (
                  <tr key={d.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-200">{d.merchantName}</td>
                    <td className="px-4 py-3 text-sm text-right text-slate-400">NPR {d.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">{d.status}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-slate-500">{new Date(d.createdAt).toLocaleDateString()}</td>
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
