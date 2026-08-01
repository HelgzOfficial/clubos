import { supabase } from "./supabase";
import type { DbPlayer } from "./players-db";

export type GpsMetricKey =
  | "distance_m"
  | "sprint_distance_m"
  | "top_speed_kmh"
  | "avg_speed_kmh"
  | "accelerations"
  | "decelerations"
  | "sprints"
  | "minutes_played"
  | "power_score";

// Order matters — this is the order columns appear in the review table and in
// the CSV export.
export const GPS_METRICS: { key: GpsMetricKey; label: string; short: string; unit: string; decimals: number }[] = [
  { key: "minutes_played", label: "Minutes", short: "Min", unit: "", decimals: 0 },
  { key: "distance_m", label: "Total distance", short: "Dist", unit: "m", decimals: 0 },
  { key: "sprint_distance_m", label: "Sprint distance", short: "Sprint", unit: "m", decimals: 0 },
  { key: "top_speed_kmh", label: "Top speed", short: "Top", unit: "km/h", decimals: 1 },
  { key: "avg_speed_kmh", label: "Average speed", short: "Avg", unit: "km/h", decimals: 1 },
  { key: "sprints", label: "Sprints", short: "Spr", unit: "", decimals: 0 },
  { key: "accelerations", label: "Accelerations", short: "Acc", unit: "", decimals: 0 },
  { key: "decelerations", label: "Decelerations", short: "Dec", unit: "", decimals: 0 },
  { key: "power_score", label: "Power score", short: "Pwr", unit: "", decimals: 1 },
];

export type GpsRow = {
  player_id: string | null;
  player_name: string;
} & Partial<Record<GpsMetricKey, number | null>>;

export type DbGpsImport = {
  id: string;
  match_id: string | null;
  label: string | null;
  session_date: string;
  source_file_name: string | null;
  imported_at: string;
  imported_by: string | null;
};

export type DbGpsMetric = GpsRow & {
  id: string;
  import_id: string;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Matching report names to squad members
// ---------------------------------------------------------------------------

function canon(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// GPS reports write names inconsistently — "J. Smith", "Smith, Jack", "Jack
// Smith". Rather than demanding one format, this tries the obvious readings
// and gives up gracefully, because a wrong match is worse than no match.
export function matchPlayer(name: string, players: DbPlayer[]): DbPlayer | null {
  const target = canon(name);
  if (!target) return null;

  const exact = players.find((p) => canon(p.name) === target);
  if (exact) return exact;

  // "Smith, Jack" → "jack smith"
  if (target.includes(",")) {
    const flipped = canon(name.split(",").reverse().join(" "));
    const m = players.find((p) => canon(p.name) === flipped);
    if (m) return m;
  }

  const parts = target.split(" ");
  const surname = parts[parts.length - 1];
  const initial = parts.length > 1 ? parts[0][0] : null;

  // Surname plus first initial, which is what most reports actually print.
  if (initial) {
    const byInitial = players.filter((p) => {
      const pp = canon(p.name).split(" ");
      return pp[pp.length - 1] === surname && pp[0][0] === initial;
    });
    if (byInitial.length === 1) return byInitial[0];
  }

  // Surname alone, but only when it's unambiguous in the squad. Two Smiths
  // and it stays unmatched for a human to sort out.
  const bySurname = players.filter((p) => {
    const pp = canon(p.name).split(" ");
    return pp[pp.length - 1] === surname;
  });
  if (bySurname.length === 1) return bySurname[0];

  return null;
}

// ---------------------------------------------------------------------------
// Reads and writes
// ---------------------------------------------------------------------------

export async function fetchGpsImports(): Promise<DbGpsImport[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("gps_imports")
    .select("*")
    .order("session_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbGpsImport[];
}

export async function fetchGpsMetrics(importId: string): Promise<DbGpsMetric[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("gps_metrics")
    .select("*")
    .eq("import_id", importId);
  if (error) throw error;
  return (data ?? []) as DbGpsMetric[];
}

// Every row for one player, newest first, joined to its import so a player's
// page can show which fixture each set of numbers came from.
export async function fetchGpsForPlayer(
  playerId: string
): Promise<{ metric: DbGpsMetric; session: DbGpsImport }[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("gps_metrics")
    .select("*, gps_imports!inner(*)")
    .eq("player_id", playerId);
  if (error) throw error;
  const rows = (data ?? []) as (DbGpsMetric & { gps_imports: DbGpsImport })[];
  return rows
    .map((r) => ({ metric: r, session: r.gps_imports }))
    .sort((a, b) => b.session.session_date.localeCompare(a.session.session_date));
}

export async function saveGpsImport(input: {
  matchId: string | null;
  label: string | null;
  sessionDate: string;
  sourceFileName: string | null;
  importedBy: string | null;
  rows: GpsRow[];
}): Promise<DbGpsImport> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data: imp, error: impError } = await supabase
    .from("gps_imports")
    .insert({
      match_id: input.matchId,
      label: input.label,
      session_date: input.sessionDate,
      source_file_name: input.sourceFileName,
      imported_by: input.importedBy,
    })
    .select()
    .single();
  if (impError) throw impError;

  const importRow = imp as DbGpsImport;

  const payload = input.rows.map((r) => ({
    import_id: importRow.id,
    player_id: r.player_id,
    player_name: r.player_name,
    distance_m: r.distance_m ?? null,
    sprint_distance_m: r.sprint_distance_m ?? null,
    top_speed_kmh: r.top_speed_kmh ?? null,
    avg_speed_kmh: r.avg_speed_kmh ?? null,
    accelerations: r.accelerations ?? null,
    decelerations: r.decelerations ?? null,
    sprints: r.sprints ?? null,
    minutes_played: r.minutes_played ?? null,
    power_score: r.power_score ?? null,
  }));

  const { error: rowsError } = await supabase.from("gps_metrics").insert(payload);
  if (rowsError) {
    // Don't leave a headed import with nothing under it.
    await supabase.from("gps_imports").delete().eq("id", importRow.id);
    throw rowsError;
  }

  return importRow;
}

export async function deleteGpsImport(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  // gps_metrics cascades.
  const { error } = await supabase.from("gps_imports").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Formatting and export
// ---------------------------------------------------------------------------

export function formatMetric(value: number | null | undefined, key: GpsMetricKey): string {
  if (value === null || value === undefined) return "—";
  const meta = GPS_METRICS.find((m) => m.key === key);
  if (!meta) return String(value);
  const n = meta.decimals === 0 ? Math.round(value).toLocaleString("en-GB") : value.toFixed(meta.decimals);
  return meta.unit ? `${n} ${meta.unit}` : n;
}

export function rowsToCsv(rows: GpsRow[]): string {
  const header = ["Player", ...GPS_METRICS.map((m) => (m.unit ? `${m.label} (${m.unit})` : m.label))];
  const lines = [header.join(",")];
  for (const r of rows) {
    const cells = [
      `"${r.player_name.replace(/"/g, '""')}"`,
      ...GPS_METRICS.map((m) => {
        const v = r[m.key];
        return v === null || v === undefined ? "" : String(v);
      }),
    ];
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}
