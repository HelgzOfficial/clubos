import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Records a public "request access" submission from the login page, and
// emails every current owner/manager so they know to review it — either
// from that email directly, or from the Access Requests list in the Staff
// module. Runs entirely server-side (service role key) so the requested
// password never needs a client-side write path of its own.
export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Requests aren't set up yet on this deployment." }, { status: 500 });
  }

  let body: { name?: string; email?: string; password?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { name, email, password, message } = body;

  if (!name?.trim() || !email?.trim() || !password || password.length < 8) {
    return NextResponse.json({ error: "Enter your name, email, and a password of at least 8 characters." }, { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedName = name.trim();

  const { error: insertError } = await admin.from("access_requests").insert({
    name: trimmedName,
    email: trimmedEmail,
    password,
    message: message?.trim() || null,
  });
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Best-effort notification — a request is still recorded and visible in
  // the Staff module even if no RESEND_API_KEY is configured or the email
  // fails, so this never blocks the actual submission from succeeding.
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const { data: recipients } = await admin
        .from("app_users")
        .select("email")
        .in("role", ["owner", "manager"]);
      const to = (recipients ?? []).map((r) => r.email).filter(Boolean);
      if (to.length > 0) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL || "ClubOS <noreply@clubosapp.co>",
            to,
            subject: `${trimmedName} is requesting access to ClubOS`,
            html: `<p><b>${trimmedName}</b> (${trimmedEmail}) has asked for access to ClubOS.</p>
${message?.trim() ? `<p>Their message: "${message.trim()}"</p>` : ""}
<p><a href="${siteUrl}/staff" style="display:inline-block;padding:10px 18px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;">Review in Staff &amp; Access</a></p>
<p>They've already chosen a password — approving from there gives them a working login immediately, no further email needed.</p>`,
          }),
        });
      }
    } catch {
      // Notification email failing shouldn't fail the request itself.
    }
  }

  return NextResponse.json({ ok: true });
}
