import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseFixturesIcs } from "@/lib/ics-parser";

export const dynamic = "force-dynamic";

// The club's own official, publicly published fixture feed — meant to be subscribed to
// by calendar apps, which is exactly what we're doing here.
const FIXTURES_ICS_URL = "https://afcwhyteleafe.com/fixtures/first-team.ics";

export async function GET() {
  return sync();
}

export async function POST() {
  return sync();
}

async function sync() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Supabase isn't fully configured on the server (missing SUPABASE_SERVICE_ROLE_KEY)." },
      { status: 500 }
    );
  }

  let icsText: string;
  try {
    const res = await fetch(FIXTURES_ICS_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Fixture feed responded with ${res.status}`);
    icsText = await res.text();
  } catch (e) {
    return NextResponse.json(
      { error: `Couldn't reach the fixtures feed: ${e instanceof Error ? e.message : "unknown error"}` },
      { status: 502 }
    );
  }

  const fixtures = parseFixturesIcs(icsText);
  if (fixtures.length === 0) {
    return NextResponse.json({ error: "The fixture feed returned no parseable fixtures — nothing was changed." }, { status: 502 });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const rows = fixtures.map((f) => ({
    source_uid: f.sourceUid,
    kickoff: f.kickoff,
    opponent: f.opponent,
    is_home: f.isHome,
    competition: f.competition,
    venue: f.venue,
    source_url: f.sourceUrl,
  }));

  const { error } = await admin.from("matches").upsert(rows, { onConflict: "source_uid" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ synced: rows.length, syncedAt: new Date().toISOString() });
}
