import { supabase } from "./supabase";
import type { DbInjury } from "./injuries-db";
import type { DbPlayerAbsence } from "./player-absences-db";
import type { DbMatch } from "./matches-db";

export type AvailabilityStatus = "available" | "doubtful" | "unavailable";

export type DbMatchAvailability = {
  id: string;
  match_id: string;
  player_id: string;
  status: AvailabilityStatus;
  note: string | null;
  responded_at: string;
  recorded_by: string | null;
};

export const AVAILABILITY_LABEL: Record<AvailabilityStatus, string> = {
  available: "Available",
  doubtful: "Doubtful",
  unavailable: "Not available",
};

export const AVAILABILITY_TONE: Record<AvailabilityStatus, string> = {
  available: "bg-emerald-500/15 text-emerald-300",
  doubtful: "bg-amber-500/15 text-amber-300",
  unavailable: "bg-red-500/15 text-red-300",
};

export async function fetchAvailabilityForMatch(matchId: string): Promise<DbMatchAvailability[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("match_availability")
    .select("*")
    .eq("match_id", matchId);
  if (error) throw error;
  return (data ?? []) as DbMatchAvailability[];
}

// Every reply across a set of fixtures — one query for the manager's view
// rather than one per fixture.
export async function fetchAvailabilityForMatches(matchIds: string[]): Promise<DbMatchAvailability[]> {
  if (!supabase || matchIds.length === 0) return [];
  const { data, error } = await supabase
    .from("match_availability")
    .select("*")
    .in("match_id", matchIds);
  if (error) throw error;
  return (data ?? []) as DbMatchAvailability[];
}

export async function fetchAvailabilityForPlayer(playerId: string): Promise<DbMatchAvailability[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("match_availability")
    .select("*")
    .eq("player_id", playerId);
  if (error) throw error;
  return (data ?? []) as DbMatchAvailability[];
}

