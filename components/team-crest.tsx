"use client";

import { useEffect, useState } from "react";
import {
  fetchTeamCrests, buildCrestLookup, crestFor, crestInitials, crestColor,
  type CrestLookup, type CrestKind,
} from "@/lib/team-crests-db";

// Crests are fetched once and shared, rather than each fixture row triggering
// its own query. A module-level promise means the second and subsequent callers
// on a page reuse the first one's request.
let crestPromise: Promise<CrestLookup> | null = null;

function loadCrests(): Promise<CrestLookup> {
  if (!crestPromise) {
    crestPromise = fetchTeamCrests()
      .then(buildCrestLookup)
      .catch(() => new Map() as CrestLookup);
  }
  return crestPromise;
}

// Call after uploading or removing a crest so the next render re-fetches.
export function invalidateCrestCache() {
  crestPromise = null;
}

export function useCrestLookup(): CrestLookup | null {
  const [lookup, setLookup] = useState<CrestLookup | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadCrests().then((l) => { if (!cancelled) setLookup(l); });
    return () => { cancelled = true; };
  }, []);
  return lookup;
}

const SIZES = { xxs: "h-4 w-4 text-[7px]", xs: "h-5 w-5 text-[8px]", sm: "h-7 w-7 text-[10px]", md: "h-9 w-9 text-xs", lg: "h-12 w-12 text-sm" };

// A team or competition badge. Uses the uploaded crest when there is one, and
// otherwise draws initials on a colour derived from the name — so a fixture
// list looks intentional even before any crests have been added.
export function TeamCrest({
  name, kind = "team", size = "sm", lookup, className = "",
}: {
  name: string;
  kind?: CrestKind;
  size?: keyof typeof SIZES;
  lookup?: CrestLookup | null;
  className?: string;
}) {
  // Accepts a lookup from the parent (one fetch for a whole list) or fetches
  // its own if used standalone.
  const own = useCrestLookup();
  const effective = lookup !== undefined ? lookup : own;
  const url = crestFor(effective, kind, name);

  if (url) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={url}
        alt={`${name} crest`}
        title={name}
        className={`${SIZES[size]} shrink-0 rounded-md object-contain ${className}`}
      />
    );
  }

  return (
    <span
      title={name}
      aria-label={`${name} badge`}
      className={`${SIZES[size]} shrink-0 inline-flex items-center justify-center rounded-md font-bold text-white/90 ${className}`}
      style={{ backgroundColor: crestColor(name) }}
    >
      {crestInitials(name)}
    </span>
  );
}
