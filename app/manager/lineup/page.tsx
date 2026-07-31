"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { TeamCrest, useCrestLookup } from "@/components/team-crest";
import { usePermissions } from "@/lib/permissions";
import { club as clubFallback } from "@/lib/sample-data";
import { loadClubSettings } from "@/lib/club-settings";
import { fetchClubSettings } from "@/lib/club-settings-db";
import { fetchPlayers, type DbPlayer } from "@/lib/players-db";
import { fetchMatches, upcomingMatches, playedMatches, type DbMatch } from "@/lib/matches-db";
import { fetchActiveInjuries, type DbInjury } from "@/lib/injuries-db";
import { fetchPlayerAbsences, type DbPlayerAbsence } from "@/lib/player-absences-db";
import { fetchSuspensions, type DbSuspension } from "@/lib/manager-db";
import {
  fetchAvailabilityForMatch, effectiveAvailability, AVAILABILITY_LABEL, AVAILABILITY_TONE, SOURCE_LABEL,
  type DbMatchAvailability,
} from "@/lib/match-availability-db";
import {
  fetchLineup, saveLineup, emptyLineup, FORMATIONS, FORMATION_NAMES,
  iFasList, teamSheetText, squadListText,
  type DbLineup, type LineupSlot,
} from "@/lib/lineups-db";
import {
  ArrowLeft, ShieldAlert, Check, X, Loader2, Copy, Printer, Mail,
  ChevronUp, ChevronDown, Star, Send,
} from "lucide-react";

