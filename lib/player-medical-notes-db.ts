import { supabase } from "./supabase";

export type DbPlayerMedicalNote = {
  id: string;
  player_id: string;
  body: string;
  author_name: string | null;
  author_email: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchPlayerNotes(playerId: string): Promise<DbPlayerMedicalNote[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("player_medical_notes")
    .select("*")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbPlayerMedicalNote[];
}

export async function addPlayerNote(input: {
  playerId: string;
  body: string;
  authorName: string | null;
  authorEmail: string | null;
}): Promise<DbPlayerMedicalNote> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("player_medical_notes")
    .insert({
      player_id: input.playerId,
      body: input.body.trim(),
      author_name: input.authorName,
      author_email: input.authorEmail,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DbPlayerMedicalNote;
}

export async function updatePlayerNote(id: string, body: string): Promise<DbPlayerMedicalNote> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("player_medical_notes")
    .update({ body: body.trim(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbPlayerMedicalNote;
}

export async function deletePlayerNote(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("player_medical_notes").delete().eq("id", id);
  if (error) throw error;
}
