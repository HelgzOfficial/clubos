import { supabase } from "./supabase";
import { countsForSeasonStats } from "./season";
import type { DbMatch } from "./matches-db";

export type StatValues = Record<string, number>;

export type DbPlayerMatchStats = {
  id: string;
  match_id: string;
  player_id: string;
  values: StatValues;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DbOpponentPlayerStats = {
  id: string;
  opponent_name: string;
  player_name: string;
  position: string | null;
  match_id: string | null;
  values: StatValues;
  created_at: string;
  updated_at: string;
};

// Season aggregates for one player across one metric.
export type MetricAggregate = {
  total: number;
  average: number;
  best: number;
  worst: number;
  games: number;
};

export type PlayerSeasonAggregate = {
  playerId: string;
  games: number;
  byMetric: Record<string, MetricAggregate>;
};

// A fixture only counts toward season figures if it's competitive AND on or
// after the season opener. Friendlies and pre-season were already excluded;
// the date half is new and comes from lib/season.ts. Kept under the original
// name so every existing call site still reads correctly.
export function isCompetitive(match: Pick<DbMatch, "competition" | "kickoff">): boolean {
  return countsForSeasonStats(match);
}

export async function fetchAllPlayerMatchStats(): Promise<DbPlayerMatchStats[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("player_match_stats").select("*");
  if (error) throw error;
  return (data ?? []) as DbPlayerMatchStats[];
}

export async function fetchStatsForMatch(matchId: string): Promise<DbPlayerMatchStats[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("player_match_stats").select("*").eq("match_id", matchId);
  if (error) throw error;
  return (data ?? []) as DbPlayerMatchStats[];
}

export async function fetchStatsForPlayer(playerId: string): Promise<DbPlayerMatchStats[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("player_match_stats")
    .select("*")
    .eq("player_id", playerId);
  if (error) throw error;
  return (data ?? []) as DbPlayerMatchStats[];
}

// One row per player per match, so saving is an upsert on that pair — entering
// a player's line twice corrects it rather than duplicating it.
export async function savePlayerMatchStats(input: {
  matchId: string;
  playerId: string;
  values: StatValues;
  notes?: string;
}): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("player_match_stats").upsert(
    {
      match_id: input.matchId,
      player_id: input.playerId,
      values: input.values,
      notes: input.notes || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "match_id,player_id" }
  );
  if (error) throw error;
}

