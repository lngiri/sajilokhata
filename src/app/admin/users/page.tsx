"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { getAdminUserDirectory, toggleMerchantStatus } from "@/app/actions/admin";
import type { DirectoryUser } from "@/app/actions/admin";

const ROLE_BADGE: Record<string, string> = {
  merchant: "bg-blue-500/10 text-blue-400",
  customer: "bg-emerald-500/10 text-emerald-400",
  both: "bg-purple-500/10 text-purple-400",
};

export default function UsersPage() {
  const searchParams = useSearchParams();
  const roleFilter = searchParams?.get("role") || "";
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getAdminUserDirectory();
    console.log("[UsersPage] getAdminUserDirectory returned", data?.length ?? 0, "users");
    if (data && data.length > 0) {
      console.log("[UsersPage] Sample user:", JSON.stringify(data[0]));
    }
    setUsers(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let result = users;
    if (roleFilter === "merchant") result = result.filter((u) => u.role === "merchant" || u.role === "both");
    if (roleFilter === "customer") result = result.filter((u) => u.role === "customer" || u.role === "both");
    if (roleFilter === "both") result = result.filter((u) => u.role === "both");
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((u) => u.name.toLowerCase().includes(q) || u.phone.includes(q) || u.businessName.toLowerCase().includes(q));
    }
    return result;
  }, [users, roleFilter, search]);

  const stats = useMemo(() => ({
    total: users.length,
    merchants: users.filter((u) => u.role === "merchant" || u.role === "both").length,
    customers: users.filter((u) => u.role === "customer" || u.role === "both").length,
    both: users.filter((u) => u.role === "both").length,
  }), [users]);

  const handleToggle = async (user: DirectoryUser) => {
    if (user.role === "customer") return;
    setToggling(user.id);
    const result = await toggleMerchantStatus(user.id, user.status);
    if (result.success && result.newStatus) {
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: result.newStatus! } : u))
      );
    }
    setToggling(null);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--a-text)] tracking-tight mb-1">User Directory</h1>
      <p className="text-sm text-[var(--a-muted)] mb-8">All merchants and customers in the platform</p>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <a href="/admin/users" className="bg-[var(--a-surface)] rounded-xl shadow-lg border border-[var(--a-border)] p-4 hover:border-[var(--a-border-2)] transition-colors block">
          <p className="text-2xl font-bold tracking-tight text-[var(--a-text)]">{stats.total}</p>
          <p className="text-xs text-[var(--a-muted)] mt-1">Total Users</p>
        </a>
        <a href="/admin/users?role=merchant" className="bg-[var(--a-surface)] rounded-xl shadow-lg border border-[var(--a-border)] p-4 hover:border-[var(--a-border-2)] transition-colors block">
          <p className="text-2xl font-bold tracking-tight text-blue-400">{stats.merchants}</p>
          <p className="text-xs text-[var(--a-muted)] mt-1">Merchants</p>
        </a>
        <a href="/admin/users?role=customer" className="bg-[var(--a-surface)] rounded-xl shadow-lg border border-[var(--a-border)] p-4 hover:border-[var(--a-border-2)] transition-colors block">
          <p className="text-2xl font-bold tracking-tight text-emerald-400">{stats.customers}</p>
          <p className="text-xs text-[var(--a-muted)] mt-1">Customers</p>
        </a>
        <a href="/admin/users?role=both" className="bg-[var(--a-surface)] rounded-xl shadow-lg border border-[var(--a-border)] p-4 hover:border-[var(--a-border-2)] transition-colors block">
          <p className="text-2xl font-bold tracking-tight text-purple-400">{stats.both}</p>
          <p className="text-xs text-[var(--a-muted)] mt-1">Both Roles</p>
        </a>
      </div>

      {/* Search + role filter tabs */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by name, phone, or business..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2.5 bg-[var(--a-input)] text-[var(--a-input-text)] rounded-xl border border-[var(--a-border)] focus:ring-2 focus:ring-red-500/40 outline-none text-sm placeholder-[var(--a-muted)]"
        />
        <div className="flex gap-2 overflow-x-auto">
          {["", "merchant", "customer", "both"].map((r) => (
            <a
              key={r}
              href={r ? `/admin/users?role=${r}` : "/admin/users"}
              className={`px-4 py-2.5 text-sm font-medium rounded-xl transition-colors whitespace-nowrap ${
                (roleFilter || "") === r
                  ? "bg-red-600 text-white"
                  : "bg-[var(--a-input)] text-[var(--a-muted)] hover:text-[var(--a-text)] border border-[var(--a-border)]"
              }`}
            >
              {r ? r.charAt(0).toUpperCase() + r.slice(1) : "All"}
            </a>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--a-muted)]">
          <p className="text-sm font-medium">No users found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--a-border)] shadow-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--a-border)] bg-[var(--a-surface)]">
                <th className="text-left px-5 py-3.5 text-xs font-medium text-[var(--a-muted)] uppercase tracking-wider">Name</th>
                <th className="text-left px-5 py-3.5 text-xs font-medium text-[var(--a-muted)] uppercase tracking-wider">Phone</th>
                <th className="text-left px-5 py-3.5 text-xs font-medium text-[var(--a-muted)] uppercase tracking-wider">Role</th>
                <th className="text-right px-5 py-3.5 text-xs font-medium text-[var(--a-muted)] uppercase tracking-wider">Txns</th>
                <th className="text-right px-5 py-3.5 text-xs font-medium text-[var(--a-muted)] uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3.5 text-xs font-medium text-[var(--a-muted)] uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, idx) => (
                <tr key={`${u.role}_${u.id}`} className={`border-b border-[var(--a-border)]/50 hover:bg-[var(--a-hover)] transition-colors ${idx % 2 === 1 ? "bg-[var(--a-stripe)]" : ""}`}>
                  <td className="px-5 py-3.5">
                    <a
                      href={u.role === "customer" ? "#" : `/admin/users/${u.id}`}
                      className="text-sm font-medium text-[var(--a-text)] hover:text-red-400 transition-colors"
                    >
                      {u.name || "Unnamed"}
                      {u.businessName && <span className="text-xs text-[var(--a-muted)] ml-1">({u.businessName})</span>}
                    </a>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-[var(--a-muted)] font-mono">{u.phone}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_BADGE[u.role] || ""}`}>
                      {u.role === "both" ? "Merchant / Customer" : u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-right text-[var(--a-text-2)]">{u.transactionCount}</td>
                  <td className="px-5 py-3.5 text-right">
                    {u.role === "customer" ? (
                      <span className="text-xs text-[var(--a-muted)]">&mdash;</span>
                    ) : (
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                        u.status === "suspended" ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
                      }`}>
                        {u.status}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {(u.role === "merchant" || u.role === "both") && (
                      <button
                        onClick={() => handleToggle(u)}
                        disabled={toggling === u.id}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 ${
                          u.status === "suspended"
                            ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                            : "bg-red-600 hover:bg-red-500 text-white"
                        }`}
                      >
                        {toggling === u.id ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                        ) : u.status === "suspended" ? "Activate" : "Suspend"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
