import { BodyPart, bodyCoords } from "@/lib/sample-data";

const severityColor = { amber: "#D97706", red: "#DC2626" };

// A stylised but anatomically-proportioned front-view silhouette,
// standing in a relaxed athletic pose (arms slightly away from torso).
const BODY_SILHOUETTE = `
M50,4
C45,4 41,8 41,14
C41,19 44,23 48,24
L44,26
C36,27 30,31 27,37
L23,55
C22,62 23,70 26,76
C22,80 19,88 18,98
C17,108 18,118 21,126
C22,129 26,129 27,126
C28,120 27,110 28,100
C29,92 31,84 34,78
L36,74
C35,84 34,96 34,108
C34,124 35,142 37,158
C38,168 38,178 37,188
C36,194 34,198 34,200
L44,200
C45,196 46,190 46,184
C47,172 48,158 48,144
C48,132 48,120 48,110
L52,110
C52,120 52,132 52,144
C52,158 53,172 54,184
C54,190 55,196 56,200
L66,200
C66,198 64,194 63,188
C62,178 62,168 63,158
C65,142 66,124 66,108
C66,96 65,84 64,74
L66,78
C69,84 71,92 72,100
C73,110 72,120 73,126
C74,129 78,129 79,126
C82,118 83,108 82,98
C81,88 78,80 74,76
C77,70 78,62 77,55
L73,37
C70,31 64,27 56,26
L52,24
C56,23 59,19 59,14
C59,8 55,4 50,4
Z`;

export function BodyMap({
  markers,
}: {
  markers: { bodyPart: BodyPart; label: string; severity: "amber" | "red" }[];
}) {
  return (
    <div className="relative mx-auto w-full max-w-[170px] aspect-[100/200] rounded-xl bg-neutral-50 dark:bg-neutral-950/40">
      <svg viewBox="0 0 100 200" className="absolute inset-0 h-full w-full">
        <path
          d={BODY_SILHOUETTE}
          className="fill-neutral-200 dark:fill-neutral-700 stroke-neutral-300 dark:stroke-neutral-600"
          strokeWidth="0.6"
        />
        {/* subtle muscle definition lines for a more anatomical feel */}
        <g className="text-neutral-300 dark:text-neutral-600" stroke="currentColor" strokeWidth="0.5" fill="none" strokeLinecap="round">
          <path d="M42,40 Q50,44 58,40" />
          <path d="M40,52 L40,66 M60,52 L60,66" />
          <path d="M50,52 L50,68" />
          <path d="M40,90 L40,106 M60,90 L60,106" />
          <path d="M38,130 L38,150 M62,130 L62,150" />
        </g>
      </svg>
      {markers.map((m, i) => {
        const c = bodyCoords[m.bodyPart];
        return (
          <div
            key={i}
            title={m.label}
            className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white dark:ring-neutral-900 animate-pulse"
            style={{
              left: `${c.x}%`,
              top: `${(c.y / 200) * 100}%`,
              backgroundColor: severityColor[m.severity],
            }}
          />
        );
      })}
    </div>
  );
}
