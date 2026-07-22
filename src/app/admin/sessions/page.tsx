"use client";

import { useState } from "react";
import {
  searchMerchantSession,
  forceMerchantLogout,
  clearForceLogout,
  terminateSession,
} from "@/app/actions/admin";
import type { UserSessionResult, SessionRecord } from "@/app/actions/admin";

export default function SessionsPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSessionResult[]>([]);
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

  const handleForceLogout = async (userId: string) => {
    setActionLoading(`force_${userId}`);
    await forceMerchantLogout(userId);
    const data = await searchMerchantSession(query);
    setResults(data);
    setActionLoading(null);
  };

  const handleClear = async (userId: string) => {
    setActionLoading(`clear_${userId}`);
    await clearForceLogout(userId);
    const data = await searchMerchantSession(query);
    setResults(data);
    setActionLoading(null);
  };

  const handleTerminate = async (sessionId: string, userId: string) => {
    setActionLoading(`term_${sessionId}`);
    await terminateSession(sessionId, userId);
    const data = await searchMerchantSession(query);
    setResults(data);
    setActionLoading(null);
  };

  const userTypeBadge = (ut: string) => {
    if (ut === "both") return "bg-purple-500/10 text-purple-400";
    if (ut === "merchant") return "bg-blue-500/10 text-blue-400";
    return "bg-[var(--color-primary)]/10 text-[var(--color-primary-light)]";
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--a-text)] tracking-tight mb-1">Session Monitor</h1>
        <p className="text-sm text-[var(--a-muted)]">Search users by phone and manage their active sessions</p>
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") search(); }}
          placeholder="Search by phone number..."
          className="flex-1 px-4 py-2.5 bg-[var(--a-input)] text-[var(--a-input-text)] rounded-xl border border-[var(--a-border)] focus:ring-2 focus:ring-red-500/40 outline-none text-sm placeholder-[var(--a-muted)]"
        />
        <button
          onClick={search}
          disabled={loading || !query.trim()}
          className="px-5 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
          ) : "Search"}
        </button>
      </div>

      {/* Results */}
      {searched && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 text-[var(--a-muted)]">
              <p className="text-sm font-medium">No users found matching &quot;{query}&quot;</p>
            </div>
          ) : (
            results.map((u) => {
              const isForceLoggedOut = !!u.forceLogoutAt;
              return (
                <div
                  key={u.userId}
                  className={`rounded-xl border shadow-lg overflow-hidden ${
                    isForceLoggedOut
                      ? "border-red-800/30 bg-red-900/10"
                      : "border-[var(--a-border)] bg-[var(--a-surface-2)]/50"
                  }`}
                >
                  {/* User header */}
                  <div className="p-5 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-[var(--a-text)]">
                          {u.businessName || u.name || "Unnamed"}
                        </h3>
                        <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${userTypeBadge(u.userType)}`}>
                          {u.userType === "both" ? "Merchant / Customer" : u.userType.charAt(0).toUpperCase() + u.userType.slice(1)}
                        </span>
                        {isForceLoggedOut && (
                          <span className="text-[10px] font-semibold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                            FORCE LOGOUT
                          </span>
                        )}
                      </div>
                      {u.name && u.businessName && (
                        <p className="text-xs text-[var(--a-muted)] mt-0.5">{u.name}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-[var(--a-muted)]">
                        <span className="font-mono">{u.phone}</span>
                        <span>&bull;</span>
                        <span className={u.status === "suspended" ? "text-red-400" : "text-[var(--color-primary-light)]"}>
                          {u.status}
                        </span>
                        <span>&bull;</span>
                        <span>{u.sessions.length} active session{u.sessions.length !== 1 ? "s" : ""}</span>
                      </div>
                      {isForceLoggedOut && (
                        <p className="text-xs text-red-400 mt-1">
                          Force-logged out on {new Date(u.forceLogoutAt!).toLocaleString()}
                        </p>
                      )}
                    </div>

                    <div className="flex-shrink-0 flex gap-2">
                      {isForceLoggedOut ? (
                        <button
                          onClick={() => handleClear(u.userId)}
                          disabled={actionLoading === `clear_${u.userId}`}
                          className="px-4 py-2 text-xs font-semibold bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] disabled:opacity-50 text-white rounded-lg transition-colors"
                        >
                          {actionLoading === `clear_${u.userId}` ? (
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : "Clear Force Logout"}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleForceLogout(u.userId)}
                          disabled={actionLoading === `force_${u.userId}`}
                          className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                        >
                          {actionLoading === `force_${u.userId}` ? (
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : "Force Logout All"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Session details */}
                  {u.sessions.length > 0 && (
                    <div className="border-t border-[var(--a-border)]/50">
                      <div className="px-5 py-2 text-xs font-medium text-[var(--a-muted)] uppercase tracking-wider bg-[var(--a-surface)]/30">
                        Sessions
                      </div>
                      {u.sessions.map((s) => (
                        <div
                          key={s.sessionId}
                          className="px-5 py-3 flex items-start justify-between gap-3 border-t border-[var(--a-border)]/30"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-4 text-xs text-[var(--a-text-2)]">
                              <span className="font-medium">Login:</span>
                              <span>{new Date(s.loginTime).toLocaleString()}</span>
                            </div>
                            {s.deviceInfo && (
                              <div className="flex items-start gap-4 text-xs text-[var(--a-muted)]">
                                <span className="font-medium shrink-0">Device:</span>
                                <span className="break-all">{s.deviceInfo}</span>
                              </div>
                            )}
                            {s.ipAddress && (
                              <div className="flex items-center gap-4 text-xs text-[var(--a-muted)]">
                                <span className="font-medium">IP:</span>
                                <span className="font-mono">{s.ipAddress}</span>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleTerminate(s.sessionId, u.userId)}
                            disabled={actionLoading === `term_${s.sessionId}`}
                            className="shrink-0 px-3 py-2 text-xs font-semibold bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg transition-colors"
                          >
                            {actionLoading === `term_${s.sessionId}` ? (
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : "Terminate Session"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
