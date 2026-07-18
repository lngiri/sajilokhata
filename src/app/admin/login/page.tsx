"use client";

import { useState } from "react";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!email || !password) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      localStorage.setItem("admin_name", data.name || "Admin");
      window.location.replace("/admin/dashboard");
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-100 dark:bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Panel</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Authorized access only</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-slate-200 dark:border-gray-800 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Admin Email</label>
            <input
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1.5 px-4 py-3 bg-slate-100 dark:bg-gray-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-gray-700 focus:ring-2 focus:ring-emerald-500/40 outline-none text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Password</label>
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="w-full mt-1.5 px-4 py-3 bg-slate-100 dark:bg-gray-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-gray-700 focus:ring-2 focus:ring-emerald-500/40 outline-none text-sm"
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-sm px-4 py-2 rounded-xl border border-red-200 dark:border-red-800/50">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!email || !password || loading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold active:scale-[0.98] transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Sign In"
            )}
          </button>
        </div>

        <p className="text-center text-xs text-slate-400 dark:text-gray-600 mt-6">
          QR Hisab — Self-Service Admin
        </p>
      </div>
    </div>
  );
}
