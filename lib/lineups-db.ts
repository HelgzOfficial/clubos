import { supabase } from "./supabase";
import type { DbPlayer } from "./players-db";
import type { DbMatch } from "./matches-db";

export type LineupSlot = {
  playerId: string;
  // Free text so a manager can write "RCB" or "left 8" rather than being
  // forced into a fixed vocabulary.
  position: string;
  shirt: number | null;
};

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
// Output formats
// ---------------------------------------------------------------------------

function nameOf(players: DbPlayer[], id: string): string {
  return players.find((p) => p.id === id)?.name ?? "Unknown player";
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
    lines.push(`${i + 1}. ${shirtOf(players, s)} ${nameOf(players, s.playerId)}`.replace(/\s+/g, " ").trim());
  });
  if (lineup.subs.length > 0) {
    lines.push("");
    lines.push("SUBS");
    lineup.subs.forEach((s, i) => {
      lines.push(`${i + 1}. ${shirtOf(players, s)} ${nameOf(players, s.playerId)}`.replace(/\s+/g, " ").trim());
    });
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
    lines.push(`${shirtOf(players, s).padStart(2, " ")}  ${s.position.padEnd(4, " ")}  ${nameOf(players, s.playerId)}${captain}`);
  }
  if (lineup.subs.length > 0) {
    lines.push("");
    lines.push("SUBSTITUTES");
    for (const s of lineup.subs) {
      lines.push(`${shirtOf(players, s).padStart(2, " ")}        ${nameOf(players, s.playerId)}`);
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
    return `${nameOf(players, s.playerId)}${captain}`;
  });
  const subs = lineup.subs.map((s) => nameOf(players, s.playerId));

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
