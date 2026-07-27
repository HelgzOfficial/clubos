"use client";

// A simple top-down football pitch, used two ways:
//  - interactive: click anywhere on it to pick an x/y location (0-100 each,
//    top-left origin) — used by the "click where this happened" goal form.
//  - display: renders a set of already-recorded points as dots — used by
//    the Goals Scored/Conceded and Assist maps.
// Both modes share the same markings so a point picked in one lines up
// exactly with where it's drawn in the other.

export type PitchPoint = { x: number; y: number; color?: string; label?: string };

function PitchMarkings() {
  return (
    <g stroke="white" strokeWidth={0.4} fill="none" opacity={0.85}>
      <rect x={1} y={1} width={98} height={98} />
      <line x1={1} y1={50} x2={99} y2={50} />
      <circle cx={50} cy={50} r={9} />
      <circle cx={50} cy={50} r={0.6} fill="white" />
      {/* Top penalty area + six-yard box + arc */}
      <rect x={22} y={1} width={56} height={16} />
      <rect x={38} y={1} width={24} height={6} />
      <circle cx={50} cy={12} r={0.6} fill="white" />
      <path d="M 38 17 A 9 9 0 0 0 62 17" />
      {/* Bottom penalty area + six-yard box + arc */}
      <rect x={22} y={83} width={56} height={16} />
      <rect x={38} y={93} width={24} height={6} />
      <circle cx={50} cy={88} r={0.6} fill="white" />
      <path d="M 38 83 A 9 9 0 0 1 62 83" />
    </g>
  );
}

export function PitchMapInput({ value, onChange }: { value: PitchPoint | null; onChange: (p: PitchPoint | null) => void }) {
  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    onChange({ x, y });
  }

  return (
    <div>
      <svg
        viewBox="0 0 100 100"
        onClick={handleClick}
        className="w-full max-w-xs cursor-crosshair rounded-lg bg-emerald-800"
        style={{ aspectRatio: "68/100" }}
      >
        <PitchMarkings />
        {value && <circle cx={value.x} cy={value.y} r={2.2} fill="#D4AF37" stroke="white" strokeWidth={0.4} />}
      </svg>
      <div className="mt-1.5 flex items-center gap-2">
        <p className="text-xs text-neutral-400">{value ? "Tap the pitch again to move it." : "Tap the pitch to mark where this happened (optional)."}</p>
        {value && (
          <button type="button" onClick={() => onChange(null)} className="text-xs text-neutral-400 hover:text-red-300 underline shrink-0">
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

export function PitchMapDisplay({ points, className }: { points: PitchPoint[]; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={`w-full rounded-lg bg-emerald-800 ${className ?? ""}`} style={{ aspectRatio: "68/100" }}>
      <PitchMarkings />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={1.8} fill={p.color ?? "#D4AF37"} stroke="white" strokeWidth={0.3} opacity={0.85}>
          {p.label && <title>{p.label}</title>}
        </circle>
      ))}
    </svg>
  );
}
