import { supabase } from "./supabase";
import { competitionKind } from "./competition-kind";
import { countsForSeasonStats } from "./season";
import type { DbMatch } from "./matches-db";
import type { DbPlayerCard, DbSuspension } from "./manager-db";

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export const COUNT_MODES = ["yellow", "red", "points"] as const;
export type CountMode = (typeof COUNT_MODES)[number];

export const COUNT_LABELS: Record<CountMode, string> = {
  yellow: "Yellow cards",
  red: "Straight reds",
  points: "Discipline points",
};

export const COUNT_HELP: Record<CountMode, string> = {
  yellow: "Counts yellows only. A red from two yellows doesn't add a third.",
  red: "Counts straight reds only — a red from two yellows isn't included.",
  points: "The FA weighting: a yellow is 1, a straight red is 3.",
};

export const SCOPES = ["all", "league", "cup", "friendly"] as const;
export type Scope = (typeof SCOPES)[number];

export const SCOPE_LABELS: Record<Scope, string> = {
  all: "Every competition",
  league: "League only",
  cup: "Cup only",
  friendly: "Friendlies only",
};

export type DbCardThreshold = {
  id: string;
  label: string;
  counts: CountMode;
  scope: Scope;
  threshold: number;
  matches_banned: number;
  repeating: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
};

export type ThresholdInput = {
  label: string;
  counts: CountMode;
  scope: Scope;
  threshold: number;
  matchesBanned: number;
  repeating: boolean;
  notes: string;
};

