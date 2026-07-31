import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Called by the service worker's `pushsubscriptionchange` handler when the
// browser rotates a subscription. There's no page open at that point — and no
// user session — so this runs with the service role and carries the old
// endpoint across, keeping the role/email attached to the new one. Without it
// a rotation silently ends the physio's notifications.

export async function POST(req: Request) {
  let body: {
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    renewalOf?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const endpoint = body.subscription?.endpoint;
  const p256dh = body.subscription?.keys?.p256dh;
  const auth = body.subscription?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Incomplete subscription." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Missing Supabase service credentials." }, { status: 500 });
  }
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Carry over who this device belonged to, then drop the dead row.
  let role: string | null = null;
  let userEmail: string | null = null;
  let playerId: string | null = null;
  if (body.renewalOf) {
    const { data: old } = await admin
      .from("push_subscriptions")
      .select("role, user_email, player_id")
      .eq("endpoint", body.renewalOf)
      .maybeSingle();
    if (old) {
      role = old.role ?? null;
      userEmail = old.user_email ?? null;
      playerId = old.player_id ?? null;
    }
  }

  const { error } = await admin.from("push_subscriptions").upsert(
    {
      endpoint,
      p256dh,
      auth,
      role,
      user_email: userEmail,
      player_id: playerId,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.renewalOf && body.renewalOf !== endpoint) {
    await admin.from("push_subscriptions").delete().eq("endpoint", body.renewalOf);
  }

  return NextResponse.json({ ok: true });
}
