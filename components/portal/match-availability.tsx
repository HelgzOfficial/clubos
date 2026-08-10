"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, HelpCircle, X as XIcon, Star } from "lucide-react";
import { fetchMatches, type DbMatch } from "@/lib/matches-db";
import {
  fetchAvailabilityForPlayer, setAvailability, effectiveAvailability,
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

// Confirming availability for one fixture, shown on that match's page.
//
// There is no cut-off. A player can answer, and change their answer, right up
// to kick-off — circumstances change, and a late "actually I can play" is worth
// far more to a manager than a locked button and a player who gave up. The one
// limit that remains is the fixture itself: once it has kicked off there is
// nothing left to declare.

export function MatchAvailabilityConfirm({ playerId, match }: { playerId: string; match: DbMatch }) {
  const [row, setRow] = useState<DbMatchAvailability | undefined>(undefined);
  const [injuries, setInjuries] = useState<DbInjury[]>([]);
  const [absences, setAbsences] = useState<DbPlayerAbsence[]>([]);
  const [suspensions, setSuspensions] = useState<DbSuspension[]>([]);
  // Needed so a match ban counts itself down here too — otherwise a player
  // whose ban is served would still be told they're suspended.
  const [allMatches, setAllMatches] = useState<DbMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [editingNote, setEditingNote] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [replies, inj, abs, sus, all] = await Promise.all([
        fetchAvailabilityForPlayer(playerId),
        fetchActiveInjuries().catch(() => [] as DbInjury[]),
        fetchPlayerAbsences().catch(() => [] as DbPlayerAbsence[]),
        fetchSuspensions().catch(() => [] as DbSuspension[]),
        fetchMatches().catch(() => [] as DbMatch[]),
      ]);
      const mine = replies.find((r) => r.match_id === match.id);
      setRow(mine);
      setNote(mine?.note ?? "");
      setInjuries(inj);
      setAbsences(abs);
      setSuspensions(sus);
      setAllMatches(all);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        /relation|does not exist|schema cache/i.test(msg)
          ? "Availability isn't set up yet — the club needs to run the setup step."
          : msg || "Couldn't load your reply."
      );
    } finally {
      setLoading(false);
    }
  }, [playerId, match.id]);

  useEffect(() => { load(); }, [load]);

  const kickoff = new Date(match.kickoff);
  const now = new Date();
  const played = now > kickoff;

  const effective = effectiveAvailability(playerId, match, {
    reply: row, injuries, absences, suspensions, matches: allMatches,
  });
  const clubSays = effective.source !== "player" && effective.source !== "none";

  async function answer(status: AvailabilityStatus, withNote?: string) {
    setBusy(true);
    setError("");
    try {
      setRow(await setAvailability({ matchId: match.id, playerId, status, note: withNote ?? note }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-neutral-400">Loading…</p>;
  if (played) {
    return (
      <p className="text-sm text-neutral-400">
        This one has been played.{row ? ` You were down as ${row.status === "unavailable" ? "unavailable" : row.status}.` : ""}
      </p>
    );
  }

  return (
    <div>
      {clubSays ? (
        <div className={`mb-3 rounded-xl px-3 py-2.5 text-sm ${
          effective.status === "unavailable" ? "bg-red-500/10 text-red-200" : "bg-amber-500/10 text-amber-200"
        }`}>
          The club has you down as {effective.status === "unavailable" ? "unavailable" : "doubtful"} for this match —
          {" "}{effective.detail}. Nothing to do; the manager already knows.
        </div>
      ) : (
        <p className="mb-3 text-xs text-neutral-400">
          Let the manager know if you&apos;re available. You can change your answer any time before kick-off.
        </p>
      )}

      {error && <p className="mb-2 text-xs text-red-300">{error}</p>}

      <div className="flex gap-1.5">
        {OPTIONS.map(({ status, label, icon: Icon, on }) => (
          <button
            key={status}
            onClick={() => answer(status)}
            disabled={busy || clubSays}
            className={`flex flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-sm font-medium transition-colors disabled:opacity-50 ${
              row?.status === status ? on : "border border-white/10 text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800"
            }`}
          >
            {busy && row?.status !== status ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
            {label}
          </button>
        ))}
      </div>

      {!clubSays && (
        editingNote ? (
          <div className="mt-2 flex gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. working till 1, can make a 3pm start"
              className="flex-1 rounded-lg border border-white/10 bg-navy-600 px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
            />
            <button
              onClick={async () => { await answer(row?.status ?? "doubtful", note); setEditingNote(false); }}
              className="touch-manipulation rounded-lg bg-club-primary px-2.5 py-1.5 text-xs font-medium text-navy-950"
            >
              Save
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditingNote(true)}
            className="mt-2 touch-manipulation text-xs text-neutral-500 hover:text-neutral-300"
          >
            {row?.note ? `“${row.note}” · edit note` : "Add a note for the manager"}
          </button>
        )
      )}
    </div>
  );
}

// Kept so a companion page that still imports the old list-of-fixtures
// component compiles and works. It simply stacks the per-match confirm blocks,
// which is what the list used to be — the club-override rules come along for
// free rather than being duplicated.
export function MatchAvailability({ playerId, matches }: { playerId: string; matches: DbMatch[] }) {
  const fixtures = matches
    .filter((m) => new Date(m.kickoff).getTime() >= Date.now() && m.status !== "cancelled")
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())
    .slice(0, 5);

  if (fixtures.length === 0) return <p className="text-sm text-neutral-400">No upcoming fixtures.</p>;

  return (
    <ul className="space-y-3">
      {fixtures.map((m) => (
        <li key={m.id} className="rounded-xl border border-white/10 p-3">
          <p className="mb-2 truncate text-sm font-medium">
            {m.is_home ? "vs" : "@"} {m.opponent}
            <span className="ml-1.5 font-normal text-neutral-500">
              {new Date(m.kickoff).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
            </span>
          </p>
          <MatchAvailabilityConfirm playerId={playerId} match={m} />
        </li>
      ))}
    </ul>
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
