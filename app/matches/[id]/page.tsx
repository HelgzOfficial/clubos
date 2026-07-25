"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchMatch, type DbMatch } from "@/lib/matches-db";
import {
  fetchMatchDetails, addLineupEntry, deleteLineupEntry,
  addGoal, deleteGoal, addSubstitution, deleteSubstitution,
  type DbLineupEntry, type DbGoal, type DbSubstitution,
} from "@/lib/match-details-db";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export default function MatchDetailPage() {
  const params = useParams<{ id: string }>();
  const [match, setMatch] = useState<DbMatch | null | undefined>(undefined);
  const [lineup, setLineup] = useState<DbLineupEntry[]>([]);
  const [goals, setGoals] = useState<DbGoal[]>([]);
  const [subs, setSubs] = useState<DbSubstitution[]>([]);
  const [error, setError] = useState("");

  async function load() {
    const m = await fetchMatch(params.id);
    setMatch(m);
    if (m) {
      try {
        const details = await fetchMatchDetails(m.id);
        setLineup(details.lineup);
        setGoals(details.goals);
        setSubs(details.substitutions);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load match details.");
      }
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  if (match === undefined) {
    return (
      <AppShell>
        <p className="text-sm text-neutral-400">Loading…</p>
      </AppShell>
    );
  }

  if (match === null) {
    return (
      <AppShell>
        <Link href="/matches" className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-white">
          <ArrowLeft size={14} /> Back to Match Centre
        </Link>
        <Card><p className="text-sm text-neutral-400">This match couldn&apos;t be found.</p></Card>
      </AppShell>
    );
  }

  const starting = lineup.filter((l) => l.is_starting);
  const bench = lineup.filter((l) => !l.is_starting);
  const hasScore = match.home_score !== null && match.away_score !== null;

  return (
    <AppShell>
      <Link href="/matches" className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-white">
        <ArrowLeft size={14} /> Back to Match Centre
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{match.is_home ? "vs" : "@"} {match.opponent}</h1>
          <p className="text-sm text-neutral-500">{match.competition} · {formatDate(match.kickoff)}{match.venue ? ` · ${match.venue}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={match.is_home ? "green" : "neutral"}>{match.is_home ? "Home" : "Away"}</Badge>
          {hasScore && <span className="text-xl font-semibold">{match.home_score} – {match.away_score}</span>}
        </div>
      </div>

      {error && (
        <Card className="mb-6 border-red-500/30 bg-red-500/10">
          <p className="text-sm text-red-300">{error}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <LineupCard title="Starting XI" matchId={match.id} entries={starting} isStarting onAdded={load} />
        <LineupCard title="Substitutes" matchId={match.id} entries={bench} isStarting={false} onAdded={load} />
        <GoalsCard matchId={match.id} goals={goals} onAdded={load} />
        <SubsCard matchId={match.id} subs={subs} onAdded={load} />
      </div>
    </AppShell>
  );
}

function LineupCard({
  title, matchId, entries, isStarting, onAdded,
}: {
  title: string; matchId: string; entries: DbLineupEntry[]; isStarting: boolean; onAdded: () => void;
}) {
  const [shirtNumber, setShirtNumber] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [position, setPosition] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!playerName.trim()) return;
    setSaving(true);
    try {
      await addLineupEntry(matchId, { isStarting, shirtNumber, playerName: playerName.trim(), position: position.trim(), sortOrder: entries.length });
      setShirtNumber("");
      setPlayerName("");
      setPosition("");
      onAdded();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteLineupEntry(id);
    onAdded();
  }

  return (
    <Card>
      <CardHeader><CardTitle>{title} ({entries.length})</CardTitle></CardHeader>
      {entries.length === 0 ? (
        <p className="mb-3 text-sm text-neutral-400">No players added yet.</p>
      ) : (
        <ul className="mb-3 divide-y divide-white/10">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-2.5 py-2 text-sm">
              <span className="w-6 text-xs text-neutral-400">{e.shirt_number ?? "-"}</span>
              <span className="flex-1 truncate">{e.player_name}</span>
              {e.position && <Badge variant="neutral">{e.position}</Badge>}
              <button onClick={() => handleDelete(e.id)} className="flex h-6 w-6 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10">
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleAdd} className="flex flex-wrap gap-2">
        <input value={shirtNumber} onChange={(e) => setShirtNumber(e.target.value)} placeholder="#" type="number" className="w-14 rounded-lg border border-white/10 bg-navy-600 dark:bg-navy-800 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
        <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Player name" className="min-w-[9rem] flex-1 rounded-lg border border-white/10 bg-navy-600 dark:bg-navy-800 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
        <input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Pos" className="w-20 rounded-lg border border-white/10 bg-navy-600 dark:bg-navy-800 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
        <button type="submit" disabled={saving} className="flex items-center gap-1 rounded-lg bg-club-primary text-navy-950 px-3 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60">
          <Plus size={13} /> Add
        </button>
      </form>
    </Card>
  );
}

function GoalsCard({ matchId, goals, onAdded }: { matchId: string; goals: DbGoal[]; onAdded: () => void }) {
  const [minute, setMinute] = useState("");
  const [team, setTeam] = useState<"us" | "opponent">("us");
  const [scorer, setScorer] = useState("");
  const [assist, setAssist] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!scorer.trim()) return;
    setSaving(true);
    try {
      await addGoal(matchId, { minute, team, scorer: scorer.trim(), assist: assist.trim() });
      setMinute("");
      setScorer("");
      setAssist("");
      onAdded();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteGoal(id);
    onAdded();
  }

  return (
    <Card>
      <CardHeader><CardTitle>Goals ({goals.length})</CardTitle></CardHeader>
      {goals.length === 0 ? (
        <p className="mb-3 text-sm text-neutral-400">No goals logged yet.</p>
      ) : (
        <ul className="mb-3 divide-y divide-white/10">
          {goals.map((g) => (
            <li key={g.id} className="flex items-center gap-2.5 py-2 text-sm">
              <span className="w-10 text-xs text-neutral-400">{g.minute !== null ? `${g.minute}'` : "-"}</span>
              <span className="flex-1 truncate">
                {g.scorer}{g.assist ? <span className="text-neutral-400"> (assist: {g.assist})</span> : ""}
              </span>
              <Badge variant={g.team === "us" ? "green" : "neutral"}>{g.team === "us" ? "Us" : "Them"}</Badge>
              <button onClick={() => handleDelete(g.id)} className="flex h-6 w-6 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10">
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleAdd} className="flex flex-wrap gap-2">
        <input value={minute} onChange={(e) => setMinute(e.target.value)} placeholder="Min" type="number" className="w-16 rounded-lg border border-white/10 bg-navy-600 dark:bg-navy-800 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
        <select value={team} onChange={(e) => setTeam(e.target.value as "us" | "opponent")} className="rounded-lg border border-white/10 bg-navy-600 dark:bg-navy-800 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-club-primary/30">
          <option value="us">Us</option>
          <option value="opponent">Them</option>
        </select>
        <input value={scorer} onChange={(e) => setScorer(e.target.value)} placeholder="Scorer" className="min-w-[8rem] flex-1 rounded-lg border border-white/10 bg-navy-600 dark:bg-navy-800 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
        <input value={assist} onChange={(e) => setAssist(e.target.value)} placeholder="Assist (optional)" className="min-w-[8rem] flex-1 rounded-lg border border-white/10 bg-navy-600 dark:bg-navy-800 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
        <button type="submit" disabled={saving} className="flex items-center gap-1 rounded-lg bg-club-primary text-navy-950 px-3 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60">
          <Plus size={13} /> Add
        </button>
      </form>
    </Card>
  );
}

function SubsCard({ matchId, subs, onAdded }: { matchId: string; subs: DbSubstitution[]; onAdded: () => void }) {
  const [minute, setMinute] = useState("");
  const [playerOff, setPlayerOff] = useState("");
  const [playerOn, setPlayerOn] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!playerOff.trim() || !playerOn.trim()) return;
    setSaving(true);
    try {
      await addSubstitution(matchId, { minute, playerOff: playerOff.trim(), playerOn: playerOn.trim() });
      setMinute("");
      setPlayerOff("");
      setPlayerOn("");
      onAdded();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteSubstitution(id);
    onAdded();
  }

  return (
    <Card>
      <CardHeader><CardTitle>Substitutions ({subs.length})</CardTitle></CardHeader>
      {subs.length === 0 ? (
        <p className="mb-3 text-sm text-neutral-400">No substitutions logged yet.</p>
      ) : (
        <ul className="mb-3 divide-y divide-white/10">
          {subs.map((s) => (
            <li key={s.id} className="flex items-center gap-2.5 py-2 text-sm">
              <span className="w-10 text-xs text-neutral-400">{s.minute !== null ? `${s.minute}'` : "-"}</span>
              <span className="flex-1 truncate">
                <span className="text-red-300">{s.player_off}</span> <span className="text-neutral-400">off,</span>{" "}
                <span className="text-emerald-300">{s.player_on}</span> <span className="text-neutral-400">on</span>
              </span>
              <button onClick={() => handleDelete(s.id)} className="flex h-6 w-6 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10">
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleAdd} className="flex flex-wrap gap-2">
        <input value={minute} onChange={(e) => setMinute(e.target.value)} placeholder="Min" type="number" className="w-16 rounded-lg border border-white/10 bg-navy-600 dark:bg-navy-800 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
        <input value={playerOff} onChange={(e) => setPlayerOff(e.target.value)} placeholder="Player off" className="min-w-[8rem] flex-1 rounded-lg border border-white/10 bg-navy-600 dark:bg-navy-800 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
        <input value={playerOn} onChange={(e) => setPlayerOn(e.target.value)} placeholder="Player on" className="min-w-[8rem] flex-1 rounded-lg border border-white/10 bg-navy-600 dark:bg-navy-800 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
        <button type="submit" disabled={saving} className="flex items-center gap-1 rounded-lg bg-club-primary text-navy-950 px-3 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60">
          <Plus size={13} /> Add
        </button>
      </form>
    </Card>
  );
}
