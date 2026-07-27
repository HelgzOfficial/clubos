"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  Play, Pause, Pencil, Circle, ArrowUpRight, Eraser, Camera, X, Palette, Save, Loader2, Check,
} from "lucide-react";
import type { Clip } from "@/lib/analysis-types";
import { saveAnnotatedImage } from "@/lib/annotated-images-db";

type Tool = "none" | "pen" | "circle" | "arrow";
type Point = { x: number; y: number };
type Shape = { tool: Tool; color: string; points: Point[] };

const COLORS = ["#D4AF37", "#EF4444", "#22C55E", "#3B82F6", "#FFFFFF"];

export function VideoPlayer({
  clip, onClose, sourceClipId, onSaved,
}: { clip: Clip; onClose: () => void; sourceClipId?: string; onSaved?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [tool, setTool] = useState<Tool>("none");
  const [color, setColor] = useState(COLORS[0]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const drawing = useRef<Shape | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  function redraw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const all = drawing.current ? [...shapes, drawing.current] : shapes;
    for (const s of all) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (s.tool === "pen") {
        ctx.beginPath();
        s.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.stroke();
      } else if (s.tool === "circle" && s.points.length >= 2) {
        const [a, b] = s.points;
        const r = Math.hypot(b.x - a.x, b.y - a.y);
        ctx.beginPath();
        ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.tool === "arrow" && s.points.length >= 2) {
        const [a, b] = s.points;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        const headLen = 12;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - headLen * Math.cos(angle - Math.PI / 6), b.y - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - headLen * Math.cos(angle + Math.PI / 6), b.y - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }
    }
  }

  useEffect(redraw, [shapes]);

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

  function pointFromEvent(e: PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: PointerEvent<HTMLCanvasElement>) {
    if (tool === "none") return;
    const p = pointFromEvent(e);
    drawing.current = { tool, color, points: [p] };
    redraw();
  }

  function handlePointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const p = pointFromEvent(e);
    if (tool === "pen") {
      drawing.current.points.push(p);
    } else {
      drawing.current.points[1] = p;
    }
    redraw();
  }

  function handlePointerUp() {
    if (!drawing.current) return;
    setShapes((prev) => [...prev, drawing.current as Shape]);
    drawing.current = null;
  }

  function clearDrawing() {
    setShapes([]);
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  function buildFreezeFrameDataUrl(): string | null {
    const video = videoRef.current;
    const overlay = canvasRef.current;
    if (!video || !overlay) return null;
    const out = document.createElement("canvas");
    out.width = video.videoWidth || overlay.width;
    out.height = video.videoHeight || overlay.height;
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, out.width, out.height);
    // scale the overlay drawing (sized to displayed element) up to the video's native resolution
    const scaleX = out.width / overlay.width;
    const scaleY = out.height / overlay.height;
    ctx.save();
    ctx.scale(scaleX, scaleY);
    ctx.drawImage(overlay, 0, 0);
    ctx.restore();
    return out.toDataURL("image/png");
  }

  function captureFreezeFrame() {
    const url = buildFreezeFrameDataUrl();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${clip.title.replace(/\.[^.]+$/, "")}-freeze-frame.png`;
    a.click();
  }

  async function saveFreezeFrameToClubOS() {
    const url = buildFreezeFrameDataUrl();
    if (!url) return;
    setSaving(true);
    setSaveError("");
    try {
      await saveAnnotatedImage(`${clip.title.replace(/\.[^.]+$/, "")} — freeze frame`, url, sourceClipId);
      setSaved(true);
      onSaved?.();
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save this to ClubOS.");
    } finally {
      setSaving(false);
    }
  }

  const tools: { key: Tool; icon: typeof Pencil; label: string }[] = [
    { key: "pen", icon: Pencil, label: "Draw" },
    { key: "arrow", icon: ArrowUpRight, label: "Arrow" },
    { key: "circle", icon: Circle, label: "Circle" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-3xl rounded-card border border-white/10 bg-navy-700 dark:bg-navy-900 p-4 shadow-softDark">
        <div className="mb-3 flex items-center justify-between">
          <p className="truncate font-medium">{clip.title}</p>
          <button onClick={onClose} className="text-neutral-400 hover:text-white shrink-0">
            <X size={18} />
          </button>
        </div>

        <div ref={wrapRef} className="relative w-full overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "16/9" }}>
          <video
            ref={videoRef}
            src={clip.url}
            className="absolute inset-0 h-full w-full"
            onLoadedMetadata={resizeCanvas}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            playsInline
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
          <button
            onClick={togglePlay}
            className="flex items-center gap-1.5 rounded-xl bg-club-primary text-navy-950 px-3 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
            {playing ? "Pause" : "Play"}
          </button>

          <div className="mx-1 h-6 w-px bg-white/10" />

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
            {COLORS.map((c) => (
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
            onClick={captureFreezeFrame}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-sm font-medium text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors"
          >
            <Camera size={14} /> Download PNG
          </button>

          <button
            onClick={saveFreezeFrameToClubOS}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-xl bg-club-primary text-navy-950 px-3 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Save size={14} />}
            {saving ? "Saving…" : saved ? "Saved" : "Save to ClubOS"}
          </button>
        </div>

        {saveError && <p className="mt-2 text-xs text-red-300">{saveError}</p>}

        <p className="mt-3 text-xs text-neutral-400">
          Select a tool, then draw on the video to mark up runs, passing lanes, or positioning. "Download PNG" saves the current
          frame with your markup to your device; "Save to ClubOS" attaches it to the Analysis module's image library instead, ready to
          use in a match pack.
        </p>
      </div>
    </div>
  );
}
