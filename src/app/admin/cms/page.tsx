"use client";

import { useEffect, useState } from "react";
import { getAppSetting, setAppSetting } from "@/app/actions/admin";

const SECTIONS = ["faq", "terms", "welcome"] as const;
const LABELS: Record<string, string> = { faq: "Frequently Asked Questions", terms: "Terms & Conditions", welcome: "Welcome Message" };

export default function CMSPage() {
  const [section, setSection] = useState<string>("faq");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    getAppSetting(`cms_${section}`).then((val) => {
      setContent(val?.content ?? "");
    }).catch(() => {});
  }, [section]);

  const save = async () => {
    setSaving(true);
    setFeedback("");
    const result = await setAppSetting(`cms_${section}`, { content, updatedAt: new Date().toISOString() });
    setFeedback(result.success ? "Saved" : result.error || "Failed to save");
    setSaving(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-50 tracking-tight mb-1">Content Management</h1>
      <p className="text-sm text-slate-400 mb-8">Edit FAQs, Terms, and Welcome messages</p>

      <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-6 space-y-5">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {SECTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                section === s ? "bg-red-600 text-white" : "bg-slate-900 text-slate-400 hover:text-slate-200"
              }`}
            >
              {LABELS[s]}
            </button>
          ))}
        </div>

        <div>
          <label className="text-sm font-medium text-slate-300">{LABELS[section]}</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            className="w-full mt-1.5 px-4 py-3 bg-slate-900 text-slate-200 rounded-xl border border-slate-700 focus:ring-2 focus:ring-red-500/40 outline-none text-sm resize-y font-mono placeholder-slate-500"
            placeholder={`Enter ${LABELS[section].toLowerCase()} content...`}
          />
        </div>

        {feedback && <p className={`text-sm font-medium ${feedback === "Saved" ? "text-emerald-400" : "text-red-400"}`}>{feedback}</p>}

        <button
          onClick={save}
          disabled={saving}
          className="w-full py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
          ) : `Save ${LABELS[section]}`}
        </button>
      </div>
    </div>
  );
}
