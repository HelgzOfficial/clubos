import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Builds a real .ics calendar invite for a booked treatment slot and emails
// it to both the player and the doctor/physio who booked it, via Resend.
// Attendees get an "Add to calendar" prompt in Gmail/Outlook/Apple Mail from
// the attached .ics file, same as any other meeting invite.

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toICSDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function escapeICS(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function buildICS(opts: {
  uid: string;
  summary: string;
  description: string;
  location: string;
  start: string;
  end: string;
  organizerEmail: string;
  organizerName: string;
  attendees: { name: string; email: string }[];
}) {
  const now = toICSDate(new Date().toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ClubOS//Treatment Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${toICSDate(opts.start)}`,
    `DTEND:${toICSDate(opts.end)}`,
    `SUMMARY:${escapeICS(opts.summary)}`,
    `DESCRIPTION:${escapeICS(opts.description)}`,
    opts.location ? `LOCATION:${escapeICS(opts.location)}` : "",
    `ORGANIZER;CN=${escapeICS(opts.organizerName)}:mailto:${opts.organizerEmail}`,
    ...opts.attendees.map(
      (a) => `ATTENDEE;CN=${escapeICS(a.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${a.email}`
    ),
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}

export async function POST(req: Request) {
  let body: {
    bookingId?: string;
    treatmentType?: string;
    startTime?: string;
    endTime?: string;
    notes?: string;
    player?: { name: string; email: string };
    doctor?: { name: string; email: string };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { bookingId, treatmentType, startTime, endTime, notes, player, doctor } = body;
  if (!bookingId || !startTime || !endTime) {
    return NextResponse.json({ error: "Missing booking details." }, { status: 400 });
  }
  if (!player?.email && !doctor?.email) {
    return NextResponse.json({ error: "Neither the player nor the doctor has an email on file — nothing to send to." }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Calendar invites aren't set up yet — add a RESEND_API_KEY environment variable in Vercel, then redeploy." },
      { status: 501 }
    );
  }

  const playerName = player?.name || "the player";
  const doctorName = doctor?.name || "the club's medical staff";
  const summary = `${treatmentType || "Treatment"} — ${playerName}`;
  const description = [
    `Treatment session for ${playerName}, arranged by ${doctorName}.`,
    notes ? `Notes: ${notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const recipients = [player?.email, doctor?.email].filter((e): e is string => !!e);

  const ics = buildICS({
    uid: `treatment-${bookingId}@clubos`,
    summary,
    description,
    location: "AFC Whyteleafe Medical Room",
    start: startTime,
    end: endTime,
    organizerEmail: doctor?.email || player?.email || "noreply@clubos.app",
    organizerName: doctorName,
    attendees: [
      player?.email ? { name: playerName, email: player.email } : null,
      doctor?.email ? { name: doctorName, email: doctor.email } : null,
    ].filter((a): a is { name: string; email: string } => !!a),
  });

  const icsBase64 = Buffer.from(ics, "utf-8").toString("base64");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "ClubOS <noreply@clubosapp.co>",
        to: recipients,
        subject: `Treatment booked: ${summary}`,
        html: `<p>A treatment session has been booked.</p>
<p><b>${treatmentType || "Treatment"}</b><br/>
Player: ${playerName}<br/>
With: ${doctorName}<br/>
${new Date(startTime).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" })}</p>
${notes ? `<p>Notes: ${notes}</p>` : ""}
<p>A calendar invite is attached — open it to add this to your calendar.</p>`,
        attachments: [
          {
            filename: "treatment.ics",
            content: icsBase64,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Couldn't send the invite (${res.status}): ${errText.slice(0, 300)}` }, { status: 502 });
    }

    return NextResponse.json({ ok: true, sentTo: recipients });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't send the invite." }, { status: 502 });
  }
}
