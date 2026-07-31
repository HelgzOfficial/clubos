import { supabase } from "./supabase";
import { resizeImageFile } from "./image-resize";

export type DbMatchPhoto = {
  id: string;
  match_id: string | null;
  caption: string | null;
  file_path: string;
  file_name: string;
  photo_url: string;
  uploaded_by: string | null;
  uploaded_at: string;
};

export async function fetchMatchPhotos(limit = 200): Promise<DbMatchPhoto[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("match_photos")
    .select("*")
    .order("uploaded_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as DbMatchPhoto[];
}

export async function fetchPhotosForMatch(matchId: string): Promise<DbMatchPhoto[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("match_photos")
    .select("*")
    .eq("match_id", matchId)
    .order("uploaded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbMatchPhoto[];
}

// Photos come off phones at 4–8 MB each. Resizing before upload keeps the
// gallery quick to load and the storage bill sane — 1600px is still plenty for
// a full-screen view on any phone or laptop.
export async function uploadMatchPhoto(input: {
  file: File;
  matchId: string | null;
  caption: string;
  uploadedBy: string | null;
}): Promise<DbMatchPhoto> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const resized = await resizeImageFile(input.file, 1600, 0.85);
  const safeName = input.file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${Date.now()}-${safeName.replace(/\.[^.]+$/, "")}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("match-photos")
    .upload(path, resized, { contentType: "image/jpeg", upsert: false });
  if (uploadError) throw uploadError;

  const { data: pub } = supabase.storage.from("match-photos").getPublicUrl(path);

  const { data, error } = await supabase
    .from("match_photos")
    .insert({
      match_id: input.matchId,
      caption: input.caption.trim() || null,
      file_path: path,
      file_name: input.file.name,
      photo_url: pub.publicUrl,
      uploaded_by: input.uploadedBy,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DbMatchPhoto;
}

export async function updatePhotoCaption(id: string, caption: string, matchId: string | null): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase
    .from("match_photos")
    .update({ caption: caption.trim() || null, match_id: matchId })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteMatchPhoto(photo: DbMatchPhoto): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  await supabase.storage.from("match-photos").remove([photo.file_path]);
  const { error } = await supabase.from("match_photos").delete().eq("id", photo.id);
  if (error) throw error;
}
