// Minimal parser for the specific ICS feed AFC Whyteleafe publish
// (https://afcwhyteleafe.com/fixtures/first-team.ics) — not a general-purpose ICS library.

export type ParsedFixture = {
  sourceUid: string;
  kickoff: string; // ISO 8601 UTC
  opponent: string;
  isHome: boolean;
  competition: string;
  venue: string | null;
  sourceUrl: string | null;
};

function unfold(ics: string) {
  // ICS "folds" long lines with a leading space/tab on the continuation line.
  return ics.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}

function field(chunk: string, name: string): string | null {
  const re = new RegExp(`(?:^|\\n)${name}(?:;[^:]*)?:(.*)`);
  const m = chunk.match(re);
  return m ? m[1].trim() : null;
}

function parseIcsDate(dt: string): string {
  const y = dt.slice(0, 4);
  const mo = dt.slice(4, 6);
  const d = dt.slice(6, 8);
  const h = dt.slice(9, 11) || "00";
  const mi = dt.slice(11, 13) || "00";
  const s = dt.slice(13, 15) || "00";
  return `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
}

export function parseFixturesIcs(ics: string): ParsedFixture[] {
  const text = unfold(ics);
  const chunks = text.split("BEGIN:VEVENT").slice(1).map((c) => c.split("END:VEVENT")[0]);
  const fixtures: ParsedFixture[] = [];

  for (const chunk of chunks) {
    const uid = field(chunk, "UID");
    const dtstart = field(chunk, "DTSTART");
    const descRaw = field(chunk, "DESCRIPTION");
    const url = field(chunk, "URL");
    const location = field(chunk, "LOCATION");
    if (!uid || !dtstart || !descRaw) continue;

    const desc = descRaw.replace(/\\,/g, ",");
    // Description format: "<Home> vs <Away> in <Competition> at <Venue>."
    const match = desc.match(/^(.*?) vs (.*?) in (.*?) at (.*?)\.?$/);
    if (!match) continue;
    const [, home, away, competition, venueFromDesc] = match;

    const isHome = home.includes("Whyteleafe");
    const opponent = (isHome ? away : home).trim();
    const venue = location ? location.replace(/\\,/g, ",") : venueFromDesc.trim();

    fixtures.push({
      sourceUid: uid,
      kickoff: parseIcsDate(dtstart),
      opponent,
      isHome,
      competition: competition.trim(),
      venue: venue || null,
      sourceUrl: url,
    });
  }

  return fixtures;
}
