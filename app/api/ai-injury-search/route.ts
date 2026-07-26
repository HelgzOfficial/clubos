import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are assisting a football club's medical staff (doctor/physio) with general information
about sports injuries, treatment approaches, and rehabilitation exercises. Give clear, practical,
well-established information a club physio would find useful — likely causes, typical treatment
pathways, and example rehab exercises with rough progression stages where relevant.

This is informational support only, not a diagnosis and not a substitute for the clinician's own
judgement, in-person assessment, or applicable medical guidelines. Keep answers focused and
practical rather than exhaustive.`;

export async function POST(req: Request) {
  let body: { query?: string; playerId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const query = body.query?.trim();
  if (!query) {
    return NextResponse.json({ error: "Enter a question first." }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI search isn't set up yet — add an ANTHROPIC_API_KEY environment variable in Vercel, then redeploy." },
      { status: 501 }
    );
  }

  let answer: string;
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
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: query }],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return NextResponse.json({ error: `AI request failed (${aiRes.status}): ${errText.slice(0, 300)}` }, { status: 502 });
    }

    const data = await aiRes.json();
    answer = data?.content?.[0]?.text ?? "";
    if (!answer) {
      return NextResponse.json({ error: "The AI didn't return a usable answer — try rephrasing your question." }, { status: 502 });
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI request failed." }, { status: 502 });
  }

  // Best-effort logging so past searches show up in the "Recent searches" list.
  // Uses the service role key (server-only) to bypass RLS, same pattern as the fixture sync route.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceKey) {
    try {
      const admin = createClient(supabaseUrl, serviceKey);
      await admin.from("ai_search_logs").insert({
        player_id: body.playerId || null,
        query,
        answer,
      });
    } catch {
      // Logging failures shouldn't block returning the answer to the user.
    }
  }

  return NextResponse.json({ answer });
}
