import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const VALID_ROLES = ["owner", "manager", "head_coach", "goalkeeper_coach", "analyst", "doctor_physio", "player"];

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner", manager: "Manager", head_coach: "Head Coach", goalkeeper_coach: "Goalkeeper Coach",
  analyst: "Analyst", doctor_physio: "Doctor / Physio", player: "Player",
};

// Invites a staff member or player into ClubOS with a given role. Creates
// (or reuses) their Supabase Auth account, then generates a real sign-up
// link ourselves and emails it via Resend directly — rather than relying on
// Supabase's own auth email sending, which needs its own SMTP setup and, if
// misconfigured, fails silently from this route's point of view. This also
// means a person who was created earlier but never actually got a working
// email (e.g. from before Resend was set up) can always be re-sent a fresh,
// working link — instead of the invite being silently treated as "already
// done" the moment their auth account exists.
export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Invites aren't set up yet — add a SUPABASE_SERVICE_ROLE_KEY environment variable in Vercel, then redeploy." },
      { status: 500 }
    );
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json(
      { error: "Invite emails aren't set up yet — add a RESEND_API_KEY environment variable in Vercel, then redeploy." },
      { status: 500 }
    );
  }

  let body: { requesterEmail?: string; name?: string; email?: string; role?: string; playerId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { requesterEmail, name, email, role, playerId } = body;

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

  const trimmedEmail = email.trim();
  const trimmedName = name.trim();

  const { error: upsertError } = await admin
    .from("app_users")
    .upsert(
      { email: trimmedEmail, name: trimmedName, role, player_id: role === "player" ? playerId : null, invite_status: "pending", invited_at: new Date().toISOString() },
      { onConflict: "email" }
    );
  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const redirectTo = `${siteUrl}/login`;

  // Try to create a brand-new auth account + invite link first. If one
  // already exists for this email (e.g. a previous attempt from before
  // email sending was working), fall back to a recovery link instead —
  // that still lands them on the same "set your password" screen, and
  // crucially we always get a fresh, real link to actually send.
  let actionLink: string | null = null;
  let linkError: string | null = null;

  const invited = await admin.auth.admin.generateLink({
    type: "invite",
    email: trimmedEmail,
    options: { redirectTo, data: { name: trimmedName, role } },
  });

  if (invited.data?.properties?.action_link) {
    actionLink = invited.data.properties.action_link;
  } else if (invited.error && /already been registered|already registered|already exists/i.test(invited.error.message)) {
    const recovery = await admin.auth.admin.generateLink({
      type: "recovery",
      email: trimmedEmail,
      options: { redirectTo },
    });
    if (recovery.data?.properties?.action_link) {
      actionLink = recovery.data.properties.action_link;
    } else {
      linkError = recovery.error?.message ?? "Couldn't generate a sign-in link for this existing account.";
    }
  } else {
    linkError = invited.error?.message ?? "Couldn't generate an invite link.";
  }

  if (!actionLink) {
    return NextResponse.json({ error: linkError ?? "Couldn't generate an invite link." }, { status: 500 });
  }

  const roleLabel = ROLE_LABELS[role] ?? role;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "ClubOS <onboarding@resend.dev>",
        to: [trimmedEmail],
        subject: "You're invited to ClubOS",
        html: `<p>Hi ${trimmedName},</p>
<p>You've been added to ClubOS as <b>${roleLabel}</b>.</p>
<p><a href="${actionLink}" style="display:inline-block;padding:10px 18px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;">Set your password &amp; sign in</a></p>
<p>Or copy and paste this link into your browser:<br/>${actionLink}</p>
<p>This link is single-use and will expire after a period of time — if it's stopped working, ask your ClubOS owner or manager to resend the invite.</p>`,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Couldn't send the invite email (${res.status}): ${errText.slice(0, 300)}` }, { status: 502 });
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't send the invite email." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
