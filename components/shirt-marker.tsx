// A stylised football shirt icon used as a pitch position marker — a shaded,
// slightly-3D looking jersey rather than a plain dot or a player photo.
// Goalkeepers get the yellow keeper shirt (as worn by Rocco), everyone else
// gets the club's traditional green.

export function ShirtMarker({
  isGoalkeeper, squadNumber, size = 30,
}: {
  isGoalkeeper: boolean;
  squadNumber?: number;
  size?: number;
}) {
  const base = isGoalkeeper ? "#facc15" : "#15803d";
  const shade = isGoalkeeper ? "#ca8a04" : "#14532d";
  const highlight = isGoalkeeper ? "#fef08a" : "#4ade80";
  const gradientId = `shirt-grad-${isGoalkeeper ? "gk" : "out"}`;

  return (
    <svg
      viewBox="0 0 64 60"
      width={size}
      height={(size * 60) / 64}
      className="drop-shadow-md"
      aria-label={isGoalkeeper ? "Goalkeeper shirt" : "Player shirt"}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={highlight} stopOpacity="0.9" />
          <stop offset="45%" stopColor={base} />
          <stop offset="100%" stopColor={shade} />
        </linearGradient>
      </defs>
      {/* Sleeves */}
      <path d="M6 14 L18 6 L24 12 L16 22 Z" fill={`url(#${gradientId})`} stroke={shade} strokeWidth="1" />
      <path d="M58 14 L46 6 L40 12 L48 22 Z" fill={`url(#${gradientId})`} stroke={shade} strokeWidth="1" />
      {/* Body */}
      <path
        d="M18 6 C22 10 42 10 46 6 L52 16 L46 24 L46 54 C46 57 18 57 18 54 L18 24 L12 16 Z"
        fill={`url(#${gradientId})`}
        stroke={shade}
        strokeWidth="1.2"
      />
      {/* Collar */}
      <path d="M26 6 C29 9 35 9 38 6 L36 4 C33 6 31 6 28 4 Z" fill="white" fillOpacity="0.85" />
      {squadNumber !== undefined && (
        <text
          x="32"
          y="38"
          textAnchor="middle"
          fontSize="14"
          fontWeight="700"
          fill="white"
          fillOpacity="0.95"
          style={{ fontFamily: "sans-serif" }}
        >
          {squadNumber}
        </text>
      )}
    </svg>
  );
}
