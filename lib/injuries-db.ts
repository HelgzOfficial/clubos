import { supabase } from "./supabase";
import { updatePlayer } from "./players-db";
import type { BodyPart } from "./sample-data";

export type InjuryStatus = "active" | "recovered";
// Severity describes the injury, not the player's availability — the two used
// to be the same field, which meant you couldn't record a mild knock without
// also declaring the player doubtful.
//
//   mild      1–7 days
//   moderate  7–21 days
//   severe    21+ days
export type InjurySeverity = "mild" | "moderate" | "severe";

export const SEVERITY_OPTIONS: { value: InjurySeverity; label: string; expected: string }[] = [
  { value: "mild", label: "Mild", expected: "1–7 days" },
  { value: "moderate", label: "Moderate", expected: "7–21 days" },
  { value: "severe", label: "Severe", expected: "21+ days" },
];

export const SEVERITY_LABEL: Record<InjurySeverity, string> = {
  mild: "Mild", moderate: "Moderate", severe: "Severe",
};

export const SEVERITY_DAYS: Record<InjurySeverity, string> = {
  mild: "1–7 days", moderate: "7–21 days", severe: "21+ days",
};

// How an injury translates into the player's availability badge. A mild knock
// leaves them doubtful; anything longer rules them out of the next fixture.
// One place to change if the club wants a different rule.
export const SEVERITY_TO_AVAILABILITY: Record<InjurySeverity, "amber" | "red"> = {
  mild: "amber", moderate: "red", severe: "red",
};

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
    availability: SEVERITY_TO_AVAILABILITY[input.severity],
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
      availability: SEVERITY_TO_AVAILABILITY[injury.severity],
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
