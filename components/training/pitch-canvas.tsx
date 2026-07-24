"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { X, Undo2 } from "lucide-react";
import { ItemType, LineStyle, PitchItem, PitchLine, nextId } from "@/lib/training-storage";

const PALETTE: { type: ItemType; label: string }[] = [
  { type: "player", label: "Player" },
  { type: "opponent", label: "Opponent" },
  { type: "football", label: "Football" },
  { type: "cone", label: "Cone" },
  { type: "goal", label: "Goal" },
  { type: "mini-goal", label: "Mini Goal" },
  { type: "mannequin", label: "Mannequin" },
  { type: "zone", label: "Zone" },
];

function ItemGlyph({ type }: { type: ItemType }) {
  switch (type) {
    case "player":
      return <div className="h-6 w-6 rounded-full bg-blue-500 ring-2 ring-white shadow" />;
    case "opponent":
      return <div className="h-6 w-6 rounded-full bg-red-500 ring-2 ring-white shadow" />;

    case "football":
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6 drop-shadow">
          <circle cx="12" cy="12" r="11" fill="white" stroke="#171717" strokeWidth="1" />
          <polygon points="12,7 15.5,9.5 14.2,13.5 9.8,13.5 8.5,9.5" fill="#171717" />
          <path d="M12,7 L12,3.5 M15.5,9.5 L19,7.5 M14.2,13.5 L16.5,17 M9.8,13.5 L7.5,17 M8.5,9.5 L5,7.5" stroke="#171717" strokeWidth="1" fill="none" />
        </svg>
      );

    case "cone":
      return (
        <svg viewBox="0 0 24 28" className="h-7 w-6 drop-shadow">
          <rect x="4" y="24" width="16" height="3" rx="1" fill="#c2410c" />
          <polygon points="12,3 18,24 6,24" fill="#f97316" />
          <polygon points="9.4,13 14.6,13 15.6,17 8.4,17" fill="white" />
          <polygon points="10.7,7.5 13.3,7.5 13.9,10.5 10.1,10.5" fill="white" />
        </svg>
      );

    case "goal":
    case "mini-goal": {
      const isMini = type === "mini-goal";
      const w = isMini ? 34 : 52;
      const h = isMini ? 18 : 24;
      const cols = 6, rows = 4;
      const netLines = [];
      for (let i = 1; i < cols; i++) {
        const x = (w / cols) * i;
        netLines.push(<line key={`v${i}`} x1={x} y1={3} x2={x} y2={h - 2} stroke="white" strokeOpacity="0.7" strokeWidth="0.5" />);
      }
      for (let i = 1; i < rows; i++) {
        const y = 3 + ((h - 5) / rows) * i;
        netLines.push(<line key={`h${i}`} x1={2} y1={y} x2={w - 2} y2={y} stroke="white" strokeOpacity="0.7" strokeWidth="0.5" />);
      }
      return (
        <svg viewBox={`0 0 ${w} ${h}`} className={isMini ? "h-4 w-7 drop-shadow" : "h-6 w-11 drop-shadow"}>
          <rect x="1.5" y="2" width={w - 3} height={h - 3} fill="#1e293b" fillOpacity="0.15" />
          {netLines}
          <path d={`M2,${h - 1} L2,2 L${w - 2},2 L${w - 2},${h - 1}`} fill="none" stroke="#262626" strokeWidth="2.5" />
        </svg>
      );
    }

    case "mannequin":
      return (
        <svg viewBox="0 0 20 36" className="h-8 w-4 drop-shadow">
          <ellipse cx="10" cy="33" rx="8" ry="2.5" fill="#171717" fillOpacity="0.7" />
          <rect x="5" y="10" width="10" height="21" rx="4" fill="#3f3f46" />
          <circle cx="10" cy="7" r="5.5" fill="#52525b" />
          <rect x="7" y="14" width="6" height="3" rx="1" fill="white" fillOpacity="0.5" />
        </svg>
      );

    case "zone":
      return <div className="h-10 w-16 rounded-lg border-2 border-club-primary bg-club-primary/20" />;
  }
}

const glyphSize: Record<ItemType, string> = {
  player: "h-6 w-6", opponent: "h-6 w-6", football: "h-6 w-6",
  cone: "h-7 w-6", goal: "h-6 w-11", "mini-goal": "h-4 w-7",
  mannequin: "h-8 w-4", zone: "h-10 w-16",
};

