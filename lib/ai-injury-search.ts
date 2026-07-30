import { supabase } from "./supabase";

export type DbAiSearchLog = {
  id: string;
  player_id: string | null;
  query: string;
  answer: string;
  created_at: string;
};

export async function askInjuryAi(query: string, playerId: string | null): Promise<{ answer?: string; error?: string }> {
  try {
    const res = await fetch("/api/ai-injury-search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, playerId }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "The AI search failed." };
    return { answer: data.answer };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "The AI search failed." };
  }
}

export async function fetchAiSearchLogs(): Promise<DbAiSearchLog[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("ai_search_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) throw error;
  return (data ?? []) as DbAiSearchLog[];
}
