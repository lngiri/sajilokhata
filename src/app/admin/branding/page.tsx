"use client";

import { useEffect, useState } from "react";
import { getAppSetting, setAppSetting } from "@/app/actions/admin";

export default function BrandingPage() {
  const [logo, setLogo] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#DC2626");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    getAppSetting("branding").then((val) => {
      if (val) {
        if (val.logo) setLogo(val.logo);
        if (val.primaryColor) setPrimaryColor(val.primaryColor);
      }
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    setFeedback("");
    const result = await setAppSetting("branding", {
      logo, primaryColor, updatedAt: new Date().toISOString(),
    });
    setFeedback(result.success ? "Branding saved" : result.error || "Failed to save");
    setSaving(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-50 tracking-tight mb-1">Branding Settings</h1>
      <p className="text-sm text-slate-400 mb-8">Customize the app appearance</p>

      <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-6 space-y-6">
        <div>
          <label className="text-sm font-medium text-slate-300">Logo URL</label>
          <input
            type="text"
            value={logo}
            onChange={(e) => setLogo(e.target.value)}
            placeholder="https://example.com/logo.png"
            className="w-full mt-1.5 px-4 py-2.5 bg-slate-900 text-slate-200 rounded-xl border border-slate-700 focus:ring-2 focus:ring-red-500/40 outline-none text-sm placeholder-slate-500"
          />
          {logo && (
            <div className="mt-3 flex items-center gap-3 p-3 bg-slate-900 rounded-xl">
              <img src={logo} alt="Preview" className="w-10 h-10 rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
              <span className="text-xs text-slate-500 truncate">{logo}</span>
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-slate-300">Primary Color</label>
          <div className="flex items-center gap-3 mt-1.5">
            <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-12 h-12 rounded-xl cursor-pointer bg-transparent border border-slate-700" />
            <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="flex-1 px-4 py-2.5 bg-slate-900 text-slate-200 rounded-xl border border-slate-700 focus:ring-2 focus:ring-red-500/40 outline-none text-sm font-mono" />
            <div className="w-12 h-12 rounded-xl border border-slate-700" style={{ backgroundColor: primaryColor }} />
          </div>
        </div>

        {feedback && <p className={`text-sm font-medium ${feedback === "Branding saved" ? "text-emerald-400" : "text-red-400"}`}>{feedback}</p>}

        <button
          onClick={save}
          disabled={saving}
          className="w-full py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
          ) : "Save Branding"}
        </button>
      </div>
    </div>
  );
}
