"use client";

import { useEffect, type ReactNode } from "react";
import { loadClubSettings, saveClubSettings, hexToRgbTriplet } from "@/lib/club-settings";
import { fetchClubSettings } from "@/lib/club-settings-db";
import { club } from "@/lib/sample-data";
import { generateShadeRamp, generateTextRamp, SHADE_KEYS } from "@/lib/theme-ramp";

// Applies the saved club colours as CSS variables on the document root, so
// every `bg-club-primary` / `text-club-primary` / etc. utility class picks
// them up live — no rebuild needed when a coach changes the palette in
// Settings > Appearance.
//
// `surfaceColor` goes further: it regenerates the app's entire background/
// panel/border ramp (--navy-50-rgb through --navy-950-rgb) from one colour,
// so every bg-navy-800, dark:bg-navy-950, border-navy-600/50 etc. across the
// whole app — hundreds of them, in every module — repaints with it. Nothing
// in those components has to change; they were already reading Tailwind
// classes that are now wired to these variables (see tailwind.config.ts).
export function applyClubColors(settings: {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  surfaceColor?: string;
  textColor?: string;
}) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--club-primary-rgb", hexToRgbTriplet(settings.primaryColor));
  root.style.setProperty("--club-secondary-rgb", hexToRgbTriplet(settings.secondaryColor));
  root.style.setProperty("--club-accent-rgb", hexToRgbTriplet(settings.accentColor));

  const ramp = generateShadeRamp(settings.surfaceColor || "#0B1428");
  if (settings.surfaceColor) {
    for (const key of SHADE_KEYS) {
      root.style.setProperty(`--navy-${key}-rgb`, ramp[key]);
    }
    // The phone's status bar tint on an installed home-screen app. Set here
    // rather than in the page metadata because metadata is fixed at build
    // time and can't know the club's colours — this keeps the bar above both
    // the staff app and the player portal matching the app underneath it.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", settings.surfaceColor);
  }

  if (settings.textColor) {
    const text = generateTextRamp(settings.textColor, ramp);
    root.style.setProperty("--text-strong-rgb", text.strong);
    for (const key of SHADE_KEYS) {
      root.style.setProperty(`--text-${key}-rgb`, text[key]);
    }
  }
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
