import { NextResponse } from "next/server";

// Reads a player stats table off a screenshot or PDF and maps its columns onto
// the club's own metrics.
//
// The metric list is passed in from the browser rather than hard-coded,
// because metrics in ClubOS are data, not code — an analyst can add
// "Progressive Carries" from the Metrics tab and this has to pick it up
// without anyone editing this file.
export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const MAX_BYTES = 8 * 1024 * 1024;

type Metric = { key: string; label: string; unit?: string | null };
type Body = { fileBase64?: string; mediaType?: string; metrics?: Metric[] };

function systemPrompt(metrics: Metric[]): string {
  const list = metrics
    .map((m) => `- "${m.key}" — ${m.label}${m.unit ? ` (in ${m.unit})` : ""}`)
    .join("\n");

  return `You read football player statistics tables from images and PDFs and return them as JSON.

The file contains a table with one row per player and columns of statistics. Map each column onto one of the club's metrics below. A column that doesn't correspond to any of them is ignored.

Club metrics:
${list}

Return ONLY a JSON object, no prose, no markdown fences, in exactly this shape:

{
  "label": "any title, fixture or date shown on the report, or null",
  "sessionDate": "YYYY-MM-DD if a date is shown, otherwise null",
  "rows": [
    { "player_name": "exactly as printed", "values": { "<metric key>": number } }
  ]
}

Rules:
- Only use metric keys from the list above. Never invent a key.
- Omit a metric entirely rather than guessing a value for it.
- Include every player row, in the order they appear.
- Strip thousands separators: "10,412" is 10412.
- Convert to the unit given in brackets for that metric where one is stated. Distances in km become metres; speeds in m/s become km/h by multiplying by 3.6.
- Percentages are plain numbers: "83%" is 83.
- If a value is blurred, cut off or unreadable, omit it rather than guessing.
- Do not treat team totals, averages or summary rows as players.`;
}

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

  const { fileBase64, mediaType, metrics } = body;
  if (!fileBase64 || !mediaType) {
    return NextResponse.json({ error: "No file was sent." }, { status: 400 });
  }
  if (!Array.isArray(metrics) || metrics.length === 0) {
    return NextResponse.json(
      { error: "No metrics are set up yet — add some on the Metrics tab first, so there's something to map the columns onto." },
      { status: 400 }
    );
  }

  if (fileBase64.length * 0.75 > MAX_BYTES) {
    return NextResponse.json(
      { error: "That file is too big — 8 MB is the limit. A screenshot of just the table works well." },
      { status: 413 }
    );
  }

  const isPdf = mediaType === "application/pdf";
  if (!isPdf && !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mediaType)) {
    return NextResponse.json({ error: "Send a PNG, JPEG, WebP or PDF." }, { status: 415 });
  }

  const content = [
    isPdf
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: fileBase64 } }
      : { type: "image", source: { type: "base64", media_type: mediaType, data: fileBase64 } },
    { type: "text", text: "Read this stats table and return the JSON described in your instructions." },
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
        system: systemPrompt(metrics),
        messages: [{ role: "user", content }],
      }),
    });
  } catch {
    return NextResponse.json({ error: "Couldn't reach the reading service." }, { status: 502 });
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
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
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) {
    return NextResponse.json(
      { error: "Couldn't find a table in that file. Try a clearer screenshot of just the stats table." },
      { status: 422 }
    );
  }

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(parsed?.rows) || parsed.rows.length === 0) {
      return NextResponse.json({ error: "No player rows were found in that file." }, { status: 422 });
    }
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "The reading service returned something unreadable." }, { status: 502 });
  }
}
