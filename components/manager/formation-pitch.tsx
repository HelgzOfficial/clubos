"use client";

import { useState } from "react";
import type { DragEvent } from "react";
import { ShirtMarker } from "@/components/shirt-marker";
import type { PitchSlot } from "@/lib/lineups-db";

export type PitchOccupant = {
  playerId: string;
  name: string;
  squadNumber: number | null;
  isCaptain: boolean;
};

// Just the surname, so the label under a shirt stays readable at pitch scale.
function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

// The team laid out in the selected formation. Two ways to move players around,
// because the manager may well be doing this on a phone at the ground:
//
//   • Drag and drop — from the squad list onto a slot, or slot to slot to swap.
//   • Tap — tap a player (or a shirt) to pick them up, tap a slot to drop them.
//
// The pitch drawing and the shirts are the same ones used on player profiles,
// so a formation here looks like the position diagrams players already know.
export function FormationPitch({
  layout,
  occupants,
  pendingName,
  onAssign,
  onTapSlot,
  onClear,
}: {
  layout: PitchSlot[];
  // Aligned to layout: occupants[i] is whoever is in layout[i], or null.
  occupants: (PitchOccupant | null)[];
  // Name of the player currently picked up and waiting to be placed, if any.
  pendingName?: string;
  onAssign: (code: string, playerId: string, fromCode?: string) => void;
  // A tap on a slot: place the picked-up player there, or pick up whoever is
  // already standing there. The page decides which, since it holds the
  // pending selection.
  onTapSlot: (code: string) => void;
  onClear: (playerId: string) => void;
}) {
  const [dragOver, setDragOver] = useState("");

  function handleDragStart(e: DragEvent<HTMLDivElement>, playerId: string, fromCode: string) {
    // Safari is unreliable with custom dataTransfer types, so both halves ride
    // along in text/plain.
    e.dataTransfer.setData("text/plain", `${playerId}|${fromCode}`);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDrop(e: DragEvent<HTMLDivElement>, code: string) {
    e.preventDefault();
    setDragOver("");
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;
    const [playerId, fromCode] = raw.split("|");
    if (!playerId) return;
    if (fromCode === code) return;
    onAssign(code, playerId, fromCode || undefined);
  }

  return (
    <div>
      <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-xl bg-emerald-600/90 aspect-[68/100] dark:bg-emerald-800/60">
        <svg viewBox="0 0 68 100" className="absolute inset-0 h-full w-full">
          <rect x="1" y="1" width="66" height="98" fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="0.5" />
          <line x1="1" y1="50" x2="67" y2="50" stroke="white" strokeOpacity="0.5" strokeWidth="0.5" />
          <circle cx="34" cy="50" r="9" fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="0.5" />
          <rect x="14" y="1" width="40" height="16" fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="0.5" />
          <rect x="14" y="83" width="40" height="16" fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="0.5" />
        </svg>

        {layout.map((slot, i) => {
          const who = occupants[i] ?? null;
          const isKeeper = slot.code === "GK";
          const highlighted = dragOver === slot.code;
          return (
            <div
              key={slot.code}
              onDragOver={(e) => { e.preventDefault(); setDragOver(slot.code); }}
              onDragLeave={() => setDragOver((prev) => (prev === slot.code ? "" : prev))}
              onDrop={(e) => handleDrop(e, slot.code)}
              onClick={() => onTapSlot(slot.code)}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center"
              style={{ left: `${slot.x}%`, top: `${100 - slot.y}%` }}
              title={who ? `${who.name} — ${slot.code}` : `Empty — ${slot.code}`}
            >
              {who ? (
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, who.playerId, slot.code)}
                  onClick={(e) => { e.stopPropagation(); onTapSlot(slot.code); }}
                  onDoubleClick={(e) => { e.stopPropagation(); onClear(who.playerId); }}
                  className={`flex flex-col items-center ${highlighted ? "scale-110" : ""} transition-transform`}
                >
                  <ShirtMarker isGoalkeeper={isKeeper} squadNumber={who.squadNumber ?? undefined} size={34} />
                  <span className="mt-0.5 max-w-[70px] truncate rounded bg-navy-950/75 px-1 text-[9px] font-semibold leading-tight text-white">
                    {shortName(who.name)}{who.isCaptain ? " (C)" : ""}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed text-[9px] font-semibold ${
                      highlighted ? "border-white bg-white/25 text-white" : "border-white/60 text-white/80"
                    }`}
                  >
                    {slot.code}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-center text-xs text-neutral-400">
        {pendingName
          ? `${pendingName} picked up — tap a position to place them.`
          : "Drag a player onto a position, or tap a player then tap a position. Drag shirt to shirt to swap. Double-tap a shirt to take them out."}
      </p>
    </div>
  );
}
