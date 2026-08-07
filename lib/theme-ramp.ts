// Turns one club-picked colour into the full 11-shade ramp (50 lightest to
// 950 darkest) that the app's "navy" palette uses everywhere — every
// bg-navy-800, dark:bg-navy-950, border navy-600/50 and so on across the
// whole codebase. Nobody has to touch those hundreds of class names: the
// Tailwind config points each shade at a CSS variable (see
// components/club-color-provider.tsx and tailwind.config.ts), and this file
// is what fills those variables in from a single colour a club picks in
// Settings > Appearance.
//
// Rather than asking a non-technical user to pick eleven shades, we keep the
// same lightness/saturation "shape" the app's original navy ramp had (so
// text contrast, borders, hover states etc. all keep working the same way)
// and just re-hue it — plus nudge the whole ramp lighter/darker to match how
// light or dark the colour they picked is.

export type ShadeKey = "50" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900" | "950";

export const SHADE_KEYS: ShadeKey[] = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];

// Lightness/saturation of the app's original navy-* palette, measured from
// the hex values that used to be hard-coded in tailwind.config.ts. The shape
// of this ramp (how much darker each step gets) is what gives the app its
// depth — cards, panels and page background all read as distinct layers.
const BASE_LIGHTNESS: Record<ShadeKey, number> = {
  "50": 95.3, "100": 89.2, "200": 78.0, "300": 65.3, "400": 52.0,
  "500": 40.0, "600": 30.2, "700": 22.7, "800": 15.9, "900": 10.0, "950": 6.3,
};
const BASE_SATURATION: Record<ShadeKey, number> = {
  "50": 41.7, "100": 45.5, "200": 44.6, "300": 41.2, "400": 35.5,
  "500": 41.2, "600": 45.5, "700": 48.3, "800": 50.6, "900": 56.9, "950": 62.5,
};

// The shade the colour picker is calibrated against — "App Background"
// defaults to this exact original navy-900 hex, so a club that never
// touches the field gets the app's original look back exactly.
const ANCHOR: ShadeKey = "900";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function hexToHsl(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num) || full.length !== 6) return [222, 51, 16]; // falls back to the original navy-800-ish tone
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hh = ((h % 360) + 360) % 360 / 360;
  const ss = clamp(s, 0, 100) / 100;
  const ll = clamp(l, 0, 100) / 100;
  if (ss === 0) {
    const v = Math.round(ll * 255);
    return [v, v, v];
  }
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const hue2rgb = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const r = hue2rgb(hh + 1 / 3);
  const g = hue2rgb(hh);
  const b = hue2rgb(hh - 1 / 3);
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function parseTriplet(triplet: string): [number, number, number] {
  const parts = triplet.split(/\s+/).map((n) => Number(n));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return [20, 31, 61];
  return [parts[0], parts[1], parts[2]];
}

// "#RRGGBB" -> "{50: 'R G B', 100: 'R G B', ...}" ready to drop straight
// into CSS custom properties (Tailwind's rgb(var(--x) / <alpha-value>) form).
export function generateShadeRamp(baseHex: string): Record<ShadeKey, string> {
  const [h, s, l] = hexToHsl(baseHex);
  const satScale = BASE_SATURATION[ANCHOR] > 0 ? s / BASE_SATURATION[ANCHOR] : 1;
  const lightDelta = l - BASE_LIGHTNESS[ANCHOR];

  const out = {} as Record<ShadeKey, string>;
  for (const key of SHADE_KEYS) {
    const newSat = clamp(BASE_SATURATION[key] * satScale, 0, 100);
    // The extremes (near-white 50, near-black 950) fade the lightness shift
    // out a bit so a very light or very dark pick can't wash out the ramp's
    // top/bottom into flat white or flat black.
    const fade = key === "50" || key === "950" ? 0.5 : 1;
    const newLight = clamp(BASE_LIGHTNESS[key] + lightDelta * fade, 2, 97);
    const [r, g, b] = hslToRgb(h, newSat, newLight);
    out[key] = `${r} ${g} ${b}`;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Text colour
// ---------------------------------------------------------------------------

// How far each `text-neutral-*` shade sits between the club's chosen text
// colour and the page background behind it. These ratios were measured from
// the greys the app already used (text-neutral-400 for hints, -500 for the
// quietest labels, and so on) so switching to a club's own text colour keeps
// exactly the same visual hierarchy — headings loud, captions quiet — rather
// than flattening everything to one shade.
//
// Deriving muted text by blending toward the background, instead of using
// fixed greys, is also what stops pale text disappearing when a club picks a
// light background, or dark text vanishing on a dark one: the muted shades
// always move toward whatever is actually behind them.
const TEXT_MIX: Record<ShadeKey, number> = {
  "50": 0, "100": 0.04, "200": 0.09, "300": 0.17, "400": 0.4,
  "500": 0.63, "600": 0.79, "700": 0.87, "800": 0.92, "900": 0.96, "950": 0.98,
};

export type TextRamp = { strong: string } & Record<ShadeKey, string>;

// Builds the text palette from the club's text colour and the surface ramp it
// will be read against. `strong` is the full-strength colour used for
// headings and body copy (everything the app writes as `text-white`).
export function generateTextRamp(textHex: string, surfaceRamp: Record<ShadeKey, string>): TextRamp {
  const [th, ts, tl] = hexToHsl(textHex);
  const [tr, tg, tb] = hslToRgb(th, ts, tl);
  // Blend against the mid-dark panel shade, which is what most text in the
  // app actually sits on (cards and page background alike).
  const [br, bg, bb] = parseTriplet(surfaceRamp["800"]);

  const out = { strong: `${tr} ${tg} ${tb}` } as TextRamp;
  for (const key of SHADE_KEYS) {
    const t = TEXT_MIX[key];
    out[key] = `${Math.round(tr + (br - tr) * t)} ${Math.round(tg + (bg - tg) * t)} ${Math.round(tb + (bb - tb) * t)}`;
  }
  return out;
}
