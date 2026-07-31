"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { TeamCrest, useCrestLookup } from "@/components/team-crest";
import { usePermissions } from "@/lib/permissions";
import { fetchPlayers, type DbPlayer } from "@/lib/players-db";
import { fetchMatches, playedMatches, upcomingMatches, type DbMatch } from "@/lib/matches-db";
import { fetchActiveInjuries, type DbInjury } from "@/lib/injuries-db";
import { fetchPlayerAbsences, type DbPlayerAbsence } from "@/lib/player-absences-db";
import { fetchLeagueTable, type DbLeagueRow } from "@/lib/league-table-db";
import {
  fetchSuspensions, createSuspension, deleteSuspension, updateSuspensionServed, isSuspensionActive,
  fetchCards, createCard, deleteCard, disciplineByPlayer,
  fetchContracts, saveContract, daysUntilExpiry, CONTRACT_TYPES,
  fetchRegistrations, saveRegistration,
  type DbSuspension, type DbPlayerCard, type DbContract, type DbRegistration, type CardType,
} from "@/lib/manager-db";
import {
  ShieldAlert, Users, FileSignature, ClipboardCheck, Swords, Shield,
  Plus, Trash2, Check, X, Loader2, AlertTriangle, Square, ListChecks,
} from "lucide-react";

type Tab = "overview" | "availability" | "discipline" | "contracts" | "registrations" | "previous" | "opposition";

const TABS: { key: Tab; label: string; icon: typeof Users }[] = [
  { key: "overview", label: "Overview", icon: ClipboardCheck },
  { key: "availability", label: "Availability", icon: Users },
  { key: "discipline", label: "Discipline", icon: Square },
  { key: "contracts", label: "Contracts", icon: FileSignature },
  { key: "registrations", label: "Registrations", icon: ShieldAlert },
  { key: "previous", label: "Previous Matches", icon: Swords },
  { key: "opposition", label: "Opposition", icon: Shield },
];

const inputClass =
  "w-full rounded-lg border border-white/10 bg-navy-600 px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800";

function today() {
  return new Date().toISOString().slice(0, 10);
}
function shortDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// A player's overall status for selection, worked out from every department at
// once: medical, discipline and time off. This is the question a manager
// actually asks — "who can I pick" — and answering it currently means opening
// three different modules.
type Status = { key: "available" | "injured" | "suspended" | "away"; label: string; detail: string };

function statusFor(
  player: DbPlayer,
  injuries: DbInjury[],
  suspensions: DbSuspension[],
  absences: DbPlayerAbsence[]
): Status {
  const suspension = suspensions.find((s) => s.player_id === player.id && isSuspensionActive(s));
  if (suspension) {
    const detail = suspension.matches_banned
      ? `${suspension.matches_served}/${suspension.matches_banned} matches served`
      : `until ${shortDate(suspension.end_date)}`;
    return { key: "suspended", label: "Suspended", detail };
  }

  const injury = injuries.find((i) => i.player_id === player.id);
  if (injury) {
    return {
      key: "injured",
      label: "Injured",
      detail: injury.expected_return ? `${injury.injury} — back ${shortDate(injury.expected_return)}` : injury.injury,
    };
  }

  const t = today();
  const away = absences.find((a) => a.player_id === player.id && a.start_date <= t && a.end_date >= t);
  if (away) return { key: "away", label: away.reason, detail: `until ${shortDate(away.end_date)}` };

  return { key: "available", label: "Available", detail: "" };
}

const statusTone: Record<Status["key"], string> = {
  available: "bg-emerald-500/15 text-emerald-300",
  injured: "bg-red-500/15 text-red-300",
  suspended: "bg-amber-500/15 text-amber-300",
  away: "bg-blue-500/15 text-blue-300",
};

