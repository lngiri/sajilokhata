"use client";

import { useState } from "react";
import {
  searchMerchantSession,
  forceMerchantLogout,
  clearForceLogout,
} from "@/app/actions/admin";

interface SessionResult {
  id: string;
  name: string;
  businessName: string;
  phone: string;
  status: string;
  lastActive: string | null;
  forceLogoutAt: string | null;
}

export default function SessionsPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SessionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    const data = await searchMerchantSession(query);
    setResults(data);
    setLoading(false);
  };

  const handleForceLogout = async (id: string) => {
    setActionLoading(id);
    await forceMerchantLogout(id);
    // Refresh results
    const data = await searchMerchantSession(query);
    setResults(data);
    setActionLoading(null);
  };

  const handleClear = async (id: string) => {
    setActionLoading(id);
    await clearForceLogout(id);
    const data = await searchMerchantSession(query);
    setResults(data);
    setActionLoading(null);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white mb-1">Session Monitor</h1>
        <p className="text-sm text-gray-400">Search merchants and manage active sessions</p>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") search(); }}
          placeholder="Search by phone, name, or business name..."
          className="flex-1 px-4 py-2.5 bg-gray-800 text-white rounded-xl border border-gray-700 focus:ring-2 focus:ring-emerald-500/40 outline-none text-sm"
        />
        <button
          onClick={search}
          disabled={loading || !query.trim()}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : "Search"}
        </button>
      </div>

      {/* Results */}
      {searched && (
        <div className="space-y-2">
          {results.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No merchants found matching &quot;{query}&quot;</p>
            </div>
          ) : (
            results.map((m) => {
              const isForceLoggedOut = !!m.forceLogoutAt;
              return (
                <div
                  key={m.id}
                  className={`rounded-xl border p-4 ${
                    isForceLoggedOut
                      ? "border-red-800/30 bg-red-900/10"
                      : "border-gray-800 bg-gray-900/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white truncate">
                          {m.businessName || m.name || "Unnamed"}
                        </h3>
                        {isForceLoggedOut && (
                          <span className="text-[10px] font-medium text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                            FORCE LOGOUT
                          </span>
                        )}
                      </div>
                      {m.name && m.businessName && (
                        <p className="text-xs text-gray-500">{m.name}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                        <span className="font-mono">{m.phone}</span>
                        <span>•</span>
                        <span className={m.status === "suspended" ? "text-red-400" : "text-emerald-400"}>
                          {m.status}
                        </span>
                        {m.lastActive && (
                          <>
                            <span>•</span>
                            <span>Last active: {new Date(m.lastActive).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                      {isForceLoggedOut && (
                        <p className="text-xs text-red-400 mt-1">
                          Force-logged out on {new Date(m.forceLogoutAt!).toLocaleString()}
                        </p>
                      )}
                    </div>

                    <div className="flex-shrink-0">
                      {isForceLoggedOut ? (
                        <button
                          onClick={() => handleClear(m.id)}
                          disabled={actionLoading === m.id}
                          className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                        >
                          {actionLoading === m.id ? (
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : "Clear"}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleForceLogout(m.id)}
                          disabled={actionLoading === m.id}
                          className="px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                        >
                          {actionLoading === m.id ? (
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : "Force Logout"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