export function PitchCanvas({
  items,
  lines,
  onChange,
}: {
  items: PitchItem[];
  lines: PitchLine[];
  onChange: (next: { items: PitchItem[]; lines: PitchLine[] }) => void;
}) {
  const pitchRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lineMode, setLineMode] = useState<LineStyle | null>(null);
  const [lineStart, setLineStart] = useState<{ x: number; y: number } | null>(null);

  const clientToPercent = useCallback((clientX: number, clientY: number) => {
    const rect = pitchRef.current?.getBoundingClientRect();
    if (!rect) return { x: 50, y: 50 };
    const x = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
    return { x, y };
  }, []);

  useEffect(() => {
    if (!draggingId) return;
    function onMove(e: PointerEvent) {
      const { x, y } = clientToPercent(e.clientX, e.clientY);
      onChange({ items: items.map((it) => (it.id === draggingId ? { ...it, x, y } : it)), lines });
    }
    function onUp() {
      setDraggingId(null);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingId, clientToPercent]);

  function addItem(type: ItemType) {
    const offset = (items.length % 6) * 3;
    onChange({ items: [...items, { id: nextId("item"), type, x: 46 + offset, y: 46 + offset }], lines });
  }

  function removeItem(id: string) {
    onChange({ items: items.filter((it) => it.id !== id), lines });
    setSelectedId(null);
  }

  function removeLine(id: string) {
    onChange({ items, lines: lines.filter((l) => l.id !== id) });
  }

  function handlePitchClick(e: MouseEvent) {
    if (!lineMode) {
      setSelectedId(null);
      return;
    }
    const { x, y } = clientToPercent(e.clientX, e.clientY);
    if (!lineStart) {
      setLineStart({ x, y });
    } else {
      onChange({ items, lines: [...lines, { id: nextId("line"), x1: lineStart.x, y1: lineStart.y, x2: x, y2: y, style: lineMode }] });
      setLineStart(null);
    }
  }

  function clearAll() {
    onChange({ items: [], lines: [] });
    setLineStart(null);
    setSelectedId(null);
  }

  function toggleLineMode(style: LineStyle) {
    setLineMode((m) => (m === style ? null : style));
    setLineStart(null);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {PALETTE.map((p) => (
          <button
            key={p.type}
            onClick={() => addItem(p.type)}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-navy-700 dark:bg-navy-900 px-3 py-2 text-xs font-medium hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors"
          >
            <span className={`flex items-center justify-center ${glyphSize[p.type]}`}>
              <ItemGlyph type={p.type} />
            </span>
            {p.label}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => toggleLineMode("solid")}
          className={`rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
            lineMode === "solid" ? "bg-club-primary text-white" : "border border-white/10 bg-navy-700 dark:bg-navy-900 hover:bg-navy-600 dark:hover:bg-navy-800"
          }`}
        >
          {lineMode === "solid" ? (lineStart ? "Click end point…" : "Click start point…") : "Add Pass (solid)"}
        </button>
        <button
          onClick={() => toggleLineMode("dashed")}
          className={`rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
            lineMode === "dashed" ? "bg-club-primary text-white" : "border border-white/10 bg-navy-700 dark:bg-navy-900 hover:bg-navy-600 dark:hover:bg-navy-800"
          }`}
        >
          {lineMode === "dashed" ? (lineStart ? "Click end point…" : "Click start point…") : "Add Run (dotted)"}
        </button>
        <button
          onClick={clearAll}
          className="ml-auto flex items-center gap-1.5 rounded-xl border border-white/10 bg-navy-700 dark:bg-navy-900 px-3 py-2 text-xs font-medium hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors"
        >
          <Undo2 size={13} /> Clear Pitch
        </button>
      </div>

      <div
        ref={pitchRef}
        onClick={handlePitchClick}
        className={`relative w-full aspect-[3/2] rounded-2xl overflow-hidden bg-emerald-600 dark:bg-emerald-800 select-none ${lineMode ? "cursor-crosshair" : ""}`}
      >
        <svg viewBox="0 0 150 100" className="absolute inset-0 h-full w-full pointer-events-none">
          <g fill="none" stroke="white" strokeOpacity="0.6" strokeWidth="0.5">
            <rect x="2" y="2" width="146" height="96" />
            <line x1="75" y1="2" x2="75" y2="98" />
            <circle cx="75" cy="50" r="10" />
            <circle cx="75" cy="50" r="0.6" fill="white" stroke="none" />
            <rect x="2" y="26" width="16" height="48" />
            <rect x="2" y="38" width="6" height="24" />
            <rect x="132" y="26" width="16" height="48" />
            <rect x="142" y="38" width="6" height="24" />
          </g>
        </svg>

        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full pointer-events-none">
          <defs>
            <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="white" />
            </marker>
          </defs>
          {lines.map((l) => (
            <line
              key={l.id}
              x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke="white" strokeWidth="0.8" markerEnd="url(#arrowhead)"
              strokeDasharray={l.style === "dashed" ? "2,2" : undefined}
            />
          ))}
          {lineStart && <circle cx={lineStart.x} cy={lineStart.y} r="1" fill="white" />}
        </svg>

        {items.map((it) => (
          <div
            key={it.id}
            onPointerDown={(e) => { e.stopPropagation(); setDraggingId(it.id); setSelectedId(it.id); }}
            onClick={(e) => e.stopPropagation()}
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing touch-none"
            style={{ left: `${it.x}%`, top: `${it.y}%` }}
          >
            <ItemGlyph type={it.type} />
            {selectedId === it.id && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); removeItem(it.id); }}
                className="absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-neutral-900 text-white"
              >
                <X size={10} />
              </button>
            )}
          </div>
        ))}
      </div>

      {lines.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {lines.map((l, i) => (
            <button
              key={l.id}
              onClick={() => removeLine(l.id)}
              className="flex items-center gap-1 rounded-full bg-navy-600 dark:bg-navy-800 px-2.5 py-1 text-xs text-neutral-500 hover:text-white"
            >
              {l.style === "dashed" ? "Run" : "Pass"} {i + 1} <X size={11} />
            </button>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs text-neutral-400">
        Click a palette item to add it, then drag to position. Click an item to select and remove it with ✕.
      </p>
    </div>
  );
}
