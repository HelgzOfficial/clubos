export type ItemType = "player" | "opponent" | "cone" | "goal" | "mini-goal" | "mannequin" | "zone" | "football";
export type LineStyle = "solid" | "dashed";

export type PitchItem = { id: string; type: ItemType; x: number; y: number };
export type PitchLine = { id: string; x1: number; y1: number; x2: number; y2: number; style: LineStyle };

export type Drill = {
  id: string;
  name: string;
  durationMin: number;
  notes: string;
  items: PitchItem[];
  lines: PitchLine[];
};

export type TrainingSession = {
  id: string;
  name: string;
  date: string; // ISO date, set when created
  drillIds: string[];
};

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
