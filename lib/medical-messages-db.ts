import { supabase } from "./supabase";
import { notifyByPush } from "./push-client";

export type MedicalMessage = {
  id: string;
  player_id: string;
  sender_role: "doctor" | "player";
  sender_name: string;
  sender_email: string | null;
  body: string;
  created_at: string;
  read_by_player: boolean;
  read_by_doctor: boolean;
};

export async function fetchMessages(playerId: string): Promise<MedicalMessage[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("medical_messages")
    .select("*")
    .eq("player_id", playerId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MedicalMessage[];
}

export async function sendMessage(input: {
  playerId: string;
  senderRole: "doctor" | "player";
  senderName: string;
  senderEmail: string | null;
  body: string;
}): Promise<MedicalMessage> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("medical_messages")
    .insert({
      player_id: input.playerId,
      sender_role: input.senderRole,
      sender_name: input.senderName,
      sender_email: input.senderEmail,
      body: input.body,
      read_by_player: input.senderRole === "player",
      read_by_doctor: input.senderRole === "doctor",
    })
    .select()
    .single();
  if (error) throw error;

  // Tell the other side's devices. Fire-and-forget by design: a push failure
  // must never stop a message being sent, and the in-app badge is unaffected
  // either way.
  const message = data as MedicalMessage;
  if (input.senderRole === "player") {
    void notifyByPush({
      targetRole: "doctor_physio",
      title: `New message from ${input.senderName}`,
      body: input.body.slice(0, 140),
      url: "/medical",
      tag: `medical-${input.playerId}`,
    });
  } else {
    // A reply from the medical team goes to that player's own devices.
    void notifyByPush({
      playerId: input.playerId,
      title: "Message from the medical team",
      body: input.body.slice(0, 140),
      url: "/portal",
      tag: `medical-${input.playerId}`,
    });
  }
  return message;
}

// Marks every message in a thread as read by whichever side is currently
// looking at it, so unread badges clear once the thread's actually opened.
export async function markThreadRead(playerId: string, forRole: "doctor" | "player"): Promise<void> {
  if (!supabase) return;
  const column = forRole === "doctor" ? "read_by_doctor" : "read_by_player";
  await supabase
    .from("medical_messages")
    .update({ [column]: true })
    .eq("player_id", playerId)
    .eq(column, false);
}

// Used by the Medical module to show an unread badge per player without
// opening every thread — one query, grouped client-side since Supabase's
// query builder doesn't have a simple GROUP BY count-where helper.
export async function fetchUnreadCountsForDoctor(): Promise<Record<string, number>> {
  if (!supabase) return {};
  const { data, error } = await supabase
    .from("medical_messages")
    .select("player_id")
    .eq("read_by_doctor", false)
    .eq("sender_role", "player");
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { player_id: string }[]) {
    counts[row.player_id] = (counts[row.player_id] ?? 0) + 1;
  }
  return counts;
}

export async function fetchUnreadCountForPlayer(playerId: string): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("medical_messages")
    .select("id", { count: "exact", head: true })
    .eq("player_id", playerId)
    .eq("read_by_player", false)
    .eq("sender_role", "doctor");
  if (error) throw error;
  return count ?? 0;
}

// Live updates across every thread, for the notification bell — the
// per-thread subscription above is filtered to one player, which is no use
// when the point is to be told about a message you weren't already looking at.
export function subscribeToAllMessages(onInsert: (msg: MedicalMessage) => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel("medical-messages-all")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "medical_messages" },
      (payload) => onInsert(payload.new as MedicalMessage)
    )
    .subscribe();
  return () => {
    supabase?.removeChannel(channel);
  };
}

// Live updates for an open thread — resolves to an unsubscribe function.
export function subscribeToThread(playerId: string, onInsert: (msg: MedicalMessage) => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`medical-messages-${playerId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "medical_messages", filter: `player_id=eq.${playerId}` },
      (payload) => onInsert(payload.new as MedicalMessage)
    )
    .subscribe();
  return () => {
    supabase?.removeChannel(channel);
  };
}
