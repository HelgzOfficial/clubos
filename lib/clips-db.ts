import { supabase } from "./supabase";

// Free-text, but these four are the ones the Analyst Dashboard's video
// reels look for — anything else (or blank) just shows up uncategorised in
// the full clip library.
export const CLIP_CATEGORIES = ["Build Up Play", "Pressing", "Transition", "Set Pieces"] as const;
export type ClipCategory = (typeof CLIP_CATEGORIES)[number];

export type ClipSource = "upload" | "youtube";

export type DbClip = {
  id: string;
  title: string;
  // Null for YouTube clips — there's no stored file behind those.
  file_name: string | null;
  file_path: string | null;
  file_type: string | null;
  category: string | null;
  match_id: string | null;
  source: ClipSource;
  youtube_url: string | null;
  youtube_id: string | null;
  uploaded_at: string;
};

// Rows created before the YouTube columns existed come back without them, so
// default anything missing to an ordinary upload.
function normaliseClip(row: Record<string, unknown>): DbClip {
  return { ...(row as DbClip), source: ((row.source as ClipSource) ?? "upload") };
}

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
  return (data ?? []).map(normaliseClip);
}

// No limit — the full Analysis library, as opposed to the dashboard's
// "latest 6" widget above.
export async function fetchAllClips(): Promise<DbClip[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("clips").select("*").order("uploaded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normaliseClip);
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
  return (data ?? []).map(normaliseClip);
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
      source: "upload",
    })
    .select()
    .single();
  if (error) throw error;
  return normaliseClip(data);
}

// Adds a YouTube video to the clip library as a link, with no file upload and
// nothing stored in the bucket. Takes the URL exactly as pasted; the caller is
// expected to have validated it with parseYouTubeId first.
export async function addYouTubeClip(input: {
  title: string;
  url: string;
  youtubeId: string;
  category?: string | null;
  matchId?: string | null;
}): Promise<DbClip> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("clips")
    .insert({
      title: input.title.trim() || "YouTube clip",
      file_name: null,
      file_path: null,
      file_type: "youtube",
      category: input.category || null,
      match_id: input.matchId || null,
      source: "youtube",
      youtube_url: input.url.trim(),
      youtube_id: input.youtubeId,
    })
    .select()
    .single();
  if (error) throw error;
  return normaliseClip(data);
}

// Accepts null so callers can pass clip.file_path straight through; a
// YouTube clip has no stored file, so that's a caller bug rather than
// something to paper over silently.
export async function getClipUrl(filePath: string | null): Promise<string> {
  if (!supabase) throw new Error("Supabase is not configured.");
  if (!filePath) throw new Error("This clip is a YouTube link, not an uploaded file.");
  const { data, error } = await supabase.storage.from("clips").createSignedUrl(filePath, 60);
  if (error) throw error;
  return data.signedUrl;
}

// filePath is null for YouTube clips — there's no stored object to remove, so
// this only deletes the row in that case.
export async function deleteClip(id: string, filePath: string | null) {
  if (!supabase) throw new Error("Supabase is not configured.");
  if (filePath) await supabase.storage.from("clips").remove([filePath]);
  const { error } = await supabase.from("clips").delete().eq("id", id);
  if (error) throw error;
}
