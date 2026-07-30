import { supabase } from "./supabase";

export type Confidence = "low" | "medium" | "high";

export type DbHeadToHead = {
  id: string;
  opponent_name: string;
  played: number | null;
  won: number | null;
  drawn: number | null;
  lost: number | null;
  last_meeting_date: string | null;
  last_meeting_venue: string | null;
  last_meeting_competition: string | null;
  last_meeting_result: string | null;
  confidence: Confidence | null;
  source_note: string | null;
  // Up to six prior meetings and the URLs they came from, so the record can be
  // checked rather than taken on trust.
  recent_meetings: PastMeeting[] | null;
  sources: string[] | null;
  updated_at: string;
};

export type PastMeeting = { date: string; competition: string; venue: string; result: string };

export async function fetchHeadToHead(opponentName: string): Promise<DbHeadToHead | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("opposition_head_to_head")
    .select("*")
    .eq("opponent_name", opponentName)
    .maybeSingle();
  if (error) throw error;
  return (data as DbHeadToHead) ?? null;
}

// Calls the AI + web-search research route, then saves whatever it found
// (or honestly didn't find) as the latest record for this opponent.
export async function refreshHeadToHead(opponentName: string, clubName: string): Promise<DbHeadToHead> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const res = await fetch("/api/opposition-head-to-head", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clubName, opponentName }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Couldn't research this opponent.");

  const { data: row, error } = await supabase
    .from("opposition_head_to_head")
    .upsert(
      {
        opponent_name: opponentName,
        played: data.played ?? null,
        won: data.won ?? null,
        drawn: data.drawn ?? null,
        lost: data.lost ?? null,
        last_meeting_date: data.lastMeeting?.date ?? null,
        last_meeting_venue: data.lastMeeting?.venue ?? null,
        last_meeting_competition: data.lastMeeting?.competition ?? null,
        last_meeting_result: data.lastMeeting?.result ?? null,
        confidence: data.confidence ?? null,
        source_note: data.note ?? null,
        recent_meetings: data.recentMeetings ?? [],
        sources: data.sources ?? [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "opponent_name" }
    )
    .select()
    .single();
  if (error) throw error;
  return row as DbHeadToHead;
}
