export function PitchPosition({ x, y }: { x: number; y: number }) {
  return (
    <div className="relative w-full aspect-[68/100] rounded-xl overflow-hidden bg-emerald-600/90 dark:bg-emerald-800/60">
      <svg viewBox="0 0 68 100" className="absolute inset-0 h-full w-full">
        <rect x="1" y="1" width="66" height="98" fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="0.5" />
        <line x1="1" y1="50" x2="67" y2="50" stroke="white" strokeOpacity="0.5" strokeWidth="0.5" />
        <circle cx="34" cy="50" r="9" fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="0.5" />
        <rect x="14" y="1" width="40" height="16" fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="0.5" />
        <rect x="14" y="83" width="40" height="16" fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="0.5" />
      </svg>
      <div
        className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow ring-2 ring-emerald-900/40"
        style={{ left: `${x}%`, top: `${100 - y}%` }}
      />
    </div>
  );
}
