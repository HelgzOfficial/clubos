import { supabase } from "./supabase";
import { fetchPlayers, updatePlayerStats, type DbPlayer, type PlayerSeasonStats } from "./players-db";
import { competitionKind } from "./competition-kind";

// Recomputes every player's season stats (appearances, goals, assists, clean
// sheets) from real match data — lineups and goals logged against league/cup
// fixtures only (friendlies never count, matching the club's own rule for
// season stats). This is a full recompute rather than an incremental patch,
// so it's safe to call after any single change (a report import, a manually
// added goal, a result being entered) without risking double-counting.

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function lastNameOf(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1]?.toLowerCase() ?? "";
}

// Match sheet / goal-scorer text is often abbreviated ("A. Goode") while our
// player records store full names ("Aaron Goode") — match on exact name
// first, then fall back to a unique last-name match.
function findPlayer(players: DbPlayer[], rawName: string): DbPlayer | undefined {
  const exact = players.find((p) => normalize(p.name) === normalize(rawName));
  if (exact) return exact;
  const last = lastNameOf(rawName);
  if (!last) return undefined;
  const candidates = players.filter((p) => lastNameOf(p.name) === last);
  return candidates.length === 1 ? candidates[0] : undefined;
}

export type SyncResult = { updatedPlayers: number; matchesCounted: number; matchesSkipped: number };

export async function syncPlayerStatsFromMatches(): Promise<SyncResult> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const players = await fetchPlayers();
  const { data: matches, error: matchesError } = await supabase.from("matches").select("*").eq("status", "completed");
  if (matchesError) throw matchesError;

  const qualifying = (matches ?? []).filter((m) => competitionKind(m.competition) !== "friendly");

  const totals = new Map<string, PlayerSeasonStats>();
  for (const p of players) totals.set(p.id, { appearances: 0, goals: 0, assists: 0, cleanSheets: 0 });

  let skipped = 0;

  for (const m of qualifying) {
    const [lineupRes, goalsRes] = await Promise.all([
      supabase.from("match_lineup").select("player_name").eq("match_id", m.id),
      supabase.from("match_goals").select("team, scorer, assist").eq("match_id", m.id),
    ]);
    if (lineupRes.error || goalsRes.error) {
      skipped++;
      continue;
    }
    const lineup = lineupRes.data ?? [];
    const goals = goalsRes.data ?? [];
    if (lineup.length === 0 && goals.length === 0) {
      skipped++;
      continue;
    }

    const oppScore = m.is_home ? m.away_score : m.home_score;
    const isCleanSheet = oppScore === 0;

    for (const entry of lineup) {
      const player = findPlayer(players, entry.player_name);
      if (!player) continue;
      const t = totals.get(player.id)!;
      t.appearances += 1;
      if (isCleanSheet && (player.position_group === "GK" || player.position_group === "DEF")) {
        t.cleanSheets += 1;
      }
    }

    for (const g of goals) {
      if (g.team !== "us") continue;
      const scorer = findPlayer(players, g.scorer);
      if (scorer) totals.get(scorer.id)!.goals += 1;
      if (g.assist) {
        const assister = findPlayer(players, g.assist);
        if (assister) totals.get(assister.id)!.assists += 1;
      }
    }
  }

  let updated = 0;
  for (const [playerId, stats] of totals) {
    await updatePlayerStats(playerId, stats);
    updated++;
  }

  return { updatedPlayers: updated, matchesCounted: qualifying.length - skipped, matchesSkipped: skipped };
}
