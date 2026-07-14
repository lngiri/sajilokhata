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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white mb-1">Dispute Resolution</h1>
          <p className="text-sm text-gray-400">Review and resolve transaction disputes</p>
        </div>
        <button onClick={load} className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : disputes.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm">No disputes — all transactions are clean</p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map((d) => (
            <div key={d.id} className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-white truncate">{d.merchantName}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      d.status === "disputed" ? "bg-red-500/10 text-red-400 border-red-800/30" : "bg-amber-500/10 text-amber-400 border-amber-800/30"
                    }`}>{d.status}</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">
                    vs {d.customerName} &middot; NPR {d.amount.toLocaleString()}
                  </p>
                  {d.description && <p className="text-xs text-gray-500 mb-1">{d.description}</p>}
                  <p className="text-xs text-red-400/80"><strong>Reason:</strong> {d.reason}</p>
                  <p className="text-[10px] text-gray-600 mt-1">{new Date(d.createdAt).toLocaleString()}</p>
                </div>
                <button
                  onClick={() => handleResolve(d.id)}
                  disabled={resolving === d.id}
                  className="shrink-0 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
                >
                  {resolving === d.id ? (
                    <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
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
