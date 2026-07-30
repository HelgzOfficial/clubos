// Pure aggregation helpers for the Analyst Dashboard — turn the season's
// worth of matches / match_stats / match_goals rows into the numbers the
// dashboard tiles show. No fetching here, just math, so these are easy to
// unit-reason-about independent of Supabase.

import type { DbMatch } from "./matches-db";
import type { DbLeagueRow } from "./league-table-db";
import type { DbMatchStats } from "./match-stats-db";
import type { StatUnit } from "./match-stat-defs";
import type { DbGoal } from "./match-details-db";
import { countsForSeasonStats } from "./season";

export type SeasonKpis = {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number;
  points: number;
  leaguePoints: number | null;
};

export function computeSeasonKpis(matches: DbMatch[], ownLeagueRow: DbLeagueRow | null): SeasonKpis {
  // Only this campaign's competitive fixtures — see lib/season.ts. Pre-season
  // friendlies and anything before the season opener are excluded, so these
  // tiles read zero until the first league game is played.
  const completed = matches.filter(
    (m) => m.status === "completed" && m.home_score !== null && m.away_score !== null && countsForSeasonStats(m)
  );
  let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0, cleanSheets = 0;
  for (const m of completed) {
    const gf = m.is_home ? m.home_score! : m.away_score!;
    const ga = m.is_home ? m.away_score! : m.home_score!;
    goalsFor += gf;
    goalsAgainst += ga;
    if (ga === 0) cleanSheets++;
    if (gf > ga) wins++;
    else if (gf < ga) losses++;
    else draws++;
  }
  return {
    played: completed.length, wins, draws, losses, goalsFor, goalsAgainst, cleanSheets,
    points: wins * 3 + draws,
    leaguePoints: ownLeagueRow?.points ?? null,
  };
}

export type AggregatedStatRow = { key: string; label: string; unit: StatUnit; us: number | null; opponent: number | null; matchesCounted: number };
export type AggregatedStatCategory = { key: string; label: string; description: string; rows: AggregatedStatRow[] };

// Season-average (not season-total) for every field that's been recorded on
// at least one match — averaging rather than summing, since these are all
// per-90 style figures (possession %, shots, etc.) where a total across a
// growing number of matches wouldn't mean much on its own.
export function aggregateSeasonStats(allStats: DbMatchStats[]): AggregatedStatCategory[] {
  const catMap = new Map<string, { label: string; description: string; rows: Map<string, { label: string; unit: StatUnit; usSum: number; usCount: number; oppSum: number; oppCount: number }> }>();

  for (const ms of allStats) {
    for (const cat of ms.categories ?? []) {
      if (!catMap.has(cat.key)) catMap.set(cat.key, { label: cat.label, description: cat.description, rows: new Map() });
      const rows = catMap.get(cat.key)!.rows;
      for (const row of cat.detail) {
        if (!rows.has(row.key)) rows.set(row.key, { label: row.label, unit: row.unit, usSum: 0, usCount: 0, oppSum: 0, oppCount: 0 });
        const r = rows.get(row.key)!;
        if (row.us !== null) { r.usSum += row.us; r.usCount += 1; }
        if (row.opponent !== null) { r.oppSum += row.opponent; r.oppCount += 1; }
      }
    }
  }

  const result: AggregatedStatCategory[] = [];
  for (const [catKey, cat] of catMap) {
    const rows: AggregatedStatRow[] = [];
    for (const [rowKey, r] of cat.rows) {
      rows.push({
        key: rowKey,
        label: r.label,
        unit: r.unit,
        us: r.usCount ? Math.round((r.usSum / r.usCount) * 10) / 10 : null,
        opponent: r.oppCount ? Math.round((r.oppSum / r.oppCount) * 10) / 10 : null,
        matchesCounted: Math.max(r.usCount, r.oppCount),
      });
    }
    result.push({ key: catKey, label: cat.label, description: cat.description, rows });
  }
  return result;
}

export type TimelineBucket = { label: string; scored: number; conceded: number };
const BUCKET_EDGES: [number, number, string][] = [
  [0, 15, "0-15"], [16, 30, "16-30"], [31, 45, "31-45"], [46, 60, "46-60"], [61, 75, "61-75"], [76, 200, "76-90+"],
];

export function goalsTimeline(goals: DbGoal[]): TimelineBucket[] {
  return BUCKET_EDGES.map(([lo, hi, label]) => {
    const inRange = goals.filter((g) => g.minute !== null && g.minute >= lo && g.minute <= hi);
    return { label, scored: inRange.filter((g) => g.team === "us").length, conceded: inRange.filter((g) => g.team === "opponent").length };
  });
}

export type LeaderboardEntry = { name: string; count: number };

// Counts how many times each name appears as a scorer (or assister) among
// goals we scored — opponent goals aren't attributed to our players, so
// those are excluded from both leaderboards.
export function topScorers(goals: DbGoal[], limit = 5): LeaderboardEntry[] {
  return countBy(goals.filter((g) => g.team === "us").map((g) => g.scorer)).slice(0, limit);
}

export function topAssists(goals: DbGoal[], limit = 5): LeaderboardEntry[] {
  return countBy(
    goals.filter((g) => g.team === "us" && g.assist).map((g) => g.assist as string)
  ).slice(0, limit);
}

function countBy(names: string[]): LeaderboardEntry[] {
  const counts = new Map<string, number>();
  for (const n of names) {
    const clean = n.trim();
    if (!clean) continue;
    counts.set(clean, (counts.get(clean) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}
