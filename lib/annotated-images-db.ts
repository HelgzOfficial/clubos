import { supabase } from "./supabase";

export type DbAnnotatedImage = {
  id: string;
  title: string;
  file_name: string;
  file_path: string;
  source_clip_id: string | null;
  created_at: string;
};

export async function fetchAnnotatedImages(): Promise<DbAnnotatedImage[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("annotated_images").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbAnnotatedImage[];
}

// Takes a data URL (what <canvas>.toDataURL() produces) rather than a File,
// since the caller is always either a freeze-frame captured from a video or
// a marked-up upload rendered onto a canvas — never a file picked straight
// off disk.
export async function saveAnnotatedImage(title: string, dataUrl: string, sourceClipId?: string | null): Promise<DbAnnotatedImage> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const fileName = `${title.replace(/[^a-zA-Z0-9.\-_ ]/g, "_") || "annotation"}.png`;
  const path = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;

  const { error: uploadError } = await supabase.storage.from("annotated-images").upload(path, blob, { contentType: "image/png" });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("annotated_images")
    .insert({ title: title || fileName, file_name: fileName, file_path: path, source_clip_id: sourceClipId || null })
    .select()
    .single();
  if (error) throw error;
  return data as DbAnnotatedImage;
}

// A plain image upload, before any drawing on it — lands in the same
// library so it can be opened straight into the annotator later. Saving an
// annotated version of it creates a separate new entry rather than
// overwriting this one, same as the video freeze-frame flow, so the
// original always stays available.
export async function uploadRawImage(title: string, file: File): Promise<DbAnnotatedImage> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
  const { error: uploadError } = await supabase.storage.from("annotated-images").upload(path, file);
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("annotated_images")
    .insert({ title: title || file.name, file_name: file.name, file_path: path, source_clip_id: null })
    .select()
    .single();
  if (error) throw error;
  return data as DbAnnotatedImage;
}

export async function getAnnotatedImageUrl(filePath: string): Promise<string> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.storage.from("annotated-images").createSignedUrl(filePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteAnnotatedImage(id: string, filePath: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  await supabase.storage.from("annotated-images").remove([filePath]);
  const { error } = await supabase.from("annotated_images").delete().eq("id", id);
  if (error) throw error;
}
