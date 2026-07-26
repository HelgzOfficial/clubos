"use client";

import type { MouseEvent } from "react";
import { ShirtMarker } from "./shirt-marker";

export type PitchPoint = { x: number; y: number };

// Renders one or more position markers on a pitch diagram, each shown as a
// stylised club shirt (yellow for goalkeepers, green for everyone else)
// instead of a plain dot or the player's own photo. In edit mode, clicking
// empty pitch space adds a marker and clicking an existing marker removes
// it — used to let a player carry more than one position.
export function PitchPosition({
  positions, isGoalkeeper, squadNumber, editable, onChange, maxPositions = 5,
}: {
  positions: PitchPoint[];
  isGoalkeeper?: boolean;
  squadNumber?: number;
  editable?: boolean;
  onChange?: (positions: PitchPoint[]) => void;
  maxPositions?: number;
}) {
  function handlePitchClick(e: MouseEvent<HTMLDivElement>) {
    if (!editable || !onChange) return;
    if (positions.length >= maxPositions) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(100 - ((e.clientY - rect.top) / rect.height) * 100);
    onChange([...positions, { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) }]);
  }

  function handleMarkerClick(e: MouseEvent, index: number) {
    if (!editable || !onChange) return;
    e.stopPropagation();
    if (positions.length <= 1) return; // always keep at least one position
    onChange(positions.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div
        onClick={handlePitchClick}
        className={`relative w-full aspect-[68/100] rounded-xl overflow-hidden bg-emerald-600/90 dark:bg-emerald-800/60 ${editable ? "cursor-copy" : ""}`}
      >
        <svg viewBox="0 0 68 100" className="absolute inset-0 h-full w-full">
          <rect x="1" y="1" width="66" height="98" fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="0.5" />
          <line x1="1" y1="50" x2="67" y2="50" stroke="white" strokeOpacity="0.5" strokeWidth="0.5" />
          <circle cx="34" cy="50" r="9" fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="0.5" />
          <rect x="14" y="1" width="40" height="16" fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="0.5" />
          <rect x="14" y="83" width="40" height="16" fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="0.5" />
        </svg>
        {positions.map((p, i) => (
          <div
            key={i}
            onClick={(e) => handleMarkerClick(e, i)}
            className={`absolute -translate-x-1/2 -translate-y-1/2 ${editable && positions.length > 1 ? "cursor-pointer" : ""}`}
            style={{ left: `${p.x}%`, top: `${100 - p.y}%` }}
            title={editable ? "Click to remove this position" : undefined}
          >
            <ShirtMarker isGoalkeeper={!!isGoalkeeper} squadNumber={squadNumber} />
          </div>
        ))}
      </div>
      {editable && (
        <p className="mt-2 text-xs text-neutral-400">
          Click the pitch to add a position (up to {maxPositions}) · click a shirt to remove it — at least one is kept.
        </p>
      )}
    </div>
  );
}
