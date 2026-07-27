import { supabase } from "./supabase";

export type AbsenceReason = "Holiday" | "International Duty" | "Compassionate Leave" | "Other";

export type DbPlayerAbsence = {
  id: string;
  player_id: string;
  reason: AbsenceReason;
  notes: string | null;
  start_date: string;
  end_date: string;
  created_at: string;
};

export async function fetchPlayerAbsences(): Promise<DbPlayerAbsence[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("player_absences")
    .select("*")
    .order("start_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbPlayerAbsence[];
}

export async function createPlayerAbsence(input: {
  playerId: string;
  reason: AbsenceReason;
  notes?: string;
  startDate: string;
  endDate: string;
}): Promise<DbPlayerAbsence> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("player_absences")
    .insert({
      player_id: input.playerId,
      reason: input.reason,
      notes: input.notes || null,
      start_date: input.startDate,
      end_date: input.endDate,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DbPlayerAbsence;
}

export async function deletePlayerAbsence(id: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("player_absences").delete().eq("id", id);
  if (error) throw error;
}

// A player counts as "currently away" if today's date falls within one of
// their approved absence windows (inclusive of both ends).
export function isAbsentOn(absence: DbPlayerAbsence, dateStr: string): boolean {
  return dateStr >= absence.start_date && dateStr <= absence.end_date;
}

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
