import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Turns whatever stats a scouting upload contains (a Wyscout/Hudl multi-match
// export, a CSV/TXT export, or a screenshot of a stats page) into a short,
// practical scouting summary. Unlike the per-fixture Match Centre parser,
// this doesn't try to extract structured fields — opposition uploads are
// typically season/multi-match squad exports with no fixed per-match
// team-vs-team shape, so a free-text AI summary is the more reliable fit.

// Shared instructions for the structured stat-bar block every prompt below
// asks for, appended after the prose summary. Each stat is normalised to a
// 0-100 scale so the UI can render it as a simple green(strong)-to-red(weak)
// gauge — 100 being the most favourable reading for the OPPONENT (i.e. the
// thing our own team should be most wary of), 0 the least.
const STATS_BLOCK_INSTRUCTIONS = `
After the prose summary, on a new line write exactly the marker "===STATS===" and then, on the next line, a single
JSON array (no other text) of the clearest 4-8 numeric stats you found, in this shape:
[{"label": "Possession %", "value": 62}, {"label": "Pass Accuracy %", "value": 78}]

Rules for the JSON:
- "value" must be a number from 0 to 100. If a stat is already a percentage, use it as-is. If it isn't (e.g. goals
  per game, shots per game), convert it to a 0-100 scale by judging where it sits against a normal amateur/
  non-league range for that stat (roughly: well below average ≈ 20, average ≈ 50, well above average ≈ 80+).
- Higher value should always mean "stronger/more dangerous for this opponent" on that stat, so a coach reading a
  long red-to-green bar instantly sees where the opponent is a threat.
- Only include stats you can actually calculate or read — never invent a number. If there are fewer than 4 usable
  stats, return fewer; if there are none at all, return an empty array [].
- Keep "label" short (2-3 words, plain English, not the raw column header).`;

function buildTextPrompt(opponentName: string, text: string) {
  return `You are a football scouting analyst. Below is raw text extracted from a statistics export (e.g. Wyscout or
Hudl) for the team "${opponentName}" — likely a table of recent/season matches with stats like goals, xG, shots,
passes/accuracy, possession %, and duels won, often with an averages row.

Read the numbers and write a concise scouting summary for a club coach preparing to play against this team. Cover:
- Overall attacking/defensive trend (goals scored/conceded, xG over/underperformance if visible)
- Style indicators from the numbers (possession share, passing volume/accuracy, duels won — high press vs low block, direct vs possession-based)
- 2-3 notable strengths to be wary of
- 2-3 notable weaknesses or exploitable patterns

Keep it tight and practical — a coach should be able to read it in under a minute. Write in plain prose with short
paragraphs and simple "- " bullet lines only — no markdown headers, no asterisk bullets. Only reference numbers
actually present in the text below — never invent or estimate a stat that isn't there.
${STATS_BLOCK_INSTRUCTIONS}

TEXT:
"""
${text}
"""`;
}

function buildImagePrompt(opponentName: string) {
  return `This image is a screenshot of a football statistics export (e.g. Wyscout) for the team "${opponentName}" —
likely a table of recent/season matches with stats like goals, xG, shots, passes/accuracy, possession %, and duels
won, often with an averages row.

Read whatever numbers are visible and write a concise scouting summary for a club coach preparing to play against
this team. Cover the overall attacking/defensive trend, style indicators from the numbers, 2-3 strengths to be wary
of, and 2-3 weaknesses or exploitable patterns. Keep it tight and practical — under a minute to read. Write in plain
prose with short paragraphs and simple "- " bullet lines only — no markdown headers, no asterisk bullets. Only
reference numbers you can actually see in the image — never invent or estimate a stat.
${STATS_BLOCK_INSTRUCTIONS}`;
}

export async function POST(req: Request) {
  let body: { text?: string; imageBase64?: string; mediaType?: string; opponentName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const opponentName = body.opponentName?.trim() || "the opponent";

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI summaries aren't set up yet — add an ANTHROPIC_API_KEY environment variable in Vercel, then redeploy." },
      { status: 501 }
    );
  }

  let content: unknown;
  if (body.imageBase64 && body.mediaType) {
    content = [
      { type: "image", source: { type: "base64", media_type: body.mediaType, data: body.imageBase64 } },
      { type: "text", text: buildImagePrompt(opponentName) },
    ];
  } else if (body.text && body.text.trim()) {
    content = buildTextPrompt(opponentName, body.text.trim());
  } else {
    return NextResponse.json({ error: "No file content received." }, { status: 400 });
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
        messages: [{ role: "user", content }],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return NextResponse.json({ error: `AI request failed (${aiRes.status}): ${errText.slice(0, 300)}` }, { status: 502 });
    }

    const data = await aiRes.json();
    const textBlocks: string[] = (data?.content ?? [])
      .filter((b: { type?: string }) => b?.type === "text")
      .map((b: { text?: string }) => b.text ?? "");
    const rawText = textBlocks.join("\n").trim();

    // Pull the "===STATS===" JSON block off the end, if present, and treat
    // whatever's left as the prose summary. Best-effort: a malformed or
    // missing stats block just means no graphic, not a failed summary.
    const markerIndex = rawText.indexOf("===STATS===");
    const summary = (markerIndex === -1 ? rawText : rawText.slice(0, markerIndex)).trim();
    let stats: { label: string; value: number }[] = [];
    if (markerIndex !== -1) {
      const statsPart = rawText.slice(markerIndex + "===STATS===".length);
      const jsonMatch = statsPart.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) {
            stats = parsed
              .filter((s) => s && typeof s.label === "string" && typeof s.value === "number")
              .map((s) => ({ label: String(s.label).slice(0, 40), value: Math.max(0, Math.min(100, Math.round(s.value))) }))
              .slice(0, 8);
          }
        } catch {
          // ignore — stats are a nice-to-have, not required
        }
      }
    }

    if (!summary) {
      // Surface *why* nothing came back (refusal, hit max_tokens with no
      // output, unexpected block shape, etc.) instead of a generic message —
      // this is what actually failed, not a guess.
      const stopReason = data?.stop_reason ?? "unknown";
      const blockTypes = (data?.content ?? []).map((b: { type?: string }) => b?.type).join(", ") || "none";
      return NextResponse.json(
        {
          error: `The AI didn't return any text (stop_reason: ${stopReason}, content blocks: [${blockTypes}]). Try a clearer or smaller image.`,
        },
        { status: 502 }
      );
    }

    // If the model ran out of room before finishing, say so plainly rather
    // than silently handing back a summary that trails off mid-sentence.
    const truncated = data?.stop_reason === "max_tokens";

    return NextResponse.json({ summary, stats, truncated });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI request failed." }, { status: 502 });
  }
}