export default function LineupPage() {
  const { can, appUser, loading: permsLoading } = usePermissions();
  const allowed = can("manager");
  const crestLookup = useCrestLookup();

  const [players, setPlayers] = useState<DbPlayer[]>([]);
  const [matches, setMatches] = useState<DbMatch[]>([]);
  const [injuries, setInjuries] = useState<DbInjury[]>([]);
  const [absences, setAbsences] = useState<DbPlayerAbsence[]>([]);
  const [suspensions, setSuspensions] = useState<DbSuspension[]>([]);
  const [availability, setAvailability] = useState<DbMatchAvailability[]>([]);
  const [clubName, setClubName] = useState(clubFallback.name);

  const [matchId, setMatchId] = useState("");
  const [lineup, setLineup] = useState<DbLineup | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [output, setOutput] = useState<"ifas" | "sheet" | "social">("ifas");

  useEffect(() => {
    if (!allowed) return;
    (async () => {
      const [p, m, inj, abs, sus] = await Promise.all([
        fetchPlayers(), fetchMatches(), fetchActiveInjuries(), fetchPlayerAbsences(), fetchSuspensions(),
      ]);
      setPlayers(p);
      setMatches(m);
      setInjuries(inj);
      setAbsences(abs);
      setSuspensions(sus);
      setMatchId((prev) => prev || upcomingMatches(m)[0]?.id || playedMatches(m)[0]?.id || "");
      setLoading(false);
    })().catch((e) => {
      setError(e instanceof Error ? e.message : "Couldn't load the squad.");
      setLoading(false);
    });

    setClubName(loadClubSettings(clubFallback).name);
    fetchClubSettings(clubFallback).then((s) => setClubName(s.name)).catch(() => {});
  }, [allowed]);

  const loadLineup = useCallback(async (id: string) => {
    if (!id) return;
    setError("");
    try {
      setLineup((await fetchLineup(id)) ?? emptyLineup(id));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        /relation|does not exist|schema cache/i.test(msg)
          ? "Line-ups aren't set up yet — run supabase-match-lineups.sql in Supabase."
          : msg || "Couldn't load that line-up."
      );
      setLineup(emptyLineup(id));
    }
  }, []);

  useEffect(() => { loadLineup(matchId); }, [matchId, loadLineup]);

  // Replies are per fixture, so they reload whenever the fixture changes.
  useEffect(() => {
    if (!matchId) return;
    fetchAvailabilityForMatch(matchId).then(setAvailability).catch(() => setAvailability([]));
  }, [matchId]);

  const match = matches.find((m) => m.id === matchId) ?? null;
  const positions = lineup ? FORMATIONS[lineup.formation] ?? FORMATIONS["4-4-2"] : [];

  const selectedIds = useMemo(() => {
    if (!lineup) return new Set<string>();
    return new Set([...lineup.starters, ...lineup.subs].map((s) => s.playerId));
  }, [lineup]);

  function update(patch: Partial<DbLineup>) {
    setLineup((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function addStarter(player: DbPlayer) {
    if (!lineup || lineup.starters.length >= 11) return;
    const slot: LineupSlot = {
      playerId: player.id,
      position: positions[lineup.starters.length] ?? "",
      shirt: player.squad_number,
    };
    update({ starters: [...lineup.starters, slot] });
  }

  function addSub(player: DbPlayer) {
    if (!lineup) return;
    update({ subs: [...lineup.subs, { playerId: player.id, position: "SUB", shirt: player.squad_number }] });
  }

  function removeSlot(playerId: string) {
    if (!lineup) return;
    update({
      starters: lineup.starters.filter((s) => s.playerId !== playerId),
      subs: lineup.subs.filter((s) => s.playerId !== playerId),
      captain_id: lineup.captain_id === playerId ? null : lineup.captain_id,
    });
  }

  function moveStarter(index: number, delta: -1 | 1) {
    if (!lineup) return;
    const next = [...lineup.starters];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    update({ starters: next });
  }

  function setSlotPosition(playerId: string, position: string) {
    if (!lineup) return;
    update({ starters: lineup.starters.map((s) => (s.playerId === playerId ? { ...s, position } : s)) });
  }

  async function handleSave(publish: boolean) {
    if (!lineup) return;
    setSaving(true);
    setError("");
    try {
      const saved = await saveLineup(
        { ...lineup, published_at: publish ? new Date().toISOString() : lineup.published_at },
        appUser?.name ?? null
      );
      setLineup({ ...saved, starters: saved.starters ?? [], subs: saved.subs ?? [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the line-up.");
    } finally {
      setSaving(false);
    }
  }

  const outputText = useMemo(() => {
    if (!lineup || !match) return "";
    if (output === "ifas") return iFasList(lineup, players);
    if (output === "sheet") return teamSheetText(lineup, players, match, clubName);
    return squadListText(lineup, players, match, clubName);
  }, [lineup, match, players, clubName, output]);

  async function copyOutput() {
    try {
      await navigator.clipboard.writeText(outputText);
      setCopied(output);
      setTimeout(() => setCopied(""), 2500);
    } catch {
      setError("Couldn't copy — select the text and copy it manually.");
    }
  }

  if (permsLoading) return <AppShell><p className="text-sm text-neutral-400">Loading…</p></AppShell>;

  if (!allowed) {
    return (
      <AppShell>
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldAlert size={24} className="mb-3 text-neutral-500" />
          <p className="font-medium">Manager access only</p>
          <p className="mt-1 text-sm text-neutral-400">Team selection is limited to the manager and the owner.</p>
        </Card>
      </AppShell>
    );
  }

  const fixtures = [...upcomingMatches(matches), ...playedMatches(matches).slice(0, 5)];
  const available = players.filter((p) => !selectedIds.has(p.id));

  return (
    <AppShell>
      <Link href="/manager" className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-white">
        <ArrowLeft size={14} /> Back to Manager
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Team Selection</h1>
          <p className="text-sm text-neutral-500">Pick the side, then read it straight into iFAS.</p>
        </div>
        {lineup?.published_at && <Badge variant="green">Published to squad</Badge>}
      </div>

      {error && (
        <Card className="mb-4 border-amber-500/30 bg-amber-500/10">
          <p className="text-sm text-amber-200">{error}</p>
        </Card>
      )}

      {loading || !lineup ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : (
        <div className="space-y-5">
          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                value={matchId}
                onChange={(e) => setMatchId(e.target.value)}
                className="flex-1 rounded-lg border border-white/10 bg-navy-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
              >
                {fixtures.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.is_home ? "vs" : "@"} {m.opponent} · {new Date(m.kickoff).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </option>
                ))}
              </select>
              <select
                value={lineup.formation}
                onChange={(e) => update({ formation: e.target.value })}
                className="rounded-lg border border-white/10 bg-navy-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
              >
                {FORMATION_NAMES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              {match && <TeamCrest name={match.opponent} size="md" lookup={crestLookup} />}
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Starting XI</CardTitle>
                <span className="text-sm text-neutral-400 tabular-nums">{lineup.starters.length}/11</span>
              </CardHeader>

              {lineup.starters.length === 0 ? (
                <p className="text-sm text-neutral-400">Tap players below to build the XI.</p>
              ) : (
                <ul className="divide-y divide-white/10">
                  {lineup.starters.map((s, i) => {
                    const p = players.find((x) => x.id === s.playerId);
                    return (
                      <li key={s.playerId} className="flex items-center gap-2 py-2">
                        <span className="w-5 shrink-0 text-xs text-neutral-500 tabular-nums">{i + 1}</span>
                        {p && <PlayerAvatar playerId={p.id} initials={p.initials} photoUrl={p.photo_url} size="sm" />}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {p?.name ?? "Unknown"}
                            {lineup.captain_id === s.playerId && <span className="text-club-primary"> (C)</span>}
                          </p>
                          <input
                            value={s.position}
                            onChange={(e) => setSlotPosition(s.playerId, e.target.value)}
                            placeholder="Position"
                            className="mt-0.5 w-20 rounded border border-white/10 bg-navy-600 px-1.5 py-0.5 text-[11px] outline-none dark:bg-navy-800"
                          />
                        </div>
                        <button
                          onClick={() => update({ captain_id: lineup.captain_id === s.playerId ? null : s.playerId })}
                          title="Captain"
                          className={`flex h-7 w-7 shrink-0 touch-manipulation items-center justify-center rounded-full ${
                            lineup.captain_id === s.playerId ? "text-club-primary" : "text-neutral-500 hover:text-white"
                          }`}
                        >
                          <Star size={13} />
                        </button>
                        <span className="flex shrink-0 flex-col">
                          <button onClick={() => moveStarter(i, -1)} className="touch-manipulation text-neutral-500 hover:text-white"><ChevronUp size={13} /></button>
                          <button onClick={() => moveStarter(i, 1)} className="touch-manipulation text-neutral-500 hover:text-white"><ChevronDown size={13} /></button>
                        </span>
                        <button
                          onClick={() => removeSlot(s.playerId)}
                          className="flex h-7 w-7 shrink-0 touch-manipulation items-center justify-center rounded-full text-red-400 hover:bg-red-500/10"
                        >
                          <X size={13} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Substitutes ({lineup.subs.length})
              </p>
              {lineup.subs.length === 0 ? (
                <p className="text-sm text-neutral-400">No substitutes named.</p>
              ) : (
                <ul className="divide-y divide-white/10">
                  {lineup.subs.map((s, i) => {
                    const p = players.find((x) => x.id === s.playerId);
                    return (
                      <li key={s.playerId} className="flex items-center gap-2 py-2">
                        <span className="w-5 shrink-0 text-xs text-neutral-500 tabular-nums">{i + 1}</span>
                        {p && <PlayerAvatar playerId={p.id} initials={p.initials} photoUrl={p.photo_url} size="sm" />}
                        <span className="min-w-0 flex-1 truncate text-sm">{p?.name ?? "Unknown"}</span>
                        <button
                          onClick={() => removeSlot(s.playerId)}
                          className="flex h-7 w-7 shrink-0 touch-manipulation items-center justify-center rounded-full text-red-400 hover:bg-red-500/10"
                        >
                          <X size={13} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <textarea
                value={lineup.notes ?? ""}
                onChange={(e) => update({ notes: e.target.value })}
                rows={2}
                placeholder="Notes for the team sheet (optional)"
                className="mt-4 w-full rounded-lg border border-white/10 bg-navy-600 px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className="flex touch-manipulation items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-200 hover:bg-navy-600 disabled:opacity-60 dark:hover:bg-navy-800"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save draft
                </button>
                <button
                  onClick={() => handleSave(true)}
                  disabled={saving || lineup.starters.length === 0}
                  className="flex touch-manipulation items-center gap-1.5 rounded-xl bg-club-primary px-3 py-2 text-sm font-medium text-navy-950 disabled:opacity-60"
                >
                  <Send size={14} /> Publish to squad
                </button>
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                A draft is yours alone. Publishing is what makes it visible to players.
              </p>
            </Card>

            {/* Squad */}
            <Card>
              <CardHeader><CardTitle>Squad</CardTitle></CardHeader>
              <p className="mb-2 text-xs text-neutral-400">
                Combines each player&apos;s own reply with medical, suspensions and booked time off. Anyone flagged is
                still selectable — a doubtful player often plays, and that&apos;s your call, not the app&apos;s.
              </p>
              <ul className="divide-y divide-white/10">
                {available.map((p) => {
                  const eff = match
                    ? effectiveAvailability(p.id, match, {
                        reply: availability.find((a) => a.player_id === p.id),
                        injuries, suspensions, absences,
                      })
                    : null;
                  return (
                    <li key={p.id} className="flex items-center gap-2.5 py-2">
                      <PlayerAvatar playerId={p.id} initials={p.initials} photoUrl={p.photo_url} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className="truncate text-[11px] text-neutral-500">
                          #{p.squad_number} · {p.position}
                          {eff && eff.detail ? ` · ${eff.detail}` : ""}
                        </p>
                      </div>
                      {eff && eff.status !== "unknown" && (
                        <span
                          title={`${SOURCE_LABEL[eff.source]}${eff.detail ? ` · ${eff.detail}` : ""}`}
                          className={`shrink-0 rounded-lg px-1.5 py-0.5 text-[10px] font-medium ${AVAILABILITY_TONE[eff.status]}`}
                        >
                          {AVAILABILITY_LABEL[eff.status]}
                        </span>
                      )}
                      <button
                        onClick={() => addStarter(p)}
                        disabled={lineup.starters.length >= 11}
                        className="shrink-0 touch-manipulation rounded-lg border border-white/10 px-2 py-1 text-[11px] hover:bg-navy-600 disabled:opacity-40 dark:hover:bg-navy-800"
                      >
                        XI
                      </button>
                      <button
                        onClick={() => addSub(p)}
                        className="shrink-0 touch-manipulation rounded-lg border border-white/10 px-2 py-1 text-[11px] hover:bg-navy-600 dark:hover:bg-navy-800"
                      >
                        Sub
                      </button>
                    </li>
                  );
                })}
              </ul>
              {available.length === 0 && <p className="text-sm text-neutral-400">Everyone is selected.</p>}
            </Card>
          </div>

          {/* Output */}
          <Card>
            <CardHeader><CardTitle>Team Sheet</CardTitle></CardHeader>
            <div className="mb-3 flex flex-wrap gap-2">
              {([
                { key: "ifas" as const, label: "For iFAS" },
                { key: "sheet" as const, label: "Team sheet" },
                { key: "social" as const, label: "Social media" },
              ]).map((o) => (
                <button
                  key={o.key}
                  onClick={() => setOutput(o.key)}
                  className={`touch-manipulation rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    output === o.key ? "bg-club-primary text-navy-950" : "border border-white/10 text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>

            <p className="mb-2 text-xs text-neutral-400">
              {output === "ifas"
                ? "Numbered in team-sheet order so you can keep your place while clicking each player in iFAS."
                : output === "sheet"
                  ? "Full sheet with positions and captain, for printing or the dressing room."
                  : "Names only, ready to paste into a post or email."}
            </p>

            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-navy-600 p-3 font-mono text-xs leading-relaxed dark:bg-navy-800">
{outputText || "Nothing selected yet."}
            </pre>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={copyOutput}
                disabled={!outputText}
                className="flex touch-manipulation items-center gap-1.5 rounded-xl bg-club-primary px-3 py-2 text-sm font-medium text-navy-950 disabled:opacity-60"
              >
                <Copy size={14} /> {copied === output ? "Copied" : "Copy"}
              </button>
              <button
                onClick={() => window.print()}
                className="flex touch-manipulation items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800"
              >
                <Printer size={14} /> Print
              </button>
              {match && (
                <a
                  href={`mailto:?subject=${encodeURIComponent(`Team news — ${clubName} ${match.is_home ? "vs" : "@"} ${match.opponent}`)}&body=${encodeURIComponent(outputText)}`}
                  className="flex touch-manipulation items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800"
                >
                  <Mail size={14} /> Email
                </a>
              )}
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
