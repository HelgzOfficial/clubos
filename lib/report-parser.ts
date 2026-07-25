// Best-effort extraction of goals / lineup / substitutions from an uploaded
// Hudl or Wyscout match report. There is no official public export spec for
// either platform, so this uses heuristics against common patterns rather
// than a guaranteed-correct parser — extracted data should always be reviewed
// before importing into the fixture.

export type ParsedGoal = { minute: number | null; scorer: string; assist: string };
export type ParsedLineupEntry = { shirtNumber: string; playerName: string; isStarting: boolean };
export type ParsedSub = { minute: number | null; playerOff: string; playerOn: string };

export type ParsedReport = {
  goals: ParsedGoal[];
  lineup: ParsedLineupEntry[];
  substitutions: ParsedSub[];
  rawTextPreview: string;
};

let pdfjsLoadPromise: Promise<any> | null = null;

// Loads pdf.js from a CDN at runtime instead of bundling it, so this feature
// doesn't add a new build dependency to a project we can't test-build locally.
function loadPdfJs(): Promise<any> {
  if (pdfjsLoadPromise) return pdfjsLoadPromise;
  pdfjsLoadPromise = new Promise((resolve, reject) => {
    const w = window as any;
    if (w.pdfjsLib) {
      resolve(w.pdfjsLib);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.js";
    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (!lib) {
        reject(new Error("pdf.js failed to load."));
        return;
      }
      lib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js";
      resolve(lib);
    };
    script.onerror = () => reject(new Error("pdf.js failed to load."));
    document.head.appendChild(script);
  });
  return pdfjsLoadPromise;
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await loadPdfJs();
  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it: any) => ("str" in it ? it.str : "")).join(" ") + "\n";
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

// Heuristic goal pattern: a minute marker (e.g. "45'", "45’", "90+2'") followed
// by a name, optionally with an assist in brackets or after "assist"/"(A)".
const GOAL_LINE = /(\d{1,3}(?:\s*\+\s*\d{1,2})?)\s*['’′]\s*[-–—:]?\s*([A-Z][A-Za-z.'\- ]{2,40})(?:\s*\(?(?:assist|A)[:\s]+([A-Z][A-Za-z.'\- ]{2,40})\)?)?/g;

// Heuristic substitution pattern: minute + "OUT"/"off" name + "IN"/"on" name.
const SUB_LINE = /(\d{1,3})\s*['’′]?\s*(?:SUB|Substitution)?[:\s]*([A-Z][A-Za-z.'\- ]{2,40})\s*(?:off|OUT|→|->|out for)\s*(?:for\s*)?([A-Z][A-Za-z.'\- ]{2,40})/gi;

// Heuristic lineup line: a shirt number followed by a name, one per line —
// common in exported team-sheet tables. Only used if several consecutive
// lines match, to avoid false positives on unrelated numbered lists.
const LINEUP_LINE = /^\s*(\d{1,2})[.)\s]+([A-Z][A-Za-z.'\- ]{2,40})\s*$/;

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

function parseSubs(text: string): ParsedSub[] {
  const subs: ParsedSub[] = [];
  let m: RegExpExecArray | null;
  SUB_LINE.lastIndex = 0;
  while ((m = SUB_LINE.exec(text))) {
    subs.push({ minute: Number(m[1]) || null, playerOff: m[2].trim(), playerOn: m[3].trim() });
  }
  return subs;
}

function parseLineup(text: string): ParsedLineupEntry[] {
  const lines = text.split(/\r?\n/);
  const matches: { shirtNumber: string; playerName: string }[] = [];
  for (const line of lines) {
    const m = line.match(LINEUP_LINE);
    if (m) matches.push({ shirtNumber: m[1], playerName: m[2].trim() });
  }
  // Only treat these as a real lineup if there's a plausible squad-sized run of them.
  if (matches.length < 7) return [];
  return matches.slice(0, 18).map((entry, i) => ({ ...entry, isStarting: i < 11 }));
}

export function parseReportText(text: string): ParsedReport {
  return {
    goals: parseGoals(text),
    substitutions: parseSubs(text),
    lineup: parseLineup(text),
    rawTextPreview: text.slice(0, 4000),
  };
}
