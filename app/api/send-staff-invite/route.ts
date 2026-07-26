import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const VALID_ROLES = ["owner", "manager", "head_coach", "goalkeeper_coach", "analyst", "doctor_physio", "player"];

// Invites a staff member or player into ClubOS with a given role. This
// creates their Supabase Auth account (via the admin API, which emails them
// a secure "set your password" link using Supabase's own auth email — no
// separate email provider needed) and a matching app_users row so the app
// knows their role the moment they sign in.
export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Invites aren't set up yet — add a SUPABASE_SERVICE_ROLE_KEY environment variable in Vercel, then redeploy." },
      { status: 500 }
    );
  }

  const body = await req.json();
  const { requesterEmail, name, email, role, playerId } = body as {
    requesterEmail?: string; name?: string; email?: string; role?: string; playerId?: string | null;
  };

  if (!requesterEmail || !name?.trim() || !email?.trim() || !role || !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Missing or invalid invite details." }, { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // Only an owner/manager may invite people — verified server-side against
  // their own app_users row, not just trusted from the client.
  const { data: requester } = await admin.from("app_users").select("role").ilike("email", requesterEmail).maybeSingle();
  if (!requester || (requester.role !== "owner" && requester.role !== "manager")) {
    return NextResponse.json({ error: "Only an owner or manager can send invites." }, { status: 403 });
  }

  if (role === "player" && !playerId) {
    return NextResponse.json({ error: "A player invite must be linked to a player profile." }, { status: 400 });
  }

  const { error: upsertError } = await admin
    .from("app_users")
    .upsert(
      { email: email.trim(), name: name.trim(), role, player_id: role === "player" ? playerId : null, invite_status: "pending", invited_at: new Date().toISOString() },
      { onConflict: "email" }
    );
  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email.trim(), {
    redirectTo: `${siteUrl}/login`,
    data: { name: name.trim(), role },
  });

  // "User already registered" just means they already have a login — that's
  // fine, their app_users row above is what actually grants the new role.
  if (inviteError && !inviteError.message.toLowerCase().includes("already been registered") && !inviteError.message.toLowerCase().includes("already registered")) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
