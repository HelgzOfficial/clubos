export type ItemType =
  | "player" | "opponent" | "cone" | "goal" | "mini-goal" | "mannequin" | "zone" | "football"
  | "neutral" | "keeper" | "flat-marker" | "ladder" | "hurdle" | "text"
  // Shape markers — the same object in different outlines, which is how coaches
  // separate teams, bibs and roles without needing more colours.
  | "triangle" | "square" | "octagon" | "dot" | "number" | "hatch";

// solid = pass, dashed = run, wavy = dribble, block = a barrier/pressing line,
// free = a freehand brush stroke (uses `points` rather than the endpoints).
export type LineStyle = "solid" | "dashed" | "wavy" | "block" | "free";

// Which template the diagram is drawn on. Most drills happen in a third, a box
// or a plain grid, and forcing them onto a full pitch made everything tiny.
export type PitchView =
  | "full" | "half" | "third" | "box"
  | "split2" | "split3" | "square" | "blank"
  // Kept so drills saved against the earlier five-view build still open.
  | "grid";

// Everything added after the original four fields is optional, so drills saved
// before this existed still parse — old rows simply fall back to the defaults.
export type PitchItem = {
  id: string;
  type: ItemType;
  x: number;
  y: number;
  color?: string;   // hex; defaults per item type
  label?: string;   // shirt number, or the words for a "text" item
  size?: number;    // 0.5–2 scale multiplier
  rotation?: number; // degrees, for goals and ladders
};

export type PitchLine = {
  id: string;
  x1: number; y1: number;
  x2: number; y2: number;
  style: LineStyle;
  color?: string;
  // Quadratic control point, as a percentage like the ends. Absent means a
  // straight line, which is what every pre-existing line is.
  cx?: number;
  cy?: number;
  // Freehand strokes only: the sampled path, as percentages like everything else.
  points?: { x: number; y: number }[];
};

export type Drill = {
  id: string;
  name: string;
  durationMin: number;
  notes: string;
  items: PitchItem[];
  lines: PitchLine[];
  view?: PitchView;
};

export type TrainingSession = {
  id: string;
  name: string;
  date: string; // ISO date, set when created
  drillIds: string[];
};

// NOTE: these localStorage helpers are now only a fast local cache so the
// page can paint immediately on load. Supabase is the source of truth for
// training sessions and drills — see lib/training-db.ts.
const SESSIONS_KEY = "clubos_training_sessions_v1";
const DRILLS_KEY = "clubos_training_drills_v1";

export function loadSessions(): TrainingSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSessions(sessions: TrainingSession[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function loadDrills(): Record<string, Drill> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DRILLS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveDrills(drills: Record<string, Drill>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DRILLS_KEY, JSON.stringify(drills));
}

let counter = 0;
export function nextId(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

export function blankDrill(name = "New Drill"): Drill {
  return { id: nextId("drill"), name, durationMin: 10, notes: "", items: [], lines: [] };
}
