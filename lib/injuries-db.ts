import { supabase } from "./supabase";
import { updatePlayer } from "./players-db";
import type { BodyPart } from "./sample-data";

export type InjuryStatus = "active" | "recovered";
export type InjurySeverity = "amber" | "red";

export type DbInjury = {
  id: string;
  player_id: string;
  body_part: BodyPart;
  injury: string;
  severity: InjurySeverity;
  date_occurred: string | null;
  expected_return: string | null;
  rehab_stage: number;
  notes: string | null;
  status: InjuryStatus;
  created_at: string;
  updated_at: string;
};

export type InjuryInput = {
  bodyPart: BodyPart;
  injury: string;
  severity: InjurySeverity;
  dateOccurred: string;
  expectedReturn: string;
  rehabStage: number;
  notes: string;
};

export const BODY_PART_OPTIONS: { value: BodyPart; label: string }[] = [
  { value: "head", label: "Head" },
  { value: "shoulder-l", label: "Left Shoulder" },
  { value: "shoulder-r", label: "Right Shoulder" },
  { value: "chest", label: "Chest" },
  { value: "abdomen", label: "Abdomen" },
  { value: "hip-l", label: "Left Hip" },
  { value: "hip-r", label: "Right Hip" },
  { value: "thigh-l", label: "Left Thigh" },
  { value: "thigh-r", label: "Right Thigh" },
  { value: "knee-l", label: "Left Knee" },
  { value: "knee-r", label: "Right Knee" },
  { value: "calf-l", label: "Left Calf" },
  { value: "calf-r", label: "Right Calf" },
  { value: "ankle-l", label: "Left Ankle" },
  { value: "ankle-r", label: "Right Ankle" },
  { value: "foot-l", label: "Left Foot" },
  { value: "foot-r", label: "Right Foot" },
];

export async function fetchActiveInjuries(): Promise<DbInjury[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("injuries").select("*").eq("status", "active");
  if (error) throw error;
  return data ?? [];
}

export async function createInjury(playerId: string, input: InjuryInput) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("injuries")
    .insert({
      player_id: playerId,
      body_part: input.bodyPart,
      injury: input.injury,
      severity: input.severity,
      date_occurred: input.dateOccurred || null,
      expected_return: input.expectedReturn || null,
      rehab_stage: input.rehabStage,
      notes: input.notes || null,
    })
    .select()
    .single();
  if (error) throw error;

  // Keep the player's availability badge in sync with the injury just logged.
  await updatePlayer(playerId, {
    availability: input.severity,
    availabilityNote: input.expectedReturn ? `${input.injury} — back ${input.expectedReturn}` : input.injury,
  });

  return data as DbInjury;
}

export async function updateInjury(id: string, playerId: string, input: Partial<InjuryInput>) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.bodyPart !== undefined) patch.body_part = input.bodyPart;
  if (input.injury !== undefined) patch.injury = input.injury;
  if (input.severity !== undefined) patch.severity = input.severity;
  if (input.dateOccurred !== undefined) patch.date_occurred = input.dateOccurred || null;
  if (input.expectedReturn !== undefined) patch.expected_return = input.expectedReturn || null;
  if (input.rehabStage !== undefined) patch.rehab_stage = input.rehabStage;
  if (input.notes !== undefined) patch.notes = input.notes || null;

  const { data, error } = await supabase.from("injuries").update(patch).eq("id", id).select().single();
  if (error) throw error;

  if (input.severity !== undefined || input.injury !== undefined || input.expectedReturn !== undefined) {
    const injury = data as DbInjury;
    await updatePlayer(playerId, {
      availability: injury.severity,
      availabilityNote: injury.expected_return ? `${injury.injury} — back ${injury.expected_return}` : injury.injury,
    });
  }

  return data as DbInjury;
}

export async function markInjuryRecovered(id: string, playerId: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("injuries").update({ status: "recovered", updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;

  await updatePlayer(playerId, { availability: "green", availabilityNote: "Available" });
}

export async function deleteInjury(id: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("injuries").delete().eq("id", id);
  if (error) throw error;
}
