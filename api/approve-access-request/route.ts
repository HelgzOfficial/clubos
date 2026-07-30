import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const VALID_ROLES = ["owner", "manager", "head_coach", "goalkeeper_coach", "analyst", "doctor_physio", "player"];

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner", manager: "Manager", head_coach: "Head Coach", goalkeeper_coach: "Goalkeeper Coach",
  analyst: "Analyst", doctor_physio: "Doctor / Physio", player: "Player",
};

// Approves a pending access request: creates the person's Supabase Auth
// account directly with the password they chose when they asked for
// access (so they can sign in immediately, no follow-up email/link needed),
// grants them the given role in app_users, and clears the stored password
// from the request row the moment it's been used. All server-side —
// the password is never read by, or returned to, any browser.
export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Not set up yet — add a SUPABASE_SERVICE_ROLE_KEY environment variable in Vercel." }, { status: 500 });
  }

  let body: { requesterEmail?: string; requestId?: string; role?: string; playerId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { requesterEmail, requestId, role, playerId } = body;

  if (!requesterEmail || !requestId || !role || !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Missing or invalid approval details." }, { status: 400 });
  }
  if (role === "player" && !playerId) {
    return NextResponse.json({ error: "A player role must be linked to a player profile." }, { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const requesterEmailLower = requesterEmail.trim().toLowerCase();

  const { data: requesterRows, error: requesterLookupError } = await admin
    .from("app_users")
    .select("role")
    .ilike("email", requesterEmailLower)
    .order("role", { ascending: true })
    .limit(1);
  if (requesterLookupError) {
    return NextResponse.json({ error: `Couldn't verify your account: ${requesterLookupError.message}` }, { status: 500 });
  }
  const requester = requesterRows?.[0];
  if (!requester || (requester.role !== "owner" && requester.role !== "manager")) {
    return NextResponse.json({ error: "Only an owner or manager can approve access requests." }, { status: 403 });
  }

  const { data: reqRow, error: reqError } = await admin
    .from("access_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (reqError) {
    return NextResponse.json({ error: reqError.message }, { status: 500 });
  }
  if (!reqRow) {
    return NextResponse.json({ error: "That request no longer exists." }, { status: 404 });
  }
  if (reqRow.status !== "pending") {
    return NextResponse.json({ error: "That request has already been resolved." }, { status: 409 });
  }
  if (!reqRow.password) {
    return NextResponse.json({ error: "That request's password is no longer available — ask them to submit a new request." }, { status: 400 });
  }

  // Look up whether a Supabase Auth account already exists for this email
  // *before* trying to create one — this is the same email the request row
  // came in on, and it's common for someone to have already been invited
  // the normal way (Staff → Invite Person) before also asking for access
  // separately. Checking up front, rather than firing createUser and trying
  // to pattern-match its error message afterwards, means this doesn't
  // depend on the exact wording Supabase happens to use for a duplicate —
  // it works the same way regardless.
  let existingUserId: string | null = null;
  {
    let page = 1;
    while (true) {
      const { data: pageData, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (listError) {
        return NextResponse.json({ error: `Couldn't check for an existing account: ${listError.message}` }, { status: 500 });
      }
      const match = pageData.users.find((u) => (u.email ?? "").toLowerCase() === reqRow.email.toLowerCase());
      if (match) {
        existingUserId = match.id;
        break;
      }
      if (pageData.users.length < 200) break;
      page += 1;
    }
  }

  if (existingUserId) {
    // Already has an auth account (e.g. from an earlier Staff invite) — set
    // its password to the one just chosen in the request, rather than
    // failing the approval outright.
    const { error: updateError } = await admin.auth.admin.updateUserById(existingUserId, {
      password: reqRow.password,
      email_confirm: true,
      user_metadata: { name: reqRow.name, role },
    });
    if (updateError) {
      return NextResponse.json({ error: `Couldn't update the existing account: ${updateError.message}` }, { status: 500 });
    }
  } else {
    const { error: createError } = await admin.auth.admin.createUser({
      email: reqRow.email,
      password: reqRow.password,
      email_confirm: true,
      user_metadata: { name: reqRow.name, role },
    });
    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }
  }

  // invite_status must be one of 'pending' | 'accepted' (enforced by a check
  // constraint on the table). 'accepted' is correct here even though nobody
  // clicked an invite link: they already chose their own password when they
  // requested access, so the account is fully usable the moment it's created
  // — there's no pending step left. accepted_at is stamped for the same
  // reason, which is also what makes Staff & Access show them as "Active".
  const nowIso = new Date().toISOString();
  const { error: upsertError } = await admin.from("app_users").upsert(
    {
      email: reqRow.email,
      name: reqRow.name,
      role,
      player_id: role === "player" ? playerId : null,
      invite_status: "accepted",
      invited_at: nowIso,
      accepted_at: nowIso,
    },
    { onConflict: "email" }
  );
  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  // Clear the password immediately — it's done its one job. status flips to
  // approved so it drops off the pending queue.
  await admin
    .from("access_requests")
    .update({ password: null, status: "approved", resolved_at: new Date().toISOString() })
    .eq("id", requestId);

  // Best-effort confirmation email — never blocks the approval itself.
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || "ClubOS <noreply@clubosapp.co>",
          to: [reqRow.email],
          subject: "You're approved for ClubOS",
          html: `<p>Hi ${reqRow.name},</p>
<p>You've been approved for ClubOS as <b>${ROLE_LABELS[role] ?? role}</b>. Sign in with the password you chose when you requested access:</p>
<p><a href="${siteUrl}/login" style="display:inline-block;padding:10px 18px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;">Sign in to ClubOS</a></p>`,
        }),
      });
    } catch {
      // Non-blocking.
    }
  }

  return NextResponse.json({ ok: true });
}
