"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Circle, ArrowUpRight, Eraser, Palette, X, Save, Loader2, Check, Download } from "lucide-react";
import { useAnnotationCanvas, ANNOTATION_COLORS, type AnnotationTool } from "@/lib/use-annotation-canvas";
import { saveAnnotatedImage } from "@/lib/annotated-images-db";

// Same drawing tools as the video annotator, but over a static image
// instead of a paused video frame — used for a straight image upload
// (screenshot, opposition formation graphic, etc.) that an analyst wants to
// mark up and attach to a match pack.
export function ImageAnnotator({
  imageUrl, title, onClose, onSaved,
}: { imageUrl: string; title: string; onClose: () => void; onSaved?: () => void }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { canvasRef, tool, setTool, color, setColor, redraw, handlePointerDown, handlePointerMove, handlePointerUp, clearDrawing } =
    useAnnotationCanvas();

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  function resizeCanvas() {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    canvas.width = wrap.clientWidth;
    canvas.height = wrap.clientHeight;
    redraw();
  }

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buildAnnotatedDataUrl(): string | null {
    const img = imgRef.current;
    const overlay = canvasRef.current;
    if (!img || !overlay) return null;
    const out = document.createElement("canvas");
    out.width = img.naturalWidth || overlay.width;
    out.height = img.naturalHeight || overlay.height;
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, out.width, out.height);
    const scaleX = out.width / overlay.width;
    const scaleY = out.height / overlay.height;
    ctx.save();
    ctx.scale(scaleX, scaleY);
    ctx.drawImage(overlay, 0, 0);
    ctx.restore();
    return out.toDataURL("image/png");
  }

  function download() {
    const url = buildAnnotatedDataUrl();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\.[^.]+$/, "")}-annotated.png`;
    a.click();
  }

  async function saveToClubOS() {
    const url = buildAnnotatedDataUrl();
    if (!url) return;
    setSaving(true);
    setSaveError("");
    try {
      await saveAnnotatedImage(`${title.replace(/\.[^.]+$/, "")} — annotated`, url);
      setSaved(true);
      onSaved?.();
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save this to ClubOS.");
    } finally {
      setSaving(false);
    }
  }

  const tools: { key: AnnotationTool; icon: typeof Pencil; label: string }[] = [
    { key: "pen", icon: Pencil, label: "Draw" },
    { key: "arrow", icon: ArrowUpRight, label: "Arrow" },
    { key: "circle", icon: Circle, label: "Circle" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4">
      <div className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-y-auto rounded-card border border-white/10 bg-navy-700 dark:bg-navy-900 p-4 shadow-softDark">
        <div className="mb-3 flex items-center justify-between">
          <p className="truncate font-medium">{title}</p>
          <button onClick={onClose} className="text-neutral-400 hover:text-white shrink-0">
            <X size={18} />
          </button>
        </div>

        <div ref={wrapRef} className="relative w-full shrink-0 overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "16/9" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imageUrl}
            alt={title}
            className="absolute inset-0 h-full w-full object-contain"
            onLoad={resizeCanvas}
            crossOrigin="anonymous"
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full touch-none"
            style={{ cursor: tool === "none" ? "default" : "crosshair" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {tools.map((t) => (
            <button
              key={t.key}
              onClick={() => setTool((prev) => (prev === t.key ? "none" : t.key))}
              title={t.label}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                tool === t.key ? "bg-club-primary text-navy-950" : "bg-navy-600 dark:bg-navy-800 text-neutral-300 hover:text-white"
              }`}
            >
              <t.icon size={15} />
            </button>
          ))}

          <button
            onClick={clearDrawing}
            title="Clear drawings"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-600 dark:bg-navy-800 text-neutral-300 hover:text-white"
          >
            <Eraser size={15} />
          </button>

          <div className="flex items-center gap-1 rounded-lg bg-navy-600 dark:bg-navy-800 px-1.5 py-1">
            <Palette size={13} className="text-neutral-400" />
            {ANNOTATION_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`h-4 w-4 rounded-full ${color === c ? "ring-2 ring-white" : ""}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="mx-1 h-6 w-px bg-white/10" />

          <button
            onClick={download}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-sm font-medium text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors"
          >
            <Download size={14} /> Download PNG
          </button>

          <button
            onClick={saveToClubOS}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-xl bg-club-primary text-navy-950 px-3 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Save size={14} />}
            {saving ? "Saving…" : saved ? "Saved" : "Save to ClubOS"}
          </button>
        </div>

        {saveError && <p className="mt-2 text-xs text-red-300">{saveError}</p>}

        <p className="mt-3 text-xs text-neutral-400">
          Select a tool, then draw on the image to mark up shape, runs, or positioning — then save it into ClubOS to attach to a match pack.
        </p>
      </div>
    </div>
  );
}
