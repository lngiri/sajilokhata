"use client";

import { useEffect, useState } from "react";

export default function BrandingPage() {
  const [logo, setLogo] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#059669");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings?key=branding", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data?.value) {
          if (data.value.logo) setLogo(data.value.logo);
          if (data.value.primaryColor) setPrimaryColor(data.value.primaryColor);
        }
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    setFeedback("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "branding",
          value: { logo, primaryColor, updatedAt: new Date().toISOString() },
        }),
      });
      const data = await res.json();
      setFeedback(data.success ? "Branding saved" : "Failed to save");
    } catch {
      setFeedback("Network error");
    }
    setSaving(false);
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-white mb-1">Branding Settings</h1>
      <p className="text-sm text-gray-400 mb-6">Customize the app appearance</p>

      <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5 space-y-5">
        <div>
          <label className="text-sm font-medium text-gray-300">Logo URL</label>
          <input
            type="text"
            value={logo}
            onChange={(e) => setLogo(e.target.value)}
            placeholder="https://example.com/logo.png"
            className="w-full mt-1.5 px-4 py-2.5 bg-gray-800 text-white rounded-xl border border-gray-700 focus:ring-2 focus:ring-emerald-500/40 outline-none text-sm"
          />
          {logo && (
            <div className="mt-3 flex items-center gap-3 p-3 bg-gray-800 rounded-xl">
              <img src={logo} alt="Preview" className="w-10 h-10 rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
              <span className="text-xs text-gray-400 truncate">{logo}</span>
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-gray-300">Primary Color</label>
          <div className="flex items-center gap-3 mt-1.5">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-12 h-12 rounded-xl cursor-pointer bg-transparent border border-gray-700"
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-gray-800 text-white rounded-xl border border-gray-700 focus:ring-2 focus:ring-emerald-500/40 outline-none text-sm font-mono"
            />
            <div className="w-12 h-12 rounded-xl border border-gray-700" style={{ backgroundColor: primaryColor }} />
          </div>
        </div>

        {feedback && (
          <p className={`text-sm ${feedback.includes("saved") ? "text-emerald-400" : "text-red-400"}`}>{feedback}</p>
        )}

        <button
          onClick={save}
          disabled={saving}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
          ) : "Save Branding"}
        </button>
      </div>
    </div>
  );
}
