"use client";

import { useEffect, useState } from "react";
import { X, Download, Loader2, AlertCircle, FileText } from "lucide-react";

const PREVIEWABLE_TYPES = new Set(["pdf", "png", "jpg", "jpeg", "webp", "gif", "mp4", "mov", "webm"]);
const IMAGE_TYPES = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
const VIDEO_TYPES = new Set(["mp4", "mov", "webm"]);

function extOf(fileType: string, fileName: string): string {
  const t = fileType.toLowerCase();
  if (t) return t;
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

// A shared in-app "View" experience — PDFs, images and video preview right
// here (no new tab, no leaving the app); anything else (docx/xlsx/etc, which
// browsers can't render on their own) shows a friendly notice with a
// Download button instead of failing silently.
export function DocumentViewerModal({
  fileName,
  fileType,
  getViewUrl,
  getDownloadUrl,
  onClose,
}: {
  fileName: string;
  fileType: string;
  getViewUrl: () => Promise<string>;
  getDownloadUrl: () => Promise<string>;
  onClose: () => void;
}) {
  const ext = extOf(fileType, fileName);
  const previewable = PREVIEWABLE_TYPES.has(ext);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(previewable);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!previewable) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    getViewUrl()
      .then((u) => { if (!cancelled) setUrl(u); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't open this file."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewable]);

  async function handleDownload() {
    setDownloading(true);
    try {
      const dUrl = await getDownloadUrl();
      window.open(dUrl, "_blank");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't download this file.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70 p-3 sm:p-6" onClick={onClose}>
      <div
        className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-card border border-white/10 bg-navy-700 dark:bg-navy-900 shadow-softDark"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <FileText size={16} className="shrink-0 text-neutral-400" />
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{fileName}</p>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors disabled:opacity-60"
          >
            {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {downloading ? "Preparing…" : "Download"}
          </button>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 bg-navy-800 dark:bg-navy-950">
          {!previewable ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <AlertCircle size={20} className="text-amber-300" />
              <p className="text-sm text-neutral-300">This file type can&apos;t be previewed in the app.</p>
              <p className="text-xs text-neutral-500">Use Download above to save it to this device and open it there.</p>
            </div>
          ) : loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 size={20} className="animate-spin text-neutral-400" />
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <AlertCircle size={20} className="text-red-400" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          ) : url && ext === "pdf" ? (
            <iframe src={url} title={fileName} className="h-full w-full border-0" />
          ) : url && IMAGE_TYPES.has(ext) ? (
            <div className="flex h-full items-center justify-center overflow-auto p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={fileName} className="max-h-full max-w-full rounded-lg object-contain" />
            </div>
          ) : url && VIDEO_TYPES.has(ext) ? (
            <div className="flex h-full items-center justify-center p-4">
              <video src={url} controls className="max-h-full max-w-full rounded-lg" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
