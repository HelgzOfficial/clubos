import { NextResponse } from "next/server";

// Reads a Pitchero GPS report — a screenshot or a PDF — and returns the table
// as structured rows.
//
// This runs on the server for one reason: the Anthropic API key. Anything with
// NEXT_PUBLIC_ on it is visible to every visitor, so the key must never reach
// the browser. The file goes up, the numbers come back, the key stays here.
export const runtime = "nodejs";
// Reading a full squad's report takes a few seconds.
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const MAX_BYTES = 8 * 1024 * 1024;

const SYSTEM = `You read GPS performance reports for a football club and return the data as JSON.

The image or PDF is a report from Pitchero GPS. It contains a table with one row per player and columns of physical metrics.

Return ONLY a JSON object, no prose, no markdown fences, in exactly this shape:

{
  "sessionDate": "YYYY-MM-DD or null if not shown",
  "label": "any title/fixture shown on the report, or null",
  "rows": [
    {
      "player_name": "exactly as printed on the report",
      "minutes_played": number or null,
      "distance_m": number or null,
      "sprint_distance_m": number or null,
      "top_speed_kmh": number or null,
      "avg_speed_kmh": number or null,
      "sprints": number or null,
      "accelerations": number or null,
      "decelerations": number or null,
      "power_score": number or null
    }
  ]
}

Rules:
- Include every player row you can see, in the order they appear.
- Use null for any metric the report doesn't show. Never invent a value.
- Convert distances to metres. If a figure is in kilometres (e.g. "9.4 km"), multiply by 1000.
- Convert speeds to km/h. If given in m/s, multiply by 3.6. If in mph, multiply by 1.60934.
- Strip thousands separators: "10,412" is 10412.
- If a number is cut off, blurred or genuinely unreadable, use null rather than guessing.
- Do not include team totals, averages or summary rows as if they were players.`;

type Body = { fileBase64?: string; mediaType?: string };

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Reading reports isn't set up yet — add ANTHROPIC_API_KEY in Vercel, then redeploy." },
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
    return NextResponse.json(
      { error: "Send a PNG, JPEG, WebP or PDF." },
      { status: 415 }
    );
  }

  const content = [
    isPdf
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: fileBase64 } }
      : { type: "image", source: { type: "base64", media_type: mediaType, data: fileBase64 } },
    { type: "text", text: "Read this GPS report and return the JSON described in your instructions." },
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
      { error: "Couldn't find a table in that file. Try a clearer screenshot of just the metrics table." },
      { status: 422 }
    );
  }

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(parsed?.rows) || parsed.rows.length === 0) {
      return NextResponse.json(
        { error: "No player rows were found in that file." },
        { status: 422 }
      );
    }
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "The reading service returned something unreadable." }, { status: 502 });
  }
}
