import { supabase } from "./supabase";

export type DbLeagueRow = {
  id: string;
  position: number;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  points: number;
  is_own_club: boolean;
  updated_at: string;
};

export type LeagueRowInput = {
  position: number;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  isOwnClub: boolean;
};

export async function fetchLeagueTable(): Promise<DbLeagueRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("league_table").select("*").order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbLeagueRow[];
}

export async function updateLeagueRow(id: string, input: LeagueRowInput): Promise<DbLeagueRow> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("league_table")
    .update({
      position: input.position,
      team: input.team,
      played: input.played,
      won: input.won,
      drawn: input.drawn,
      lost: input.lost,
      goals_for: input.goalsFor,
      goals_against: input.goalsAgainst,
      points: input.points,
      is_own_club: input.isOwnClub,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbLeagueRow;
}

export async function addLeagueRow(input: LeagueRowInput): Promise<DbLeagueRow> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("league_table")
    .insert({
      position: input.position,
      team: input.team,
      played: input.played,
      won: input.won,
      drawn: input.drawn,
      lost: input.lost,
      goals_for: input.goalsFor,
      goals_against: input.goalsAgainst,
      points: input.points,
      is_own_club: input.isOwnClub,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DbLeagueRow;
}

export async function deleteLeagueRow(id: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("league_table").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Importing a published table
// ---------------------------------------------------------------------------

// Loose name matching, so "AFC Whyteleafe", "A.F.C. Whyteleafe" and
// "Whyteleafe FC" all recognise each other. Published tables abbreviate clubs
// differently from one site to the next, and the club's own name in Settings
// is unlikely to match any of them character for character.
export function normaliseTeam(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.'’]/g, "")
    .replace(/&/g, "and")
    .replace(/\b(afc|fc|football club|town|utd)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Is this row the club's own? Compared both ways round because one name is
// often a prefix of the other ("Whyteleafe" vs "AFC Whyteleafe").
export function isOwnClubName(team: string, clubName: string): boolean {
  const a = normaliseTeam(team);
  const b = normaliseTeam(clubName);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

// Arithmetic that must hold in any league table. Returned as a message rather
// than thrown, because the point is to show it next to the row for a human to
// judge — a genuine points deduction breaks the points rule legitimately, and
// the app has no business overruling that.
export function rowWarning(r: LeagueRowInput): string | null {
  if (r.won + r.drawn + r.lost !== r.played) {
    return `W+D+L is ${r.won + r.drawn + r.lost}, but played says ${r.played}`;
  }
  const expected = r.won * 3 + r.drawn;
  if (r.points !== expected) {
    const diff = r.points - expected;
    return `Points look ${diff > 0 ? `${diff} high` : `${-diff} low`} for ${r.won}W ${r.drawn}D — check for a deduction`;
  }
  return null;
}

// Sort by the standard league criteria, then renumber from 1. Published tables
// are already in order, but a re-read of a blurry screenshot can come back with
// two teams claiming the same position.
export function rankRows(rows: LeagueRowInput[]): LeagueRowInput[] {
  const sorted = [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.team.localeCompare(b.team);
  });
  return sorted.map((r, i) => ({ ...r, position: i + 1 }));
}

// Swap the whole table for a new one, in one go.
//
// The old rows are held onto until the new ones are safely in, and put back if
// the insert fails. Without that, a rejected insert would leave the club with
// no league table at all — a worse outcome than the stale one they started
// with, and one they'd only discover when the Dashboard went blank.
export async function replaceLeagueTable(rows: LeagueRowInput[]): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  if (rows.length === 0) throw new Error("There are no rows to save.");

  const previous = await fetchLeagueTable();

  const { error: delError } = await supabase.from("league_table").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (delError) throw delError;

  const payload = rows.map((r) => ({
    position: r.position,
    team: r.team,
    played: r.played,
    won: r.won,
    drawn: r.drawn,
    lost: r.lost,
    goals_for: r.goalsFor,
    goals_against: r.goalsAgainst,
    points: r.points,
    is_own_club: r.isOwnClub,
  }));

  const { error } = await supabase.from("league_table").insert(payload);
  if (error) {
    if (previous.length > 0) {
      await supabase.from("league_table").insert(
        previous.map((p) => ({
          position: p.position, team: p.team, played: p.played, won: p.won, drawn: p.drawn,
          lost: p.lost, goals_for: p.goals_for, goals_against: p.goals_against,
          points: p.points, is_own_club: p.is_own_club,
        }))
      ).then(() => {}, () => {});
    }
    throw error;
  }
}
