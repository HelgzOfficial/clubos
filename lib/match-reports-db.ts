import { supabase } from "./supabase";
import { extractReportText, parseReportText, type ParsedReport } from "./report-parser";

export type ReportSource = "hudl" | "wyscout" | "other";
export type ParseStatus = "unparsed" | "parsed" | "failed";

export type DbMatchReport = {
  id: string;
  match_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  source: ReportSource;
  parse_status: ParseStatus;
  parsed_summary: ParsedReport | null;
  uploaded_at: string;
};

function fileTypeOf(file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (["pdf", "csv", "txt"].includes(ext)) return ext;
  return ext || "other";
}

export async function fetchMatchReports(matchId: string): Promise<DbMatchReport[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("match_reports")
    .select("*")
    .eq("match_id", matchId)
    .order("uploaded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbMatchReport[];
}

export async function uploadMatchReport(matchId: string, file: File, source: ReportSource): Promise<DbMatchReport> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const fileType = fileTypeOf(file);
  const path = `${matchId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;

  const { error: uploadError } = await supabase.storage.from("match-reports").upload(path, file);
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("match_reports")
    .insert({
      match_id: matchId,
      file_name: file.name,
      file_path: path,
      file_type: fileType,
      source,
      parse_status: "unparsed",
    })
    .select()
    .single();
  if (error) throw error;

  const report = data as DbMatchReport;

  // Best-effort auto-extraction — supported for pdf/csv/txt. Failures here
  // shouldn't block the upload itself, so they're caught and stored as a
  // "failed" parse status rather than thrown.
  try {
    if (["pdf", "csv", "txt"].includes(fileType)) {
      const text = await extractReportText(file, fileType);
      const parsed = parseReportText(text);
      const hasAnything = parsed.goals.length > 0 || parsed.lineup.length > 0 || parsed.substitutions.length > 0;
      return await updateReportParseResult(report.id, hasAnything ? "parsed" : "failed", parsed);
    }
    return await updateReportParseResult(report.id, "failed", null);
  } catch {
    return await updateReportParseResult(report.id, "failed", null);
  }
}

export async function updateReportParseResult(id: string, status: ParseStatus, summary: ParsedReport | null): Promise<DbMatchReport> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("match_reports")
    .update({ parse_status: status, parsed_summary: summary })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbMatchReport;
}

export async function getReportDownloadUrl(filePath: string): Promise<string> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.storage.from("match-reports").createSignedUrl(filePath, 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteMatchReport(id: string, filePath: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  await supabase.storage.from("match-reports").remove([filePath]);
  const { error } = await supabase.from("match_reports").delete().eq("id", id);
  if (error) throw error;
}
