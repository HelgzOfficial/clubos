"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, HelpCircle, X as XIcon, Star } from "lucide-react";
import type { DbMatch } from "@/lib/matches-db";
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
// The deadline is real: replies close 48 hours before kick-off, because a
// manager naming a side on Thursday can't have answers arriving on Saturday
// morning. After it passes the answer is shown but locked, and anyone who
// didn't reply is told to speak to the manager rather than left with a dead
// button.
export const AVAILABILITY_DEADLINE_HOURS = 48;

export function deadlineFor(kickoff: string): Date {
  return new Date(new Date(kickoff).getTime() - AVAILABILITY_DEADLINE_HOURS * 3600_000);
}

export function MatchAvailabilityConfirm({ playerId, match }: { playerId: string; match: DbMatch }) {
  const [row, setRow] = useState<DbMatchAvailability | undefined>(undefined);
  const [injuries, setInjuries] = useState<DbInjury[]>([]);
  const [absences, setAbsences] = useState<DbPlayerAbsence[]>([]);
  const [suspensions, setSuspensions] = useState<DbSuspension[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [editingNote, setEditingNote] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [replies, inj, abs, sus] = await Promise.all([
        fetchAvailabilityForPlayer(playerId),
        fetchActiveInjuries().catch(() => [] as DbInjury[]),
        fetchPlayerAbsences().catch(() => [] as DbPlayerAbsence[]),
        fetchSuspensions().catch(() => [] as DbSuspension[]),
      ]);
      const mine = replies.find((r) => r.match_id === match.id);
      setRow(mine);
      setNote(mine?.note ?? "");
      setInjuries(inj);
      setAbsences(abs);
      setSuspensions(sus);
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
  const deadline = deadlineFor(match.kickoff);
  const now = new Date();
  const closed = now > deadline;
  const played = now > kickoff;

  const effective = effectiveAvailability(playerId, match, { reply: row, injuries, absences, suspensions });
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
          {closed
            ? "Replies for this match are closed."
            : `Please answer by ${deadline.toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} — 48 hours before kick-off.`}
        </p>
      )}

      {error && <p className="mb-2 text-xs text-red-300">{error}</p>}

      <div className="flex gap-1.5">
        {OPTIONS.map(({ status, label, icon: Icon, on }) => (
          <button
            key={status}
            onClick={() => answer(status)}
            disabled={busy || closed || clubSays}
            className={`flex flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-sm font-medium transition-colors disabled:opacity-50 ${
              row?.status === status ? on : "border border-white/10 text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800"
            }`}
          >
            {busy && row?.status !== status ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
            {label}
          </button>
        ))}
      </div>

      {closed && !row && !clubSays && (
        <p className="mt-2 text-xs text-amber-300">
          You didn&apos;t reply before the deadline. Speak to the manager directly if you&apos;re available.
        </p>
      )}

      {!closed && !clubSays && (
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