export default function ManagerPage() {
  const { can, appUser, loading: permsLoading } = usePermissions();
  const allowed = can("manager");
  const crestLookup = useCrestLookup();

  const [tab, setTab] = useState<Tab>("overview");
  const [players, setPlayers] = useState<DbPlayer[]>([]);
  const [matches, setMatches] = useState<DbMatch[]>([]);
  const [injuries, setInjuries] = useState<DbInjury[]>([]);
  const [absences, setAbsences] = useState<DbPlayerAbsence[]>([]);
  const [suspensions, setSuspensions] = useState<DbSuspension[]>([]);
  const [cards, setCards] = useState<DbPlayerCard[]>([]);
  const [contracts, setContracts] = useState<DbContract[]>([]);
  const [registrations, setRegistrations] = useState<DbRegistration[]>([]);
  const [league, setLeague] = useState<DbLeagueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    // Settled rather than all: contracts and registrations are restricted, so
    // a permissions problem on one shouldn't blank the whole module.
    const results = await Promise.allSettled([
      fetchPlayers(), fetchMatches(), fetchActiveInjuries(), fetchPlayerAbsences(),
      fetchSuspensions(), fetchCards(), fetchContracts(), fetchRegistrations(), fetchLeagueTable(),
    ]);
    const [p, m, inj, abs, sus, crd, con, reg, lg] = results;
    if (p.status === "fulfilled") setPlayers(p.value);
    if (m.status === "fulfilled") setMatches(m.value);
    if (inj.status === "fulfilled") setInjuries(inj.value);
    if (abs.status === "fulfilled") setAbsences(abs.value);
    if (sus.status === "fulfilled") setSuspensions(sus.value);
    if (crd.status === "fulfilled") setCards(crd.value);
    if (con.status === "fulfilled") setContracts(con.value);
    if (reg.status === "fulfilled") setRegistrations(reg.value);
    if (lg.status === "fulfilled") setLeague(lg.value);

    const failed = results.find((r) => r.status === "rejected");
    if (failed && failed.status === "rejected") {
      const msg = failed.reason instanceof Error ? failed.reason.message : "";
      setError(
        /relation|does not exist|schema cache/i.test(msg)
          ? "Some tables aren't set up yet — run supabase-manager-module.sql in Supabase."
          : msg || "Some data couldn't be loaded."
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (allowed) load(); }, [allowed, load]);

  const statuses = useMemo(() => {
    const map = new Map<string, Status>();
    for (const p of players) map.set(p.id, statusFor(p, injuries, suspensions, absences));
    return map;
  }, [players, injuries, suspensions, absences]);

  const discipline = useMemo(() => disciplineByPlayer(cards, matches), [cards, matches]);
  const nextMatch = useMemo(() => upcomingMatches(matches)[0] ?? null, [matches]);
  const recent = useMemo(() => playedMatches(matches).slice(0, 8), [matches]);
  const playerName = (id: string) => players.find((p) => p.id === id)?.name ?? "Unknown player";

  if (permsLoading) {
    return <AppShell><p className="text-sm text-neutral-400">Loading…</p></AppShell>;
  }

  if (!allowed) {
    return (
      <AppShell>
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldAlert size={24} className="mb-3 text-neutral-500" />
          <p className="font-medium">Manager access only</p>
          <p className="mt-1 max-w-sm text-sm text-neutral-400">
            This module is limited to the manager and the owner.
          </p>
        </Card>
      </AppShell>
    );
  }

  const counts = {
    available: [...statuses.values()].filter((s) => s.key === "available").length,
    injured: [...statuses.values()].filter((s) => s.key === "injured").length,
    suspended: [...statuses.values()].filter((s) => s.key === "suspended").length,
    away: [...statuses.values()].filter((s) => s.key === "away").length,
  };

  const expiringSoon = contracts.filter((c) => {
    const d = daysUntilExpiry(c.end_date);
    return d !== null && d <= 90;
  });
  const unregistered = players.filter((p) => !registrations.find((r) => r.player_id === p.id)?.registered);

  return (
    <AppShell>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Manager</h1>
          <p className="text-sm text-neutral-500">Everything from every department, in one place.</p>
        </div>
        <Link
          href="/manager/lineup"
          className="flex touch-manipulation items-center gap-1.5 rounded-xl bg-club-primary px-3.5 py-2 text-sm font-medium text-navy-950 hover:opacity-90"
        >
          <ListChecks size={15} /> Team selection
        </Link>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex touch-manipulation items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              tab === key ? "bg-club-primary text-navy-950" : "bg-navy-600 text-neutral-400 hover:text-white dark:bg-navy-800"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {error && (
        <Card className="mb-4 border-amber-500/30 bg-amber-500/10">
          <p className="text-sm text-amber-200">{error}</p>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : tab === "overview" ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Available" value={counts.available} tone="text-emerald-300" />
            <Tile label="Injured" value={counts.injured} tone="text-red-300" />
            <Tile label="Suspended" value={counts.suspended} tone="text-amber-300" />
            <Tile label="Away" value={counts.away} tone="text-blue-300" />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Next Match</CardTitle></CardHeader>
              {!nextMatch ? (
                <p className="text-sm text-neutral-400">No upcoming fixture.</p>
              ) : (
                <Link href={`/matches/${nextMatch.id}`} className="flex items-center gap-3 hover:brightness-125">
                  <TeamCrest name={nextMatch.opponent} size="lg" lookup={crestLookup} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {nextMatch.is_home ? "vs" : "@"} {nextMatch.opponent}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {new Date(nextMatch.kickoff).toLocaleString("en-GB", {
                        weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                    <p className="text-xs text-neutral-500">{nextMatch.competition}{nextMatch.venue ? ` · ${nextMatch.venue}` : ""}</p>
                  </div>
                </Link>
              )}
            </Card>

            <Card>
              <CardHeader><CardTitle>Needs Attention</CardTitle></CardHeader>
              <ul className="space-y-2 text-sm">
                {counts.suspended > 0 && (
                  <Attention tone="amber" text={`${counts.suspended} player${counts.suspended === 1 ? "" : "s"} suspended`} onClick={() => setTab("availability")} />
                )}
                {counts.injured > 0 && (
                  <Attention tone="red" text={`${counts.injured} player${counts.injured === 1 ? "" : "s"} injured`} onClick={() => setTab("availability")} />
                )}
                {expiringSoon.length > 0 && (
                  <Attention tone="amber" text={`${expiringSoon.length} contract${expiringSoon.length === 1 ? "" : "s"} expiring within 90 days`} onClick={() => setTab("contracts")} />
                )}
                {unregistered.length > 0 && (
                  <Attention tone="red" text={`${unregistered.length} player${unregistered.length === 1 ? "" : "s"} not registered`} onClick={() => setTab("registrations")} />
                )}
                {counts.suspended === 0 && counts.injured === 0 && expiringSoon.length === 0 && unregistered.length === 0 && (
                  <li className="text-neutral-400">Nothing outstanding.</li>
                )}
              </ul>
            </Card>

            <Card>
              <CardHeader><CardTitle>Discipline</CardTitle></CardHeader>
              {discipline.size === 0 ? (
                <p className="text-sm text-neutral-400">No cards recorded this season.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {[...discipline.entries()]
                    .sort((a, b) => b[1].points - a[1].points)
                    .slice(0, 5)
                    .map(([playerId, t]) => (
                      <li key={playerId} className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate">{playerName(playerId)}</span>
                        <CardPips yellow={t.yellow} red={t.red} />
                      </li>
                    ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader><CardTitle>League</CardTitle></CardHeader>
              {(() => {
                const own = league.find((r) => r.is_own_club);
                if (!own) return <p className="text-sm text-neutral-400">No league table set up yet.</p>;
                return (
                  <div>
                    <p className="text-3xl font-bold">
                      {own.position}
                      <span className="text-base font-normal text-neutral-400">
                        {own.position === 1 ? "st" : own.position === 2 ? "nd" : own.position === 3 ? "rd" : "th"}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-neutral-400">
                      P{own.played} W{own.won} D{own.drawn} L{own.lost} · {own.points} pts
                    </p>
                  </div>
                );
              })()}
            </Card>
          </div>
        </div>
      ) : tab === "availability" ? (
        <AvailabilityTab
          players={players}
          statuses={statuses}
          suspensions={suspensions}
          absences={absences}
          onChanged={load}
        />
      ) : tab === "discipline" ? (
        <DisciplineTab players={players} matches={matches} cards={cards} onChanged={load} />
      ) : tab === "contracts" ? (
        <ContractsTab players={players} contracts={contracts} editorName={appUser?.name ?? null} onChanged={load} />
      ) : tab === "registrations" ? (
        <RegistrationsTab players={players} registrations={registrations} editorName={appUser?.name ?? null} onChanged={load} />
      ) : tab === "previous" ? (
        <Card>
          <CardHeader><CardTitle>Previous Matches</CardTitle></CardHeader>
          {recent.length === 0 ? (
            <p className="text-sm text-neutral-400">No results yet.</p>
          ) : (
            <ul className="divide-y divide-white/10">
              {recent.map((m) => {
                const scored = m.home_score !== null && m.away_score !== null;
                const gf = m.is_home ? m.home_score : m.away_score;
                const ga = m.is_home ? m.away_score : m.home_score;
                const result = scored ? (gf! > ga! ? "W" : gf! < ga! ? "L" : "D") : null;
                return (
                  <li key={m.id}>
                    <Link href={`/matches/${m.id}`} className="flex items-center gap-3 py-2.5 hover:brightness-125">
                      <span className="w-20 shrink-0 text-xs text-neutral-400">
                        {new Date(m.kickoff).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {m.is_home ? "vs" : "@"} {m.opponent}
                      </span>
                      <TeamCrest name={m.opponent} size="sm" lookup={crestLookup} />
                      {result && (
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                          result === "W" ? "bg-emerald-500 text-white" : result === "L" ? "bg-red-500 text-white" : "bg-amber-400 text-navy-950"
                        }`}>{result}</span>
                      )}
                      <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">
                        {scored ? `${gf}-${ga}` : "—"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Opposition</CardTitle></CardHeader>
          {!nextMatch ? (
            <p className="text-sm text-neutral-400">No upcoming fixture to scout.</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-neutral-400">
                Scouting reports, head-to-head and previous meetings live in the Opposition module.
              </p>
              <Link
                href={`/opposition/${encodeURIComponent(nextMatch.opponent)}`}
                className="inline-flex items-center gap-2.5 rounded-xl border border-white/10 px-3 py-2.5 text-sm hover:bg-navy-600 dark:hover:bg-navy-800"
              >
                <TeamCrest name={nextMatch.opponent} size="md" lookup={crestLookup} />
                <span>
                  <span className="block font-medium">{nextMatch.opponent}</span>
                  <span className="block text-xs text-neutral-400">
                    {new Date(nextMatch.kickoff).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                  </span>
                </span>
              </Link>
            </>
          )}
        </Card>
      )}
    </AppShell>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Card className="text-center">
      <p className={`text-3xl font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="mt-0.5 text-xs text-neutral-400">{label}</p>
    </Card>
  );
}

function Attention({ tone, text, onClick }: { tone: "amber" | "red"; text: string; onClick: () => void }) {
  return (
    <li>
      <button onClick={onClick} className="flex w-full touch-manipulation items-center gap-2 text-left hover:underline">
        <AlertTriangle size={14} className={tone === "red" ? "text-red-400" : "text-amber-400"} />
        <span>{text}</span>
      </button>
    </li>
  );
}

function CardPips({ yellow, red }: { yellow: number; red: number }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-xs tabular-nums">
      {yellow > 0 && (
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-2.5 rounded-[2px] bg-amber-400" /> {yellow}
        </span>
      )}
      {red > 0 && (
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-2.5 rounded-[2px] bg-red-500" /> {red}
        </span>
      )}
      {yellow === 0 && red === 0 && <span className="text-neutral-500">—</span>}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------
function AvailabilityTab({
  players, statuses, suspensions, absences, onChanged,
}: {
  players: DbPlayer[];
  statuses: Map<string, Status>;
  suspensions: DbSuspension[];
  absences: DbPlayerAbsence[];
  onChanged: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    playerId: "", reason: "", startDate: today(), endDate: "", matchesBanned: "", competition: "", notes: "",
  });

  async function handleAdd() {
    if (!form.playerId || !form.startDate) {
      setError("Pick a player and a start date.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createSuspension(form);
      setShowAdd(false);
      setForm({ playerId: "", reason: "", startDate: today(), endDate: "", matchesBanned: "", competition: "", notes: "" });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that suspension.");
    } finally {
      setSaving(false);
    }
  }

  const active = suspensions.filter((s) => isSuspensionActive(s));

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Squad Availability</CardTitle>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="flex touch-manipulation items-center gap-1.5 rounded-xl bg-club-primary px-3 py-1.5 text-sm font-medium text-navy-950"
          >
            <Plus size={13} /> Add suspension
          </button>
        </CardHeader>

        {showAdd && (
          <div className="mb-4 rounded-xl border border-white/10 p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select value={form.playerId} onChange={(e) => setForm({ ...form, playerId: e.target.value })} className={inputClass}>
                <option value="">Select player…</option>
                {players.map((p) => <option key={p.id} value={p.id}>#{p.squad_number} {p.name}</option>)}
              </select>
              <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Reason (e.g. red card, 5 bookings)" className={inputClass} />
              <label className="text-xs text-neutral-500">
                Start date
                <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={`${inputClass} mt-1`} />
              </label>
              <label className="text-xs text-neutral-500">
                End date (optional)
                <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={`${inputClass} mt-1`} />
              </label>
              <input value={form.matchesBanned} onChange={(e) => setForm({ ...form, matchesBanned: e.target.value })} placeholder="Matches banned (optional)" inputMode="numeric" className={inputClass} />
              <input value={form.competition} onChange={(e) => setForm({ ...form, competition: e.target.value })} placeholder="Competition (optional)" className={inputClass} />
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              Record it by dates, by number of matches, or both — whichever the competition uses.
            </p>
            {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
            <div className="mt-2 flex gap-2">
              <button onClick={handleAdd} disabled={saving} className="flex touch-manipulation items-center gap-1.5 rounded-lg bg-club-primary px-3 py-1.5 text-sm font-medium text-navy-950 disabled:opacity-60">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save
              </button>
              <button onClick={() => setShowAdd(false)} className="flex touch-manipulation items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-neutral-300">
                <X size={13} /> Cancel
              </button>
            </div>
          </div>
        )}

        <ul className="divide-y divide-white/10">
          {players.map((p) => {
            const s = statuses.get(p.id);
            return (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <PlayerAvatar playerId={p.id} initials={p.initials} photoUrl={p.photo_url} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="truncate text-[11px] text-neutral-500">#{p.squad_number} · {p.position}</p>
                </div>
                <div className="min-w-0 text-right">
                  <span className={`inline-block rounded-lg px-2 py-1 text-[11px] font-medium ${statusTone[s?.key ?? "available"]}`}>
                    {s?.label ?? "Available"}
                  </span>
                  {s?.detail && <p className="mt-0.5 truncate text-[11px] text-neutral-500">{s.detail}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {active.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Active Suspensions</CardTitle></CardHeader>
          <ul className="divide-y divide-white/10">
            {active.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{players.find((p) => p.id === s.player_id)?.name ?? "Unknown"}</p>
                  <p className="truncate text-[11px] text-neutral-500">
                    {s.reason || "Suspension"} · from {shortDate(s.start_date)}
                    {s.end_date ? ` to ${shortDate(s.end_date)}` : ""}
                    {s.competition ? ` · ${s.competition}` : ""}
                  </p>
                </div>
                {s.matches_banned !== null && (
                  <div className="flex shrink-0 items-center gap-1.5 text-xs">
                    <span className="tabular-nums">{s.matches_served}/{s.matches_banned}</span>
                    <button
                      onClick={async () => { await updateSuspensionServed(s.id, Math.min(s.matches_banned!, s.matches_served + 1)); onChanged(); }}
                      className="touch-manipulation rounded-lg border border-white/10 px-2 py-1 hover:bg-navy-600 dark:hover:bg-navy-800"
                    >
                      Served one
                    </button>
                  </div>
                )}
                <button
                  onClick={async () => { if (window.confirm("Remove this suspension?")) { await deleteSuspension(s.id); onChanged(); } }}
                  className="flex h-7 w-7 shrink-0 touch-manipulation items-center justify-center rounded-full text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Time Off</CardTitle></CardHeader>
        <p className="mb-2 text-xs text-neutral-400">
          Holidays and other absences. Players can add their own from the companion app.
        </p>
        {absences.length === 0 ? (
          <p className="text-sm text-neutral-400">Nothing booked.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {absences.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{players.find((p) => p.id === a.player_id)?.name ?? "Unknown"}</span>
                <Badge variant="blue">{a.reason}</Badge>
                <span className="shrink-0 text-xs text-neutral-400">
                  {shortDate(a.start_date)} – {shortDate(a.end_date)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Discipline
// ---------------------------------------------------------------------------
function DisciplineTab({
  players, matches, cards, onChanged,
}: {
  players: DbPlayer[];
  matches: DbMatch[];
  cards: DbPlayerCard[];
  onChanged: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    playerId: "", matchId: "", card: "yellow" as CardType, secondYellow: false, minute: "", reason: "",
  });

  const totals = useMemo(() => disciplineByPlayer(cards, matches), [cards, matches]);
  const played = useMemo(() => playedMatches(matches), [matches]);

  async function handleAdd() {
    if (!form.playerId) { setError("Pick a player."); return; }
    setSaving(true);
    setError("");
    try {
      await createCard({ ...form, matchId: form.matchId || null });
      setShowAdd(false);
      setForm({ playerId: "", matchId: "", card: "yellow", secondYellow: false, minute: "", reason: "" });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't record that card.");
    } finally {
      setSaving(false);
    }
  }

  const ranked = [...totals.entries()].sort((a, b) => b[1].points - a[1].points || b[1].red - a[1].red);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Season Discipline</CardTitle>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="flex touch-manipulation items-center gap-1.5 rounded-xl bg-club-primary px-3 py-1.5 text-sm font-medium text-navy-950"
          >
            <Plus size={13} /> Record card
          </button>
        </CardHeader>

        {showAdd && (
          <div className="mb-4 rounded-xl border border-white/10 p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select value={form.playerId} onChange={(e) => setForm({ ...form, playerId: e.target.value })} className={inputClass}>
                <option value="">Select player…</option>
                {players.map((p) => <option key={p.id} value={p.id}>#{p.squad_number} {p.name}</option>)}
              </select>
              <select value={form.matchId} onChange={(e) => setForm({ ...form, matchId: e.target.value })} className={inputClass}>
                <option value="">No fixture</option>
                {played.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.is_home ? "vs" : "@"} {m.opponent} · {new Date(m.kickoff).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </option>
                ))}
              </select>
              <select value={form.card} onChange={(e) => setForm({ ...form, card: e.target.value as CardType })} className={inputClass}>
                <option value="yellow">Yellow</option>
                <option value="red">Red</option>
              </select>
              <input value={form.minute} onChange={(e) => setForm({ ...form, minute: e.target.value })} placeholder="Minute (optional)" inputMode="numeric" className={inputClass} />
              <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Reason (optional)" className={`${inputClass} sm:col-span-2`} />
            </div>
            {form.card === "red" && (
              <label className="mt-2 flex items-center gap-2 text-xs text-neutral-400">
                <input type="checkbox" checked={form.secondYellow} onChange={(e) => setForm({ ...form, secondYellow: e.target.checked })} />
                Second yellow (doesn&apos;t add disciplinary points on top of the bookings)
              </label>
            )}
            {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
            <div className="mt-2 flex gap-2">
              <button onClick={handleAdd} disabled={saving} className="flex touch-manipulation items-center gap-1.5 rounded-lg bg-club-primary px-3 py-1.5 text-sm font-medium text-navy-950 disabled:opacity-60">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save
              </button>
              <button onClick={() => setShowAdd(false)} className="flex touch-manipulation items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-neutral-300">
                <X size={13} /> Cancel
              </button>
            </div>
          </div>
        )}

        {ranked.length === 0 ? (
          <p className="text-sm text-neutral-400">No cards recorded this season.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {ranked.map(([playerId, t]) => {
              const p = players.find((x) => x.id === playerId);
              return (
                <li key={playerId} className="flex items-center gap-3 py-2.5">
                  {p && <PlayerAvatar playerId={p.id} initials={p.initials} photoUrl={p.photo_url} size="sm" />}
                  <span className="min-w-0 flex-1 truncate text-sm">{p?.name ?? "Unknown player"}</span>
                  <CardPips yellow={t.yellow} red={t.red} />
                  <span className="w-16 shrink-0 text-right text-xs text-neutral-400 tabular-nums">{t.points} pts</span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-neutral-500">
          Competitive fixtures only. A yellow counts one point, a straight red three; a red from two yellows adds
          nothing on top of the bookings already counted.
        </p>
      </Card>

      {cards.length > 0 && (
        <Card>
          <CardHeader><CardTitle>All Cards</CardTitle></CardHeader>
          <ul className="divide-y divide-white/10">
            {cards.slice(0, 40).map((c) => {
              const m = matches.find((x) => x.id === c.match_id);
              return (
                <li key={c.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className={`inline-block h-4 w-3 shrink-0 rounded-[2px] ${c.card === "yellow" ? "bg-amber-400" : "bg-red-500"}`} />
                  <span className="min-w-0 flex-1 truncate">
                    {players.find((p) => p.id === c.player_id)?.name ?? "Unknown"}
                    {c.reason ? <span className="text-neutral-500"> · {c.reason}</span> : null}
                  </span>
                  <span className="shrink-0 text-xs text-neutral-400">
                    {m ? `${m.is_home ? "vs" : "@"} ${m.opponent}` : "No fixture"}
                    {c.minute ? ` · ${c.minute}'` : ""}
                  </span>
                  <button
                    onClick={async () => { if (window.confirm("Delete this card?")) { await deleteCard(c.id); onChanged(); } }}
                    className="flex h-7 w-7 shrink-0 touch-manipulation items-center justify-center rounded-full text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------
function ContractsTab({
  players, contracts, editorName, onChanged,
}: {
  players: DbPlayer[];
  contracts: DbContract[];
  editorName: string | null;
  onChanged: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    contractType: "", startDate: "", endDate: "", terms: "", agentName: "", agentPhone: "", notes: "",
  });

  function startEdit(playerId: string) {
    const c = contracts.find((x) => x.player_id === playerId);
    setForm({
      contractType: c?.contract_type ?? "",
      startDate: c?.start_date ?? "",
      endDate: c?.end_date ?? "",
      terms: c?.terms ?? "",
      agentName: c?.agent_name ?? "",
      agentPhone: c?.agent_phone ?? "",
      notes: c?.notes ?? "",
    });
    setEditingId(playerId);
  }

  async function handleSave(playerId: string) {
    setSaving(true);
    setError("");
    try {
      await saveContract(playerId, form, editorName);
      setEditingId(null);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that contract.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Contracts</CardTitle></CardHeader>
      <p className="mb-3 text-xs text-neutral-400">
        Visible to the manager and owner only. Anything expiring within 90 days is flagged.
      </p>
      {error && <p className="mb-2 text-xs text-red-300">{error}</p>}

      <ul className="divide-y divide-white/10">
        {players.map((p) => {
          const c = contracts.find((x) => x.player_id === p.id);
          const days = daysUntilExpiry(c?.end_date ?? null);
          const expiring = days !== null && days <= 90;
          return (
            <li key={p.id} className="py-2.5">
              {editingId === p.id ? (
                <div className="rounded-xl border border-white/10 p-3">
                  <p className="mb-2 text-sm font-medium">{p.name}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <select value={form.contractType} onChange={(e) => setForm({ ...form, contractType: e.target.value })} className={inputClass}>
                      <option value="">Type…</option>
                      {CONTRACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} placeholder="Terms (appearance money, expenses…)" className={inputClass} />
                    <label className="text-xs text-neutral-500">
                      Start
                      <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={`${inputClass} mt-1`} />
                    </label>
                    <label className="text-xs text-neutral-500">
                      Expires
                      <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={`${inputClass} mt-1`} />
                    </label>
                    <input value={form.agentName} onChange={(e) => setForm({ ...form, agentName: e.target.value })} placeholder="Agent (optional)" className={inputClass} />
                    <input value={form.agentPhone} onChange={(e) => setForm({ ...form, agentPhone: e.target.value })} placeholder="Agent phone" inputMode="tel" className={inputClass} />
                    <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" className={`${inputClass} sm:col-span-2`} />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => handleSave(p.id)} disabled={saving} className="flex touch-manipulation items-center gap-1.5 rounded-lg bg-club-primary px-3 py-1.5 text-sm font-medium text-navy-950 disabled:opacity-60">
                      {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save
                    </button>
                    <button onClick={() => setEditingId(null)} className="flex touch-manipulation items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-neutral-300">
                      <X size={13} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => startEdit(p.id)} className="flex w-full touch-manipulation items-center gap-3 text-left">
                  <PlayerAvatar playerId={p.id} initials={p.initials} photoUrl={p.photo_url} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="truncate text-[11px] text-neutral-500">
                      {c?.contract_type ?? "No contract recorded"}
                      {c?.end_date ? ` · expires ${shortDate(c.end_date)}` : ""}
                      {c?.agent_name ? ` · agent ${c.agent_name}` : ""}
                    </p>
                  </div>
                  {expiring && (
                    <Badge variant={days! < 0 ? "red" : "amber"}>
                      {days! < 0 ? "Expired" : `${days}d left`}
                    </Badge>
                  )}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Registrations
// ---------------------------------------------------------------------------
function RegistrationsTab({
  players, registrations, editorName, onChanged,
}: {
  players: DbPlayer[];
  registrations: DbRegistration[];
  editorName: string | null;
  onChanged: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    registered: false, registrationDate: "", registrationNumber: "", competitions: "",
    itcRequired: false, itcReceived: false, notes: "",
  });

  function startEdit(playerId: string) {
    const r = registrations.find((x) => x.player_id === playerId);
    setForm({
      registered: r?.registered ?? false,
      registrationDate: r?.registration_date ?? "",
      registrationNumber: r?.registration_number ?? "",
      competitions: r?.competitions ?? "",
      itcRequired: r?.itc_required ?? false,
      itcReceived: r?.itc_received ?? false,
      notes: r?.notes ?? "",
    });
    setEditingId(playerId);
  }

  async function handleSave(playerId: string) {
    setSaving(true);
    setError("");
    try {
      await saveRegistration(playerId, form, editorName);
      setEditingId(null);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that registration.");
    } finally {
      setSaving(false);
    }
  }

  const registeredCount = players.filter((p) => registrations.find((r) => r.player_id === p.id)?.registered).length;

  return (
    <Card>
      <CardHeader><CardTitle>Registrations</CardTitle></CardHeader>
      <p className="mb-3 text-sm">
        <span className="font-semibold text-emerald-300">{registeredCount}</span>
        <span className="text-neutral-400"> of {players.length} registered</span>
      </p>
      {error && <p className="mb-2 text-xs text-red-300">{error}</p>}

      <ul className="divide-y divide-white/10">
        {players.map((p) => {
          const r = registrations.find((x) => x.player_id === p.id);
          return (
            <li key={p.id} className="py-2.5">
              {editingId === p.id ? (
                <div className="rounded-xl border border-white/10 p-3">
                  <p className="mb-2 text-sm font-medium">{p.name}</p>
                  <label className="mb-2 flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.registered} onChange={(e) => setForm({ ...form, registered: e.target.checked })} />
                    Registered and eligible to play
                  </label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="text-xs text-neutral-500">
                      Registration date
                      <input type="date" value={form.registrationDate} onChange={(e) => setForm({ ...form, registrationDate: e.target.value })} className={`${inputClass} mt-1`} />
                    </label>
                    <input value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} placeholder="Registration number" className={inputClass} />
                    <input value={form.competitions} onChange={(e) => setForm({ ...form, competitions: e.target.value })} placeholder="Eligible competitions" className={`${inputClass} sm:col-span-2`} />
                    <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" className={`${inputClass} sm:col-span-2`} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-neutral-400">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={form.itcRequired} onChange={(e) => setForm({ ...form, itcRequired: e.target.checked })} />
                      ITC required
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={form.itcReceived} onChange={(e) => setForm({ ...form, itcReceived: e.target.checked })} />
                      ITC received
                    </label>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => handleSave(p.id)} disabled={saving} className="flex touch-manipulation items-center gap-1.5 rounded-lg bg-club-primary px-3 py-1.5 text-sm font-medium text-navy-950 disabled:opacity-60">
                      {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save
                    </button>
                    <button onClick={() => setEditingId(null)} className="flex touch-manipulation items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-neutral-300">
                      <X size={13} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => startEdit(p.id)} className="flex w-full touch-manipulation items-center gap-3 text-left">
                  <PlayerAvatar playerId={p.id} initials={p.initials} photoUrl={p.photo_url} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="truncate text-[11px] text-neutral-500">
                      {r?.registration_number ? `No. ${r.registration_number}` : "No registration number"}
                      {r?.registration_date ? ` · ${shortDate(r.registration_date)}` : ""}
                      {r?.itc_required && !r?.itc_received ? " · ITC outstanding" : ""}
                    </p>
                  </div>
                  <Badge variant={r?.registered ? "green" : "red"}>{r?.registered ? "Registered" : "Not registered"}</Badge>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
