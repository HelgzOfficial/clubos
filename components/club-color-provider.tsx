"use client";

import { useEffect, type ReactNode } from "react";
import { loadClubSettings, saveClubSettings, hexToRgbTriplet } from "@/lib/club-settings";
import { fetchClubSettings } from "@/lib/club-settings-db";
import { club } from "@/lib/sample-data";

// Applies the saved club colours as CSS variables on the document root, so
// every `bg-club-primary` / `text-club-primary` / etc. utility class picks
// them up live — no rebuild needed when a coach changes the palette in
// Settings > Appearance.
export function applyClubColors(settings: { primaryColor: string; secondaryColor: string; accentColor: string }) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--club-primary-rgb", hexToRgbTriplet(settings.primaryColor));
  root.style.setProperty("--club-secondary-rgb", hexToRgbTriplet(settings.secondaryColor));
  root.style.setProperty("--club-accent-rgb", hexToRgbTriplet(settings.accentColor));
}

export function ClubColorProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Paint instantly from whatever this browser last saw (avoids a flash
    // of the sample defaults), then replace with the real shared value from
    // Supabase — the source of truth every device/user actually reads.
    applyClubColors(loadClubSettings(club));
    fetchClubSettings(club).then((settings) => {
      applyClubColors(settings);
      saveClubSettings(settings);
    });
  }, []);
  return <>{children}</>;
}
