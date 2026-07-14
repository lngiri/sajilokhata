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
      <h1 className="text-xl font-bold text-white mb-1">Content Management</h1>
      <p className="text-sm text-gray-400 mb-6">Edit FAQs, Terms, and Welcome messages</p>

      <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {SECTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors whitespace-nowrap ${
                section === s ? "bg-emerald-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              {LABELS[s]}
            </button>
          ))}
        </div>

        <div>
          <label className="text-sm font-medium text-gray-300">{LABELS[section]}</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            className="w-full mt-1.5 px-4 py-3 bg-gray-800 text-white rounded-xl border border-gray-700 focus:ring-2 focus:ring-emerald-500/40 outline-none text-sm resize-y font-mono"
            placeholder={`Enter ${LABELS[section].toLowerCase()} content...`}
          />
        </div>

        {feedback && <p className={`text-sm ${feedback === "Saved" ? "text-emerald-400" : "text-red-400"}`}>{feedback}</p>}

        <button
          onClick={save}
          disabled={saving}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
          ) : `Save ${LABELS[section]}`}
        </button>
      </div>
    </div>
  );
}
