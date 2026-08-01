import { NextResponse } from "next/server";

// Reads a workload or wellness table off a screenshot or PDF for the Season
// Injury Risk Tracker.
//
// The fields to look for are sent up from the browser, not hard-coded here.
// That's the whole point: an analyst adds "Hamstring soreness" with a hint
// describing where it appears on their report, and this finds it without
// anyone touching this file.
export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const MAX_BYTES = 8 * 1024 * 1024;

type Field = {
  key: string;
  label: string;
  unit?: string | null;
  role?: string;
  higherIsBetter?: boolean;
  hint?: string | null;
};
type Body = { fileBase64?: string; mediaType?: string; fields?: Field[] };

function systemPrompt(fields: Field[]): string {
  const list = fields
    .map((f) => {
      const bits = [`- "${f.key}" — ${f.label}`];
      if (f.unit) bits.push(`in ${f.unit}`);
      if (f.role === "wellness") {
        bits.push(
          f.higherIsBetter === false
            ? "on a 1-5 scale where a LOW number is better; invert it so 5 always means best (use 6 minus the value)"
            : "on a 1-5 scale where 5 is best"
        );
      }
      let line = bits.join(", ");
      if (f.hint) line += `. ${f.hint}`;
      return line;
    })
    .join("\n");

  return `You read football squad workload and wellness tables from images and PDFs and return them as JSON.

The club tracks these fields. Map the table's columns onto them. A column that matches none of them is ignored.

${list}

Return ONLY a JSON object, no prose, no markdown fences, in exactly this shape:

{
  "weekStart": "YYYY-MM-DD for the Monday of the week the data covers, or null",
  "rows": [
    {
      "player_name": "exactly as printed",
      "previous_injury": true or false or null,
      "values": { "<field key>": number }
    }
  ]
}

Rules:
- Only use field keys from the list above. Never invent a key.
- Omit a field entirely rather than guessing a value for it.
- Include every player row you can see, in the order they appear.
- Strip thousands separators: "10,412" is 10412.
- Convert to the unit stated for that field. Kilometres become metres; m/s becomes km/h by multiplying by 3.6.
- Percentages are plain numbers: "83%" is 83.
- Where a field says to invert a scale, do the inversion before returning it.
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

  const { fileBase64, mediaType, fields } = body;
  if (!fileBase64 || !mediaType) {
    return NextResponse.json({ error: "No file was sent." }, { status: 400 });
  }
  if (!Array.isArray(fields) || fields.length === 0) {
    return NextResponse.json(
      { error: "No fields are set up for reading — add some on the Fields tab and tick \"read from uploads\"." },
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
    { type: "text", text: "Read this table and return the JSON described in your instructions." },
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
        system: systemPrompt(fields),
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
      { error: "Couldn't find a table in that file. Try a clearer screenshot of just the table." },
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