// Upsert on (match_id, player_id) so changing your mind updates the answer
// rather than adding a second one.
export async function setAvailability(input: {
  matchId: string;
  playerId: string;
  status: AvailabilityStatus;
  note?: string;
  recordedBy?: string | null;
}): Promise<DbMatchAvailability> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("match_availability")
    .upsert(
      {
        match_id: input.matchId,
        player_id: input.playerId,
        status: input.status,
        note: input.note?.trim() || null,
        responded_at: new Date().toISOString(),
        recorded_by: input.recordedBy ?? null,
      },
      { onConflict: "match_id,player_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as DbMatchAvailability;
}

export type AvailabilityCounts = { available: number; doubtful: number; unavailable: number; noReply: number };

export function countAvailability(
  rows: DbMatchAvailability[],
  matchId: string,
  squadSize: number
): AvailabilityCounts {
  const forMatch = rows.filter((r) => r.match_id === matchId);
  const available = forMatch.filter((r) => r.status === "available").length;
  const doubtful = forMatch.filter((r) => r.status === "doubtful").length;
  const unavailable = forMatch.filter((r) => r.status === "unavailable").length;
  return { available, doubtful, unavailable, noReply: Math.max(0, squadSize - forMatch.length) };
}

// ---------------------------------------------------------------------------
// Effective availability
//
// A player's own reply is only part of the picture. If they're injured,
// suspended, or on holiday over the fixture date, the club already knows they
// can't play — and that fact outranks anything they tapped a week ago.
//
// One resolver, used by the companion, the manager's availability view and the
// team-selection screen, so all three can never disagree about who's available.
// ---------------------------------------------------------------------------
export type AvailabilitySource = "suspension" | "injury" | "absence" | "player" | "none";

export type EffectiveAvailability = {
  status: AvailabilityStatus | "unknown";
  source: AvailabilitySource;
  // Human-readable reason, empty when it's simply the player's own answer.
  detail: string;
  // True when the club's records override what the player said, so the
  // difference can be shown rather than silently applied.
  overridesReply: boolean;
};

type SuspensionLike = {
  player_id: string;
  start_date: string;
  end_date: string | null;
  matches_banned: number | null;
  matches_served: number;
  reason: string | null;
};

function coversDate(start: string, end: string | null, date: string): boolean {
  if (start > date) return false;
  if (!end) return true;
  return end >= date;
}

export function effectiveAvailability(
  playerId: string,
  match: Pick<DbMatch, "id" | "kickoff">,
  sources: {
    reply?: DbMatchAvailability;
    injuries?: DbInjury[];
    suspensions?: SuspensionLike[];
    absences?: DbPlayerAbsence[];
  }
): EffectiveAvailability {
  const matchDate = match.kickoff.slice(0, 10);
  const reply = sources.reply;
  const hasReply = Boolean(reply);

  // Suspension: banned by date range covering the fixture, or a match ban with
  // games still to serve.
  const suspension = (sources.suspensions ?? []).find(
    (s) =>
      s.player_id === playerId &&
      (coversDate(s.start_date, s.end_date, matchDate) ||
        (s.matches_banned !== null && s.matches_served < s.matches_banned && s.start_date <= matchDate))
  );
  if (suspension) {
    return {
      status: "unavailable",
      source: "suspension",
      detail: suspension.reason ? `Suspended — ${suspension.reason}` : "Suspended",
      overridesReply: hasReply && reply!.status !== "unavailable",
    };
  }

  // Injury: an active injury rules them out unless they're due back before the
  // fixture. No expected return date means unknown, which is treated as out.
  const injury = (sources.injuries ?? []).find((i) => i.player_id === playerId);
  if (injury && (!injury.expected_return || injury.expected_return > matchDate)) {
    return {
      status: "unavailable",
      source: "injury",
      detail: injury.expected_return
        ? `${injury.injury} — due back ${injury.expected_return}`
        : injury.injury,
      overridesReply: hasReply && reply!.status !== "unavailable",
    };
  }
  // Due back before the fixture but still on the injury list: doubtful rather
  // than available, unless they've said otherwise themselves.
  if (injury && !hasReply) {
    return {
      status: "doubtful",
      source: "injury",
      detail: `${injury.injury} — due back ${injury.expected_return}`,
      overridesReply: false,
    };
  }

  const absence = (sources.absences ?? []).find(
    (a) => a.player_id === playerId && coversDate(a.start_date, a.end_date, matchDate)
  );
  if (absence) {
    return {
      status: "unavailable",
      source: "absence",
      detail: absence.notes ? `${absence.reason} — ${absence.notes}` : absence.reason,
      overridesReply: hasReply && reply!.status !== "unavailable",
    };
  }

  if (reply) {
    return {
      status: reply.status,
      source: "player",
      detail: reply.note ?? "",
      overridesReply: false,
    };
  }

  return { status: "unknown", source: "none", detail: "", overridesReply: false };
}

export const SOURCE_LABEL: Record<AvailabilitySource, string> = {
  suspension: "Suspended",
  injury: "Medical",
  absence: "Time off",
  player: "Player replied",
  none: "No reply",
};

// Removes a recorded answer entirely, putting the player back to "no reply".
//
// Distinct from setting them unavailable, and the difference matters: "hasn't
// answered" is a person to chase, "unavailable" is a decision already taken.
// Collapsing the two would leave a manager unable to undo a mistaken tap.
export async function clearAvailability(matchId: string, playerId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error, count } = await supabase
    .from("match_availability")
    .delete({ count: "exact" })
    .eq("match_id", matchId)
    .eq("player_id", playerId);
  if (error) throw error;
  // Zero rows means the database refused rather than there being nothing to
  // remove — the caller already knows a row exists before offering this.
  if (!count) {
    throw new Error(
      "The database wouldn't clear that answer. Check the delete permission on match_availability in Supabase."
    );
  }
}
