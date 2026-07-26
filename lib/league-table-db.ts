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
