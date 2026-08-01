import { supabase } from "./supabase";

export type MatchStatus = "scheduled" | "postponed" | "completed" | "cancelled";

export type DbMatch = {
  id: string;
  source_uid: string | null;
  kickoff: string;
  opponent: string;
  is_home: boolean;
  competition: string;
  venue: string | null;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  notes: string | null;
  source_url: string | null;
  created_at: string;
  updated_at: string;
};

export type MatchInput = {
  kickoff: string;
  opponent: string;
  isHome: boolean;
  competition: string;
  venue: string;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  notes: string;
};

export async function fetchMatches(): Promise<DbMatch[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("matches").select("*").order("kickoff", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchMatch(id: string): Promise<DbMatch | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("matches").select("*").eq("id", id).single();
  if (error) return null;
  return data;
}

export async function createMatch(input: Omit<MatchInput, "status" | "homeScore" | "awayScore" | "notes">) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("matches")
    .insert({
      kickoff: input.kickoff,
      opponent: input.opponent,
      is_home: input.isHome,
      competition: input.competition,
      venue: input.venue || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DbMatch;
}

export async function updateMatch(id: string, input: Partial<MatchInput>) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.kickoff !== undefined) patch.kickoff = input.kickoff;
  if (input.opponent !== undefined) patch.opponent = input.opponent;
  if (input.isHome !== undefined) patch.is_home = input.isHome;
  if (input.competition !== undefined) patch.competition = input.competition;
  if (input.venue !== undefined) patch.venue = input.venue || null;
  if (input.status !== undefined) patch.status = input.status;
  if (input.homeScore !== undefined) patch.home_score = input.homeScore;
  if (input.awayScore !== undefined) patch.away_score = input.awayScore;
  if (input.notes !== undefined) patch.notes = input.notes || null;

  const { data, error } = await supabase.from("matches").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as DbMatch;
}

export async function deleteMatch(id: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("matches").delete().eq("id", id);
  if (error) throw error;
}

// Every table that hangs off a fixture. Listed explicitly rather than relying
// on database cascades, because these tables were added over months and not
// all of them were created with ON DELETE CASCADE — which means a plain
// delete either fails on a foreign key or, worse, succeeds and leaves goals
// and stats pointing at a fixture that no longer exists. Those orphans then
// quietly skew every average in the app.
//
// Tables missing here would be the bug, so any new fixture-linked table needs
// adding to this list.
const MATCH_CHILD_TABLES = [
  "match_lineup",          // the XI shown in Match Centre
  "match_lineups",         // the manager's saved selection
  "match_goals",
  "match_substitutions",
  "match_stats",
  "player_match_stats",
  "match_availability",
  "match_documents",
  "match_document_views",
  "match_reports",
  "match_photos",
  "match_packs",
] as const;

export type DeleteMatchResult = {
  removed: Record<string, number>;
  total: number;
  // Tables that don't exist in this project yet — not an error, just SQL that
  // hasn't been run.
  skipped: string[];
};

// Removes a fixture and everything recorded against it. Returns what went, so
// the confirmation can say "48 rows" rather than leaving someone wondering
// whether it worked.
export async function deleteMatchCompletely(id: string): Promise<DeleteMatchResult> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const removed: Record<string, number> = {};
  const skipped: string[] = [];
  let total = 0;

  for (const table of MATCH_CHILD_TABLES) {
    const { count, error } = await supabase
      .from(table)
      .delete({ count: "exact" })
      .eq("match_id", id);

    if (error) {
      // A table that was never created isn't a failure — the club simply
      // hasn't run that SQL. Anything else is real and should stop us, since
      // half-deleting a fixture is worse than not deleting it.
      if (/relation|does not exist|schema cache|column/i.test(error.message)) {
        skipped.push(table);
        continue;
      }
      throw new Error(`Couldn't clear ${table}: ${error.message}`);
    }
    if (count && count > 0) {
      removed[table] = count;
      total += count;
    }
  }

  // Clips are linked but nullable — a highlight might be worth keeping even
  // once the fixture record has gone, so they're unlinked rather than binned.
  const { error: clipError } = await supabase.from("clips").update({ match_id: null }).eq("match_id", id);
  if (clipError && !/relation|does not exist|schema cache/i.test(clipError.message)) {
    throw new Error(`Couldn't unlink clips: ${clipError.message}`);
  }

  const { error } = await supabase.from("matches").delete().eq("id", id);
  if (error) throw error;

  return { removed, total, skipped };
}

export async function triggerFixtureSync(): Promise<{ synced?: number; error?: string }> {
  try {
    const res = await fetch("/api/sync-fixtures", { method: "POST" });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "Sync failed." };
    return { synced: data.synced };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Sync failed." };
  }
}

// ---------------------------------------------------------------------------
// Played / upcoming
//
// One definition of "this game has happened", shared by the Match Centre's
// Results tab, the match-photos fixture picker and anything else that needs
// it. Kept here rather than repeated at each call site so the lists can't
// drift apart — which is exactly what "sync the photos dropdown with the
// results tab" means in practice.
//
// A game counts as played once its kick-off has passed. Deliberately NOT
// `status === "completed"`: fixtures routinely sit in the past still marked
// 'scheduled', or get a score without anyone changing the status, so the
// stricter test hides real results. Cancelled and postponed games are excluded
// — they didn't happen, so they belong in neither list.
// ---------------------------------------------------------------------------
export function playedMatches(matches: DbMatch[], now = Date.now()): DbMatch[] {
  return matches
    .filter((m) => new Date(m.kickoff).getTime() < now && m.status !== "cancelled" && m.status !== "postponed")
    .sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());
}

export function upcomingMatches(matches: DbMatch[], now = Date.now()): DbMatch[] {
  return matches
    .filter((m) => new Date(m.kickoff).getTime() >= now && m.status !== "cancelled")
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
}
