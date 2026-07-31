import { supabase } from "./supabase";
import { countsForSeasonStats } from "./season";
import type { DbMatch } from "./matches-db";

// Everything the Manager module reads and writes. Kept in one module because
// these four things are only ever used together, on one screen.

// ---------------------------------------------------------------------------
// Suspensions
// ---------------------------------------------------------------------------
export type DbSuspension = {
  id: string;
  player_id: string;
  reason: string | null;
  start_date: string;
  end_date: string | null;
  matches_banned: number | null;
  matches_served: number;
  competition: string | null;
  notes: string | null;
  created_at: string;
};

export async function fetchSuspensions(): Promise<DbSuspension[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("player_suspensions")
    .select("*")
    .order("start_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbSuspension[];
}

export async function createSuspension(input: {
  playerId: string;
  reason: string;
  startDate: string;
  endDate: string;
  matchesBanned: string;
  competition: string;
  notes: string;
}): Promise<DbSuspension> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("player_suspensions")
    .insert({
      player_id: input.playerId,
      reason: input.reason.trim() || null,
      start_date: input.startDate,
      end_date: input.endDate || null,
      matches_banned: input.matchesBanned ? Number(input.matchesBanned) : null,
      competition: input.competition.trim() || null,
      notes: input.notes.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DbSuspension;
}

export async function updateSuspensionServed(id: string, served: number): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("player_suspensions").update({ matches_served: served }).eq("id", id);
  if (error) throw error;
}

export async function deleteSuspension(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("player_suspensions").delete().eq("id", id);
  if (error) throw error;
}

// A suspension is live if today falls inside its dates, or — when it's counted
// in matches rather than dates — if there are matches still to serve. Clubs
// record bans both ways, so both have to be handled.
export function isSuspensionActive(s: DbSuspension, today = new Date().toISOString().slice(0, 10)): boolean {
  if (s.matches_banned !== null) {
    if (s.matches_served < s.matches_banned) return true;
    if (!s.end_date) return false;
  }
  if (s.start_date > today) return false;
  if (s.end_date) return s.end_date >= today;
  // Open-ended date ban with no match count: treat as active.
  return s.matches_banned === null;
}

// ---------------------------------------------------------------------------
// Discipline
// ---------------------------------------------------------------------------
export type CardType = "yellow" | "red";

export type DbPlayerCard = {
  id: string;
  player_id: string;
  match_id: string | null;
  card: CardType;
  second_yellow: boolean;
  minute: number | null;
  reason: string | null;
  created_at: string;
};

export async function fetchCards(): Promise<DbPlayerCard[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("player_cards").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbPlayerCard[];
}

export async function createCard(input: {
  playerId: string;
  matchId: string | null;
  card: CardType;
  secondYellow: boolean;
  minute: string;
  reason: string;
}): Promise<DbPlayerCard> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("player_cards")
    .insert({
      player_id: input.playerId,
      match_id: input.matchId,
      card: input.card,
      second_yellow: input.secondYellow,
      minute: input.minute ? Number(input.minute) : null,
      reason: input.reason.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DbPlayerCard;
}

export async function deleteCard(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("player_cards").delete().eq("id", id);
  if (error) throw error;
}

export type DisciplineTotals = { yellow: number; red: number; points: number };

// Season totals per player, competitive fixtures only — same rule the rest of
// the app uses. Cards with no match attached are counted, since a card can be
// recorded before the fixture is linked up.
export function disciplineByPlayer(
  cards: DbPlayerCard[],
  matches: DbMatch[]
): Map<string, DisciplineTotals> {
  const matchById = new Map(matches.map((m) => [m.id, m]));
  const out = new Map<string, DisciplineTotals>();
  for (const c of cards) {
    if (c.match_id) {
      const m = matchById.get(c.match_id);
      if (m && !countsForSeasonStats(m)) continue;
    }
    const t = out.get(c.player_id) ?? { yellow: 0, red: 0, points: 0 };
    if (c.card === "yellow") t.yellow++;
    else t.red++;
    // The FA's usual weighting: a yellow is one point, a straight red three.
    // A red from two yellows doesn't add on top of the yellows already counted.
    t.points += c.card === "yellow" ? 1 : c.second_yellow ? 0 : 3;
    out.set(c.player_id, t);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------
export type DbContract = {
  player_id: string;
  contract_type: string | null;
  start_date: string | null;
  end_date: string | null;
  terms: string | null;
  agent_name: string | null;
  agent_phone: string | null;
  notes: string | null;
  updated_at: string;
  updated_by: string | null;
};

export const CONTRACT_TYPES = [
  "Contract", "Non-contract", "Amateur", "Dual registration", "Loan", "Youth", "Trialist",
];

export async function fetchContracts(): Promise<DbContract[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("player_contracts").select("*");
  if (error) throw error;
  return (data ?? []) as DbContract[];
}

export async function saveContract(
  playerId: string,
  input: { contractType: string; startDate: string; endDate: string; terms: string; agentName: string; agentPhone: string; notes: string },
  updatedBy: string | null
): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("player_contracts").upsert(
    {
      player_id: playerId,
      contract_type: input.contractType || null,
      start_date: input.startDate || null,
      end_date: input.endDate || null,
      terms: input.terms.trim() || null,
      agent_name: input.agentName.trim() || null,
      agent_phone: input.agentPhone.trim() || null,
      notes: input.notes.trim() || null,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    },
    { onConflict: "player_id" }
  );
  if (error) throw error;
}

// Days until a contract runs out — negative once expired, null if no end date.
export function daysUntilExpiry(endDate: string | null, today = new Date()): number | null {
  if (!endDate) return null;
  const end = new Date(`${endDate}T00:00:00`).getTime();
  const now = new Date(today.toISOString().slice(0, 10) + "T00:00:00").getTime();
  return Math.round((end - now) / 86400000);
}

// ---------------------------------------------------------------------------
// Registrations
// ---------------------------------------------------------------------------
export type DbRegistration = {
  player_id: string;
  registered: boolean;
  registration_date: string | null;
  registration_number: string | null;
  competitions: string | null;
  itc_required: boolean;
  itc_received: boolean;
  notes: string | null;
  updated_at: string;
  updated_by: string | null;
};

export async function fetchRegistrations(): Promise<DbRegistration[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("player_registrations").select("*");
  if (error) throw error;
  return (data ?? []) as DbRegistration[];
}

export async function saveRegistration(
  playerId: string,
  input: {
    registered: boolean;
    registrationDate: string;
    registrationNumber: string;
    competitions: string;
    itcRequired: boolean;
    itcReceived: boolean;
    notes: string;
  },
  updatedBy: string | null
): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("player_registrations").upsert(
    {
      player_id: playerId,
      registered: input.registered,
      registration_date: input.registrationDate || null,
      registration_number: input.registrationNumber.trim() || null,
      competitions: input.competitions.trim() || null,
      itc_required: input.itcRequired,
      itc_received: input.itcReceived,
      notes: input.notes.trim() || null,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    },
    { onConflict: "player_id" }
  );
  if (error) throw error;
}
