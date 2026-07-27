import { supabase } from "./supabase";

// Free-text, but these four are the ones the Analyst Dashboard's video
// reels look for — anything else (or blank) just shows up uncategorised in
// the full clip library.
export const CLIP_CATEGORIES = ["Build Up Play", "Pressing", "Transition", "Set Pieces"] as const;
export type ClipCategory = (typeof CLIP_CATEGORIES)[number];

export type DbClip = {
  id: string;
  title: string;
  file_name: string;
  file_path: string;
  file_type: string;
  category: string | null;
  match_id: string | null;
  uploaded_at: string;
};

function fileTypeOf(file: File): string {
  return file.name.split(".").pop()?.toLowerCase() || "other";
}

export async function fetchClips(limit = 6): Promise<DbClip[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("clips")
    .select("*")
    .order("uploaded_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as DbClip[];
}

// No limit — the full Analysis library, as opposed to the dashboard's
// "latest 6" widget above.
export async function fetchAllClips(): Promise<DbClip[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("clips").select("*").order("uploaded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbClip[];
}

// Every clip/highlight uploaded against one specific fixture — for Match
// Centre's "Highlights" section, as opposed to fetchClips/fetchAllClips
// above which pull the general Analysis library regardless of match.
export async function fetchClipsForMatch(matchId: string): Promise<DbClip[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("clips")
    .select("*")
    .eq("match_id", matchId)
    .order("uploaded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbClip[];
}

export async function uploadClip(
  title: string,
  file: File,
  category?: string | null,
  matchId?: string | null
): Promise<DbClip> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
  const { error: uploadError } = await supabase.storage.from("clips").upload(path, file);
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("clips")
    .insert({
      title: title || file.name,
      file_name: file.name,
      file_path: path,
      file_type: fileTypeOf(file),
      category: category || null,
      match_id: matchId || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DbClip;
}

export async function getClipUrl(filePath: string): Promise<string> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.storage.from("clips").createSignedUrl(filePath, 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteClip(id: string, filePath: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  await supabase.storage.from("clips").remove([filePath]);
  const { error } = await supabase.from("clips").delete().eq("id", id);
  if (error) throw error;
}
