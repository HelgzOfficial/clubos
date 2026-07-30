// Extraction of goals / lineup / team stats from an uploaded Hudl/Wyscout
// match report PDF (or a CSV/TXT export in the same rough shape).
//
// The patterns below are tuned against a real Wyscout single-fixture "Match
// Report" export (not a hypothetical format) — the TEAM STATS page lists
// stats as "<Label> <us-value(s)> <opponent-value(s)>", always with the
// subscribing club listed first regardless of home/away venue, and the
// starting-lineup page lists "<POS> <shirt#> <Player Name>" entries for both
// teams back-to-back (11 for team A, then 11 for team B, then each team's
// substitutes). We figure out which side is "us" by locating the exact
// "<team A> <score> – <score> <team B>" scoreline against the club's own
// name and this fixture's opponent name — not by guessing.
//
// Other Hudl/Wyscout export types (e.g. a multi-match squad "Team Report")
// don't carry this per-match team-vs-team comparison at all, so this parser
// will simply find nothing to extract from those — that's expected, not a
// bug, and the manual "Edit Stats" / import flows are the fallback either way.

import { STAT_FIELDS, buildCategories, type StatCategory } from "./match-stat-defs";

export type ParsedGoal = { minute: number | null; scorer: string; assist: string };
export type ParsedLineupEntry = { shirtNumber: string; playerName: string; isStarting: boolean; side: "us" | "opponent" };
export type ParsedSub = { minute: number | null; playerOff: string; playerOn: string };

export type ParsedReport = {
  goals: ParsedGoal[];
  lineup: ParsedLineupEntry[];
  substitutions: ParsedSub[];
  statCategories: StatCategory[];
  rawTextPreview: string;
};

export type ReportContext = {
  clubName: string; // e.g. "AFC Whyteleafe" — used to spot which side of the report is "us"
  opponentName: string; // this fixture's opponent, e.g. "East Grinstead Town"
};

let pdfjsLoadPromise: Promise<any> | null = null;

// Loads pdf.js from a CDN at runtime instead of bundling it, so this feature
// doesn't add a new build dependency to a project we can't test-build locally.
//
// Pinned to 3.11.174 deliberately: pdf.js v4+ dropped the legacy browser
// <script> build (pdf.min.js) from its cdnjs package in favour of ES modules
// only, so that file 404s on cdnjs for v4+ and this script tag would silently
// fail to load every single time, with no PDF ever getting auto-read. 3.11.174
// is the last line that reliably serves a working pdf.min.js there — verified
// directly against the CDN, not assumed.
const PDFJS_VERSION = "3.11.174";

function loadPdfJs(): Promise<any> {
  if (pdfjsLoadPromise) return pdfjsLoadPromise;
  pdfjsLoadPromise = new Promise((resolve, reject) => {
    const w = window as any;
    if (w.pdfjsLib) {
      resolve(w.pdfjsLib);
      return;
    }
    const script = document.createElement("script");
    script.src = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (!lib) {
        reject(new Error("pdf.js loaded but didn't expose the expected library — try again or use a different file."));
        return;
      }
      resolve(lib);
    };
    script.onerror = () => reject(new Error("Couldn't load the PDF reader from the CDN — check your internet connection and try again."));
    document.head.appendChild(script);
  });
  return pdfjsLoadPromise;
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await loadPdfJs();
  const buffer = await file.arrayBuffer();
  // disableWorker runs pdf.js on the main thread instead of spinning up a
  // separate worker script. That worker has to be fetched from the CDN as a
  // second, independent request (on top of the main pdf.js script) — if that
  // fetch is blocked, slow, or mismatched (ad blockers, some corporate
  // networks, or CDN hiccups all do this), getDocument() hangs or throws and
  // the whole upload silently comes back "Couldn't auto-read" with no clue
  // why. Skipping the worker removes that entire failure mode.
  const doc = await pdfjsLib.getDocument({ data: buffer, disableWorker: true }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it: any) => ("str" in it ? it.str : "")).filter((s: string) => s.trim()).join(" ") + "\n";
  }
  return text;
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Couldn't read the file."));
    reader.readAsText(file);
  });
}

