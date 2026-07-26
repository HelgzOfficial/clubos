import { supabase } from "./supabase";

export type DocumentCategory = "Match Packs" | "Match Reports" | "Policies";

export type DbClubDocument = {
  id: string;
  name: string;
  category: DocumentCategory;
  linked_to: string | null;
  file_name: string;
  file_path: string;
  file_type: string;
  size_kb: number;
  uploaded_at: string;
};

function fileTypeOf(file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "docx" || ext === "doc") return "docx";
  if (ext === "xlsx" || ext === "csv") return "xlsx";
  if (ext === "mp4" || ext === "mov") return "mp4";
  return "pdf";
}

export async function fetchClubDocuments(): Promise<DbClubDocument[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("club_documents").select("*").order("uploaded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbClubDocument[];
}

export async function uploadClubDocument(
  category: DocumentCategory,
  file: File,
  linkedTo?: string
): Promise<DbClubDocument> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const path = `${category.replace(/\s+/g, "-")}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
  const { error: uploadError } = await supabase.storage.from("club-documents").upload(path, file);
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("club_documents")
    .insert({
      name: file.name,
      category,
      linked_to: linkedTo || null,
      file_name: file.name,
      file_path: path,
      file_type: fileTypeOf(file),
      size_kb: Math.round(file.size / 1024),
    })
    .select()
    .single();
  if (error) throw error;
  return data as DbClubDocument;
}

export async function getClubDocumentUrl(filePath: string): Promise<string> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.storage.from("club-documents").createSignedUrl(filePath, 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteClubDocument(id: string, filePath: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  await supabase.storage.from("club-documents").remove([filePath]);
  const { error } = await supabase.from("club_documents").delete().eq("id", id);
  if (error) throw error;
}
