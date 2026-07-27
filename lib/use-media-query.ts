"use client";

import { useEffect, useState } from "react";

// Tracks a CSS media query in JS, so a component can render one layout on
// mobile/tablet and a different one on desktop without shipping both to the
// DOM at once (which would double-mount things like data-fetching widgets).
// Defaults to `false` (desktop) until mounted, matching server-rendered
// output, then flips after the first effect run on the client.
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, [query]);

  return matches;
}

// Below Tailwind's `lg` breakpoint (1024px) — i.e. phones and tablets,
// matching the same cutoff the dashboard grid already switches on.
export function useIsMobileOrTablet(): boolean {
  return useMediaQuery("(max-width: 1023px)");
}