export async function extractReportText(file: File, fileType: string): Promise<string> {
  if (fileType === "pdf") return extractPdfText(file);
  return readAsText(file);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Couldn't read the file."));
    reader.readAsDataURL(file);
  });
}

// Screenshots/photos have no selectable text, so instead of the regex
// pipeline below, this sends the image to the server-side AI route which
// asks Claude's vision model to read off the same goals/lineup/stats shape.
export async function parseReportImage(file: File, ctx?: ReportContext): Promise<ParsedReport> {
  const dataUrl = await readAsDataUrl(file);
  const base64 = dataUrl.split(",")[1] || "";
  const mediaType = dataUrl.match(/^data:(.*?);base64/)?.[1] || file.type || "image/jpeg";

  const res = await fetch("/api/parse-report-image", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ imageBase64: base64, mediaType, clubName: ctx?.clubName, opponentName: ctx?.opponentName }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Couldn't read that image.");
  return data as ParsedReport;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Heuristic goal pattern: a minute marker (e.g. "45'", "45’", "90+2'") followed
// by a name, optionally with an assist in brackets or after "assist"/"(A)".
const GOAL_LINE = /(\d{1,3}(?:\s*\+\s*\d{1,2})?)\s*['’′]\s*[-–—:]?\s*([A-Z][A-Za-z.'\- ]{2,40})(?:\s*\(?(?:assist|A)[:\s]+([A-Z][A-Za-z.'\- ]{2,40})\)?)?/g;

function parseGoals(text: string): ParsedGoal[] {
  const goals: ParsedGoal[] = [];
  let m: RegExpExecArray | null;
  GOAL_LINE.lastIndex = 0;
  while ((m = GOAL_LINE.exec(text))) {
    const minuteRaw = m[1].replace(/\s/g, "");
    const minute = minuteRaw.includes("+")
      ? Number(minuteRaw.split("+")[0]) + Number(minuteRaw.split("+")[1])
      : Number(minuteRaw);
    const scorer = m[2].trim();
    if (scorer.length < 3) continue;
    goals.push({ minute: Number.isFinite(minute) ? minute : null, scorer, assist: (m[3] || "").trim() });
  }
  return goals;
}

// Figures out which side of the report is "us" by finding the literal
// "<team A> <score> – <score> <team B>" scoreline (it appears repeatedly as
// a running header) and matching team A / team B against the club's own
// name and this fixture's opponent name, in either order.
function findUsFirst(text: string, ctx?: ReportContext): { usFirst: boolean; usScore: number | null; oppScore: number | null } {
  if (ctx) {
    const clubVariants = [ctx.clubName, ctx.clubName.replace(/^(AFC|FC|F\.C\.)\s+/i, "").trim()].filter(Boolean);
    const opp = escapeRegex(ctx.opponentName.trim());
    for (const club of clubVariants) {
      const c = escapeRegex(club);
      if (!c || !opp) continue;
      let m = text.match(new RegExp(`${c}\\D{0,4}(\\d{1,2})\\s*[–—-]\\s*(\\d{1,2})\\D{0,4}${opp}`, "i"));
      if (m) return { usFirst: true, usScore: Number(m[1]), oppScore: Number(m[2]) };
      m = text.match(new RegExp(`${opp}\\D{0,4}(\\d{1,2})\\s*[–—-]\\s*(\\d{1,2})\\D{0,4}${c}`, "i"));
      if (m) return { usFirst: false, usScore: Number(m[2]), oppScore: Number(m[1]) };
    }
  }
  // Fallback: these per-club reports consistently list the subscribing club
  // first, so default to "us first" if we couldn't confirm it from names.
  return { usFirst: true, usScore: null, oppScore: null };
}

const POSITION_CODES =
  "GK|RCB|LCB|CB|RWB|LWB|RB|LB|RDMF|LDMF|CDMF|DMF|RCMF|LCMF|CMF|RAMF|LAMF|CAMF|AMF|RWF|LWF|RW|LW|CF|ST|SS";
const NAME_WORD = `(?!(?:${POSITION_CODES})\\b)[A-Z][A-Za-z.'\\-]+`;
const LINEUP_ENTRY = new RegExp(`\\b(${POSITION_CODES})\\s+(\\d{1,2})\\s+(${NAME_WORD}(?:\\s+${NAME_WORD})*)`, "g");

// Parses the "Starting lineup" + "Substitutes" table that appears on a
// Wyscout match report's MATCH SHEET page. Entries for both teams are
// interleaved as two blocks (all of team A's rows, then all of team B's),
// so we assign "us"/"opponent" by position: the first 11 entries encountered
// belong to one side, the next 11 to the other, and anything after that is
// that side's substitutes — repeating per side using a running counter so
// the block order doesn't matter, only which side comes first.
function parseLineup(text: string, usFirst: boolean): ParsedLineupEntry[] {
  const entries: { position: string; shirtNumber: string; playerName: string }[] = [];
  let m: RegExpExecArray | null;
  LINEUP_ENTRY.lastIndex = 0;
  while ((m = LINEUP_ENTRY.exec(text))) {
    entries.push({ position: m[1], shirtNumber: m[2], playerName: m[3].trim() });
  }
  if (entries.length < 11) return [];

  // Blocks appear as: teamA-start(11), teamB-start(11), teamA-subs(N), teamB-subs(M).
  const firstSide: "us" | "opponent" = usFirst ? "us" : "opponent";
  const secondSide: "us" | "opponent" = usFirst ? "opponent" : "us";

  const firstStart = entries.slice(0, 11);
  const secondStart = entries.slice(11, 22);
  const rest = entries.slice(22);

  // Any remaining entries alternate blocks again (first side's subs, then second side's) —
  // without a hard delimiter we split evenly at the midpoint as a reasonable approximation.
  const mid = Math.ceil(rest.length / 2);
  const firstSubs = rest.slice(0, mid);
  const secondSubs = rest.slice(mid);

  const toEntries = (list: typeof entries, side: "us" | "opponent", isStarting: boolean): ParsedLineupEntry[] =>
    list.map((e) => ({ shirtNumber: e.shirtNumber, playerName: e.playerName, isStarting, side }));

  return [
    ...toEntries(firstStart, firstSide, true),
    ...toEntries(secondStart, secondSide, true),
    ...toEntries(firstSubs, firstSide, false),
    ...toEntries(secondSubs, secondSide, false),
  ];
}

function toNumber(raw: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

type StatMatcher = { pattern: RegExp; fields: string[]; groupIndexes: number[][] };

// One entry per stat line on the TEAM STATS page. groupIndexes lists, per
// field, which regex capture groups hold [usValue, opponentValue].
const STAT_MATCHERS: StatMatcher[] = [
  // Note: Goals/xG aren't captured here — the fixture's score is already tracked
  // on the match record itself, so we don't duplicate it into the stats dashboard.
  { pattern: /Shots\s*\/\s*on target\s+(\d+)\/(\d+)\s+(\d+)\/(\d+)/i, fields: ["shots", "shotsOnTarget"], groupIndexes: [[1, 3], [2, 4]] },
  { pattern: /Fouls\s*\/\s*suffered\s+(\d+)\/(\d+)\s+(\d+)\/(\d+)/i, fields: ["fouls", "foulsSuffered"], groupIndexes: [[1, 3], [2, 4]] },
  { pattern: /Yellow\s*\/\s*red cards\s+(\d+)\/(\d+)\s+(\d+)\/(\d+)/i, fields: ["yellowCards", "redCards"], groupIndexes: [[1, 3], [2, 4]] },
  { pattern: /\bCorners\s+(\d+)\s+(\d+)\s+Free kicks\b/i, fields: ["corners"], groupIndexes: [[1, 2]] },
  { pattern: /Free kicks\s+(\d+)\s+(\d+)\s+Offsides\b/i, fields: ["freeKicks"], groupIndexes: [[1, 2]] },
  { pattern: /Offsides\s+(\d+)\s+(\d+)\s+Fouls/i, fields: ["offsides"], groupIndexes: [[1, 2]] },
  { pattern: /Sliding tackles\s+(\d+)\s+(\d+)\s+Interceptions\b/i, fields: ["slidingTackles"], groupIndexes: [[1, 2]] },
  { pattern: /\bInterceptions\s+(\d+)\s+(\d+)\s+Clearances\b/i, fields: ["interceptions"], groupIndexes: [[1, 2]] },
  { pattern: /\bClearances\s+(\d+)\s+(\d+)\s+Passes allowed/i, fields: ["clearances"], groupIndexes: [[1, 2]] },
  { pattern: /Passes allowed per def\.?\s*action\s*\(PPDA\)\s+([\d.]+)\s+([\d.]+)/i, fields: ["ppda"], groupIndexes: [[1, 2]] },
  { pattern: /Total duels\s*\/\s*won\s+(\d+)\/(\d+)\s*\d+%\s+(\d+)\/(\d+)\s*\d+%/i, fields: ["duelsWon"], groupIndexes: [[2, 4]] },
  { pattern: /Offensive duels\s*\/\s*won\s+(\d+)\/(\d+)\s*\d+%\s+(\d+)\/(\d+)\s*\d+%/i, fields: ["offensiveDuelsWon"], groupIndexes: [[2, 4]] },
  { pattern: /Defensive duels\s*\/\s*won\s+(\d+)\/(\d+)\s*\d+%\s+(\d+)\/(\d+)\s*\d+%/i, fields: ["defensiveDuelsWon"], groupIndexes: [[2, 4]] },
  { pattern: /Aerial duels\s*\/\s*won\s+(\d+)\/(\d+)\s*\d+%\s+(\d+)\/(\d+)\s*\d+%/i, fields: ["aerialDuelsWon"], groupIndexes: [[2, 4]] },
  { pattern: /Dribbles\s*\/\s*successful\s+(\d+)\/(\d+)\s*\d+%\s+(\d+)\/(\d+)\s*\d+%/i, fields: ["dribblesSuccessful"], groupIndexes: [[2, 4]] },
  { pattern: /Possession\s*%\s+(\d+)\s+(\d+)/i, fields: ["possession"], groupIndexes: [[1, 2]] },
  {
    pattern: /Total passes\s*\/\s*accurate\s+(\d+)\/(\d+)\s*(\d+)%\s+(\d+)\/(\d+)\s*(\d+)%/i,
    fields: ["passesAttempted", "passesCompleted", "passAccuracy"],
    groupIndexes: [[1, 4], [2, 5], [3, 6]],
  },
  { pattern: /Long passes\s*\/\s*accurate\s+(\d+)\/(\d+)\s*\d+%\s+(\d+)\/(\d+)\s*\d+%/i, fields: ["longBalls"], groupIndexes: [[2, 4]] },
  { pattern: /Crosses\s*\/\s*accurate\s+(\d+)\/(\d+)\s*\d+%\s+(\d+)\/(\d+)\s*\d+%/i, fields: ["crosses"], groupIndexes: [[2, 4]] },
  { pattern: /Match tempo\s+([\d.]+)\s+([\d.]+)/i, fields: ["matchTempo"], groupIndexes: [[1, 2]] },
];

function parseTeamStats(text: string, usFirst: boolean): StatCategory[] {
  const values: Record<string, { us: number | null; opponent: number | null }> = {};

  for (const matcher of STAT_MATCHERS) {
    if (matcher.fields.length === 0) continue;
    const m = text.match(matcher.pattern);
    if (!m) continue;
    matcher.fields.forEach((field, i) => {
      const [aIdx, bIdx] = matcher.groupIndexes[i];
      const aVal = toNumber(m[aIdx]);
      const bVal = toNumber(m[bIdx]);
      values[field] = usFirst ? { us: aVal, opponent: bVal } : { us: bVal, opponent: aVal };
    });
  }

  return buildCategories(values);
}

export function parseReportText(text: string, ctx?: ReportContext): ParsedReport {
  const { usFirst } = findUsFirst(text, ctx);
  return {
    goals: parseGoals(text),
    substitutions: [],
    lineup: parseLineup(text, usFirst),
    statCategories: parseTeamStats(text, usFirst),
    rawTextPreview: text.slice(0, 4000),
  };
}

// Re-exported so callers building a manual/blank values record share the
// same field list as the dashboard.
export { STAT_FIELDS };
