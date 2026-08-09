import { supabase } from "./supabase";

// Which columns a club has chosen not to see.
//
// This exists because the app has two different kinds of metric and only one of
// them was ever removable. Player Stats metrics are rows a club creates and can
// delete. The GPS metrics are a fixed set written into the app — every club
// gets the same nine, whether or not their kit records all of them, and a club
// with no power-score sensor was stuck looking at an empty column forever.
//
// Hiding rather than deleting is deliberate for GPS. The numbers keep being
// imported and stored, so switching a column back on brings its history with
// it. Nothing is destroyed by tidying a table.
//
// Stored in the database rather than the browser so the choice holds for
// everyone at the club and on every device, the same as the club's colours.

export type MetricScope = "gps" | "stat";

export type HiddenMetrics = {
  has: (scope: MetricScope, key: string) => boolean;
  keys: string[];
};

function makeSet(rows: { scope: string; metric_key: string }[]): HiddenMetrics {
  const set = new Set(rows.map((r) => `${r.scope}:${r.metric_key}`));
  return {
    has: (scope, key) => set.has(`${scope}:${key}`),
    keys: [...set],
  };
}

export const NO_HIDDEN: HiddenMetrics = { has: () => false, keys: [] };

export async function fetchHiddenMetrics(): Promise<HiddenMetrics> {
  if (!supabase) return NO_HIDDEN;
  const { data, error } = await supabase.from("hidden_metrics").select("scope, metric_key");
  // A club that hasn't run the setup SQL yet simply has nothing hidden — that's
  // a working state, not an error worth interrupting a page load for.
  if (error) return NO_HIDDEN;
  return makeSet((data ?? []) as { scope: string; metric_key: string }[]);
}

export async function setMetricHidden(scope: MetricScope, key: string, hidden: boolean): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");

  if (hidden) {
    const { error } = await supabase
      .from("hidden_metrics")
      .upsert({ scope, metric_key: key }, { onConflict: "scope,metric_key" });
    if (error) throw error;
    return;
  }

  // Counted, not assumed. Without a delete policy on the table Postgres removes
  // nothing and reports success, so a column would refuse to come back with
  // nothing on screen explaining why.
  const { error, count } = await supabase
    .from("hidden_metrics")
    .delete({ count: "exact" })
    .eq("scope", scope)
    .eq("metric_key", key);
  if (error) throw error;
  if (!count) {
    throw new Error(
      "The database wouldn't remove that setting, so the column can't be shown again. " +
      "Run supabase-hidden-metrics.sql in Supabase and try again."
    );
  }
}

// Filters any list of metrics down to the ones still meant to be seen.
export function visibleMetrics<T extends { key: string }>(
  metrics: T[],
  hidden: HiddenMetrics,
  scope: MetricScope
): T[] {
  return metrics.filter((m) => !hidden.has(scope, m.key));
}
