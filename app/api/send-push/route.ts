import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const dynamic = "force-dynamic";
// web-push needs Node crypto, so this can't run on the edge runtime.
export const runtime = "nodejs";

// Sends a Web Push notification to every device registered against a role.
//
// The subscription keys are read with the service role rather than the
// caller's session: the sender is a player, and a player has no business
// listing the medical team's devices. Doing the lookup server-side keeps that
// asymmetry intact.

type PushRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function POST(req: Request) {
  let body: { targetRole?: string; title?: string; body?: string; url?: string; tag?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const targetRole = body.targetRole?.trim();
  const title = body.title?.trim();
  if (!targetRole || !title) {
    return NextResponse.json({ error: "Missing targetRole or title." }, { status: 400 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:info@clubosapp.co";
  if (!publicKey || !privateKey) {
    return NextResponse.json(
      { error: "Push isn't configured — add NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Vercel." },
      { status: 501 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Missing Supabase service credentials." }, { status: 500 });
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("role", targetRole);
  if (error) {
    return NextResponse.json({ error: `Couldn't load subscriptions: ${error.message}` }, { status: 500 });
  }

  const subscriptions = (data ?? []) as PushRow[];
  if (subscriptions.length === 0) {
    return NextResponse.json({ sent: 0, note: "Nobody in that role has enabled notifications on a device yet." });
  }

  const payload = JSON.stringify({
    title,
    body: body.body ?? "",
    url: body.url ?? "/medical",
    tag: body.tag ?? "clubos",
  });

  // Endpoints go stale — an uninstalled app or a revoked permission leaves a
  // dead row that will fail forever. 404/410 means gone for good, so those are
  // cleaned up rather than retried on every message.
  const expired: string[] = [];
  let sent = 0;

  await Promise.all(
    subscriptions.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          payload
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) expired.push(row.id);
      }
    })
  );

  if (expired.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", expired);
  }

  await admin
    .from("push_subscriptions")
    .update({ last_used_at: new Date().toISOString() })
    .eq("role", targetRole);

  return NextResponse.json({ sent, removed: expired.length });
}
