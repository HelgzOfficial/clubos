import { NextResponse } from "next/server";

// Reads a published league table — a screenshot of the league's website, or a
// PDF — and returns it as structured rows.
//
// Server-side for the same reason as the other readers: the Anthropic API key.
// Anything prefixed NEXT_PUBLIC_ is visible to every visitor, so the key never
// leaves this file. The image goes up, the table comes back.
export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const MAX_BYTES = 8 * 1024 * 1024;

const SYSTEM = `You read football league tables and return them as JSON.

The image or PDF is a league table from a football league's website. It has one row per club and the usual columns, though the headings vary by site:

- Pos / # / Position
- Team / Club
- P / Pl / Pld / MP  — matches played
- W — won
- D — drawn
- L — lost
- F / GF / For — goals for
- A / GA / Against — goals against
- GD / +/- — goal difference
- Pts / P — points

Return ONLY a JSON object, no prose, no markdown fences, in exactly this shape:

{
  "competition": "the league/division name if shown, else null",
  "rows": [
    {
      "position": number,
      "team": "club name exactly as printed",
      "played": number,
      "won": number,
      "drawn": number,
      "lost": number,
      "goals_for": number,
      "goals_against": number,
      "points": number
    }
  ]
}

Rules:
- Include every club in the table, in the order printed, top to bottom.
- Copy club names exactly as printed. Do not expand abbreviations or correct spellings.
- Beware the two different meanings of "P". If a table has both a "P" near the left and a "Pts" or "P" at the far right, the left one is matches played and the right one is points. Points are almost always the last numeric column and the largest numbers in the table.
- Goal difference is NOT needed in the output, but use it as a check: goals_for minus goals_against should equal the printed GD. If it doesn't, you have misread one of the three — re-read that row.
- Also check that won + drawn + lost equals played for every row. If it doesn't, re-read that row before answering.
- If a club has a points deduction the points will be lower than won*3 + drawn. That is legitimate — report the points exactly as printed, do not recalculate them.
- Use 0, not null, for a genuine zero. Only if a cell is truly unreadable, use null for that one field.
- Ignore any legend, form guide, promotion/relegation key, or notes below the table.
- Do not invent clubs that are not in the image.`;

type Body = { fileBase64?: string; mediaType?: string };

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Reading tables isn't set up yet — add ANTHROPIC_API_KEY in Vercel, then redeploy." },
      { status: 501 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Couldn't read that request." }, { status: 400 });
  }

  const { fileBase64, mediaType } = body;
  if (!fileBase64 || !mediaType) {
    return NextResponse.json({ error: "No file was sent." }, { status: 400 });
  }

  // base64 is roughly 4/3 the size of the bytes it encodes.
  if (fileBase64.length * 0.75 > MAX_BYTES) {
    return NextResponse.json(
      { error: "That file is too big — 8 MB is the limit. A screenshot of just the table works well." },
      { status: 413 }
    );
  }

  const isPdf = mediaType === "application/pdf";
  const allowed = isPdf || ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mediaType);
  if (!allowed) {
    return NextResponse.json({ error: "Send a PNG, JPEG, WebP or PDF." }, { status: 415 });
  }

  const content = [
    isPdf
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: fileBase64 } }
      : { type: "image", source: { type: "base64", media_type: mediaType, data: fileBase64 } },
    { type: "text", text: "Read this league table and return the JSON described in your instructions." },
  ];

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM,
        messages: [{ role: "user", content }],
      }),
    });
  } catch {
    return NextResponse.json({ error: "Couldn't reach the reading service." }, { status: 502 });
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // Surface the real reason — an expired key or a wrong model name is
    // otherwise indistinguishable from "it didn't work".
    let message = `The reading service returned ${res.status}.`;
    try {
      const parsed = JSON.parse(detail);
      if (parsed?.error?.message) message = parsed.error.message;
    } catch {
      /* keep the generic message */
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const payload = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (payload.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");

  // Belt and braces: strip a markdown fence if one sneaks in, and take the
  // outermost JSON object.
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) {
    return NextResponse.json(
      { error: "Couldn't find a league table in that file. Try a clearer screenshot of just the table." },
      { status: 422 }
    );
  }

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(parsed?.rows) || parsed.rows.length === 0) {
      return NextResponse.json({ error: "No clubs were found in that file." }, { status: 422 });
    }
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "The reading service returned something unreadable." }, { status: 502 });
  }
}
