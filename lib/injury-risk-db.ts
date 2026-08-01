import { supabase } from "./supabase";

// ---------------------------------------------------------------------------
// Fields — what the club tracks, decided by the analyst rather than by me
// ---------------------------------------------------------------------------

export const FIELD_ROLES = ["acute_load", "chronic_load", "wellness", "history", "other"] as const;
export type FieldRole = (typeof FIELD_ROLES)[number];

export const ROLE_LABELS: Record<FieldRole, string> = {
  acute_load: "Acute load (7 day)",
  chronic_load: "Chronic load (28 day)",
  wellness: "Wellness (1-5)",
  history: "Days since return",
  other: "Recorded only",
};

export const ROLE_HELP: Record<FieldRole, string> = {
  acute_load: "This week's workload. Paired with the chronic field to work out the acute:chronic ratio.",
  chronic_load: "The 28-day total. The weekly average is a quarter of it.",
  wellness: "A 1-5 self-report. Two or below counts as a flag.",
  history: "Days since returning from injury. The first month back carries more weight.",
  other: "Shown in the table and exported, but takes no part in the banding.",
};

export type DbRiskField = {
  id: string;
  key: string;
  label: string;
  unit: string | null;
  role: FieldRole;
  higher_is_better: boolean;
  extraction_hint: string | null;
  ai_extract: boolean;
  decimals: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type RiskFieldInput = {
  key: string;
  label: string;
  unit: string;
  role: FieldRole;
  higherIsBetter: boolean;
  extractionHint: string;
  aiExtract: boolean;
  decimals: number;
  sortOrder: number;
};

export function slugifyFieldKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export async function fetchRiskFields(includeInactive = false): Promise<DbRiskField[]> {
  if (!supabase) return [];
  let q = supabase.from("injury_risk_fields").select("*").order("sort_order").order("label");
  if (!includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as DbRiskField[];
}

export async function createRiskField(input: RiskFieldInput): Promise<DbRiskField> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("injury_risk_fields")
    .insert({
      key: input.key,
      label: input.label,
      unit: input.unit || null,
      role: input.role,
      higher_is_better: input.higherIsBetter,
      extraction_hint: input.extractionHint || null,
      ai_extract: input.aiExtract,
      decimals: input.decimals,
      sort_order: input.sortOrder,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DbRiskField;
}

export async function updateRiskField(
  id: string,
  patch: Partial<RiskFieldInput> & { isActive?: boolean }
): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const row: Record<string, unknown> = {};
  if (patch.label !== undefined) row.label = patch.label;
  if (patch.unit !== undefined) row.unit = patch.unit || null;
  if (patch.role !== undefined) row.role = patch.role;
  if (patch.higherIsBetter !== undefined) row.higher_is_better = patch.higherIsBetter;
  if (patch.extractionHint !== undefined) row.extraction_hint = patch.extractionHint || null;
  if (patch.aiExtract !== undefined) row.ai_extract = patch.aiExtract;
  if (patch.decimals !== undefined) row.decimals = patch.decimals;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  // The key is deliberately not updatable — values are stored against it, and
  // renaming it would orphan a season of numbers.
  const { error } = await supabase.from("injury_risk_fields").update(row).eq("id", id);
  if (error) throw error;
}

// Hidden rather than deleted, so historical entries keep their meaning.
export async function deactivateRiskField(id: string): Promise<void> {
  await updateRiskField(id, { isActive: false });
}

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

export type RiskValues = Record<string, number>;

export type DbRiskEntry = {
  id: string;
  player_id: string;
  week_start: string;
  values: RiskValues;
  previous_injury: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function normalise(row: Record<string, unknown>): DbRiskEntry {
  const e = row as DbRiskEntry;
  return { ...e, values: e.values && typeof e.values === "object" ? e.values : {} };
}

export async function fetchRiskEntries(weekStart?: string): Promise<DbRiskEntry[]> {
  if (!supabase) return [];
  let q = supabase.from("injury_risk_entries").select("*").order("week_start", { ascending: false });
  if (weekStart) q = q.eq("week_start", weekStart);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(normalise);
}

export async function saveRiskEntry(input: {
  playerId: string;
  weekStart: string;
  values: RiskValues;
  previousInjury: boolean;
  notes?: string | null;
}): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("injury_risk_entries").upsert(
    {
      player_id: input.playerId,
      week_start: input.weekStart,
      values: input.values,
      previous_injury: input.previousInjury,
      notes: input.notes ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "player_id,week_start" }
  );
  if (error) throw error;
}

export async function deleteRiskEntry(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("injury_risk_entries").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Weeks and the season
// ---------------------------------------------------------------------------

// The Monday of whichever week a date falls in.
export function weekStartOf(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : new Date(date);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

export function addWeeks(weekStart: string, n: number): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + n * 7);
  return d.toISOString().slice(0, 10);
}

export function formatWeek(weekStart: string): string {
  const start = new Date(weekStart);
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${start.toLocaleDateString("en-GB", o)} – ${end.toLocaleDateString("en-GB", o)}`;
}

export function shortWeek(weekStart: string): string {
  return new Date(weekStart).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Every Monday from the season's start to the current week, so the tracker
// covers the whole season rather than only the weeks somebody remembered to
// fill in. Weeks with no entries simply show as blank, which is itself worth
// seeing.
export function seasonWeeks(seasonStart: string, upTo: Date = new Date()): string[] {
  const first = weekStartOf(seasonStart);
  const last = weekStartOf(upTo);
  const out: string[] = [];
  let cursor = first;
  // A season is ~46 weeks; the cap is a runaway guard, not a limit anyone
  // will meet.
  for (let i = 0; i < 120 && cursor <= last; i++) {
    out.push(cursor);
    cursor = addWeeks(cursor, 1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Risk banding
//
// This is a workload flag, not a diagnosis, and the app says so wherever it is
// shown. The acute:chronic workload ratio is a well-known conditioning
// heuristic — a sharp rise in this week's load against the recent average is
// worth a conversation — but it predicts nothing on its own. It exists to
// prompt "has anyone asked him how he feels?", a question that otherwise gets
// asked after somebody pulls up rather than before.
// ---------------------------------------------------------------------------

export type RiskBand = "low" | "moderate" | "high" | "unknown";

export const RISK_LABEL: Record<RiskBand, string> = {
  low: "Low", moderate: "Monitor", high: "Elevated", unknown: "No data",
};

export const RISK_TONE: Record<RiskBand, string> = {
  low: "bg-emerald-500/15 text-emerald-300",
  moderate: "bg-amber-500/15 text-amber-300",
  high: "bg-red-500/15 text-red-300",
  unknown: "bg-white/5 text-neutral-400",
};

export type RiskAssessment = { band: RiskBand; ratio: number | null; reasons: string[] };

export function acwr(entry: DbRiskEntry, fields: DbRiskField[]): number | null {
  const acuteFields = fields.filter((f) => f.role === "acute_load");
  const chronicFields = fields.filter((f) => f.role === "chronic_load");
  for (const a of acuteFields) {
    const acute = entry.values[a.key];
    if (typeof acute !== "number") continue;
    for (const c of chronicFields) {
      const chronic = entry.values[c.key];
      if (typeof chronic !== "number" || chronic <= 0) continue;
      // The chronic figure is a 28-day total, so the comparable week is a
      // quarter of it. Comparing a week against a month would make every
      // ratio look alarmingly low.
      const weekly = chronic / 4;
      if (weekly > 0) return acute / weekly;
    }
  }
  return null;
}

export function assessRisk(entry: DbRiskEntry, fields: DbRiskField[]): RiskAssessment {
  const reasons: string[] = [];
  const ratio = acwr(entry, fields);
  let score = 0;

  if (ratio !== null) {
    if (ratio > 1.5) { score += 2; reasons.push(`Workload spike — ${ratio.toFixed(2)}× the recent average`); }
    else if (ratio > 1.3) { score += 1; reasons.push(`Load rising — ${ratio.toFixed(2)}× the recent average`); }
    else if (ratio < 0.8) { score += 1; reasons.push(`Undertrained — ${ratio.toFixed(2)}× the recent average`); }
  }

  let poor = 0;
  for (const f of fields.filter((x) => x.role === "wellness")) {
    const raw = entry.values[f.key];
    if (typeof raw !== "number") continue;
    // Normalise so 5 always means good, whichever way the club's scale runs.
    const value = f.higher_is_better ? raw : 6 - raw;
    if (value <= 2) { poor += 1; reasons.push(`Low ${f.label.toLowerCase()}`); }
  }
  if (poor >= 2) score += 2;
  else if (poor === 1) score += 1;

  if (entry.previous_injury) {
    const historyField = fields.find((f) => f.role === "history");
    const days = historyField ? entry.values[historyField.key] : undefined;
    if (typeof days === "number" && days <= 28) {
      score += 2;
      reasons.push(`Only ${days} days back from injury`);
    } else {
      score += 1;
      reasons.push("Previous injury this season");
    }
  }

  const hasAnything = Object.values(entry.values).some((v) => typeof v === "number") || entry.previous_injury;
  if (!hasAnything) return { band: "unknown", ratio, reasons: [] };

  const band: RiskBand = score >= 3 ? "high" : score >= 1 ? "moderate" : "low";
  return { band, ratio, reasons };
}

// ---------------------------------------------------------------------------
// Season summary per player
// ---------------------------------------------------------------------------

export type SeasonSummary = {
  playerId: string;
  weeksRecorded: number;
  elevatedWeeks: number;
  monitorWeeks: number;
  latestBand: RiskBand;
  latestWeek: string | null;
  averageRatio: number | null;
  // Oldest → newest, so a sparkline reads left to right.
  trend: { week: string; band: RiskBand; ratio: number | null }[];
};

export function summariseSeason(entries: DbRiskEntry[], fields: DbRiskField[]): SeasonSummary[] {
  const byPlayer = new Map<string, DbRiskEntry[]>();
  for (const e of entries) byPlayer.set(e.player_id, [...(byPlayer.get(e.player_id) ?? []), e]);

  const out: SeasonSummary[] = [];
  for (const [playerId, list] of byPlayer) {
    const sorted = [...list].sort((a, b) => a.week_start.localeCompare(b.week_start));
    const trend = sorted.map((e) => {
      const a = assessRisk(e, fields);
      return { week: e.week_start, band: a.band, ratio: a.ratio };
    });
    const ratios = trend.map((t) => t.ratio).filter((r): r is number => r !== null);
    const latest = trend[trend.length - 1];
    out.push({
      playerId,
      weeksRecorded: sorted.length,
      elevatedWeeks: trend.filter((t) => t.band === "high").length,
      monitorWeeks: trend.filter((t) => t.band === "moderate").length,
      latestBand: latest?.band ?? "unknown",
      latestWeek: latest?.week ?? null,
      averageRatio: ratios.length ? ratios.reduce((s, r) => s + r, 0) / ratios.length : null,
      trend,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function riskRowsToCsv(
  entries: DbRiskEntry[],
  fields: DbRiskField[],
  nameFor: (playerId: string) => string
): string {
  const header = [
    "Player", "Week",
    ...fields.map((f) => (f.unit ? `${f.label} (${f.unit})` : f.label)),
    "Previous injury", "A:C ratio", "Band", "Reasons", "Notes",
  ];
  const lines = [header.join(",")];
  const sorted = [...entries].sort(
    (a, b) => a.week_start.localeCompare(b.week_start) || nameFor(a.player_id).localeCompare(nameFor(b.player_id))
  );
  for (const e of sorted) {
    const a = assessRisk(e, fields);
    lines.push([
      `"${nameFor(e.player_id).replace(/"/g, '""')}"`,
      e.week_start,
      ...fields.map((f) => {
        const v = e.values[f.key];
        return typeof v === "number" ? String(v) : "";
      }),
      e.previous_injury ? "yes" : "no",
      a.ratio === null ? "" : a.ratio.toFixed(2),
      RISK_LABEL[a.band],
      `"${a.reasons.join("; ").replace(/"/g, '""')}"`,
      `"${(e.notes ?? "").replace(/"/g, '""')}"`,
    ].join(","));
  }
  return lines.join("\n");
}
