import { supabase } from "./supabase";

// A metric is whatever the analyst decides to record per player per match.
// The list is data, not code, so adding "Progressive Carries" is a form entry
// rather than a schema change — values live in player_match_stats.values keyed
// by `key`.
export type StatMetric = {
  id: string;
  key: string;
  label: string;
  unit: string | null;
  category: string;
  higher_is_better: boolean;
  decimals: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type StatMetricInput = {
  key: string;
  label: string;
  unit: string;
  category: string;
  higherIsBetter: boolean;
  decimals: number;
  sortOrder: number;
};

export const METRIC_CATEGORIES = ["gps", "technical", "physical", "other"] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  gps: "GPS / Physical Load",
  technical: "Technical",
  physical: "Physical",
  other: "Other",
};

// Turns a human label into a stable machine key ("Top Speed" -> "top_speed").
export function slugifyMetricKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export async function fetchStatMetrics(includeInactive = false): Promise<StatMetric[]> {
  if (!supabase) return [];
  let query = supabase.from("stat_metrics").select("*").order("sort_order", { ascending: true });
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as StatMetric[];
}

export async function createStatMetric(input: StatMetricInput): Promise<StatMetric> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("stat_metrics")
    .insert({
      key: input.key,
      label: input.label,
      unit: input.unit || null,
      category: input.category,
      higher_is_better: input.higherIsBetter,
      decimals: input.decimals,
      sort_order: input.sortOrder,
    })
    .select()
    .single();
  if (error) throw error;
  return data as StatMetric;
}

export async function updateStatMetric(id: string, patch: Partial<StatMetricInput> & { isActive?: boolean }): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const row: Record<string, unknown> = {};
  if (patch.label !== undefined) row.label = patch.label;
  if (patch.unit !== undefined) row.unit = patch.unit || null;
  if (patch.category !== undefined) row.category = patch.category;
  if (patch.higherIsBetter !== undefined) row.higher_is_better = patch.higherIsBetter;
  if (patch.decimals !== undefined) row.decimals = patch.decimals;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  const { error } = await supabase.from("stat_metrics").update(row).eq("id", id);
  if (error) throw error;
}

// Deliberately soft-deletes by default (is_active = false) rather than hard
// deleting: recorded values stay keyed by this metric in past matches, so
// removing the definition outright would orphan real data. Hard delete is
// available for a metric added by mistake that has no data behind it.
export async function deactivateStatMetric(id: string): Promise<void> {
  await updateStatMetric(id, { isActive: false });
}

export async function deleteStatMetric(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("stat_metrics").delete().eq("id", id);
  if (error) throw error;
}

export function formatMetricValue(value: number | null | undefined, metric: StatMetric): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return value.toFixed(metric.decimals);
}