export async function deletePlayerMatchStats(matchId: string, playerId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase
    .from("player_match_stats")
    .delete()
    .eq("match_id", matchId)
    .eq("player_id", playerId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Season aggregation
// ---------------------------------------------------------------------------

// Totals, averages, best and worst per metric, computed live from the raw
// per-match rows rather than stored anywhere. That keeps one source of truth:
// correcting a single match's numbers immediately corrects every season figure
// and ranking, with no recalculation step to remember to run.
export function aggregateSeason(
  rows: DbPlayerMatchStats[],
  matches: DbMatch[],
  opts: { competitiveOnly?: boolean } = {}
): Map<string, PlayerSeasonAggregate> {
  const competitiveOnly = opts.competitiveOnly ?? true;
  const matchById = new Map(matches.map((m) => [m.id, m]));
  const out = new Map<string, PlayerSeasonAggregate>();

  for (const row of rows) {
    const match = matchById.get(row.match_id);
    if (!match) continue;
    if (competitiveOnly && !isCompetitive(match)) continue;

    let agg = out.get(row.player_id);
    if (!agg) {
      agg = { playerId: row.player_id, games: 0, byMetric: {} };
      out.set(row.player_id, agg);
    }
    agg.games += 1;

    for (const [key, raw] of Object.entries(row.values ?? {})) {
      const value = Number(raw);
      if (!Number.isFinite(value)) continue;
      const m = agg.byMetric[key];
      if (!m) {
        agg.byMetric[key] = { total: value, average: value, best: value, worst: value, games: 1 };
      } else {
        m.total += value;
        m.games += 1;
        m.best = Math.max(m.best, value);
        m.worst = Math.min(m.worst, value);
        m.average = m.total / m.games;
      }
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Rankings
// ---------------------------------------------------------------------------

export type RankingRow = {
  playerId: string;
  value: number;
  games: number;
  rank: number;
};

// Orders players by one metric, on either their season total or per-game
// average. `higherIsBetter` flips the direction so a "fewest turnovers" metric
// ranks correctly rather than rewarding the worst offender.
export function rankByMetric(
  aggregates: Map<string, PlayerSeasonAggregate>,
  metricKey: string,
  mode: "total" | "average",
  higherIsBetter: boolean
): RankingRow[] {
  const rows: Omit<RankingRow, "rank">[] = [];
  for (const agg of aggregates.values()) {
    const m = agg.byMetric[metricKey];
    if (!m) continue;
    rows.push({ playerId: agg.playerId, value: mode === "total" ? m.total : m.average, games: m.games });
  }
  rows.sort((a, b) => (higherIsBetter ? b.value - a.value : a.value - b.value));
  // Equal values share a rank (1,2,2,4) rather than being ordered arbitrarily.
  let lastValue: number | null = null;
  let lastRank = 0;
  return rows.map((r, i) => {
    const rank = lastValue !== null && r.value === lastValue ? lastRank : i + 1;
    lastValue = r.value;
    lastRank = rank;
    return { ...r, rank };
  });
}

// An overall standing across every metric at once: each player is scored 0–100
// per metric relative to the best and worst in the squad, then those scores are
// averaged. Percentile-style rather than summing raw numbers, because distance
// in km and pass counts aren't on comparable scales — adding them directly
// would let whichever metric happens to have the largest numbers dominate.
export type OverallRanking = {
  playerId: string;
  score: number;
  games: number;
  metricsCounted: number;
};

export function rankOverall(
  aggregates: Map<string, PlayerSeasonAggregate>,
  metrics: { key: string; higher_is_better: boolean }[],
  mode: "total" | "average" = "average"
): OverallRanking[] {
  const players = [...aggregates.values()];
  if (players.length === 0) return [];

  const scores = new Map<string, { sum: number; count: number }>();

  for (const metric of metrics) {
    const values: { playerId: string; value: number }[] = [];
    for (const agg of players) {
      const m = agg.byMetric[metric.key];
      if (!m) continue;
      values.push({ playerId: agg.playerId, value: mode === "total" ? m.total : m.average });
    }
    if (values.length < 2) continue; // nothing meaningful to scale against

    const nums = values.map((v) => v.value);
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const span = max - min;

    for (const { playerId, value } of values) {
      // Everyone level on this metric scores full marks rather than dividing by zero.
      const normalised = span === 0 ? 100 : ((value - min) / span) * 100;
      const score = metric.higher_is_better ? normalised : 100 - normalised;
      const entry = scores.get(playerId) ?? { sum: 0, count: 0 };
      entry.sum += score;
      entry.count += 1;
      scores.set(playerId, entry);
    }
  }

  return [...scores.entries()]
    .map(([playerId, { sum, count }]) => ({
      playerId,
      score: count === 0 ? 0 : sum / count,
      games: aggregates.get(playerId)?.games ?? 0,
      metricsCounted: count,
    }))
    .sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Opponent players (for comparison)
// ---------------------------------------------------------------------------

export async function fetchOpponentPlayerStats(opponentName?: string): Promise<DbOpponentPlayerStats[]> {
  if (!supabase) return [];
  let query = supabase.from("opponent_player_stats").select("*").order("created_at", { ascending: false });
  if (opponentName) query = query.eq("opponent_name", opponentName);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as DbOpponentPlayerStats[];
}

export async function saveOpponentPlayerStats(input: {
  id?: string;
  opponentName: string;
  playerName: string;
  position?: string;
  matchId?: string | null;
  values: StatValues;
}): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const row = {
    opponent_name: input.opponentName.trim(),
    player_name: input.playerName.trim(),
    position: input.position?.trim() || null,
    match_id: input.matchId || null,
    values: input.values,
    updated_at: new Date().toISOString(),
  };
  const { error } = input.id
    ? await supabase.from("opponent_player_stats").update(row).eq("id", input.id)
    : await supabase.from("opponent_player_stats").insert(row);
  if (error) throw error;
}

export async function deleteOpponentPlayerStats(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("opponent_player_stats").delete().eq("id", id);
  if (error) throw error;
}

// Averages an opponent player's recorded appearances so they sit on the same
// per-game footing as our own players in the comparison view.
export function averageOpponentValues(rows: DbOpponentPlayerStats[]): StatValues {
  const totals: Record<string, { sum: number; count: number }> = {};
  for (const row of rows) {
    for (const [key, raw] of Object.entries(row.values ?? {})) {
      const value = Number(raw);
      if (!Number.isFinite(value)) continue;
      const t = totals[key] ?? { sum: 0, count: 0 };
      t.sum += value;
      t.count += 1;
      totals[key] = t;
    }
  }
  const out: StatValues = {};
  for (const [key, { sum, count }] of Object.entries(totals)) out[key] = sum / count;
  return out;
}

// ---------------------------------------------------------------------------
// Removing a metric's recorded readings
// ---------------------------------------------------------------------------

// How many readings exist for one metric. Shown before deleting it, so the
// choice is made knowing what's at stake rather than guessing.
export function countMetricValues(rows: DbPlayerMatchStats[], key: string): number {
  let n = 0;
  for (const r of rows) {
    const v = r.values?.[key];
    if (typeof v === "number" && Number.isFinite(v)) n += 1;
  }
  return n;
}

// Strips one metric's readings out of every stat row.
//
// Values are stored in a jsonb column keyed by metric, so deleting the metric
// definition alone leaves its numbers sitting in the database, invisible. That
// matters for a reason that isn't obvious: create a metric with the same name
// again months later and it derives the same key, and all the old readings
// reappear as if they'd been entered against the new metric. This is what makes
// "delete" able to mean delete.
//
// Both tables that store readings are swept, not just our own players': the
// opposition scouting rows use the same metric keys, so clearing one and not
// the other would leave the metric half-deleted and able to come back.
//
// Rewrites only the rows that actually carry the key, and returns how many were
// changed so the result can be reported rather than assumed.
const VALUE_TABLES = ["player_match_stats", "opponent_player_stats"] as const;

export async function purgeMetricValues(key: string): Promise<number> {
  if (!supabase) throw new Error("Supabase is not configured.");

  let changed = 0;

  for (const table of VALUE_TABLES) {
    const { data, error } = await supabase.from(table).select("id, values");
    if (error) {
      // A table this project hasn't created yet isn't a failure — it simply
      // holds no readings to clear.
      if (/relation|does not exist|schema cache/i.test(error.message)) continue;
      throw error;
    }

    const affected = (data ?? []).filter(
      (r: { values: StatValues | null }) => r.values != null && Object.prototype.hasOwnProperty.call(r.values, key)
    ) as { id: string; values: StatValues }[];

    for (const row of affected) {
      const next: StatValues = { ...row.values };
      delete next[key];
      const { error: upError } = await supabase.from(table).update({ values: next }).eq("id", row.id);
      if (upError) throw upError;
    }

    changed += affected.length;
  }

  return changed;
}
