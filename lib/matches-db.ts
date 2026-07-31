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
