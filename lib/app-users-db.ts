import { supabase } from "./supabase";
import type { AppRole, AppUserRecord } from "./permissions";

export async function fetchAppUsers(): Promise<AppUserRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("app_users").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AppUserRecord[];
}

export async function fetchAppUsersByRole(role: AppRole): Promise<AppUserRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("app_users").select("*").eq("role", role);
  if (error) throw error;
  return (data ?? []) as AppUserRecord[];
}

export async function updateAppUserRole(id: string, role: AppRole, playerId: string | null) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("app_users").update({ role, player_id: playerId }).eq("id", id);
  if (error) throw error;
}

export async function removeAppUser(id: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("app_users").delete().eq("id", id);
  if (error) throw error;
}

// Creates the pending app_users row and emails the person a sign-up invite.
// requesterEmail lets the server verify the person calling this is actually
// allowed to invite (owner/manager), since app_users writes are otherwise
// locked down by RLS to owner/manager anyway — this is the friendly error
// path when the API route's own check fails.
export async function inviteAppUser(input: {
  requesterEmail: string;
  name: string;
  email: string;
  role: AppRole;
  playerId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/send-staff-invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data.error || "Couldn't send the invite." };
  return { ok: true };
}
