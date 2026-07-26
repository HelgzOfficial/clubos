import { supabase } from "./supabase";
import { resizeImageFile } from "./image-resize";

export type PositionGroup = "GK" | "DEF" | "MID" | "FWD";
export type Availability = "green" | "amber" | "red";

// code is the named role (e.g. "RWB") a marker was placed from, if it was
// added via the position dropdown rather than a free click on the pitch.
export type PitchPoint = { code?: string; x: number; y: number };

export type DbPlayer = {
  id: string;
  name: string;
  initials: string;
  squad_number: number;
  position: string;
  position_group: PositionGroup;
  nationality: string;
  dob: string | null;
  pitch_x: number;
  pitch_y: number;
  pitch_positions: PitchPoint[];
  email: string | null;
  phone: string | null;
  availability: Availability;
  availability_note: string;
  photo_url: string | null;
  appearances: number;
  minutes: number;
  goals: number;
  assists: number;
  clean_sheets: number;
  gps: { distanceKm: number; topSpeedKph: number; sprints: number };
  injury_history: { injury: string; date: string; daysOut: number }[];
  documents: { name: string; type: string }[];
  clips: { title: string; duration: string }[];
  created_at: string;
};

export type PlayerInput = {
  name: string;
  squadNumber: number;
  position: string;
  positionGroup: PositionGroup;
  nationality: string;
  dob: string;
  pitchX: number;
  pitchY: number;
  availability: Availability;
  availabilityNote: string;
  email: string;
  phone: string;
};

export const POSITION_OPTIONS: { label: string; group: PositionGroup }[] = [
  { label: "Goalkeeper", group: "GK" },
  { label: "Centre Back", group: "DEF" },
  { label: "Left Back", group: "DEF" },
  { label: "Right Back", group: "DEF" },
  { label: "Defensive Midfield", group: "MID" },
  { label: "Central Midfield", group: "MID" },
  { label: "Attacking Midfield", group: "MID" },
  { label: "Left Winger", group: "FWD" },
  { label: "Right Winger", group: "FWD" },
  { label: "Striker", group: "FWD" },
];

function initialsFromName(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export async function fetchPlayers(): Promise<DbPlayer[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("players").select("*").order("squad_number", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPlayer(id: string): Promise<DbPlayer | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("players").select("*").eq("id", id).single();
  if (error) return null;
  return data;
}

export async function createPlayer(input: Omit<PlayerInput, "availability" | "availabilityNote">) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("players")
    .insert({
      name: input.name,
      initials: initialsFromName(input.name),
      squad_number: input.squadNumber,
      position: input.position,
      position_group: input.positionGroup,
      nationality: input.nationality,
      dob: input.dob || null,
      pitch_x: input.pitchX,
      pitch_y: input.pitchY,
      pitch_positions: [{ x: input.pitchX, y: input.pitchY }],
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DbPlayer;
}

export async function updatePlayer(id: string, input: Partial<PlayerInput>) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    patch.name = input.name;
    patch.initials = initialsFromName(input.name);
  }
  if (input.squadNumber !== undefined) patch.squad_number = input.squadNumber;
  if (input.position !== undefined) patch.position = input.position;
  if (input.positionGroup !== undefined) patch.position_group = input.positionGroup;
  if (input.nationality !== undefined) patch.nationality = input.nationality;
  if (input.dob !== undefined) patch.dob = input.dob || null;
  if (input.pitchX !== undefined) patch.pitch_x = input.pitchX;
  if (input.pitchY !== undefined) patch.pitch_y = input.pitchY;
  if (input.availability !== undefined) patch.availability = input.availability;
  if (input.availabilityNote !== undefined) patch.availability_note = input.availabilityNote;
  if (input.email !== undefined) patch.email = input.email.trim() || null;
  if (input.phone !== undefined) patch.phone = input.phone.trim() || null;

  const { data, error } = await supabase.from("players").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as DbPlayer;
}

export async function deletePlayer(id: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("players").delete().eq("id", id);
  if (error) throw error;
}

// Lets a player carry more than one pitch position marker (e.g. someone
// comfortable at both centre-back and right-back). pitch_x/pitch_y are kept
// in sync with the first entry so anything still reading those two columns
// keeps working.
export async function updatePlayerPositions(id: string, positions: PitchPoint[]): Promise<DbPlayer> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const primary = positions[0] ?? { x: 50, y: 50 };
  const { data, error } = await supabase
    .from("players")
    .update({ pitch_positions: positions, pitch_x: primary.x, pitch_y: primary.y })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbPlayer;
}

export type PlayerSeasonStats = { appearances: number; goals: number; assists: number; cleanSheets: number };

// Sets a player's season totals directly — used both by the automatic
// match-stats sync (lib/player-stats-sync.ts) and by manually editing a
// player's stats on their profile page.
export async function updatePlayerStats(id: string, stats: PlayerSeasonStats) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase
    .from("players")
    .update({
      appearances: stats.appearances,
      goals: stats.goals,
      assists: stats.assists,
      clean_sheets: stats.cleanSheets,
    })
    .eq("id", id);
  if (error) throw error;
}

// Photos live in the 'player-photos' storage bucket, one file per player
// (path is always `${playerId}.jpg`, so re-uploading overwrites the old
// photo automatically). The player row just stores the resulting public URL.
export async function uploadPlayerPhoto(playerId: string, file: File): Promise<string> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const resized = await resizeImageFile(file);
  const path = `${playerId}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("player-photos")
    .upload(path, resized, { upsert: true, contentType: "image/jpeg" });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("player-photos").getPublicUrl(path);
  // Cache-bust so the browser doesn't keep showing a stale cached image at the same URL.
  const photoUrl = `${data.publicUrl}?v=${Date.now()}`;

  const { error } = await supabase.from("players").update({ photo_url: photoUrl }).eq("id", playerId);
  if (error) throw error;

  return photoUrl;
}

export async function removePlayerPhoto(playerId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  await supabase.storage.from("player-photos").remove([`${playerId}.jpg`]);
  const { error } = await supabase.from("players").update({ photo_url: null }).eq("id", playerId);
  if (error) throw error;
}
