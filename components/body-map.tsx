"use client";

import { useState } from "react";
import Image from "next/image";
import { BodyPart, bodyCoords } from "@/lib/sample-data";

// Amber / orange / red as severity climbs.
const severityColor = { mild: "#D97706", moderate: "#EA580C", severe: "#DC2626" };

export function BodyMap({
  markers,
}: {
  markers: { bodyPart: BodyPart; label: string; severity: "mild" | "moderate" | "severe" }[];
}) {
  const [view, setView] = useState<"front" | "back">("front");

  return (
    <div>
      <div className="mb-2 flex justify-center gap-1 rounded-full bg-navy-600 dark:bg-navy-800 p-1 text-xs font-medium w-fit mx-auto">
        {(["front", "back"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-full px-3 py-1 capitalize transition-colors ${
              view === v ? "bg-club-primary text-navy-950 shadow-sm" : "text-neutral-400"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="relative mx-auto w-full max-w-[170px] aspect-[103/266]">
        <Image
          src={view === "front" ? "/body-front.png" : "/body-back.png"}
          alt={`Body diagram — ${view} view`}
          fill
          className="object-contain drop-shadow-sm dark:invert-[0.15] dark:brightness-125"
          priority
        />
        {markers.map((m, i) => {
          const c = bodyCoords[m.bodyPart];
          // From behind, anatomical left/right appear mirrored to the viewer.
          const left = view === "front" ? c.x : 100 - c.x;
          return (
            <div
              key={i}
              title={m.label}
              className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white dark:ring-neutral-900 animate-pulse"
              style={{
                left: `${left}%`,
                top: `${c.y}%`,
                backgroundColor: severityColor[m.severity],
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
