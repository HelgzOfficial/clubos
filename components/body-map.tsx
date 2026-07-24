"use client";

import { useState } from "react";
import { BodyPart, bodyCoords } from "@/lib/sample-data";

const severityColor = { amber: "#D97706", red: "#DC2626" };

// A clean, solid-silhouette standing figure (head/torso/arms + separate
// leg and foot shapes), styled to match a typical medical body-map chart.
const UPPER_BODY = `
  M50,2 C44.5,2 40,6.5 40,12 C40,16.5 42.7,20.3 46.5,21.8 L46.5,25
  C38,26 32.5,29 30,33 C28.5,35.5 27.5,39 27,43 L24.5,58
  C23.8,62 23.8,66 24.5,69 C22,73 20,78.5 19,85
  C17.7,93.5 17.7,102 19,110 C19.6,113.5 20.5,117 21.6,120
  C22.4,122 25.6,122 26.4,120 C27,118 27.2,115 27,112
  C26.3,105 26.5,97.5 27.6,90 C28.5,83.5 30.2,77.5 32.5,72.5
  C32.2,76 32,79 32,82 L68,82
  C68,79 67.8,76 67.5,72.5 C69.8,77.5 71.5,83.5 72.4,90
  C73.5,97.5 73.7,105 73,112 C72.8,115 73,118 73.6,120
  C74.4,122 77.6,122 78.4,120 C79.5,117 80.4,113.5 81,110
  C82.3,102 82.3,93.5 81,85 C80,78.5 78,73 75.5,69
  C76.2,66 76.2,62 75.5,58 L73,43
  C72.5,39 71.5,35.5 70,33 C67.5,29 62,26 53.5,25 L53.5,21.8
  C57.3,20.3 60,16.5 60,12 C60,6.5 55.5,2 50,2 Z`;

const LEFT_LEG = `
  M32,82 C31,92 31,104 32.5,116 C33.5,124 35.5,130 37,136
  C36,146 35,158 35.8,170 C36.2,177 37,183 38,188 L46,188
  C46.3,183 45.9,177 45.5,170 C44.8,158 44.3,146 45,136
  C46.8,126 48.3,114 49.3,102 C49.7,95 50,88 50,82 Z`;

const RIGHT_LEG = `
  M68,82 C69,92 69,104 67.5,116 C66.5,124 64.5,130 63,136
  C64,146 65,158 64.2,170 C63.8,177 63,183 62,188 L54,188
  C53.7,183 54.1,177 54.5,170 C55.2,158 55.7,146 55,136
  C53.2,126 51.7,114 50.7,102 C50.3,95 50,88 50,82 Z`;

const LEFT_FOOT = `
  M34,188 C31.5,189.5 29.5,191.8 30,194 C30.5,196 34,197 39,197
  C43,197 46.3,196 46.6,194 C46.8,192.3 45.8,190.3 44,188.5 Z`;

const RIGHT_FOOT = `
  M66,188 C68.5,189.5 70.5,191.8 70,194 C69.5,196 66,197 61,197
  C57,197 53.7,196 53.4,194 C53.2,192.3 54.2,190.3 56,188.5 Z`;

const FRONT_LINES = [
  "M40,29 Q50,33.5 60,29",
  "M50,35 L50,68",
  "M35,82 Q50,86.5 65,82",
  "M35,124 Q39,126.5 43,124",
  "M57,124 Q61,126.5 65,124",
];

const BACK_LINES = [
  "M50,26 L50,32",
  "M39,33 Q50,39 61,33",
  "M50,36 L50,72",
  "M38,88 Q50,93.5 62,88",
  "M35,100 Q39,103 43,100",
  "M57,100 Q61,103 65,100",
];

function Figure({ lines }: { lines: string[] }) {
  return (
    <svg viewBox="0 0 100 200" className="absolute inset-0 h-full w-full">
      <g className="fill-neutral-500 dark:fill-neutral-400">
        <path d={UPPER_BODY} />
        <path d={LEFT_LEG} />
        <path d={RIGHT_LEG} />
        <path d={LEFT_FOOT} />
        <path d={RIGHT_FOOT} />
      </g>
      <g stroke="white" strokeOpacity="0.55" strokeWidth="0.5" fill="none" strokeLinecap="round">
        {lines.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}

export function BodyMap({
  markers,
}: {
  markers: { bodyPart: BodyPart; label: string; severity: "amber" | "red" }[];
}) {
  const [view, setView] = useState<"front" | "back">("front");
  const lines = view === "front" ? FRONT_LINES : BACK_LINES;

  return (
    <div>
      <div className="mb-2 flex justify-center gap-1 rounded-full bg-neutral-100 dark:bg-neutral-800 p-1 text-xs font-medium w-fit mx-auto">
        {(["front", "back"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-full px-3 py-1 capitalize transition-colors ${
              view === v ? "bg-white dark:bg-neutral-700 shadow-sm" : "text-neutral-500"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="relative mx-auto w-full max-w-[170px] aspect-[100/200] rounded-xl bg-neutral-50 dark:bg-neutral-950/40">
        <Figure lines={lines} />
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
                top: `${(c.y / 200) * 100}%`,
                backgroundColor: severityColor[m.severity],
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
