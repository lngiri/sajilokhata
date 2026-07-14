"use client";

import { useEffect, useState } from "react";

export default function AnnouncementsPage() {
  const [message, setMessage] = useState("");
  const [active, setActive] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings?key=announcement", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data?.value?.text) {
          setActive(data.value.text);
          setMessage(data.value.text);
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
          key: "announcement",
          value: { text: message, active: true, updatedAt: new Date().toISOString() },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActive(message);
        setFeedback("Announcement published");
      } else {
        setFeedback("Failed to save");
      }
    } catch {
      setFeedback("Network error");
    }
    setSaving(false);
  };

  const dismiss = async () => {
    setMessage("");
    setActive("");
    setSaving(true);
    await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "announcement", value: { text: "", active: false } }),
    });
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

        {feedback && (
          <p className="text-sm text-emerald-400">{feedback}</p>
        )}

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
            <button
              onClick={dismiss}
              disabled={saving}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-sm transition-colors"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
