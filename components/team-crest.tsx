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

const SIZES = {
  xxs: "h-4 w-4 text-[7px]",
  xs: "h-5 w-5 text-[8px]",
  sm: "h-7 w-7 text-[10px]",
  md: "h-10 w-10 text-xs",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
};

// A team or competition badge. Uses the uploaded crest when there is one, and
// otherwise draws initials on a colour derived from the name — so a fixture
// list looks intentional even before any crests have been added.
export function TeamCrest({
  name, kind = "team", size = "sm", lookup, className = "", plain = false,
}: {
  name: string;
  kind?: CrestKind;
  size?: keyof typeof SIZES;
  lookup?: CrestLookup | null;
  className?: string;
  // plain drops the tile background/ring, for places where the crest sits on
  // an already-busy surface (e.g. inside a calendar cell).
  plain?: boolean;
}) {
  // Accepts a lookup from the parent (one fetch for a whole list) or fetches
  // its own if used standalone.
  const own = useCrestLookup();
  const effective = lookup !== undefined ? lookup : own;
  const url = crestFor(effective, kind, name);

  if (url) {
    // Uploaded crests vary wildly in aspect ratio and background, so they sit
    // inside a fixed square tile with object-contain rather than being
    // stretched — that's what keeps a fixture list looking even.
    return (
      <span
        title={name}
        className={`${SIZES[size]} shrink-0 inline-flex items-center justify-center overflow-hidden rounded-lg ${
          plain ? "" : "bg-white/5 ring-1 ring-white/10"
        } ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`${name} crest`} className="h-full w-full object-contain p-0.5" />
      </span>
    );
  }

  return (
    <span
      title={name}
      aria-label={`${name} badge`}
      className={`${SIZES[size]} shrink-0 inline-flex items-center justify-center rounded-lg font-bold leading-none text-white/95 ${
        plain ? "" : "ring-1 ring-white/10"
      } ${className}`}
      style={{ backgroundColor: crestColor(name) }}
    >
      {crestInitials(name)}
    </span>
  );
}
