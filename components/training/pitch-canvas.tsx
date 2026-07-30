"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Undo2, Redo2, Trash2, Download, MousePointer2, Type, Eraser, Brush, Move, Copy, FileText } from "lucide-react";
import { buildImagePdf, jpegDataUrlToBytes } from "@/lib/simple-pdf";
import {
  ItemType, LineStyle, PitchItem, PitchLine, PitchView, nextId,
} from "@/lib/training-storage";

// ---------------------------------------------------------------------------
// Pitch views
//
// Each view has its own coordinate space matching its aspect ratio, so nothing
// is stretched — a centre circle stays a circle. Items are stored as
// percentages of the box (unchanged from the original format, which is what
// keeps previously-saved drills working), and converted into view units on
// render. Because unit sizes are constant across views, zooming into a
// penalty box genuinely makes the players look bigger, which is what you want.
// ---------------------------------------------------------------------------
type ViewSpec = { label: string; w: number; h: number; markings: JSX.Element };

const LINE = { fill: "none", stroke: "#ffffff", strokeOpacity: 0.65, strokeWidth: 0.5 } as const;

const VIEWS: Record<PitchView, ViewSpec> = {
  full: {
    label: "Full pitch", w: 150, h: 100,
    markings: (
      <g {...LINE}>
        <rect x="2" y="2" width="146" height="96" />
        <line x1="75" y1="2" x2="75" y2="98" />
        <circle cx="75" cy="50" r="10" />
        <circle cx="75" cy="50" r="0.7" fill="#ffffff" stroke="none" />
        <rect x="2" y="26" width="16" height="48" />
        <rect x="2" y="38" width="6" height="24" />
        <rect x="132" y="26" width="16" height="48" />
        <rect x="142" y="38" width="6" height="24" />
        <path d="M18,42 A10,10 0 0 1 18,58" />
        <path d="M132,42 A10,10 0 0 0 132,58" />
      </g>
    ),
  },
  half: {
    label: "Attacking half", w: 100, h: 80,
    markings: (
      <g {...LINE}>
        <rect x="2" y="2" width="96" height="76" />
        <rect x="26" y="2" width="48" height="16" />
        <rect x="38" y="2" width="24" height="6" />
        <path d="M42,18 A10,10 0 0 0 58,18" />
        <circle cx="50" cy="12" r="0.7" fill="#ffffff" stroke="none" />
        <path d="M40,78 A10,10 0 0 1 60,78" />
      </g>
    ),
  },
  third: {
    label: "Attacking third", w: 100, h: 62,
    markings: (
      <g {...LINE}>
        <rect x="2" y="2" width="96" height="58" />
        <rect x="26" y="2" width="48" height="18" />
        <rect x="38" y="2" width="24" height="7" />
        <path d="M42,20 A11,11 0 0 0 58,20" />
        <circle cx="50" cy="13" r="0.7" fill="#ffffff" stroke="none" />
      </g>
    ),
  },
  box: {
    label: "Goal end", w: 90, h: 55,
    markings: (
      <g {...LINE}>
        <rect x="2" y="2" width="86" height="51" />
        <rect x="15" y="6" width="60" height="28" />
        <rect x="33" y="6" width="24" height="10" />
        <path d="M37,34 A13,13 0 0 0 53,34" />
        <circle cx="45" cy="24" r="0.9" fill="#ffffff" stroke="none" />
        <g stroke="#ffffff" strokeOpacity="0.9" strokeWidth="0.8">
          <path d="M37,6 L37,2 L53,2 L53,6" fill="none" />
        </g>
      </g>
    ),
  },
  split2: {
    label: "Two halves", w: 120, h: 80,
    markings: (
      <g {...LINE}>
        <rect x="2" y="2" width="116" height="76" />
        <line x1="60" y1="2" x2="60" y2="78" />
      </g>
    ),
  },
  split3: {
    label: "Three zones", w: 120, h: 80,
    markings: (
      <g {...LINE}>
        <rect x="2" y="2" width="116" height="76" />
        <line x1="40.7" y1="2" x2="40.7" y2="78" />
        <line x1="79.3" y1="2" x2="79.3" y2="78" />
      </g>
    ),
  },
  square: {
    label: "Square grid", w: 80, h: 80,
    markings: (
      <g {...LINE}>
        <rect x="4" y="4" width="72" height="72" />
      </g>
    ),
  },
  blank: {
    label: "Blank", w: 120, h: 80,
    markings: (
      <g {...LINE}>
        <rect x="2" y="2" width="116" height="76" />
      </g>
    ),
  },
  // Legacy alias from the previous build.
  grid: {
    label: "Blank grid", w: 120, h: 80,
    markings: (
      <g {...LINE}>
        <rect x="2" y="2" width="116" height="76" />
      </g>
    ),
  },
};

