import { NextResponse } from "next/server";
import { STAT_FIELDS, buildCategories } from "@/lib/match-stat-defs";

export const dynamic = "force-dynamic";

// Screenshots/photos of a Hudl/Wyscout match report (or any similar stats
// screen) don't have selectable text, so they can't go through the pdf.js +
// regex pipeline in lib/report-parser.ts. Instead this route sends the image
// straight to Claude's vision model and asks it to read off the same shape
// of data (goals, lineup, team stats) that the regex parser produces for
// PDFs, so both paths feed the same import/dashboard UI.

const FIELD_KEYS = STAT_FIELDS.map((f) => f.key);

function buildPrompt(clubName: string, opponentName: string) {
  return `This image is a screenshot of a football match report (e.g. from Hudl or Wyscout) for a match involving
"${clubName}" (call this side "us") against "${opponentName}" (call this side "opponent"). Read whatever is visible —
it might be a team-stats comparison screen, a lineup/squad sheet, or a goals/timeline view. Only report data you can
actually see in the image; do not guess or invent numbers.

Reply with ONLY a single JSON object, no other text, in exactly this shape:
{
  "goals": [{ "minute": number|null, "scorer": string, "assist": string, "team": "us"|"opponent" }],
  "lineup": [{ "shirtNumber": string, "playerName": string, "isStarting": boolean, "side": "us"|"opponent" }],
  "stats": { "<fieldKey>": { "us": number|null, "opponent": number|null }, ... }
}

For "stats", only use these field keys (skip any not visible in the image): ${FIELD_KEYS.join(", ")}.
Only include a goal if "team" is "us" (this app only tracks the club's own goalscorers from reports).
If a section (goals, lineup, or stats) isn't visible in the image at all, return an empty array/object for it.
Return valid JSON only — no markdown code fences, no commentary.`;
}

export async function POST(req: Request) {
  let body: { imageBase64?: string; mediaType?: string; clubName?: string; opponentName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { imageBase64, mediaType, clubName, opponentName } = body;
  if (!imageBase64 || !mediaType) {
    return NextResponse.json({ error: "No image received." }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Image reading isn't set up yet — add an ANTHROPIC_API_KEY environment variable in Vercel, then redeploy." },
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
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
              { type: "text", text: buildPrompt(clubName || "our club", opponentName || "the opponent") },
            ],
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return NextResponse.json({ error: `AI request failed (${aiRes.status}): ${errText.slice(0, 300)}` }, { status: 502 });
    }

    const data = await aiRes.json();
    const rawText: string = data?.content?.[0]?.text ?? "";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Couldn't read any recognisable stats out of that image." }, { status: 502 });
    }

    let parsed: {
      goals?: { minute: number | null; scorer: string; assist: string; team?: string }[];
      lineup?: { shirtNumber: string; playerName: string; isStarting: boolean; side: string }[];
      stats?: Record<string, { us: number | null; opponent: number | null }>;
    };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({ error: "The AI's response wasn't valid JSON — try a clearer screenshot." }, { status: 502 });
    }

    const goals = (parsed.goals ?? [])
      .filter((g) => (g.team ?? "us") === "us" && g.scorer)
      .map((g) => ({ minute: g.minute ?? null, scorer: g.scorer, assist: g.assist || "" }));

    const lineup = (parsed.lineup ?? [])
      .filter((l) => l.playerName && (l.side === "us" || l.side === "opponent"))
      .map((l) => ({
        shirtNumber: l.shirtNumber || "",
        playerName: l.playerName,
        isStarting: !!l.isStarting,
        side: l.side as "us" | "opponent",
      }));

    const statValues: Record<string, { us: number | null; opponent: number | null }> = {};
    for (const [key, val] of Object.entries(parsed.stats ?? {})) {
      if (!FIELD_KEYS.includes(key)) continue;
      if (val && (val.us !== null || val.opponent !== null)) statValues[key] = val;
    }
    const statCategories = buildCategories(statValues);

    return NextResponse.json({
      goals,
      lineup,
      substitutions: [],
      statCategories,
      rawTextPreview: "Extracted from an uploaded image via AI — always double-check against the original screenshot.",
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI request failed." }, { status: 502 });
  }
}
