"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, HelpCircle, X as XIcon, Star } from "lucide-react";
import { TeamCrest, useCrestLookup } from "@/components/team-crest";
import { upcomingMatches, type DbMatch } from "@/lib/matches-db";
import {
  fetchAvailabilityForPlayer, setAvailability, effectiveAvailability, SOURCE_LABEL,
  type DbMatchAvailability, type AvailabilityStatus,
} from "@/lib/match-availability-db";
import { fetchActiveInjuries, type DbInjury } from "@/lib/injuries-db";
import { fetchPlayerAbsences, type DbPlayerAbsence } from "@/lib/player-absences-db";
import { fetchSuspensions, type DbSuspension } from "@/lib/manager-db";
import { fetchLineup, type DbLineup } from "@/lib/lineups-db";
import { fetchPlayers, type DbPlayer } from "@/lib/players-db";

const OPTIONS: { status: AvailabilityStatus; label: string; icon: typeof Check; on: string }[] = [
  { status: "available", label: "Available", icon: Check, on: "bg-emerald-500 text-navy-950" },
  { status: "doubtful", label: "Doubtful", icon: HelpCircle, on: "bg-amber-400 text-navy-950" },
  { status: "unavailable", label: "Can't play", icon: XIcon, on: "bg-red-500 text-white" },
];

