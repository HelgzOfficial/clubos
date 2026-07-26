import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Uses Claude's web search tool to keep a per-opponent head-to-head record up
// to date automatically, instead of relying on someone manually typing in
// results. Non-league match history is patchy online, so this is deliberately
// honest about uncertainty rather than inventing plausible-looking numbers.

function buildPrompt(clubName: string, opponentName: string) {
  return `Search the web for the head-to-head football match record between "${clubName}" and "${opponentName}" —
both are English non-league football clubs, so results may only be findable on lower-tier league sites, local news,
or club websites rather than major football databases. Try to find:
- How many times these two teams have played each other, and the record from ${clubName}'s perspective (played/won/drawn/lost)
- The single most recent meeting between them: its date, venue, competition, and final score/result

Be honest about uncertainty — non-league match history is often sparse, outdated, or hard to verify online. If you
can't find reliable information, say so rather than guessing or inventing a result.

After researching, reply with ONLY a single JSON object, no other text, in exactly this shape:
{
  "found": boolean,
  "played": number|null,
  "won": number|null,
  "drawn": number|null,
  "lost": number|null,
  "lastMeeting": { "date": string|null, "venue": string|null, "competition": string|null, "result": string|null } | null,
  "confidence": "low"|"medium"|"high",
  "note": string
}
Set "found": false, all numeric fields null, and "lastMeeting": null if you couldn't find real information. Never
invent a result. Keep "note" to one short sentence on what you found (or didn't) and your source(s).`;
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
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
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
      confidence: parsed.confidence ?? "low",
      note: parsed.note || (parsed.found ? "" : "No reliable head-to-head record found online for this fixture."),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Research request failed." }, { status: 502 });
  }
}
