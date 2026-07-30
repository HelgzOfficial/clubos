import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Uses Claude's web search tool to keep a per-opponent head-to-head record up
// to date automatically, instead of relying on someone manually typing in
// results. Non-league match history is patchy online, so this is deliberately
// honest about uncertainty rather than inventing plausible-looking numbers.

function buildPrompt(clubName: string, opponentName: string) {
  return `Search the web for the head-to-head football match record between "${clubName}" and "${opponentName}".
Both are English non-league clubs, so the big football databases usually have nothing useful. Search these first,
by name, because this is where non-league results actually live:
- The Isthmian League official site (isthmian.co.uk) — results, archived season tables and match reports
- Football Web Pages (footballwebpages.co.uk) — fixtures, results and head-to-head pages for non-league divisions
- The FA Full-Time results service (fulltime.thefa.com)
- Both clubs' own websites and their Pitchero pages, which often keep a full results archive
- Non-League Matters, the Football Club History Database (fchd.info), and local newspaper match reports

Search several different ways rather than once — try "${clubName} v ${opponentName} result", the reverse fixture,
and each club's name plus "results archive" — because one phrasing often misses what another finds.

Find:
- Total meetings and the record from ${clubName}'s perspective (played / won / drawn / lost)
- The most recent meeting: date, venue, competition, final score
- Up to the last 6 meetings, most recent first, each with date, competition, venue and score

Be honest about uncertainty. Non-league history online is patchy, and a partial answer clearly labelled as partial
is far more useful than a confident guess. If you can only find some meetings, return those and say so in the note.
Never invent a result, a date or a score.

Reply with ONLY a single JSON object, no other text, in exactly this shape:
{
  "found": boolean,
  "played": number|null,
  "won": number|null,
  "drawn": number|null,
  "lost": number|null,
  "lastMeeting": { "date": string|null, "venue": string|null, "competition": string|null, "result": string|null } | null,
  "recentMeetings": [ { "date": string, "competition": string, "venue": string, "result": string } ],
  "sources": [ string ],
  "confidence": "low"|"medium"|"high",
  "note": string
}
"recentMeetings" and "sources" may be empty arrays. Put the actual URLs you relied on in "sources". Set "found":
false, all numeric fields null and "lastMeeting": null if you couldn't find real information. Keep "note" to one or
two short sentences on what you found or couldn't find.`;
}

export async function POST(req: Request) {
  let body: { clubName?: string; opponentName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const clubName = body.clubName?.trim();
  const opponentName = body.opponentName?.trim();
  if (!clubName || !opponentName) {
    return NextResponse.json({ error: "Missing club or opponent name." }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Head-to-head research isn't set up yet — add an ANTHROPIC_API_KEY environment variable in Vercel, then redeploy." },
      { status: 501 }
    );
  }

  try {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 2048,
        // Raised from 4: several differently-phrased searches across league,
        // club and archive sites is what actually finds non-league results.
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 10 }],
        messages: [{ role: "user", content: buildPrompt(clubName, opponentName) }],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return NextResponse.json({ error: `Research request failed (${aiRes.status}): ${errText.slice(0, 300)}` }, { status: 502 });
    }

    const data = await aiRes.json();
    const textBlocks: string[] = (data?.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text);
    const rawText = textBlocks.join("\n");
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Couldn't get a usable answer back from the research step." }, { status: 502 });
    }

    let parsed: {
      found?: boolean;
      played?: number | null;
      won?: number | null;
      drawn?: number | null;
      lost?: number | null;
      lastMeeting?: { date: string | null; venue: string | null; competition: string | null; result: string | null } | null;
      recentMeetings?: { date: string; competition: string; venue: string; result: string }[];
      sources?: string[];
      confidence?: "low" | "medium" | "high";
      note?: string;
    };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({ error: "The research response wasn't valid JSON." }, { status: 502 });
    }

    return NextResponse.json({
      played: parsed.played ?? null,
      won: parsed.won ?? null,
      drawn: parsed.drawn ?? null,
      lost: parsed.lost ?? null,
      lastMeeting: parsed.lastMeeting ?? null,
      recentMeetings: Array.isArray(parsed.recentMeetings) ? parsed.recentMeetings.slice(0, 6) : [],
      sources: Array.isArray(parsed.sources) ? parsed.sources.filter((u) => typeof u === "string").slice(0, 8) : [],
      confidence: parsed.confidence ?? "low",
      note: parsed.note || (parsed.found ? "" : "No reliable head-to-head record found online for this fixture."),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Research request failed." }, { status: 502 });
  }
}
