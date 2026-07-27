import { supabase } from "./supabase";

export type DbMatchDocument = {
  id: string;
  match_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  uploaded_at: string;
};

export type DocumentViewer = {
  player_id: string;
  player_name: string;
  viewed_at: string;
};

function fileTypeOf(file: File): string {
  return file.name.split(".").pop()?.toLowerCase() || "other";
}

export async function fetchMatchDocuments(matchId: string): Promise<DbMatchDocument[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("match_documents")
    .select("*")
    .eq("match_id", matchId)
    .order("uploaded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbMatchDocument[];
}

export async function uploadMatchDocument(matchId: string, file: File): Promise<DbMatchDocument> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const path = `${matchId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
  const { error: uploadError } = await supabase.storage.from("match-documents").upload(path, file);
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("match_documents")
    .insert({ match_id: matchId, file_name: file.name, file_path: path, file_type: fileTypeOf(file) })
    .select()
    .single();
  if (error) throw error;
  return data as DbMatchDocument;
}

// A "view" URL — safe to render inline (e.g. a PDF in an iframe).
export async function getMatchDocumentUrl(filePath: string): Promise<string> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.storage.from("match-documents").createSignedUrl(filePath, 120);
  if (error) throw error;
  return data.signedUrl;
}

// A "download" URL — forces the browser to save the file to whatever
// device it's opened on (Content-Disposition: attachment), rather than
// navigating to or rendering it inline.
export async function getMatchDocumentDownloadUrl(filePath: string, fileName: string): Promise<string> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.storage.from("match-documents").createSignedUrl(filePath, 120, { download: fileName });
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteMatchDocument(id: string, filePath: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  await supabase.storage.from("match-documents").remove([filePath]);
  const { error } = await supabase.from("match_documents").delete().eq("id", id);
  if (error) throw error;
}

// Who has opened a given document — joined against players for a display name.
export async function fetchDocumentViewers(documentId: string): Promise<DocumentViewer[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("match_document_views")
    .select("player_id, viewed_at, players(name)")
    .eq("document_id", documentId)
    .order("viewed_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: { player_id: string; viewed_at: string; players: { name: string } | { name: string }[] | null }) => ({
    player_id: row.player_id,
    viewed_at: row.viewed_at,
    player_name: Array.isArray(row.players) ? row.players[0]?.name ?? "Unknown player" : row.players?.name ?? "Unknown player",
  }));
}

// Called from the player portal when a player opens a document — records
// (or refreshes the timestamp of) their view. Best-effort/idempotent.
export async function recordDocumentView(documentId: string, playerId: string) {
  if (!supabase) return;
  await supabase
    .from("match_document_views")
    .upsert({ document_id: documentId, player_id: playerId, viewed_at: new Date().toISOString() }, { onConflict: "document_id,player_id" });
}
