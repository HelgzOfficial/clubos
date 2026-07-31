import { supabase } from "./supabase";

// Emergency and medical detail for one player. Stored separately from the
// player record and readable only by medical staff and senior management —
// see supabase-player-medical-profiles.sql for the access rule.
export type DbPlayerMedicalProfile = {
  player_id: string;
  emergency_contact_name: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_alt_phone: string | null;
  blood_type: string | null;
  conditions: string | null;
  allergies: string | null;
  medications: string | null;
  surgeries: string | null;
  previous_injuries: string | null;
  gp_name: string | null;
  gp_practice: string | null;
  gp_phone: string | null;
  notes: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type MedicalProfileInput = Omit<DbPlayerMedicalProfile, "player_id" | "updated_at" | "updated_by">;

export const EMPTY_MEDICAL_PROFILE: MedicalProfileInput = {
  emergency_contact_name: "",
  emergency_contact_relationship: "",
  emergency_contact_phone: "",
  emergency_contact_alt_phone: "",
  blood_type: "",
  conditions: "",
  allergies: "",
  medications: "",
  surgeries: "",
  previous_injuries: "",
  gp_name: "",
  gp_practice: "",
  gp_phone: "",
  notes: "",
};

// Returns null when nothing has been recorded yet, and also when the caller
// isn't allowed to see it — RLS filters the row out rather than erroring, so
// the two cases look the same from here by design.
export async function fetchMedicalProfile(playerId: string): Promise<DbPlayerMedicalProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("player_medical_profiles")
    .select("*")
    .eq("player_id", playerId)
    .maybeSingle();
  if (error) throw error;
  return (data as DbPlayerMedicalProfile) ?? null;
}

export async function saveMedicalProfile(
  playerId: string,
  input: MedicalProfileInput,
  updatedBy: string | null
): Promise<DbPlayerMedicalProfile> {
  if (!supabase) throw new Error("Supabase is not configured.");
  // Empty strings become null so a blank field reads as "not recorded" rather
  // than "recorded as nothing".
  const cleaned = Object.fromEntries(
    Object.entries(input).map(([k, v]) => [k, typeof v === "string" && v.trim() === "" ? null : v])
  );
  const { data, error } = await supabase
    .from("player_medical_profiles")
    .upsert(
      { player_id: playerId, ...cleaned, updated_at: new Date().toISOString(), updated_by: updatedBy },
      { onConflict: "player_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as DbPlayerMedicalProfile;
}

// The subset a player maintains for themselves in the companion app. Kept
// narrow on purpose: emergency contact and the things a paramedic would want
// to know. History, GP and notes stay with the medical team.
export type EmergencySelfInput = Pick<
  MedicalProfileInput,
  | "emergency_contact_name"
  | "emergency_contact_relationship"
  | "emergency_contact_phone"
  | "emergency_contact_alt_phone"
  | "allergies"
  | "conditions"
  | "medications"
>;

export const EMPTY_EMERGENCY_SELF: EmergencySelfInput = {
  emergency_contact_name: "",
  emergency_contact_relationship: "",
  emergency_contact_phone: "",
  emergency_contact_alt_phone: "",
  allergies: "",
  conditions: "",
  medications: "",
};

export function toEmergencySelf(profile: DbPlayerMedicalProfile | null): EmergencySelfInput {
  if (!profile) return { ...EMPTY_EMERGENCY_SELF };
  return {
    emergency_contact_name: profile.emergency_contact_name ?? "",
    emergency_contact_relationship: profile.emergency_contact_relationship ?? "",
    emergency_contact_phone: profile.emergency_contact_phone ?? "",
    emergency_contact_alt_phone: profile.emergency_contact_alt_phone ?? "",
    allergies: profile.allergies ?? "",
    conditions: profile.conditions ?? "",
    medications: profile.medications ?? "",
  };
}

// Sends only the player-maintained fields, so saving from the companion can
// never blank out the medical team's own entries in the same row.
export async function saveEmergencySelf(
  playerId: string,
  input: EmergencySelfInput,
  updatedBy: string | null
): Promise<DbPlayerMedicalProfile> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const cleaned = Object.fromEntries(
    Object.entries(input).map(([k, v]) => [k, typeof v === "string" && v.trim() === "" ? null : v])
  );
  const { data, error } = await supabase
    .from("player_medical_profiles")
    .upsert(
      { player_id: playerId, ...cleaned, updated_at: new Date().toISOString(), updated_by: updatedBy },
      { onConflict: "player_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as DbPlayerMedicalProfile;
}

export function toInput(profile: DbPlayerMedicalProfile | null): MedicalProfileInput {
  if (!profile) return { ...EMPTY_MEDICAL_PROFILE };
  return {
    emergency_contact_name: profile.emergency_contact_name ?? "",
    emergency_contact_relationship: profile.emergency_contact_relationship ?? "",
    emergency_contact_phone: profile.emergency_contact_phone ?? "",
    emergency_contact_alt_phone: profile.emergency_contact_alt_phone ?? "",
    blood_type: profile.blood_type ?? "",
    conditions: profile.conditions ?? "",
    allergies: profile.allergies ?? "",
    medications: profile.medications ?? "",
    surgeries: profile.surgeries ?? "",
    previous_injuries: profile.previous_injuries ?? "",
    gp_name: profile.gp_name ?? "",
    gp_practice: profile.gp_practice ?? "",
    gp_phone: profile.gp_phone ?? "",
    notes: profile.notes ?? "",
  };
}

// True when there's anything at all worth showing — used to decide between the
// record and an "add details" prompt.
export function hasAnyDetail(profile: DbPlayerMedicalProfile | null): boolean {
  if (!profile) return false;
  return Object.entries(profile).some(
    ([key, value]) =>
      !["player_id", "updated_at", "updated_by"].includes(key) &&
      typeof value === "string" &&
      value.trim() !== ""
  );
}
