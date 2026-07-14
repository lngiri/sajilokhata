"use client";

import { useEffect, useState } from "react";
import { getAdminDisputes, resolveDispute } from "@/app/actions/admin";

interface Dispute {
  id: string;
  merchantName: string;
  merchantPhone: string;
  customerName: string;
  amount: number;
  description: string;
  reason: string;
  status: string;
  createdAt: string;
}

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  const load = () => {
    getAdminDisputes().then(setDisputes).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleResolve = async (logId: string) => {
    setResolving(logId);
    const result = await resolveDispute(logId);
    if (result.success) {
      setDisputes((prev) => prev.filter((d) => d.id !== logId));
    }
    setResolving(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-50 tracking-tight mb-1">Dispute Resolution</h1>
          <p className="text-sm text-slate-400">Review and resolve transaction disputes</p>
        </div>
        <button onClick={load} className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : disputes.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <svg className="w-14 h-14 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium">No disputes — all transactions are clean</p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map((d) => (
            <div key={d.id} className="rounded-xl border border-slate-700 bg-slate-800/50 shadow-lg p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-semibold text-sm text-slate-200 truncate">{d.merchantName}</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                      d.status === "disputed" ? "bg-red-500/10 text-red-400 border-red-800/30" : "bg-amber-500/10 text-amber-400 border-amber-800/30"
                    }`}>{d.status}</span>
                  </div>
                  <p className="text-xs text-slate-500 mb-2">
                    vs {d.customerName} &middot; NPR {d.amount.toLocaleString()}
                  </p>
                  {d.description && <p className="text-xs text-slate-400 mb-1">{d.description}</p>}
                  <p className="text-xs text-red-400/80"><strong>Reason:</strong> {d.reason}</p>
                  <p className="text-[10px] text-slate-600 mt-2">{new Date(d.createdAt).toLocaleString()}</p>
                </div>
                <button
                  onClick={() => handleResolve(d.id)}
                  disabled={resolving === d.id}
                  className="shrink-0 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  {resolving === d.id ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : "Resolve"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
