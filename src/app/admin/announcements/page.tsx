"use client";

import { useEffect, useState } from "react";
import { getAppSetting, setAppSetting } from "@/app/actions/admin";

export default function AnnouncementsPage() {
  const [message, setMessage] = useState("");
  const [active, setActive] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    getAppSetting("announcement").then((val) => {
      if (val?.text) {
        setActive(val.text);
        setMessage(val.text);
      }
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    setFeedback("");
    const result = await setAppSetting("announcement", {
      text: message, active: true, updatedAt: new Date().toISOString(),
    });
    if (result.success) {
      setActive(message);
      setFeedback("Announcement published");
    } else {
      setFeedback(result.error || "Failed to save");
    }
    setSaving(false);
  };

  const dismiss = async () => {
    setSaving(true);
    await setAppSetting("announcement", { text: "", active: false });
    setMessage("");
    setActive("");
    setSaving(false);
    setFeedback("Announcement removed");
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-white mb-1">Global Announcement</h1>
      <p className="text-sm text-gray-400 mb-6">Push a banner message to all app users</p>

      <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-300">Announcement Text</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g., Scheduled maintenance tonight at 2 AM..."
            rows={3}
            className="w-full mt-1.5 px-4 py-3 bg-gray-800 text-white rounded-xl border border-gray-700 focus:ring-2 focus:ring-emerald-500/40 outline-none text-sm resize-none"
          />
        </div>

        {active && (
          <div className="bg-emerald-500/10 border border-emerald-800/30 rounded-xl p-3">
            <p className="text-xs text-emerald-400 mb-1">Currently active:</p>
            <p className="text-sm text-gray-300">{active}</p>
          </div>
        )}

        {feedback && <p className={`text-sm ${feedback.includes("published") || feedback.includes("removed") ? "text-emerald-400" : "text-red-400"}`}>{feedback}</p>}

        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={!message || saving}
            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
            ) : "Publish Announcement"}
          </button>
          {active && (
            <button onClick={dismiss} disabled={saving} className="px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-sm transition-colors">
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
