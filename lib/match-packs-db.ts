import { supabase } from "./supabase";

export type MatchPackItem =
  | { type: "clip"; clipId: string; caption: string }
  | { type: "image"; imageId: string; caption: string };

export type DbMatchPack = {
  id: string;
  match_id: string | null;
  title: string;
  notes: string | null;
  items: MatchPackItem[];
  created_at: string;
  updated_at: string;
};

export async function fetchMatchPacks(): Promise<DbMatchPack[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("match_packs").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbMatchPack[];
}

export async function fetchMatchPack(id: string): Promise<DbMatchPack | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("match_packs").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as DbMatchPack) ?? null;
}

export async function createMatchPack(input: { matchId: string | null; title: string }): Promise<DbMatchPack> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("match_packs")
    .insert({ match_id: input.matchId, title: input.title, notes: "", items: [] })
    .select()
    .single();
  if (error) throw error;
  return data as DbMatchPack;
}

export async function updateMatchPack(id: string, patch: { title?: string; notes?: string; items?: MatchPackItem[] }): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase
    .from("match_packs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteMatchPack(id: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("match_packs").delete().eq("id", id);
  if (error) throw error;
}
