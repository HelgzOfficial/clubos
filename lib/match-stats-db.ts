import { supabase } from "./supabase";
import { STAT_FIELDS, buildCategories, type StatCategory } from "./match-stat-defs";

export type DbMatchStats = {
  id: string;
  match_id: string;
  source_report_id: string | null;
  categories: StatCategory[];
  updated_at: string;
};

export async function fetchMatchStats(matchId: string): Promise<DbMatchStats | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("match_stats").select("*").eq("match_id", matchId).maybeSingle();
  if (error) throw error;
  return (data as DbMatchStats) ?? null;
}

export async function upsertMatchStats(matchId: string, categories: StatCategory[], sourceReportId: string | null): Promise<DbMatchStats> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("match_stats")
    .upsert(
      { match_id: matchId, source_report_id: sourceReportId, categories, updated_at: new Date().toISOString() },
      { onConflict: "match_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as DbMatchStats;
}

// Flattens saved categories back into { [fieldKey]: {us, opponent} } so the
// manual "Edit stats" form can pre-fill with whatever's already on file.
export function flattenCategories(categories: StatCategory[]): Record<string, { us: number | null; opponent: number | null }> {
  const values: Record<string, { us: number | null; opponent: number | null }> = {};
  for (const cat of categories) {
    for (const row of cat.detail) {
      values[row.key] = { us: row.us, opponent: row.opponent };
    }
  }
  return values;
}

export async function saveManualStats(matchId: string, values: Record<string, { us: number | null; opponent: number | null }>): Promise<DbMatchStats> {
  const categories = buildCategories(values);
  return upsertMatchStats(matchId, categories, null);
}

export { STAT_FIELDS };
