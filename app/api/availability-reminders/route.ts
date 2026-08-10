import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Nudges players who haven't said whether they're available for a fixture
// that's coming up.
//
// Two ways in, deliberately:
//   - Vercel Cron calls it on a schedule (see vercel.json), so nobody has to
//     remember to chase.
//   - The Availability tab in the Manager module calls it on demand, for when
//     a squad needs naming today and three replies are missing.
//
// It only ever messages players with nothing recorded for that fixture. Anyone
// who has already answered is left alone — a reminder to do something you've
// already done is the fastest way to teach people to ignore notifications.

const DEFAULT_DAYS_AHEAD = 7;

function adminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type PushRow = { id: string; endpoint: string; p256dh: string; auth: string; player_id: string | null };

export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}

async function run(req: Request) {
  const url = new URL(req.url);
  const daysAhead = Math.min(30, Math.max(1, Number(url.searchParams.get("days")) || DEFAULT_DAYS_AHEAD));
  // A dry run reports who would be messaged without sending anything — useful
  // for checking the targeting before letting it loose on a squad.
  const dryRun = url.searchParams.get("dryRun") === "1";

  const admin = adminClient();
  if (!admin) {
    return NextResponse.json({ error: "Missing Supabase service credentials on the server." }, { status: 500 });
  }

  const now = new Date();
  const until = new Date(now.getTime() + daysAhead * 24 * 3600_000);

  // Fixtures still to be played inside the window. A cancelled or postponed
  // game is not something to chase availability for.
  const { data: matchRows, error: matchError } = await admin
    .from("matches")
    .select("id, kickoff, opponent, is_home, competition, status")
    .gte("kickoff", now.toISOString())
    .lte("kickoff", until.toISOString())
    .order("kickoff", { ascending: true });
  if (matchError) {
    return NextResponse.json({ error: `Couldn't load fixtures: ${matchError.message}` }, { status: 500 });
  }

  const matches = (matchRows ?? []).filter(
    (m: { status: string }) => m.status !== "cancelled" && m.status !== "postponed"
  ) as { id: string; kickoff: string; opponent: string; is_home: boolean }[];

  if (matches.length === 0) {
    return NextResponse.json({ matches: 0, reminded: 0, sent: 0, note: `No fixtures in the next ${daysAhead} days.` });
  }

  const { data: playerRows, error: playerError } = await admin
    .from("players")
    .select("id, name, availability");
  if (playerError) {
    return NextResponse.json({ error: `Couldn't load the squad: ${playerError.message}` }, { status: 500 });
  }
  const players = (playerRows ?? []) as { id: string; name: string; availability: string | null }[];

  const { data: replyRows } = await admin
    .from("match_availability")
    .select("match_id, player_id")
    .in("match_id", matches.map((m) => m.id));
  const answered = new Set(
    ((replyRows ?? []) as { match_id: string; player_id: string }[]).map((r) => `${r.match_id}|${r.player_id}`)
  );

  // One message per player, not one per fixture. A player with three unanswered
  // games gets a single "3 fixtures need your answer" rather than three
  // separate buzzes, which is the difference between a useful prompt and being
  // spammed by your own club.
  const outstanding = new Map<string, { name: string; matches: typeof matches }>();
  for (const p of players) {
    const missing = matches.filter((m) => !answered.has(`${m.id}|${p.id}`));
    if (missing.length > 0) outstanding.set(p.id, { name: p.name, matches: missing });
  }

  if (outstanding.size === 0) {
    return NextResponse.json({
      matches: matches.length, reminded: 0, sent: 0,
      note: "Everyone has answered for every upcoming fixture.",
    });
  }

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      matches: matches.length,
      reminded: outstanding.size,
      players: [...outstanding.values()].map((o) => ({ name: o.name, fixtures: o.matches.length })),
    });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:info@clubosapp.co";
  if (!publicKey || !privateKey) {
    return NextResponse.json(
      {
        matches: matches.length,
        reminded: outstanding.size,
        sent: 0,
        error: "Push isn't configured — add NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Vercel.",
      },
      { status: 501 }
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const { data: subRows } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, player_id")
    .in("player_id", [...outstanding.keys()]);
  const subscriptions = (subRows ?? []) as PushRow[];

  const byPlayer = new Map<string, PushRow[]>();
  for (const s of subscriptions) {
    if (!s.player_id) continue;
    const list = byPlayer.get(s.player_id) ?? [];
    list.push(s);
    byPlayer.set(s.player_id, list);
  }

  const expired: string[] = [];
  let sent = 0;
  let withoutDevice = 0;

  await Promise.all(
    [...outstanding.entries()].map(async ([playerId, info]) => {
      const subs = byPlayer.get(playerId) ?? [];
      if (subs.length === 0) {
        withoutDevice++;
        return;
      }

      const next = info.matches[0];
      const when = new Date(next.kickoff).toLocaleString("en-GB", {
        weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
      });
      const body =
        info.matches.length === 1
          ? `${next.is_home ? "vs" : "away to"} ${next.opponent}, ${when}. Tap to let the manager know.`
          : `${info.matches.length} fixtures need your answer — next is ${next.is_home ? "vs" : "away to"} ${next.opponent}, ${when}.`;

      const payload = JSON.stringify({
        title: "Are you available?",
        body,
        url: "/portal",
        // Tagged per player so a later reminder replaces the earlier one on the
        // lock screen instead of stacking up.
        tag: `availability-${playerId}`,
      });

      await Promise.all(
        subs.map(async (row) => {
          try {
            await webpush.sendNotification(
              { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
              payload
            );
            sent++;
          } catch (e) {
            const status = (e as { statusCode?: number }).statusCode;
            // Gone for good — an uninstalled app or a revoked permission. Left
            // in place it would fail on every run forever.
            if (status === 404 || status === 410) expired.push(row.id);
          }
        })
      );
    })
  );

  if (expired.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", expired);
  }

  return NextResponse.json({
    matches: matches.length,
    reminded: outstanding.size,
    sent,
    withoutDevice,
    removed: expired.length,
  });
}