function when(m: DbMatch) {
  return new Date(m.kickoff).toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

// A player answering "can you play" for the next few fixtures.
//
// Three answers rather than two: at this level "probably, depends on work" is
// the honest reply more often than not, and forcing it into yes/no just means
// the manager gets a yes and a phone call later.
export function MatchAvailability({ playerId, matches }: { playerId: string; matches: DbMatch[] }) {
  const [rows, setRows] = useState<DbMatchAvailability[]>([]);
  // The club's own records — injuries, suspensions and booked time off. They
  // outrank whatever the player tapped, so the card says so rather than
  // pretending the answer still stands.
  const [injuries, setInjuries] = useState<DbInjury[]>([]);
  const [absences, setAbsences] = useState<DbPlayerAbsence[]>([]);
  const [suspensions, setSuspensions] = useState<DbSuspension[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const crestLookup = useCrestLookup();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [replies, inj, abs, sus] = await Promise.all([
        fetchAvailabilityForPlayer(playerId),
        fetchActiveInjuries().catch(() => [] as DbInjury[]),
        fetchPlayerAbsences().catch(() => [] as DbPlayerAbsence[]),
        fetchSuspensions().catch(() => [] as DbSuspension[]),
      ]);
      setRows(replies);
      setInjuries(inj);
      setAbsences(abs);
      setSuspensions(sus);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        /relation|does not exist|schema cache/i.test(msg)
          ? "Match availability isn't set up yet."
          : msg || "Couldn't load your replies."
      );
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => { load(); }, [load]);

  const fixtures = upcomingMatches(matches).slice(0, 5);

  async function answer(matchId: string, status: AvailabilityStatus, note?: string) {
    setBusyId(matchId);
    setError("");
    try {
      const saved = await setAvailability({ matchId, playerId, status, note });
      setRows((prev) => [...prev.filter((r) => r.match_id !== matchId), saved]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="text-sm text-neutral-400">Loading…</p>;

  if (fixtures.length === 0) {
    return <p className="text-sm text-neutral-400">No upcoming fixtures.</p>;
  }

  return (
    <div>
      <p className="mb-3 text-xs text-neutral-400">
        Let the manager know as early as you can. You can change your answer any time.
      </p>

      {error && <p className="mb-2 text-xs text-red-300">{error}</p>}

      <ul className="space-y-3">
        {fixtures.map((m) => {
          const row = rows.find((r) => r.match_id === m.id);
          const effective = effectiveAvailability(playerId, m, {
            reply: row, injuries, absences, suspensions,
          });
          const clubSays = effective.source !== "player" && effective.source !== "none";
          return (
            <li key={m.id} className="rounded-xl border border-white/10 p-3">
              <div className="mb-2 flex items-center gap-2.5">
                <TeamCrest name={m.opponent} size="sm" lookup={crestLookup} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.is_home ? "vs" : "@"} {m.opponent}</p>
                  <p className="truncate text-[11px] text-neutral-500">
                    {when(m)}{m.venue ? ` · ${m.venue}` : ""}
                  </p>
                </div>
              </div>

              {clubSays && (
                <div className={`mb-2 rounded-lg px-2.5 py-2 text-[11px] ${
                  effective.status === "unavailable" ? "bg-red-500/10 text-red-200" : "bg-amber-500/10 text-amber-200"
                }`}>
                  The club has you down as {effective.status === "unavailable" ? "unavailable" : "doubtful"} for this
                  one — {effective.detail}. Nothing to do; it&apos;s already on the manager&apos;s list.
                </div>
              )}

              <div className="flex gap-1.5">
                {OPTIONS.map(({ status, label, icon: Icon, on }) => (
                  <button
                    key={status}
                    onClick={() => answer(m.id, status, row?.note ?? undefined)}
                    disabled={busyId === m.id}
                    className={`flex flex-1 touch-manipulation items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors disabled:opacity-60 ${
                      row?.status === status ? on : "border border-white/10 text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800"
                    }`}
                  >
                    {busyId === m.id && row?.status !== status ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
                    {label}
                  </button>
                ))}
              </div>

              {noteFor === m.id ? (
                <div className="mt-2 flex gap-2">
                  <input
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="e.g. working till 1, can make a 3pm start"
                    className="flex-1 rounded-lg border border-white/10 bg-navy-600 px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
                  />
                  <button
                    onClick={async () => {
                      await answer(m.id, row?.status ?? "doubtful", noteText);
                      setNoteFor(null);
                    }}
                    className="touch-manipulation rounded-lg bg-club-primary px-2.5 py-1.5 text-xs font-medium text-navy-950"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setNoteFor(m.id); setNoteText(row?.note ?? ""); }}
                  className="mt-1.5 touch-manipulation text-[11px] text-neutral-500 hover:text-neutral-300"
                >
                  {row?.note ? `“${row.note}” · edit` : "Add a note"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// The published XI for the next fixture. Nothing is shown until the manager
// publishes — a draft is theirs alone.
//
// Fetches the squad itself rather than taking it as a prop: the companion only
// holds the signed-in player, and every other name in the XI has to come from
// somewhere.
export function PublishedLineup({ match }: { match: DbMatch | null }) {
  const [lineup, setLineup] = useState<DbLineup | null>(null);
  const [players, setPlayers] = useState<DbPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!match) { setLoading(false); return; }
    Promise.all([fetchLineup(match.id), fetchPlayers()])
      .then(([l, p]) => { if (!cancelled) { setLineup(l); setPlayers(p); } })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [match]);

  if (loading) return <p className="text-sm text-neutral-400">Loading…</p>;
  if (!match) return <p className="text-sm text-neutral-400">No upcoming fixture.</p>;
  if (!lineup?.published_at) {
    return <p className="text-sm text-neutral-400">The team hasn&apos;t been named yet.</p>;
  }

  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "Unknown player";

  return (
    <div>
      <p className="mb-2 text-xs text-neutral-500">
        {match.is_home ? "vs" : "@"} {match.opponent} · {lineup.formation}
      </p>
      <ol className="space-y-1 text-sm">
        {lineup.starters.map((s, i) => (
          <li key={s.playerId} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-xs text-neutral-500 tabular-nums">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">{nameOf(s.playerId)}</span>
            {lineup.captain_id === s.playerId && <Star size={12} className="shrink-0 text-club-primary" />}
            <span className="shrink-0 text-[11px] text-neutral-500">{s.position}</span>
          </li>
        ))}
      </ol>
      {lineup.subs.length > 0 && (
        <>
          <p className="mb-1 mt-3 text-[11px] font-medium uppercase tracking-wide text-neutral-500">Substitutes</p>
          <ul className="space-y-1 text-sm">
            {lineup.subs.map((s) => (
              <li key={s.playerId} className="truncate">{nameOf(s.playerId)}</li>
            ))}
          </ul>
        </>
      )}
      {lineup.notes && <p className="mt-3 whitespace-pre-wrap text-xs text-neutral-400">{lineup.notes}</p>}
    </div>
  );
}