export async function fetchThresholds(includeInactive = false): Promise<DbCardThreshold[]> {
  if (!supabase) return [];
  let q = supabase.from("card_thresholds").select("*").order("threshold");
  if (!includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as DbCardThreshold[];
}

export async function createThreshold(input: ThresholdInput): Promise<DbCardThreshold> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("card_thresholds")
    .insert({
      label: input.label.trim(),
      counts: input.counts,
      scope: input.scope,
      threshold: input.threshold,
      matches_banned: input.matchesBanned,
      repeating: input.repeating,
      notes: input.notes.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DbCardThreshold;
}

export async function updateThreshold(
  id: string,
  patch: Partial<ThresholdInput> & { isActive?: boolean }
): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const row: Record<string, unknown> = {};
  if (patch.label !== undefined) row.label = patch.label.trim();
  if (patch.counts !== undefined) row.counts = patch.counts;
  if (patch.scope !== undefined) row.scope = patch.scope;
  if (patch.threshold !== undefined) row.threshold = patch.threshold;
  if (patch.matchesBanned !== undefined) row.matches_banned = patch.matchesBanned;
  if (patch.repeating !== undefined) row.repeating = patch.repeating;
  if (patch.notes !== undefined) row.notes = patch.notes.trim() || null;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  const { error } = await supabase.from("card_thresholds").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteThreshold(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("card_thresholds").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Counting
// ---------------------------------------------------------------------------

// Does this card count toward a rule with this scope?
//
// A card with no fixture attached counts everywhere except a scoped rule,
// because we can't know which competition it belongs to and guessing would
// either suspend someone wrongly or quietly miss a ban. Neither is acceptable,
// so an unlinked card only ever counts toward "every competition" rules.
function cardInScope(card: DbPlayerCard, scope: Scope, matchById: Map<string, DbMatch>): boolean {
  if (!card.match_id) return scope === "all";
  const m = matchById.get(card.match_id);
  if (!m) return scope === "all";
  // Friendlies are excluded from season figures everywhere else in the app;
  // the exception is a rule that deliberately targets them.
  if (scope !== "friendly" && !countsForSeasonStats(m)) return false;
  if (scope === "all") return true;
  return competitionKind(m.competition) === scope;
}

function cardValue(card: DbPlayerCard, counts: CountMode): number {
  if (counts === "yellow") return card.card === "yellow" ? 1 : 0;
  if (counts === "red") return card.card === "red" && !card.second_yellow ? 1 : 0;
  // points
  if (card.card === "yellow") return 1;
  return card.second_yellow ? 0 : 3;
}

// A player's running total against one rule.
export function tallyFor(
  playerId: string,
  rule: DbCardThreshold,
  cards: DbPlayerCard[],
  matches: DbMatch[]
): number {
  const matchById = new Map(matches.map((m) => [m.id, m]));
  return cards
    .filter((c) => c.player_id === playerId && cardInScope(c, rule.scope, matchById))
    .reduce((sum, c) => sum + cardValue(c, rule.counts), 0);
}

// How many times a rule should have fired at this total. A repeating rule
// fires at every multiple; a one-off fires once.
export function triggerCount(rule: DbCardThreshold, tally: number): number {
  if (tally < rule.threshold) return 0;
  return rule.repeating ? Math.floor(tally / rule.threshold) : 1;
}

// The total at which the Nth firing happens — stored on the suspension so a
// repeating rule doesn't raise the same ban twice.
export function triggerTotal(rule: DbCardThreshold, occurrence: number): number {
  return rule.threshold * (rule.repeating ? occurrence : 1);
}

export type PendingSuspension = {
  playerId: string;
  rule: DbCardThreshold;
  tally: number;
  atTotal: number;
};

// Every automatic ban that's due and hasn't been raised yet.
//
// Deliberately a pure calculation: it works out what should exist, compares it
// with what already does, and returns the difference. Nothing is written here,
// so it can be run as often as you like — after a card, on page load, twice by
// accident — without ever double-banning anyone.
export function pendingSuspensions(
  playerIds: string[],
  rules: DbCardThreshold[],
  cards: DbPlayerCard[],
  matches: DbMatch[],
  existing: DbSuspension[]
): PendingSuspension[] {
  const already = new Set(
    existing
      .filter((s) => s.threshold_id)
      .map((s) => `${s.player_id}|${s.threshold_id}|${s.auto_trigger_count ?? 0}`)
  );

  const out: PendingSuspension[] = [];
  for (const rule of rules) {
    if (!rule.is_active) continue;
    for (const playerId of playerIds) {
      const tally = tallyFor(playerId, rule, cards, matches);
      const fires = triggerCount(rule, tally);
      for (let n = 1; n <= fires; n++) {
        const atTotal = triggerTotal(rule, n);
        if (already.has(`${playerId}|${rule.id}|${atTotal}`)) continue;
        out.push({ playerId, rule, tally, atTotal });
      }
    }
  }
  return out;
}

// Writes the bans that pendingSuspensions found. Returns how many were raised.
export async function applyPendingSuspensions(pending: PendingSuspension[]): Promise<number> {
  if (!supabase) throw new Error("Supabase is not configured.");
  if (pending.length === 0) return 0;

  const today = new Date().toISOString().slice(0, 10);
  const rows = pending.map((p) => ({
    player_id: p.playerId,
    reason: `${p.rule.label} (${p.atTotal} ${p.rule.counts === "points" ? "points" : "cards"})`,
    start_date: today,
    end_date: null,
    matches_banned: p.rule.matches_banned,
    matches_served: 0,
    competition: p.rule.scope === "all" ? null : SCOPE_LABELS[p.rule.scope],
    notes: "Raised automatically by a card threshold.",
    threshold_id: p.rule.id,
    auto_trigger_count: p.atTotal,
  }));

  const { error } = await supabase.from("player_suspensions").insert(rows);
  if (error) throw error;
  return rows.length;
}

// Convenience: work out what's due and write it, in one call.
export async function syncAutomaticSuspensions(
  playerIds: string[],
  rules: DbCardThreshold[],
  cards: DbPlayerCard[],
  matches: DbMatch[],
  existing: DbSuspension[]
): Promise<PendingSuspension[]> {
  const pending = pendingSuspensions(playerIds, rules, cards, matches, existing);
  if (pending.length > 0) await applyPendingSuspensions(pending);
  return pending;
}

// How close a player is to their next ban under each rule — for showing a
// counter before anybody gets suspended, which is the point of a counter.
export type CardWatch = {
  rule: DbCardThreshold;
  tally: number;
  nextAt: number;
  remaining: number;
};

export function watchFor(
  playerId: string,
  rules: DbCardThreshold[],
  cards: DbPlayerCard[],
  matches: DbMatch[]
): CardWatch[] {
  return rules
    .filter((r) => r.is_active)
    .map((rule) => {
      const tally = tallyFor(playerId, rule, cards, matches);
      const fired = triggerCount(rule, tally);
      const nextAt = rule.repeating
        ? rule.threshold * (fired + 1)
        : rule.threshold;
      return { rule, tally, nextAt, remaining: Math.max(0, nextAt - tally) };
    })
    .filter((w) => w.tally > 0 || w.remaining <= 2);
}