const VIEW_ORDER: PitchView[] = ["blank", "split2", "split3", "full", "half", "third", "box", "square"];

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------
const COLORS = ["#3b82f6", "#ef4444", "#facc15", "#22c55e", "#ffffff", "#f97316"];

const DEFAULT_COLOR: Partial<Record<ItemType, string>> = {
  player: "#3b82f6", opponent: "#ef4444", neutral: "#facc15", keeper: "#22c55e",
};

const PALETTE: { type: ItemType; label: string }[] = [
  { type: "player", label: "Player" },
  { type: "opponent", label: "Opponent" },
  { type: "neutral", label: "Neutral" },
  { type: "keeper", label: "Keeper" },
  { type: "football", label: "Ball" },
  { type: "cone", label: "Cone" },
  { type: "flat-marker", label: "Marker" },
  { type: "mannequin", label: "Mannequin" },
  { type: "goal", label: "Goal" },
  { type: "mini-goal", label: "Mini goal" },
  { type: "ladder", label: "Ladder" },
  { type: "hurdle", label: "Hurdle" },
  { type: "zone", label: "Zone" },
  { type: "hatch", label: "Hatched area" },
  // Shape markers, matching how coaches separate groups without more colours.
  { type: "triangle", label: "Triangle" },
  { type: "square", label: "Square" },
  { type: "octagon", label: "Octagon" },
  { type: "dot", label: "Dot" },
  { type: "number", label: "Number only" },
];

const LINE_TOOLS: { style: LineStyle; label: string }[] = [
  { style: "solid", label: "Pass" },
  { style: "dashed", label: "Run" },
  { style: "wavy", label: "Dribble" },
  { style: "block", label: "Barrier" },
];

type Tool =
  | { kind: "select" }
  | { kind: "item"; type: ItemType }
  | { kind: "line"; style: LineStyle }
  | { kind: "brush" }
  | { kind: "move" }
  | { kind: "text" }
  | { kind: "erase" };

// Freehand strokes are stored as sampled points rather than endpoints.
function freePath(points: { x: number; y: number }[], vx: (n: number) => number, vy: (n: number) => number): string {
  if (points.length === 0) return "";
  return `M${points.map((p) => `${vx(p.x)},${vy(p.y)}`).join(" L")}`;
}

// A wiggly path along a quadratic curve, for dribbles.
function wavyPath(x1: number, y1: number, x2: number, y2: number, cx: number, cy: number): string {
  const steps = 28;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const amp = Math.min(1.6, len / 14);
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    // Point on the quadratic bezier…
    const px = mt * mt * x1 + 2 * mt * t * cx + t * t * x2;
    const py = mt * mt * y1 + 2 * mt * t * cy + t * t * y2;
    // …offset perpendicular to the local tangent, tapering to nothing at the tip
    // so the arrowhead still points cleanly along the line.
    const tx = 2 * mt * (cx - x1) + 2 * t * (x2 - cx);
    const ty = 2 * mt * (cy - y1) + 2 * t * (y2 - cy);
    const tl = Math.hypot(tx, ty) || 1;
    const offset = Math.sin(t * Math.PI * 6) * amp * (1 - t);
    pts.push(`${px + (-ty / tl) * offset},${py + (tx / tl) * offset}`);
  }
  return `M${pts.join(" L")}`;
}

function controlOf(l: PitchLine): { cx: number; cy: number } {
  return { cx: l.cx ?? (l.x1 + l.x2) / 2, cy: l.cy ?? (l.y1 + l.y2) / 2 };
}

