import { supabase } from "./supabase";

export type DbLineupEntry = {
  id: string;
  match_id: string;
  is_starting: boolean;
  shirt_number: number | null;
  player_name: string;
  position: string | null;
  sort_order: number;
};

export type DbGoal = {
  id: string;
  match_id: string;
  minute: number | null;
  team: "us" | "opponent";
  scorer: string;
  assist: string | null;
};

export type DbSubstitution = {
  id: string;
  match_id: string;
  minute: number | null;
  player_off: string;
  player_on: string;
};

export async function fetchMatchDetails(matchId: string) {
  if (!supabase) return { lineup: [], goals: [], substitutions: [] };
  const [lineup, goals, subs] = await Promise.all([
    supabase.from("match_lineup").select("*").eq("match_id", matchId).order("sort_order", { ascending: true }),
    supabase.from("match_goals").select("*").eq("match_id", matchId).order("minute", { ascending: true }),
    supabase.from("match_substitutions").select("*").eq("match_id", matchId).order("minute", { ascending: true }),
  ]);
  if (lineup.error) throw lineup.error;
  if (goals.error) throw goals.error;
  if (subs.error) throw subs.error;
  return {
    lineup: (lineup.data ?? []) as DbLineupEntry[],
    goals: (goals.data ?? []) as DbGoal[],
    substitutions: (subs.data ?? []) as DbSubstitution[],
  };
}

export async function addLineupEntry(matchId: string, input: { isStarting: boolean; shirtNumber: string; playerName: string; position: string; sortOrder: number }) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("match_lineup").insert({
    match_id: matchId,
    is_starting: input.isStarting,
    shirt_number: input.shirtNumber ? Number(input.shirtNumber) : null,
    player_name: input.playerName,
    position: input.position || null,
    sort_order: input.sortOrder,
  });
  if (error) throw error;
}

export async function deleteLineupEntry(id: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("match_lineup").delete().eq("id", id);
  if (error) throw error;
}

export async function addGoal(matchId: string, input: { minute: string; team: "us" | "opponent"; scorer: string; assist: string }) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("match_goals").insert({
    match_id: matchId,
    minute: input.minute ? Number(input.minute) : null,
    team: input.team,
    scorer: input.scorer,
    assist: input.assist || null,
  });
  if (error) throw error;
}

export async function deleteGoal(id: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("match_goals").delete().eq("id", id);
  if (error) throw error;
}

export async function addSubstitution(matchId: string, input: { minute: string; playerOff: string; playerOn: string }) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("match_substitutions").insert({
    match_id: matchId,
    minute: input.minute ? Number(input.minute) : null,
    player_off: input.playerOff,
    player_on: input.playerOn,
  });
  if (error) throw error;
}

export async function deleteSubstitution(id: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("match_substitutions").delete().eq("id", id);
  if (error) throw error;
}
