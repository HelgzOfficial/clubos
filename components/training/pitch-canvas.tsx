"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Undo2 } from "lucide-react";

type ItemType = "player" | "opponent" | "cone" | "goal" | "mini-goal" | "mannequin" | "zone";

type PitchItem = { id: string; type: ItemType; x: number; y: number; label?: string };
type Arrow = { id: string; x1: number; y1: number; x2: number; y2: number };

const PALETTE: { type: ItemType; label: string }[] = [
  { type: "player", label: "Player" },
  { type: "opponent", label: "Opponent" },
  { type: "cone", label: "Cone" },
  { type: "goal", label: "Goal" },
  { type: "mini-goal", label: "Mini Goal" },
  { type: "mannequin", label: "Mannequin" },
  { type: "zone", label: "Zone" },
];

let counter = 0;
function nextId(prefix: string) {
  counter += 1;
  return `${prefix}-${counter}`;
}

function ItemGlyph({ type }: { type: ItemType }) {
  switch (type) {
    case "player":
      return <div className="h-6 w-6 rounded-full bg-blue-500 ring-2 ring-white shadow" />;
    case "opponent":
      return <div className="h-6 w-6 rounded-full bg-red-500 ring-2 ring-white shadow" />;
    case "cone":
      return <div className="h-0 w-0 border-l-[7px] border-r-[7px] border-b-[14px] border-l-transparent border-r-transparent border-b-orange-500 drop-shadow" />;
    case "goal":
      return <div className="h-5 w-12 rounded-sm border-[3px] border-neutral-700 dark:border-neutral-300 bg-white/40" />;
    case "mini-goal":
      return <div className="h-3.5 w-7 rounded-sm border-2 border-neutral-700 dark:border-neutral-300 bg-white/40" />;
    case "mannequin":
      return <div className="h-7 w-3.5 rounded-t-full rounded-b-sm bg-neutral-500 ring-2 ring-white shadow" />;
    case "zone":
      return <div className="h-10 w-16 rounded-lg border-2 border-club-primary bg-club-primary/20" />;
  }
}

export function PitchCanvas() {
  const pitchRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<PitchItem[]>([]);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [arrowMode, setArrowMode] = useState(false);
  const [arrowStart, setArrowStart] = useState<{ x: number; y: number } | null>(null);

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
      setItems((prev) => prev.map((it) => (it.id === draggingId ? { ...it, x, y } : it)));
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
  }, [draggingId, clientToPercent]);

  function addItem(type: ItemType) {
    const offset = (items.length % 6) * 3;
    setItems((prev) => [...prev, { id: nextId("item"), type, x: 46 + offset, y: 46 + offset }]);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
    setSelectedId(null);
  }

  function removeArrow(id: string) {
    setArrows((prev) => prev.filter((a) => a.id !== id));
  }

  function handlePitchClick(e: React.MouseEvent) {
    if (!arrowMode) {
      setSelectedId(null);
      return;
    }
    const { x, y } = clientToPercent(e.clientX, e.clientY);
    if (!arrowStart) {
      setArrowStart({ x, y });
    } else {
      setArrows((prev) => [...prev, { id: nextId("arrow"), x1: arrowStart.x, y1: arrowStart.y, x2: x, y2: y }]);
      setArrowStart(null);
    }
  }

  function clearAll() {
    setItems([]);
    setArrows([]);
    setArrowStart(null);
    setSelectedId(null);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {PALETTE.map((p) => (
          <button
            key={p.type}
            onClick={() => addItem(p.type)}
            className="flex items-center gap-2 rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-neutral-900 px-3 py-2 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <span className="flex h-6 w-6 items-center justify-center scale-75">
              <ItemGlyph type={p.type} />
            </span>
            {p.label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => { setArrowMode((v) => !v); setArrowStart(null); }}
            className={`rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
              arrowMode ? "bg-club-primary text-white" : "border border-black/5 dark:border-white/10 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            }`}
          >
            {arrowMode ? (arrowStart ? "Click end point…" : "Click start point…") : "Add Arrow"}
          </button>
          <button
            onClick={clearAll}
            className="flex items-center gap-1.5 rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-neutral-900 px-3 py-2 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <Undo2 size={13} /> Clear Pitch
          </button>
        </div>
      </div>

      <div
        ref={pitchRef}
        onClick={handlePitchClick}
        className={`relative w-full aspect-[3/2] rounded-2xl overflow-hidden bg-emerald-600 dark:bg-emerald-800 select-none ${arrowMode ? "cursor-crosshair" : ""}`}
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

        {/* arrows */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full pointer-events-none">
          <defs>
            <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="white" />
            </marker>
          </defs>
          {arrows.map((a) => (
            <line
              key={a.id}
              x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
              stroke="white" strokeWidth="0.8" markerEnd="url(#arrowhead)"
            />
          ))}
          {arrowStart && (
            <circle cx={arrowStart.x} cy={arrowStart.y} r="1" fill="white" />
          )}
        </svg>

        {/* items */}
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

      {arrows.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {arrows.map((a, i) => (
            <button
              key={a.id}
              onClick={() => removeArrow(a.id)}
              className="flex items-center gap-1 rounded-full bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
            >
              Arrow {i + 1} <X size={11} />
            </button>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs text-neutral-400">
        Click a palette item to add it to the pitch, then drag to position. Click an item to select it and remove with the ✕. This session isn't saved yet — it clears on refresh.
      </p>
    </div>
  );
}
