import { supabase } from "./supabase";
import { extractReportText } from "./report-parser";

export type SummaryStatus = "pending" | "ready" | "failed";

export type DbOppositionReport = {
  id: string;
  opponent_name: string;
  file_name: string;
  file_path: string;
  file_type: string;
  ai_summary: string | null;
  summary_status: SummaryStatus;
  uploaded_at: string;
};

const TEXT_TYPES = ["pdf", "csv", "txt"];
const IMAGE_TYPES = ["png", "jpg", "jpeg", "webp"];

function fileTypeOf(file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if ([...TEXT_TYPES, ...IMAGE_TYPES].includes(ext)) return ext;
  return ext || "other";
}

export async function fetchOppositionReports(opponentName: string): Promise<DbOppositionReport[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("opposition_reports")
    .select("*")
    .eq("opponent_name", opponentName)
    .order("uploaded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbOppositionReport[];
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Couldn't read the file."));
    reader.readAsDataURL(file);
  });
}

async function requestSummary(file: File, fileType: string, opponentName: string): Promise<string> {
  let body: Record<string, unknown>;
  if (TEXT_TYPES.includes(fileType)) {
    const text = await extractReportText(file, fileType);
    // Capped well under the model's context — these exports can be long
    // multi-page tables, and the summary only needs the numbers, not everything.
    body = { text: text.slice(0, 12000), opponentName };
  } else if (IMAGE_TYPES.includes(fileType)) {
    const dataUrl = await readAsDataUrl(file);
    const base64 = dataUrl.split(",")[1] || "";
    const mediaType = dataUrl.match(/^data:(.*?);base64/)?.[1] || file.type || "image/jpeg";
    body = { imageBase64: base64, mediaType, opponentName };
  } else {
    throw new Error("Unsupported file type — upload a PDF, CSV, TXT, or a PNG/JPG screenshot.");
  }

  const res = await fetch("/api/opposition-summary", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Couldn't generate a summary for that file.");
  return data.summary as string;
}

export async function uploadOppositionReport(opponentName: string, file: File): Promise<DbOppositionReport> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const fileType = fileTypeOf(file);
  const safeOpponent = opponentName.replace(/[^a-zA-Z0-9.\-_]/g, "_") || "opponent";
  const path = `${safeOpponent}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;

  const { error: uploadError } = await supabase.storage.from("opposition-reports").upload(path, file);
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("opposition_reports")
    .insert({
      opponent_name: opponentName,
      file_name: file.name,
      file_path: path,
      file_type: fileType,
      summary_status: "pending",
    })
    .select()
    .single();
  if (error) throw error;

  const report = data as DbOppositionReport;

  // Best-effort AI summary — logged, not thrown, so an upload always
  // succeeds even if the summary step fails (missing API key, unreadable
  // file, AI hiccup).
  try {
    const summary = await requestSummary(file, fileType, opponentName);
    return await updateSummaryResult(report.id, "ready", summary);
  } catch (e) {
    console.error("Opposition report AI summary failed:", e);
    return await updateSummaryResult(report.id, "failed", null);
  }
}

export async function updateSummaryResult(id: string, status: SummaryStatus, summary: string | null): Promise<DbOppositionReport> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("opposition_reports")
    .update({ summary_status: status, ai_summary: summary })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbOppositionReport;
}

export async function getOppositionReportDownloadUrl(filePath: string): Promise<string> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.storage.from("opposition-reports").createSignedUrl(filePath, 60);
  if (error) throw error;
  return data.signedUrl;
}

// The explicit "delete an opposition report" option — removes both the
// uploaded file from storage and its row (and AI summary) from the database.
export async function deleteOppositionReport(id: string, filePath: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  await supabase.storage.from("opposition-reports").remove([filePath]);
  const { error } = await supabase.from("opposition_reports").delete().eq("id", id);
  if (error) throw error;
}
