import { supabase } from "./supabase";
import type { Drill, PitchItem, PitchLine, PitchView, TrainingSession } from "./training-storage";

// Shared storage for training sessions and drills, replacing the per-browser
// localStorage that meant a session planned on one device was invisible on
// every other. localStorage is still used underneath as an instant-paint cache
// (see training-storage.ts) but Supabase is the source of truth.

type DbSessionRow = {
  id: string;
  name: string;
  session_date: string;
  drill_ids: string[] | null;
};

type DbDrillRow = {
  id: string;
  name: string;
  duration_min: number;
  notes: string | null;
  items: PitchItem[] | null;
  lines: PitchLine[] | null;
  view: PitchView | null;
};

export type TrainingData = { sessions: TrainingSession[]; drills: Record<string, Drill> };

export async function fetchTrainingData(): Promise<TrainingData> {
  if (!supabase) return { sessions: [], drills: {} };

  const [sessionsRes, drillsRes] = await Promise.all([
    supabase.from("training_sessions").select("*").order("session_date", { ascending: false }),
    supabase.from("training_drills").select("*"),
  ]);
  if (sessionsRes.error) throw sessionsRes.error;
  if (drillsRes.error) throw drillsRes.error;

  const sessions: TrainingSession[] = ((sessionsRes.data ?? []) as DbSessionRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    date: r.session_date,
    drillIds: r.drill_ids ?? [],
  }));

  const drills: Record<string, Drill> = {};
  for (const r of (drillsRes.data ?? []) as DbDrillRow[]) {
    drills[r.id] = {
      id: r.id,
      name: r.name,
      durationMin: r.duration_min,
      notes: r.notes ?? "",
      items: r.items ?? [],
      lines: r.lines ?? [],
      view: r.view ?? "full",
    };
  }

  return { sessions, drills };
}

// Upserts the current sessions and drills. Deliberately does NOT delete rows
// that are absent from what's passed in: this runs debounced on every edit, so
// treating it as a full replace would let one device's slightly stale state
// wipe a session another coach had just created. Deletions go through the
// explicit delete functions below instead.
export async function saveTrainingState(sessions: TrainingSession[], drills: Record<string, Drill>): Promise<void> {
  if (!supabase) return;
  const now = new Date().toISOString();

  if (sessions.length > 0) {
    const rows = sessions.map((s) => ({
      id: s.id,
      name: s.name,
      session_date: s.date,
      drill_ids: s.drillIds,
      updated_at: now,
    }));
    const { error } = await supabase.from("training_sessions").upsert(rows, { onConflict: "id" });
    if (error) throw error;
  }

  const drillList = Object.values(drills);
  if (drillList.length > 0) {
    const rows = drillList.map((d) => ({
      id: d.id,
      name: d.name,
      duration_min: d.durationMin,
      notes: d.notes ?? "",
      items: d.items ?? [],
      lines: d.lines ?? [],
      view: d.view ?? "full",
      updated_at: now,
    }));
    const { error } = await supabase.from("training_drills").upsert(rows, { onConflict: "id" });
    if (error) throw error;
  }
}

export async function deleteSessionRemote(sessionId: string, drillIds: string[]): Promise<void> {
  if (!supabase) return;
  // Drills belong to exactly one session, so removing the session removes its
  // drills too — otherwise they'd linger as unreachable rows.
  if (drillIds.length > 0) {
    const { error } = await supabase.from("training_drills").delete().in("id", drillIds);
    if (error) throw error;
  }
  const { error } = await supabase.from("training_sessions").delete().eq("id", sessionId);
  if (error) throw error;
}

export async function deleteDrillRemote(drillId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("training_drills").delete().eq("id", drillId);
  if (error) throw error;
}

// True when the shared store has nothing in it — used to decide whether a
// device's existing localStorage sessions should be pushed up on first load
// rather than silently discarded.
export async function remoteTrainingIsEmpty(): Promise<boolean> {
  if (!supabase) return false;
  const { count, error } = await supabase
    .from("training_sessions")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return (count ?? 0) === 0;
}
