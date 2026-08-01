import { supabase } from "./supabase";
import type { DbPlayer } from "./players-db";
import type { DbMatch } from "./matches-db";

export type LineupSlot = {
  playerId: string;
  // Free text so a manager can write "RCB" or "left 8" rather than being
  // forced into a fixed vocabulary.
  position: string;
  shirt: number | null;
  // Set only for trialists. A trialist has no row in `players` — deliberately,
  // because someone on a week's look isn't a squad member and shouldn't appear
  // in registrations, contracts, medical or the season's stats. So the name
  // travels with the line-up instead of being looked up.
  name?: string | null;
  isTrialist?: boolean;
};

// Trialist ids are generated here rather than by the database, since nothing
// is inserted anywhere — they only ever exist inside a line-up's jsonb.
export const TRIALIST_PREFIX = "trialist:";

export function isTrialistSlot(slot: LineupSlot): boolean {
  return slot.isTrialist === true || slot.playerId.startsWith(TRIALIST_PREFIX);
}

export function newTrialistId(): string {
  // Not crypto — it only has to be unique within one team sheet.
  return `${TRIALIST_PREFIX}${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export type DbLineup = {
  match_id: string;
  formation: string;
  starters: LineupSlot[];
  subs: LineupSlot[];
  captain_id: string | null;
  notes: string | null;
  published_at: string | null;
  updated_at: string;
  updated_by: string | null;
};

// The shapes clubs at this level actually use. The position labels are ordered
// back-to-front, which is the order a team sheet is read out and the order
// iFAS expects you to click through.
export const FORMATIONS: Record<string, string[]> = {
  "4-4-2": ["GK", "RB", "RCB", "LCB", "LB", "RM", "RCM", "LCM", "LM", "RS", "LS"],
  "4-3-3": ["GK", "RB", "RCB", "LCB", "LB", "CDM", "RCM", "LCM", "RW", "ST", "LW"],
  "4-2-3-1": ["GK", "RB", "RCB", "LCB", "LB", "RDM", "LDM", "RAM", "CAM", "LAM", "ST"],
  "3-5-2": ["GK", "RCB", "CB", "LCB", "RWB", "RCM", "CM", "LCM", "LWB", "RS", "LS"],
  "5-3-2": ["GK", "RWB", "RCB", "CB", "LCB", "LWB", "RCM", "CM", "LCM", "RS", "LS"],
  "4-5-1": ["GK", "RB", "RCB", "LCB", "LB", "RM", "RCM", "CM", "LCM", "LM", "ST"],
};

export const FORMATION_NAMES = Object.keys(FORMATIONS);

// Where each position sits on the pitch, as percentages. x runs left to right,
// y runs from your own goal line (0) to the opponent's (100) — the same
// convention the player-profile pitch uses, so the two look identical.
//
// The order matches FORMATIONS exactly: slot i on the pitch is starter i in
// the line-up, which is what keeps the team sheet and the diagram in step.
export type PitchSlot = { code: string; x: number; y: number };

export const FORMATION_LAYOUTS: Record<string, PitchSlot[]> = {
  "4-4-2": [
    { code: "GK", x: 50, y: 7 },
    { code: "RB", x: 85, y: 26 }, { code: "RCB", x: 63, y: 20 }, { code: "LCB", x: 37, y: 20 }, { code: "LB", x: 15, y: 26 },
    { code: "RM", x: 85, y: 56 }, { code: "RCM", x: 63, y: 52 }, { code: "LCM", x: 37, y: 52 }, { code: "LM", x: 15, y: 56 },
    { code: "RS", x: 60, y: 83 }, { code: "LS", x: 40, y: 83 },
  ],
  "4-3-3": [
    { code: "GK", x: 50, y: 7 },
    { code: "RB", x: 85, y: 26 }, { code: "RCB", x: 63, y: 20 }, { code: "LCB", x: 37, y: 20 }, { code: "LB", x: 15, y: 26 },
    { code: "CDM", x: 50, y: 44 }, { code: "RCM", x: 68, y: 56 }, { code: "LCM", x: 32, y: 56 },
    { code: "RW", x: 82, y: 79 }, { code: "ST", x: 50, y: 87 }, { code: "LW", x: 18, y: 79 },
  ],
  "4-2-3-1": [
    { code: "GK", x: 50, y: 7 },
    { code: "RB", x: 85, y: 26 }, { code: "RCB", x: 63, y: 20 }, { code: "LCB", x: 37, y: 20 }, { code: "LB", x: 15, y: 26 },
    { code: "RDM", x: 62, y: 44 }, { code: "LDM", x: 38, y: 44 },
    { code: "RAM", x: 80, y: 67 }, { code: "CAM", x: 50, y: 67 }, { code: "LAM", x: 20, y: 67 },
    { code: "ST", x: 50, y: 87 },
  ],
  "3-5-2": [
    { code: "GK", x: 50, y: 7 },
    { code: "RCB", x: 70, y: 22 }, { code: "CB", x: 50, y: 18 }, { code: "LCB", x: 30, y: 22 },
    { code: "RWB", x: 88, y: 52 }, { code: "RCM", x: 65, y: 50 }, { code: "CM", x: 50, y: 44 }, { code: "LCM", x: 35, y: 50 }, { code: "LWB", x: 12, y: 52 },
    { code: "RS", x: 60, y: 84 }, { code: "LS", x: 40, y: 84 },
  ],
  "5-3-2": [
    { code: "GK", x: 50, y: 7 },
    { code: "RWB", x: 88, y: 33 }, { code: "RCB", x: 70, y: 20 }, { code: "CB", x: 50, y: 17 }, { code: "LCB", x: 30, y: 20 }, { code: "LWB", x: 12, y: 33 },
    { code: "RCM", x: 66, y: 55 }, { code: "CM", x: 50, y: 49 }, { code: "LCM", x: 34, y: 55 },
    { code: "RS", x: 60, y: 84 }, { code: "LS", x: 40, y: 84 },
  ],
  "4-5-1": [
    { code: "GK", x: 50, y: 7 },
    { code: "RB", x: 85, y: 26 }, { code: "RCB", x: 63, y: 20 }, { code: "LCB", x: 37, y: 20 }, { code: "LB", x: 15, y: 26 },
    { code: "RM", x: 86, y: 58 }, { code: "RCM", x: 65, y: 52 }, { code: "CM", x: 50, y: 47 }, { code: "LCM", x: 35, y: 52 }, { code: "LM", x: 14, y: 58 },
    { code: "ST", x: 50, y: 86 },
  ],
};

export function layoutFor(formation: string): PitchSlot[] {
  return FORMATION_LAYOUTS[formation] ?? FORMATION_LAYOUTS["4-4-2"];
}

export function emptyLineup(matchId: string): DbLineup {
  return {
    match_id: matchId,
    formation: "4-4-2",
    starters: [],
    subs: [],
    captain_id: null,
    notes: null,
    published_at: null,
    updated_at: new Date().toISOString(),
    updated_by: null,
  };
}

export async function fetchLineup(matchId: string): Promise<DbLineup | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("match_lineups")
    .select("*")
    .eq("match_id", matchId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as DbLineup;
  // jsonb comes back as whatever was written; guard against an older or
  // hand-edited row so the page can't crash on a malformed array.
  return {
    ...row,
    starters: Array.isArray(row.starters) ? row.starters : [],
    subs: Array.isArray(row.subs) ? row.subs : [],
  };
}

// Every selection made this season, newest fixture first once joined to the
// fixture list. Used by the manager module's Selections tab.
export async function fetchAllLineups(): Promise<DbLineup[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("match_lineups")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as DbLineup;
    return {
      ...r,
      starters: Array.isArray(r.starters) ? r.starters : [],
      subs: Array.isArray(r.subs) ? r.subs : [],
    };
  });
}

export async function saveLineup(
  lineup: DbLineup,
  updatedBy: string | null
): Promise<DbLineup> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("match_lineups")
    .upsert(
      {
        match_id: lineup.match_id,
        formation: lineup.formation,
        starters: lineup.starters,
        subs: lineup.subs,
        captain_id: lineup.captain_id,
        notes: lineup.notes,
        published_at: lineup.published_at,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy,
      },
      { onConflict: "match_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as DbLineup;
}

// ---------------------------------------------------------------------------
// Pushing the selected side into the fixture itself
//
// The manager picks the team once. Everywhere else in the app that shows a
// starting XI — Match Centre, the players' companion, the analysis pages —
// reads `match_lineup`, so publishing writes it there rather than expecting
// somebody to type the same eleven names in twice. Typing it twice is how the
// two ended up disagreeing, and a team sheet nobody trusts is worse than none.
// ---------------------------------------------------------------------------

// How many rows are already in Match Centre for this fixture. Used to warn
// before overwriting something that was entered by hand.
export async function countMatchCentreLineup(matchId: string): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("match_lineup")
    .select("id", { count: "exact", head: true })
    .eq("match_id", matchId);
  if (error) throw error;
  return count ?? 0;
}

export async function syncLineupToMatchCentre(
  lineup: DbLineup,
  players: DbPlayer[]
): Promise<number> {
  if (!supabase) throw new Error("Supabase is not configured.");

  // Replace rather than merge. A partial update would leave last week's
  // substitute sitting in this week's XI if the squad shrank, and nobody
  // would spot it.
  const { error: clearError } = await supabase
    .from("match_lineup")
    .delete()
    .eq("match_id", lineup.match_id);
  if (clearError) throw clearError;

  const rows = [
    ...lineup.starters.map((s, i) => ({
      match_id: lineup.match_id,
      is_starting: true,
      shirt_number: s.shirt ?? players.find((p) => p.id === s.playerId)?.squad_number ?? null,
      player_name: slotName(players, s) + (lineup.captain_id === s.playerId ? " (C)" : ""),
      position: s.position || null,
      sort_order: i,
    })),
    ...lineup.subs.map((s, i) => ({
      match_id: lineup.match_id,
      is_starting: false,
      shirt_number: s.shirt ?? players.find((p) => p.id === s.playerId)?.squad_number ?? null,
      player_name: slotName(players, s),
      position: null,
      // Keeps substitutes below the XI in the same ordered list.
      sort_order: 100 + i,
    })),
  ];

  if (rows.length === 0) return 0;

  const { error } = await supabase.from("match_lineup").insert(rows);
  if (error) throw error;
  return rows.length;
}

// ---------------------------------------------------------------------------
// Output formats
// ---------------------------------------------------------------------------

// A trialist carries their own name; a squad player is looked up. Everything
// downstream goes through this, so the output formats never have to care which
// kind of person they're printing.
export function slotName(players: DbPlayer[], slot: LineupSlot): string {
  if (isTrialistSlot(slot)) return slot.name?.trim() || "Trialist";
  return players.find((p) => p.id === slot.playerId)?.name ?? "Unknown player";
}
function shirtOf(players: DbPlayer[], slot: LineupSlot): string {
  const n = slot.shirt ?? players.find((p) => p.id === slot.playerId)?.squad_number;
  return n === undefined || n === null ? "" : String(n);
}

// The list you read down while clicking players in iFAS. Numbered so you can
// keep your place, starters then bench, in team-sheet order — no positions or
// decoration, because anything extra is something to skim past.
export function iFasList(lineup: DbLineup, players: DbPlayer[]): string {
  const lines: string[] = [];
  lineup.starters.forEach((s, i) => {
    lines.push(`${i + 1}. ${shirtOf(players, s)} ${slotName(players, s)}`.replace(/\s+/g, " ").trim());
  });
  if (lineup.subs.length > 0) {
    lines.push("");
    lines.push("SUBS");
    lineup.subs.forEach((s, i) => {
      lines.push(`${i + 1}. ${shirtOf(players, s)} ${slotName(players, s)}`.replace(/\s+/g, " ").trim());
    });
  }

  // A trialist isn't registered, so there's nobody to click in iFAS. Saying so
  // here is the difference between a thirty-second fix at the ground and a
  // manager hunting for a name that was never going to be in the list.
  const trialists = [...lineup.starters, ...lineup.subs].filter(isTrialistSlot);
  if (trialists.length > 0) {
    lines.push("");
    lines.push("NOT IN iFAS — REGISTER FIRST");
    trialists.forEach((t) => lines.push(`- ${slotName(players, t)}`));
  }
  return lines.join("\n");
}

// A proper team sheet, with positions and the captain marked.
export function teamSheetText(
  lineup: DbLineup,
  players: DbPlayer[],
  match: DbMatch,
  clubName: string
): string {
  const kickoff = new Date(match.kickoff).toLocaleString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const lines = [
    `${clubName} ${match.is_home ? "vs" : "away to"} ${match.opponent}`,
    `${match.competition} · ${kickoff}${match.venue ? ` · ${match.venue}` : ""}`,
    `Formation: ${lineup.formation}`,
    "",
    "STARTING XI",
  ];
  for (const s of lineup.starters) {
    const captain = lineup.captain_id === s.playerId ? " (C)" : "";
    const trialist = isTrialistSlot(s) ? " (trialist)" : "";
    lines.push(`${shirtOf(players, s).padStart(2, " ")}  ${s.position.padEnd(4, " ")}  ${slotName(players, s)}${captain}${trialist}`);
  }
  if (lineup.subs.length > 0) {
    lines.push("");
    lines.push("SUBSTITUTES");
    for (const s of lineup.subs) {
      lines.push(`${shirtOf(players, s).padStart(2, " ")}        ${slotName(players, s)}`);
    }
  }
  if (lineup.notes) {
    lines.push("");
    lines.push(lineup.notes);
  }
  return lines.join("\n");
}

// For social media: no positions or shirt numbers, just the names, in a shape
// that reads well in a post.
export function squadListText(
  lineup: DbLineup,
  players: DbPlayer[],
  match: DbMatch,
  clubName: string
): string {
  const kickoff = new Date(match.kickoff).toLocaleString("en-GB", {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });
  const starters = lineup.starters.map((s) => {
    const captain = lineup.captain_id === s.playerId ? " (C)" : "";
    return `${slotName(players, s)}${captain}`;
  });
  const subs = lineup.subs.map((s) => slotName(players, s));

  const lines = [
    `TEAM NEWS`,
    `${clubName} ${match.is_home ? "vs" : "@"} ${match.opponent}`,
    `${kickoff}${match.venue ? ` · ${match.venue}` : ""}`,
    "",
    `XI (${lineup.formation}): ${starters.join(", ")}`,
  ];
  if (subs.length > 0) lines.push("", `Subs: ${subs.join(", ")}`);
  return lines.join("\n");
}
