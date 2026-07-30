import { supabase } from "./supabase";

export type PlayerResponse = "yes" | "no";
export type CoachStatus = "present" | "absent" | "excused";

export type DbTrainingAttendance = {
  id: string;
  session_date: string;
  player_id: string | null;
  guest_name: string | null;
  guest_note: string | null;
  player_response: PlayerResponse | null;
  responded_at: string | null;
  coach_status: CoachStatus | null;
  coach_note: string | null;
  updated_at: string;
};

// What the register actually shows for someone. The coach's mark always wins;
// otherwise it falls back to what the player said, and to "awaiting" if
// nobody has said anything yet.
export type EffectiveStatus = "present" | "absent" | "excused" | "said-yes" | "said-no" | "awaiting";

export function effectiveStatus(row: DbTrainingAttendance | undefined): EffectiveStatus {
  if (!row) return "awaiting";
  if (row.coach_status) return row.coach_status;
  if (row.player_response === "yes") return "said-yes";
  if (row.player_response === "no") return "said-no";
  return "awaiting";
}

export const STATUS_LABEL: Record<EffectiveStatus, string> = {
  present: "Present",
  absent: "Absent",
  excused: "Excused",
  "said-yes": "Confirmed",
  "said-no": "Can't make it",
  awaiting: "No reply",
};

export const STATUS_TONE: Record<EffectiveStatus, string> = {
  present: "bg-emerald-500/15 text-emerald-300",
  absent: "bg-red-500/15 text-red-300",
  excused: "bg-blue-500/15 text-blue-300",
  "said-yes": "bg-emerald-500/10 text-emerald-400/90",
  "said-no": "bg-red-500/10 text-red-400/90",
  awaiting: "bg-white/10 text-neutral-400",
};

// True when the coach has recorded something that contradicts the player —
// used to show "player said yes" underneath an Absent mark, so the override is
// visible rather than silently replacing the answer.
export function isOverridden(row: DbTrainingAttendance | undefined): boolean {
  if (!row?.coach_status || !row.player_response) return false;
  const impliedByPlayer = row.player_response === "yes" ? "present" : "absent";
  return row.coach_status !== impliedByPlayer;
}

export async function fetchAttendance(sessionDate: string): Promise<DbTrainingAttendance[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("training_attendance")
    .select("*")
    .eq("session_date", sessionDate)
    .order("updated_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbTrainingAttendance[];
}

// One player's own row for a day — what the companion needs to show them their
// current answer without pulling the whole squad's register.
export async function fetchMyAttendance(sessionDate: string, playerId: string): Promise<DbTrainingAttendance | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("training_attendance")
    .select("*")
    .eq("session_date", sessionDate)
    .eq("player_id", playerId)
    .maybeSingle();
  if (error) throw error;
  return (data as DbTrainingAttendance) ?? null;
}

// Upsert on (session_date, player_id) so a player changing their mind updates
// their answer rather than adding a second row.
export async function setPlayerResponse(
  sessionDate: string, playerId: string, response: PlayerResponse
): Promise<DbTrainingAttendance> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("training_attendance")
    .upsert(
      {
        session_date: sessionDate,
        player_id: playerId,
        player_response: response,
        responded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_date,player_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as DbTrainingAttendance;
}

// Passing null clears the override and hands the row back to whatever the
// player said.
export async function setCoachStatus(
  sessionDate: string, playerId: string, status: CoachStatus | null, note?: string
): Promise<DbTrainingAttendance> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("training_attendance")
    .upsert(
      {
        session_date: sessionDate,
        player_id: playerId,
        coach_status: status,
        coach_note: note ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_date,player_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as DbTrainingAttendance;
}

// Guests have no player record, so their status is set directly on the row.
export async function setGuestStatus(id: string, status: CoachStatus | null): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase
    .from("training_attendance")
    .update({ coach_status: status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function addGuest(
  sessionDate: string, name: string, note?: string
): Promise<DbTrainingAttendance> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("training_attendance")
    .insert({
      session_date: sessionDate,
      guest_name: name.trim(),
      guest_note: note?.trim() || null,
      coach_status: "present",
    })
    .select()
    .single();
  if (error) throw error;
  return data as DbTrainingAttendance;
}

export async function removeAttendanceRow(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("training_attendance").delete().eq("id", id);
  if (error) throw error;
}
