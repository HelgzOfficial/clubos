import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Turns whatever stats a scouting upload contains (a Wyscout/Hudl multi-match
// export, a CSV/TXT export, or a screenshot of a stats page) into a short,
// practical scouting summary. Unlike the per-fixture Match Centre parser,
// this doesn't try to extract structured fields — opposition uploads are
// typically season/multi-match squad exports with no fixed per-match
// team-vs-team shape, so a free-text AI summary is the more reliable fit.

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
reference numbers you can actually see in the image — never invent or estimate a stat.`;
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
    const summary = textBlocks.join("\n").trim();

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

    return NextResponse.json({ summary, truncated });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI request failed." }, { status: 502 });
  }
}
