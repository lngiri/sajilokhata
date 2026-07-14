"use client";

import { useEffect, useState } from "react";
import { getAdminStats } from "@/app/actions/admin";

interface Stats {
  totalMerchants: number;
  totalCustomers: number;
  activeTransactions: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    setName(localStorage.getItem("admin_name") || "Admin");
    getAdminStats().then(setStats).catch(() => {});
  }, []);

  const cards = [
    { label: "Total Merchants", value: stats?.totalMerchants ?? "-", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4", color: "bg-blue-500/10 text-blue-400 border-blue-800/30" },
    { label: "Total Customers", value: stats?.totalCustomers ?? "-", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z", color: "bg-emerald-500/10 text-emerald-400 border-emerald-800/30" },
    { label: "Active Transactions", value: stats?.activeTransactions ?? "-", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", color: "bg-amber-500/10 text-amber-400 border-amber-800/30" },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold text-white mb-1">Welcome, {name}</h1>
      <p className="text-sm text-gray-400 mb-6">Real-time overview</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div key={card.label} className={`rounded-2xl p-5 border ${card.color}`}>
            <svg className="w-8 h-8 mb-3 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={card.icon} />
            </svg>
            <div className="text-3xl font-bold">{card.value}</div>
            <div className="text-sm mt-1 opacity-80">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-gray-800 bg-gray-900/50 p-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {[
            { label: "Alerts", href: "/admin/alerts", icon: "M12 9v2m0 4h.01" },
            { label: "Disputes", href: "/admin/disputes", icon: "M9 12h6m-6 4h6" },
            { label: "Announce", href: "/admin/announcements", icon: "M11 5.882V19.24" },
            { label: "Health", href: "/admin/health", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
          ].map((action) => (
            <a
              key={action.href}
              href={action.href}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-800/50 hover:bg-gray-800 border border-gray-800 transition-colors text-center"
            >
              <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={action.icon} />
              </svg>
              <span className="text-xs text-gray-400">{action.label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
