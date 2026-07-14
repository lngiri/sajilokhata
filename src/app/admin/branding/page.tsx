"use client";

import { useEffect, useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { getAppSetting, setAppSetting } from "@/app/actions/admin";

export default function BrandingPage() {
  const [logo, setLogo] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#DC2626");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    getAppSetting("branding").then((val) => {
      if (val) {
        if (val.logo) setLogo(val.logo);
        if (val.primaryColor) setPrimaryColor(val.primaryColor);
      }
    }).catch(() => {});
  }, []);

  const onDrop = useCallback(async (accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;

    setUploading(true);
    setFeedback("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        setLogo(data.url);
        setFeedback("Logo uploaded successfully");
      } else {
        setFeedback(data.error || "Upload failed");
      }
    } catch {
      setFeedback("Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp", ".svg"] },
    maxFiles: 1,
    maxSize: 2 * 1024 * 1024,
  });

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
      <h1 className="text-2xl font-bold text-[var(--a-text)] tracking-tight mb-1">Branding Settings</h1>
      <p className="text-sm text-[var(--a-muted)] mb-8">Customize the app appearance</p>

      <div className="bg-[var(--a-surface)] rounded-xl shadow-lg border border-[var(--a-border)] p-6 space-y-6">
        {/* Logo dropzone */}
        <div>
          <label className="text-sm font-medium text-[var(--a-text-2)]">Logo</label>
          <div
            {...getRootProps()}
            className={`mt-1.5 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-red-500 bg-red-500/5"
                : "border-[var(--a-border)] hover:border-[var(--a-border-2)] bg-[var(--a-input)]"
            }`}
          >
            <input {...getInputProps()} />
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-[var(--a-muted)]">Uploading...</p>
              </div>
            ) : logo ? (
              <div className="flex flex-col items-center gap-3">
                <img src={logo} alt="Logo preview" className="h-16 object-contain rounded-lg" />
                <p className="text-xs text-[var(--a-muted)]">Drag &amp; drop or click to replace</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <svg className="w-10 h-10 text-[var(--a-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-sm text-[var(--a-text-2)]">Drop a logo here, or click to browse</p>
                <p className="text-xs text-[var(--a-muted)]">PNG, JPG, WebP or SVG &middot; max 2MB</p>
              </div>
            )}
          </div>
        </div>

        {/* Color picker */}
        <div>
          <label className="text-sm font-medium text-[var(--a-text-2)]">Primary Color</label>
          <div className="flex items-center gap-3 mt-1.5">
            <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-12 h-12 rounded-xl cursor-pointer bg-transparent border border-[var(--a-border)]" />
            <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="flex-1 px-4 py-2.5 bg-[var(--a-input)] text-[var(--a-input-text)] rounded-xl border border-[var(--a-border)] focus:ring-2 focus:ring-red-500/40 outline-none text-sm font-mono" />
            <div className="w-12 h-12 rounded-xl border border-[var(--a-border)]" style={{ backgroundColor: primaryColor }} />
          </div>
        </div>

        {feedback && <p className={`text-sm font-medium ${feedback === "Branding saved" || feedback === "Logo uploaded successfully" || feedback === "Saved" ? "text-emerald-400" : "text-red-400"}`}>{feedback}</p>}

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
