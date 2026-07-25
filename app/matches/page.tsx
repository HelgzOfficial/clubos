"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchMatches, createMatch, updateMatch, deleteMatch, triggerFixtureSync, type DbMatch } from "@/lib/matches-db";
import { supabaseConfigured } from "@/lib/supabase";
import { RefreshCw, Plus, X, AlertCircle, Trash2, Check, Pencil } from "lucide-react";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

type CompetitionKind = "friendly" | "cup" | "league";

function competitionKind(competition: string): CompetitionKind {
  const c = competition.toLowerCase();
  if (c.includes("friendly") || c.includes("pre-season") || c.includes("preseason")) return "friendly";
  if (c.includes("cup") || c.includes("trophy") || c.includes("shield")) return "cup";
  return "league";
}

const competitionVariant: Record<CompetitionKind, "neutral" | "purple" | "blue"> = {
  friendly: "neutral",
  cup: "purple",
  league: "blue",
};

function CompetitionBadge({ competition }: { competition: string }) {
  if (!competition) return null;
  const kind = competitionKind(competition);
  return <Badge variant={competitionVariant[kind]}>{competition}</Badge>;
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<DbMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const [opponent, setOpponent] = useState("");
  const [competition, setCompetition] = useState("");
  const [venue, setVenue] = useState("");
  const [isHome, setIsHome] = useState(true);
  const [kickoffDate, setKickoffDate] = useState("");
  const [kickoffTime, setKickoffTime] = useState("15:00");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [resultEditId, setResultEditId] = useState<string | null>(null);
  const [resultHome, setResultHome] = useState("");
  const [resultAway, setResultAway] = useState("");
  const [resultSaving, setResultSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setMatches(await fetchMatches());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load matches.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSync() {
    setSyncing(true);
    setSyncMessage("");
    const result = await triggerFixtureSync();
    setSyncing(false);
    if (result.error) {
      setSyncMessage(result.error);
    } else {
      setSyncMessage(`Synced ${result.synced} fixtures from the club site.`);
      await load();
    }
  }

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!opponent.trim() || !kickoffDate) {
      setFormError("Opponent and date are required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await createMatch({
        opponent: opponent.trim(),
        competition: competition.trim() || "Friendly",
        venue: venue.trim(),
        isHome,
        kickoff: new Date(`${kickoffDate}T${kickoffTime}:00`).toISOString(),
      });
      setShowAdd(false);
      setOpponent("");
      setCompetition("");
      setVenue("");
      setIsHome(true);
      setKickoffDate("");
      setKickoffTime("15:00");
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Couldn't add match.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Remove this match?")) return;
    await deleteMatch(id);
    await load();
  }

  function startResultEdit(m: DbMatch) {
    setResultEditId(m.id);
    setResultHome(m.home_score !== null ? String(m.home_score) : "");
    setResultAway(m.away_score !== null ? String(m.away_score) : "");
  }

  async function handleSaveResult(id: string) {
    if (resultHome === "" || resultAway === "") return;
    setResultSaving(true);
    try {
      await updateMatch(id, {
        homeScore: Number(resultHome),
        awayScore: Number(resultAway),
        status: "completed",
      });
      setResultEditId(null);
      await load();
    } finally {
      setResultSaving(false);
    }
  }

  const now = Date.now();
  const upcoming = matches.filter((m) => new Date(m.kickoff).getTime() >= now);
  const past = matches.filter((m) => new Date(m.kickoff).getTime() < now).reverse();

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Match Centre</h1>
          <p className="text-sm text-neutral-500">Fixtures, results, and match preparation.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors disabled:opacity-60"
          >
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} /> {syncing ? "Syncing…" : "Sync Fixtures"}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-xl bg-club-primary text-navy-950 px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={15} /> Add Match
          </button>
        </div>
      </div>

      {syncMessage && (
        <Card className="mb-6 flex items-start gap-3 border-club-primary/30 bg-club-primary/10">
          <RefreshCw size={16} className="mt-0.5 shrink-0 text-club-primary" />
          <p className="text-sm text-neutral-200">{syncMessage}</p>
        </Card>
      )}

      {!supabaseConfigured && (
        <Card className="mb-6 flex items-start gap-3 border-amber-500/30 bg-amber-500/10">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-300" />
          <p className="text-sm text-amber-200">Supabase isn&apos;t connected on this deployment yet, so matches can&apos;t be loaded or saved here.</p>
        </Card>
      )}

      <p className="mb-6 text-xs text-neutral-400">
        &quot;Sync Fixtures&quot; pulls the latest fixture list straight from AFC Whyteleafe&apos;s own published calendar feed. It also
        runs automatically once a day, so postponements or new cup dates the club publishes will show up here without you needing to do
        anything.
      </p>

      {loading ? (
        <p className="text-sm text-neutral-400">Loading matches…</p>
      ) : error ? (
        <Card className="border-red-500/30 bg-red-500/10">
          <p className="text-sm text-red-300">{error}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Upcoming ({upcoming.length})
            </h2>
            <div className="space-y-3">
              {upcoming.length === 0 && <p className="text-sm text-neutral-400">No upcoming matches yet.</p>}
              {upcoming.map((m) => (
                <Card key={m.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{m.is_home ? "vs" : "@"} {m.opponent}</p>
                    <div className="mt-1 mb-1"><CompetitionBadge competition={m.competition} /></div>
                    <p className="text-xs text-neutral-400">{formatDate(m.kickoff)} · {formatTime(m.kickoff)}{m.venue ? ` · ${m.venue}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={m.is_home ? "green" : "neutral"}>{m.is_home ? "Home" : "Away"}</Badge>
                    <Link href={`/matches/${m.id}`} className="text-xs text-neutral-400 hover:text-club-primary underline underline-offset-2">
                      Details
                    </Link>
                    <button onClick={() => handleDelete(m.id)} className="flex h-7 w-7 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Played ({past.length})
            </h2>
            <div className="space-y-3">
              {past.length === 0 && <p className="text-sm text-neutral-400">No results yet.</p>}
              {past.map((m) => {
                const hasScore = m.home_score !== null && m.away_score !== null;
                const won = hasScore && (m.is_home ? m.home_score! > m.away_score! : m.away_score! > m.home_score!);
                const drawn = hasScore && m.home_score === m.away_score;
                const editing = resultEditId === m.id;
                return (
                  <Card key={m.id} className="gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{m.is_home ? "vs" : "@"} {m.opponent}</p>
                        <div className="mt-1 mb-1"><CompetitionBadge competition={m.competition} /></div>
                        <p className="text-xs text-neutral-400">{formatDate(m.kickoff)}</p>
                      </div>
                      {!editing && (
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            {hasScore ? (
                              <>
                                <p className="text-lg font-semibold">{m.home_score} – {m.away_score}</p>
                                <Badge variant={won ? "green" : drawn ? "amber" : "red"}>{won ? "WIN" : drawn ? "DRAW" : "LOSS"}</Badge>
                              </>
                            ) : (
                              <Badge variant="neutral">No result yet</Badge>
                            )}
                          </div>
                          <button
                            onClick={() => startResultEdit(m)}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white"
                            title={hasScore ? "Edit result" : "Add result"}
                          >
                            <Pencil size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                    {!editing && (
                      <Link href={`/matches/${m.id}`} className="mt-2 inline-block text-xs text-neutral-400 hover:text-club-primary underline underline-offset-2">
                        Match details (lineup, goals, subs)
                      </Link>
                    )}

                    {editing && (
                      <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
                        <span className="text-xs text-neutral-400 truncate">{m.is_home ? "Us" : m.opponent}</span>
                        <input
                          type="number"
                          min={0}
                          value={resultHome}
                          onChange={(e) => setResultHome(e.target.value)}
                          className="w-14 rounded-lg border border-white/10 bg-navy-600 dark:bg-navy-800 px-2 py-1 text-center text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                        />
                        <span className="text-neutral-500">–</span>
                        <input
                          type="number"
                          min={0}
                          value={resultAway}
                          onChange={(e) => setResultAway(e.target.value)}
                          className="w-14 rounded-lg border border-white/10 bg-navy-600 dark:bg-navy-800 px-2 py-1 text-center text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                        />
                        <span className="text-xs text-neutral-400 truncate flex-1">{m.is_home ? m.opponent : "Us"}</span>
                        <button
                          onClick={() => handleSaveResult(m.id)}
                          disabled={resultSaving}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-club-primary text-navy-950 disabled:opacity-60"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          onClick={() => setResultEditId(null)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-sm">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-medium">Add Match</p>
              <button onClick={() => setShowAdd(false)} className="text-neutral-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Opponent</label>
                <input value={opponent} onChange={(e) => setOpponent(e.target.value)} className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-neutral-500">Date</label>
                  <input type="date" value={kickoffDate} onChange={(e) => setKickoffDate(e.target.value)} className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
                </div>
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-neutral-500">Kick-off</label>
                  <input type="time" value={kickoffTime} onChange={(e) => setKickoffTime(e.target.value)} className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Competition</label>
                <input value={competition} onChange={(e) => setCompetition(e.target.value)} placeholder="e.g. FA Cup" className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Venue</label>
                <input value={venue} onChange={(e) => setVenue(e.target.value)} className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
              </div>
              <div className="flex gap-1 rounded-xl bg-navy-600 dark:bg-navy-800 p-1 text-sm w-fit">
                {[{ v: true, label: "Home" }, { v: false, label: "Away" }].map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    onClick={() => setIsHome(o.v)}
                    className={`rounded-lg px-3 py-1 transition-colors ${isHome === o.v ? "bg-club-primary text-navy-950" : "text-neutral-400"}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              {formError && <p className="text-sm text-red-300">{formError}</p>}

              <button type="submit" disabled={saving} className="w-full rounded-xl bg-club-primary text-navy-950 px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60">
                {saving ? "Adding…" : "Add Match"}
              </button>
            </form>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
