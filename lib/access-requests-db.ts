import { supabase } from "./supabase";

export type AccessRequestStatus = "pending" | "approved" | "rejected";

// Note: deliberately no `password` field here — it's never selected on the
// client, only read server-side by the approval API route. See
// app/api/approve-access-request/route.ts.
export type AccessRequest = {
  id: string;
  name: string;
  email: string;
  message: string | null;
  status: AccessRequestStatus;
  requested_at: string;
  resolved_at: string | null;
};

export async function submitAccessRequest(input: {
  name: string;
  email: string;
  password: string;
  message?: string;
}): Promise<{ ok: boolean; error?: string }> {
  let res: Response;
  try {
    res = await fetch("/api/request-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    return { ok: false, error: "Couldn't reach the server — check your connection and try again." };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error ?? "Couldn't submit that request." };
  return { ok: true };
}

export async function fetchPendingAccessRequests(): Promise<AccessRequest[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("access_requests")
    .select("id,name,email,message,status,requested_at,resolved_at")
    .eq("status", "pending")
    .order("requested_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AccessRequest[];
}

export async function approveAccessRequest(input: {
  requesterEmail: string;
  requestId: string;
  role: string;
  playerId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  let res: Response;
  try {
    res = await fetch("/api/approve-access-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    return { ok: false, error: "Couldn't reach the server — check your connection and try again." };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error ?? "Couldn't approve that request." };
  return { ok: true };
}

// Rejecting never needs the password, so this can go straight through the
// normal authenticated client — it also defensively clears the password
// column, even though reject implies it was never used.
export async function rejectAccessRequest(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase
    .from("access_requests")
    .update({ status: "rejected", password: null, resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
