import { BodyPart, bodyCoords } from "@/lib/sample-data";

const severityColor = { amber: "#D97706", red: "#DC2626" };

export function BodyMap({
  markers,
}: {
  markers: { bodyPart: BodyPart; label: string; severity: "amber" | "red" }[];
}) {
  return (
    <div className="relative mx-auto w-full max-w-[160px] aspect-[100/200]">
      <svg viewBox="0 0 100 200" className="absolute inset-0 h-full w-full">
        <g fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-300 dark:text-neutral-700">
          {/* head */}
          <circle cx="50" cy="14" r="11" />
          {/* torso */}
          <path d="M38 25 Q50 22 62 25 L67 68 Q50 74 33 68 Z" />
          {/* arms */}
          <path d="M38 27 L22 60 L27 64 L42 34" />
          <path d="M62 27 L78 60 L73 64 L58 34" />
          {/* legs */}
          <path d="M42 70 L38 130 L36 190 L42 190 L45 130 L50 74" />
          <path d="M58 70 L62 130 L64 190 L58 190 L55 130 L50 74" />
        </g>
      </svg>
      {markers.map((m, i) => {
        const c = bodyCoords[m.bodyPart];
        return (
          <div
            key={i}
            title={m.label}
            className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white dark:ring-neutral-900 animate-pulse"
            style={{ left: `${c.x}%`, top: `${(c.y / 200) * 100}%`, backgroundColor: severityColor[m.severity] }}
          />
        );
      })}
    </div>
  );
}
