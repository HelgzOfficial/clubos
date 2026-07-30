export type ClubSettings = {
  name: string;
  crestInitials: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};

// NOTE: this is a per-browser LOCAL CACHE only, used purely to paint
// something instantly (avoiding a flash of the sample "Riverside FC"
// defaults) while the real, shared value loads from Supabase — see
// lib/club-settings-db.ts for the source of truth every device and user
// actually reads. Do not rely on this alone; it will not reflect changes
// made on another device/browser.
const SETTINGS_KEY = "clubos_club_settings_v1";

export function loadClubSettings(fallback: ClubSettings): ClubSettings {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function saveClubSettings(settings: ClubSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// "#RRGGBB" -> "R G B", the format Tailwind's rgb(var(--x) / <alpha-value>)
// colors expect. Falls back to a neutral grey on anything unparseable.
export function hexToRgbTriplet(hex: string): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num) || full.length !== 6) return "148 163 184";
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `${r} ${g} ${b}`;
}