export function PitchCanvas({
  items,
  lines,
  onChange,
  readOnly = false,
  view = "full",
  onViewChange,
  title = "drill",
  description,
}: {
  items: PitchItem[];
  lines: PitchLine[];
  onChange: (next: { items: PitchItem[]; lines: PitchLine[] }) => void;
  readOnly?: boolean;
  view?: PitchView;
  onViewChange?: (view: PitchView) => void;
  // Used for the exported file name, and printed on the PDF.
  title?: string;
  description?: string;
}) {
  const spec = VIEWS[view] ?? VIEWS.full;
  const svgRef = useRef<SVGSVGElement>(null);
  const [tool, setTool] = useState<Tool>({ kind: "select" });
  const [color, setColor] = useState(COLORS[0]);
  const [selected, setSelected] = useState<{ kind: "item" | "line"; id: string } | null>(null);
  const [drag, setDrag] = useState<
    | { kind: "item"; id: string }
    | { kind: "curve"; id: string }
    | { kind: "draw"; style: LineStyle; x1: number; y1: number; x2: number; y2: number }
    | { kind: "brush"; points: { x: number; y: number }[] }
    | { kind: "moveAll"; lastX: number; lastY: number }
    | null
  >(null);

  // Undo/redo. The canvas is a controlled component, so history lives here as
  // snapshots of what the parent was last told.
  const past = useRef<{ items: PitchItem[]; lines: PitchLine[] }[]>([]);
  const future = useRef<{ items: PitchItem[]; lines: PitchLine[] }[]>([]);
  const [historyTick, setHistoryTick] = useState(0);

  const commit = useCallback(
    (next: { items: PitchItem[]; lines: PitchLine[] }, recordHistory = true) => {
      if (recordHistory) {
        past.current = [...past.current.slice(-49), { items, lines }];
        future.current = [];
        setHistoryTick((t) => t + 1);
      }
      onChange(next);
    },
    [items, lines, onChange]
  );

  function undo() {
    const prev = past.current.pop();
    if (!prev) return;
    future.current = [...future.current, { items, lines }];
    setHistoryTick((t) => t + 1);
    setSelected(null);
    onChange(prev);
  }

  function redo() {
    const next = future.current.pop();
    if (!next) return;
    past.current = [...past.current, { items, lines }];
    setHistoryTick((t) => t + 1);
    setSelected(null);
    onChange(next);
  }

  const toPercent = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 50, y: 50 };
    return {
      x: Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100)),
    };
  }, []);

  const vx = useCallback((x: number) => (x / 100) * spec.w, [spec.w]);
  const vy = useCallback((y: number) => (y / 100) * spec.h, [spec.h]);

  // Pointer handling lives on the window while dragging so the gesture keeps
  // working if your finger leaves the pitch.
  useEffect(() => {
    if (!drag || readOnly) return;
    function onMove(e: PointerEvent) {
      const { x, y } = toPercent(e.clientX, e.clientY);
      if (!drag) return;
      if (drag.kind === "item") {
        onChange({ items: items.map((it) => (it.id === drag.id ? { ...it, x, y } : it)), lines });
      } else if (drag.kind === "curve") {
        onChange({ items, lines: lines.map((l) => (l.id === drag.id ? { ...l, cx: x, cy: y } : l)) });
      } else if (drag.kind === "brush") {
        const last = drag.points[drag.points.length - 1];
        // Sample rather than record every event, so a stroke stays a
        // reasonable size in the database.
        if (!last || Math.hypot(x - last.x, y - last.y) > 0.7) {
          setDrag({ kind: "brush", points: [...drag.points, { x, y }] });
        }
      } else if (drag.kind === "moveAll") {
        const dx = x - drag.lastX;
        const dy = y - drag.lastY;
        onChange({
          items: items.map((it) => ({ ...it, x: it.x + dx, y: it.y + dy })),
          lines: lines.map((l) => ({
            ...l,
            x1: l.x1 + dx, y1: l.y1 + dy, x2: l.x2 + dx, y2: l.y2 + dy,
            cx: l.cx === undefined ? undefined : l.cx + dx,
            cy: l.cy === undefined ? undefined : l.cy + dy,
            points: l.points?.map((p) => ({ x: p.x + dx, y: p.y + dy })),
          })),
        });
        setDrag({ kind: "moveAll", lastX: x, lastY: y });
      } else {
        setDrag({ ...drag, x2: x, y2: y });
      }
    }
    function onUp(e: PointerEvent) {
      if (drag?.kind === "brush") {
        if (drag.points.length > 2) {
          const first = drag.points[0];
          const last = drag.points[drag.points.length - 1];
          commit({
            items,
            lines: [...lines, {
              id: nextId("line"), style: "free", color,
              x1: first.x, y1: first.y, x2: last.x, y2: last.y,
              points: drag.points,
            }],
          });
        }
      } else if (drag?.kind === "draw") {
        const { x, y } = toPercent(e.clientX, e.clientY);
        // Ignore an accidental tap — a line needs some actual length.
        if (Math.hypot(x - drag.x1, y - drag.y1) > 2) {
          commit({
            items,
            lines: [...lines, { id: nextId("line"), x1: drag.x1, y1: drag.y1, x2: x, y2: y, style: drag.style, color }],
          });
        }
      }
      setDrag(null);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, items, lines, toPercent, color]);

  function handleBackgroundDown(e: React.PointerEvent) {
    if (readOnly) return;
    const { x, y } = toPercent(e.clientX, e.clientY);
    if (tool.kind === "brush") {
      setDrag({ kind: "brush", points: [{ x, y }] });
      return;
    }
    if (tool.kind === "move") {
      past.current = [...past.current.slice(-49), { items, lines }];
      future.current = [];
      setDrag({ kind: "moveAll", lastX: x, lastY: y });
      return;
    }
    if (tool.kind === "line") {
      setDrag({ kind: "draw", style: tool.style, x1: x, y1: y, x2: x, y2: y });
      return;
    }
    if (tool.kind === "item") {
      commit({
        items: [...items, {
          id: nextId("item"), type: tool.type, x, y,
          color: DEFAULT_COLOR[tool.type] ?? color,
        }],
        lines,
      });
      return;
    }
    if (tool.kind === "text") {
      const label = window.prompt("Label text");
      if (label?.trim()) {
        commit({ items: [...items, { id: nextId("item"), type: "text", x, y, label: label.trim(), color }], lines });
      }
      return;
    }
    setSelected(null);
  }

  function handleItemDown(e: React.PointerEvent, item: PitchItem) {
    if (readOnly) return;
    e.stopPropagation();
    if (tool.kind === "erase") {
      commit({ items: items.filter((it) => it.id !== item.id), lines });
      return;
    }
    if (tool.kind === "line") {
      // Starting a line on top of a player should snap to that player, which
      // is how you draw a pass between two people without fiddling.
      setDrag({ kind: "draw", style: tool.style, x1: item.x, y1: item.y, x2: item.x, y2: item.y });
      return;
    }
    past.current = [...past.current.slice(-49), { items, lines }];
    future.current = [];
    setSelected({ kind: "item", id: item.id });
    setDrag({ kind: "item", id: item.id });
  }

  function handleLineDown(e: React.PointerEvent, line: PitchLine) {
    if (readOnly) return;
    e.stopPropagation();
    if (tool.kind === "erase") {
      commit({ items, lines: lines.filter((l) => l.id !== line.id) });
      return;
    }
    setSelected({ kind: "line", id: line.id });
  }

  function patchSelectedItem(patch: Partial<PitchItem>) {
    if (!selected || selected.kind !== "item") return;
    commit({ items: items.map((it) => (it.id === selected.id ? { ...it, ...patch } : it)), lines });
  }

  // Offset slightly so the copy is visible rather than sitting exactly on top.
  function duplicateSelected() {
    if (!selected) return;
    if (selected.kind === "item") {
      const src = items.find((it) => it.id === selected.id);
      if (!src) return;
      const copy = { ...src, id: nextId("item"), x: Math.min(98, src.x + 4), y: Math.min(98, src.y + 4) };
      commit({ items: [...items, copy], lines });
      setSelected({ kind: "item", id: copy.id });
      return;
    }
    const src = lines.find((l) => l.id === selected.id);
    if (!src) return;
    const copy: PitchLine = {
      ...src, id: nextId("line"),
      x1: src.x1 + 4, y1: src.y1 + 4, x2: src.x2 + 4, y2: src.y2 + 4,
      cx: src.cx === undefined ? undefined : src.cx + 4,
      cy: src.cy === undefined ? undefined : src.cy + 4,
      points: src.points?.map((pt) => ({ x: pt.x + 4, y: pt.y + 4 })),
    };
    commit({ items, lines: [...lines, copy] });
    setSelected({ kind: "line", id: copy.id });
  }

  function deleteSelected() {
    if (!selected) return;
    if (selected.kind === "item") commit({ items: items.filter((it) => it.id !== selected.id), lines });
    else commit({ items, lines: lines.filter((l) => l.id !== selected.id) });
    setSelected(null);
  }

  function clearAll() {
    if (readOnly) return;
    commit({ items: [], lines: [] });
    setSelected(null);
  }

  // Rasterise once, reuse for both PNG and PDF. The diagram is a single
  // self-contained SVG with every colour set as an attribute, so it serialises
  // with no stylesheet needed.
  async function rasterise(): Promise<HTMLCanvasElement | null> {
    const svg = svgRef.current;
    if (!svg) return null;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.querySelectorAll("[data-editor-only]").forEach((n) => n.remove());
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const source = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Couldn't render the diagram."));
        img.src = url;
      });
      const scale = 1400 / spec.w;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(spec.w * scale);
      canvas.height = Math.round(spec.h * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      // JPEG has no alpha, so the pitch is painted in first for the PDF path.
      ctx.fillStyle = "#047857";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function safeName() {
    return title.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "drill";
  }

  async function exportPng() {
    const canvas = await rasterise();
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${safeName()}.png`;
    a.click();
  }

  async function exportPdf() {
    const canvas = await rasterise();
    if (!canvas) return;
    const blob = buildImagePdf({
      jpeg: jpegDataUrlToBytes(canvas.toDataURL("image/jpeg", 0.92)),
      imageWidth: canvas.width,
      imageHeight: canvas.height,
      title,
      description,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName()}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  const selectedItem = useMemo(
    () => (selected?.kind === "item" ? items.find((it) => it.id === selected.id) ?? null : null),
    [selected, items]
  );

  const canUndo = past.current.length > 0;
  const canRedo = future.current.length > 0;
  void historyTick; // re-render trigger for the two flags above

  const btn = "rounded-lg border border-white/10 bg-navy-700 px-2.5 py-1.5 text-[11px] font-medium transition-colors hover:bg-navy-600 dark:bg-navy-900 dark:hover:bg-navy-800";
  const btnOn = "rounded-lg px-2.5 py-1.5 text-[11px] font-medium bg-club-primary text-navy-950";

  return (
    <div>
      {!readOnly && (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {VIEW_ORDER.map((v) => (
              <button
                key={v}
                onClick={() => onViewChange?.(v)}
                disabled={!onViewChange}
                className={`${view === v ? btnOn : btn} touch-manipulation disabled:opacity-40`}
              >
                {VIEWS[v].label}
              </button>
            ))}
          </div>

          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <button onClick={() => setTool({ kind: "select" })} className={`${tool.kind === "select" ? btnOn : btn} touch-manipulation flex items-center gap-1`}>
              <MousePointer2 size={11} /> Select
            </button>
            {LINE_TOOLS.map((l) => (
              <button
                key={l.style}
                onClick={() => setTool({ kind: "line", style: l.style })}
                className={`${tool.kind === "line" && tool.style === l.style ? btnOn : btn} touch-manipulation`}
              >
                {l.label}
              </button>
            ))}
            <button onClick={() => setTool({ kind: "brush" })} className={`${tool.kind === "brush" ? btnOn : btn} touch-manipulation flex items-center gap-1`}>
              <Brush size={11} /> Brush
            </button>
            <button onClick={() => setTool({ kind: "move" })} className={`${tool.kind === "move" ? btnOn : btn} touch-manipulation flex items-center gap-1`}>
              <Move size={11} /> Move all
            </button>
            <button onClick={() => setTool({ kind: "text" })} className={`${tool.kind === "text" ? btnOn : btn} touch-manipulation flex items-center gap-1`}>
              <Type size={11} /> Text
            </button>
            <button onClick={() => setTool({ kind: "erase" })} className={`${tool.kind === "erase" ? btnOn : btn} touch-manipulation flex items-center gap-1`}>
              <Eraser size={11} /> Erase
            </button>

            <span className="mx-1 flex items-center gap-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => { setColor(c); if (selectedItem) patchSelectedItem({ color: c }); }}
                  aria-label={`Colour ${c}`}
                  className={`h-5 w-5 rounded-full ring-2 transition-transform ${color === c ? "ring-white scale-110" : "ring-white/20"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </span>

            <span className="ml-auto flex items-center gap-1.5">
              <button onClick={undo} disabled={!canUndo} className={`${btn} touch-manipulation flex items-center gap-1 disabled:opacity-40`}>
                <Undo2 size={11} /> Undo
              </button>
              <button onClick={redo} disabled={!canRedo} className={`${btn} touch-manipulation flex items-center gap-1 disabled:opacity-40`}>
                <Redo2 size={11} /> Redo
              </button>
              <button onClick={exportPng} className={`${btn} touch-manipulation flex items-center gap-1`}>
                <Download size={11} /> PNG
              </button>
              <button onClick={exportPdf} className={`${btn} touch-manipulation flex items-center gap-1`}>
                <FileText size={11} /> PDF
              </button>
              <button onClick={clearAll} className={`${btn} touch-manipulation flex items-center gap-1 text-red-300`}>
                <Trash2 size={11} /> Clear
              </button>
            </span>
          </div>

          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {PALETTE.map((p) => (
              <button
                key={p.type}
                onClick={() => setTool({ kind: "item", type: p.type })}
                className={`${tool.kind === "item" && tool.type === p.type ? btnOn : btn} touch-manipulation`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${spec.w} ${spec.h}`}
        onPointerDown={handleBackgroundDown}
        className={`w-full touch-none select-none rounded-2xl bg-emerald-600 dark:bg-emerald-800 ${
          readOnly ? "cursor-default" : tool.kind === "select" ? "cursor-default" : "cursor-crosshair"
        }`}
      >
        <defs>
          {COLORS.map((c) => (
            <marker key={c} id={`arrow-${c.slice(1)}`} markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
              <path d="M0,0 L5,2.5 L0,5 Z" fill={c} />
            </marker>
          ))}
        </defs>

        {spec.markings}

        {lines.map((l) => {
          const c = l.color ?? "#ffffff";
          const { cx, cy } = controlOf(l);
          const p = { x1: vx(l.x1), y1: vy(l.y1), x2: vx(l.x2), y2: vy(l.y2), cx: vx(cx), cy: vy(cy) };
          const arrow = l.style === "block" || l.style === "free"
            ? undefined
            : `url(#arrow-${(COLORS.includes(c) ? c : "#ffffff").slice(1)})`;
          const d = l.style === "free"
            ? freePath(l.points ?? [], vx, vy)
            : l.style === "wavy"
              ? wavyPath(p.x1, p.y1, p.x2, p.y2, p.cx, p.cy)
              : `M${p.x1},${p.y1} Q${p.cx},${p.cy} ${p.x2},${p.y2}`;
          return (
            <g key={l.id}>
              <path
                d={d}
                fill="none"
                stroke={c}
                strokeWidth={l.style === "block" ? 1.1 : 0.8}
                strokeLinecap="round"
                strokeDasharray={l.style === "dashed" ? "2,1.6" : undefined}
                markerEnd={arrow}
              />
              {/* A fat invisible copy so the line is tappable on a phone. */}
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth="3.5"
                data-editor-only
                onPointerDown={(e) => handleLineDown(e, l)}
                style={{ cursor: readOnly ? "default" : "pointer" }}
              />
              {selected?.kind === "line" && selected.id === l.id && !readOnly && l.style !== "free" && (
                <circle
                  cx={p.cx} cy={p.cy} r="1.6"
                  fill="#0f172a" stroke="#ffffff" strokeWidth="0.4"
                  data-editor-only
                  onPointerDown={(e) => { e.stopPropagation(); setSelected({ kind: "line", id: l.id }); setDrag({ kind: "curve", id: l.id }); }}
                  style={{ cursor: "grab" }}
                />
              )}
            </g>
          );
        })}

        {drag?.kind === "brush" && (
          <path d={freePath(drag.points, vx, vy)} fill="none" stroke={color} strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" data-editor-only />
        )}

        {drag?.kind === "draw" && (
          <path
            d={`M${vx(drag.x1)},${vy(drag.y1)} L${vx(drag.x2)},${vy(drag.y2)}`}
            fill="none" stroke={color} strokeWidth="0.8" strokeOpacity="0.7"
            strokeDasharray="1.5,1.5" data-editor-only
          />
        )}

        {items.map((it) => (
          <g
            key={it.id}
            transform={`translate(${vx(it.x)},${vy(it.y)}) scale(${it.size ?? 1}) rotate(${it.rotation ?? 0})`}
            onPointerDown={(e) => handleItemDown(e, it)}
            style={{ cursor: readOnly ? "default" : "grab" }}
          >
            <ItemShape item={it} />
            {selected?.kind === "item" && selected.id === it.id && !readOnly && (
              <circle r="4.6" fill="none" stroke="#ffffff" strokeWidth="0.4" strokeDasharray="1,1" data-editor-only />
            )}
          </g>
        ))}
      </svg>

      {!readOnly && selected && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {selectedItem && (
            <>
              <button
                onClick={() => {
                  const label = window.prompt("Shirt number or label", selectedItem.label ?? "");
                  if (label !== null) patchSelectedItem({ label: label.trim() || undefined });
                }}
                className={`${btn} touch-manipulation`}
              >
                Label
              </button>
              <button onClick={() => patchSelectedItem({ size: Math.min(2, (selectedItem.size ?? 1) + 0.25) })} className={`${btn} touch-manipulation`}>Bigger</button>
              <button onClick={() => patchSelectedItem({ size: Math.max(0.5, (selectedItem.size ?? 1) - 0.25) })} className={`${btn} touch-manipulation`}>Smaller</button>
              <button onClick={() => patchSelectedItem({ rotation: ((selectedItem.rotation ?? 0) + 45) % 360 })} className={`${btn} touch-manipulation`}>Rotate</button>
            </>
          )}
          <button onClick={duplicateSelected} className={`${btn} touch-manipulation flex items-center gap-1`}>
            <Copy size={11} /> Duplicate
          </button>
          <button onClick={deleteSelected} className={`${btn} touch-manipulation text-red-300`}>Delete</button>
          <button onClick={() => setSelected(null)} className={`${btn} touch-manipulation`}>Done</button>
        </div>
      )}

      <p className="mt-2 text-xs text-neutral-400">
        {readOnly
          ? "View only — you don't have edit access to Training."
          : "Pick an object then tap the pitch to place it. Drag between players with Pass/Run/Dribble, then tap a line and drag its handle to curve it."}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Glyphs. All SVG, centred on 0,0, drawn in pitch units — which is what makes
// a single-element PNG export possible.
// ---------------------------------------------------------------------------
function ItemShape({ item }: { item: PitchItem }) {
  const c = item.color ?? DEFAULT_COLOR[item.type] ?? "#ffffff";

  switch (item.type) {
    case "player":
    case "opponent":
    case "neutral":
    case "keeper":
      return (
        <>
          <circle r="3" fill={c} stroke="#ffffff" strokeWidth="0.5" />
          {item.label && (
            <text
              y="1.05" textAnchor="middle" fontSize="3" fontWeight="700"
              fill={c === "#ffffff" || c === "#facc15" ? "#0f172a" : "#ffffff"}
              fontFamily="system-ui, sans-serif"
            >
              {item.label}
            </text>
          )}
        </>
      );

    case "football":
      return (
        <>
          <circle r="1.8" fill="#ffffff" stroke="#171717" strokeWidth="0.3" />
          <polygon points="0,-1 0.95,-0.3 0.6,0.8 -0.6,0.8 -0.95,-0.3" fill="#171717" />
        </>
      );

    case "cone":
      return (
        <>
          <polygon points="0,-3.2 2.2,2.4 -2.2,2.4" fill={item.color ?? "#f97316"} stroke="#7c2d12" strokeWidth="0.25" />
          <rect x="-2.8" y="2.4" width="5.6" height="0.9" rx="0.4" fill="#c2410c" />
        </>
      );

    case "flat-marker":
      return <circle r="1.7" fill={item.color ?? "#f97316"} stroke="#ffffff" strokeWidth="0.3" fillOpacity="0.95" />;

    case "mannequin":
      return (
        <>
          <ellipse cy="3.4" rx="2.4" ry="0.7" fill="#0f172a" fillOpacity="0.5" />
          <rect x="-1.4" y="-1.2" width="2.8" height="4.6" rx="1.2" fill="#3f3f46" />
          <circle cy="-2.4" r="1.5" fill="#52525b" />
        </>
      );

    case "goal":
    case "mini-goal": {
      const w = item.type === "goal" ? 12 : 7;
      const h = item.type === "goal" ? 4 : 2.6;
      const rungs = [];
      for (let i = 1; i < 6; i++) {
        const x = -w / 2 + (w / 6) * i;
        rungs.push(<line key={`v${i}`} x1={x} y1={-h / 2} x2={x} y2={h / 2} stroke="#ffffff" strokeOpacity="0.55" strokeWidth="0.2" />);
      }
      return (
        <>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="#0f172a" fillOpacity="0.2" />
          {rungs}
          <path d={`M${-w / 2},${h / 2} L${-w / 2},${-h / 2} L${w / 2},${-h / 2} L${w / 2},${h / 2}`} fill="none" stroke="#e5e5e5" strokeWidth="0.7" />
        </>
      );
    }

    case "ladder": {
      const rungs = [];
      for (let i = 0; i <= 5; i++) {
        const x = -5 + i * 2;
        rungs.push(<line key={i} x1={x} y1={-1.6} x2={x} y2={1.6} stroke="#fbbf24" strokeWidth="0.35" />);
      }
      return (
        <>
          <line x1="-5" y1="-1.6" x2="5" y2="-1.6" stroke="#fbbf24" strokeWidth="0.4" />
          <line x1="-5" y1="1.6" x2="5" y2="1.6" stroke="#fbbf24" strokeWidth="0.4" />
          {rungs}
        </>
      );
    }

    case "hurdle":
      return (
        <>
          <path d="M-2,2 L-2,-1.6 L2,-1.6 L2,2" fill="none" stroke={item.color ?? "#facc15"} strokeWidth="0.6" />
          <line x1="-2.6" y1="2" x2="2.6" y2="2" stroke={item.color ?? "#facc15"} strokeWidth="0.6" />
        </>
      );

    case "triangle":
    case "square":
    case "octagon":
    case "dot": {
      const dark = c === "#ffffff" || c === "#facc15";
      const label = item.label ? (
        <text
          y="1.05" textAnchor="middle" fontSize="3" fontWeight="700"
          fill={dark ? "#0f172a" : "#ffffff"} fontFamily="system-ui, sans-serif"
        >
          {item.label}
        </text>
      ) : null;
      if (item.type === "dot") return <circle r="2.2" fill={c} />;
      if (item.type === "triangle") {
        return (
          <>
            <polygon points="0,-3.4 3,2.2 -3,2.2" fill={c} stroke="#ffffff" strokeWidth="0.4" />
            <g transform="translate(0,0.9)">{label}</g>
          </>
        );
      }
      if (item.type === "square") {
        return (
          <>
            <rect x="-2.7" y="-2.7" width="5.4" height="5.4" fill={c} stroke="#ffffff" strokeWidth="0.4" />
            {label}
          </>
        );
      }
      // Octagon
      const r = 3;
      const pts = Array.from({ length: 8 }, (_, i) => {
        const a = (Math.PI / 4) * i + Math.PI / 8;
        return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
      }).join(" ");
      return (
        <>
          <polygon points={pts} fill={c} stroke="#ffffff" strokeWidth="0.4" />
          {label}
        </>
      );
    }

    case "number":
      return (
        <text textAnchor="middle" y="1.2" fontSize="4" fontWeight="800" fill={c} fontFamily="system-ui, sans-serif">
          {item.label ?? "1"}
        </text>
      );

    case "hatch":
      return (
        <>
          <defs>
            <pattern id={`hatch-${item.id}`} patternUnits="userSpaceOnUse" width="1.6" height="1.6" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="1.6" stroke={c} strokeWidth="0.5" strokeOpacity="0.85" />
            </pattern>
          </defs>
          <rect x="-9" y="-6" width="18" height="12" fill={`url(#hatch-${item.id})`} stroke={c} strokeWidth="0.5" />
        </>
      );

    case "zone":
      return (
        <rect
          x="-9" y="-6" width="18" height="12" rx="1"
          fill={c} fillOpacity="0.16" stroke={c} strokeWidth="0.5" strokeDasharray="1.5,1"
        />
      );

    case "text":
      return (
        <text textAnchor="middle" y="1" fontSize="3.4" fontWeight="600" fill={c} fontFamily="system-ui, sans-serif">
          {item.label ?? ""}
        </text>
      );

    default:
      return null;
  }
}
