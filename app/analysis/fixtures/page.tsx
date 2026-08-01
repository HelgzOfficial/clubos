"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { TeamCrest, useCrestLookup } from "@/components/team-crest";
import { fetchMatches, playedMatches, type DbMatch } from "@/lib/matches-db";
import { fetchPlayers, type DbPlayer } from "@/lib/players-db";
import { fetchAllMatchStats, type DbMatchStats } from "@/lib/match-stats-db";
import { fetchAllPlayerMatchStats, type DbPlayerMatchStats } from "@/lib/player-match-stats-db";
import { fetchStatMetrics, formatMetricValue, type StatMetric } from "@/lib/stat-metrics-db";
import { fetchMatchDetails, type DbLineupEntry, type DbGoal, type DbSubstitution } from "@/lib/match-details-db";
import { fetchGpsImports, fetchGpsMetrics, GPS_METRICS, formatMetric, type DbGpsImport, type DbGpsMetric } from "@/lib/gps-db";
import { competitionKind, competitionVariant } from "@/lib/competition-kind";
import {
  ArrowLeft, ChevronDown, ChevronRight, ListChecks, Activity, Users, Target, ArrowLeftRight, ExternalLink,
} from "lucide-react";

type Loaded = {
  lineup: DbLineupEntry[];
  goals: DbGoal[];
  substitutions: DbSubstitution[];
  gps: DbGpsMetric[];
};

// Every fixture that's been played, with everything the analysis module holds
// about it in one place — team stats, per-player metrics, GPS, the team sheet,
// goals and substitutions.
//
// This exists because the data was scattered: team stats on the fixture page,
// player metrics on the stats page, GPS somewhere else again. Answering "what
// happened against Carshalton" meant opening three screens and holding the
// first in your head.
export default function AnalysisFixturesPage() {
  const crestLookup = useCrestLookup();

  const [matches, setMatches] = useState<DbMatch[]>([]);
  const [players, setPlayers] = useState<DbPlayer[]>([]);
  const [metrics, setMetrics] = useState<StatMetric[]>([]);
  const [matchStats, setMatchStats] = useState<DbMatchStats[]>([]);
  const [playerStats, setPlayerStats] = useState<DbPlayerMatchStats[]>([]);
  const [gpsImports, setGpsImports] = useState<DbGpsImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [openId, setOpenId] = useState("");
  const [detail, setDetail] = useState<Record<string, Loaded>>({});
  const [loadingDetail, setLoadingDetail] = useState("");

  useEffect(() => {
    // allSettled throughout: a club that hasn't run the GPS SQL should still
    // get the fixtures and the stats it does have, rather than an empty page.
    Promise.allSettled([
      fetchMatches(), fetchPlayers(), fetchStatMetrics(), fetchAllMatchStats(),
      fetchAllPlayerMatchStats(), fetchGpsImports(),
    ]).then(([m, p, met, ms, ps, gi]) => {
      if (m.status === "fulfilled") setMatches(m.value);
      else setError("Couldn't load fixtures.");
      if (p.status === "fulfilled") setPlayers(p.value);
      if (met.status === "fulfilled") setMetrics(met.value);
      if (ms.status === "fulfilled") setMatchStats(ms.value);
      if (ps.status === "fulfilled") setPlayerStats(ps.value);
      if (gi.status === "fulfilled") setGpsImports(gi.value);
      setLoading(false);
    });
  }, []);

  const fixtures = useMemo(() => playedMatches(matches), [matches]);

  const nameFor = (id: string) => players.find((p) => p.id === id)?.name ?? "Unknown player";

  async function toggle(match: DbMatch) {
    if (openId === match.id) {
      setOpenId("");
      return;
    }
    setOpenId(match.id);
    if (detail[match.id]) return;

    setLoadingDetail(match.id);
    const gpsImport = gpsImports.find((g) => g.match_id === match.id);
    const [details, gps] = await Promise.allSettled([
      fetchMatchDetails(match.id),
      gpsImport ? fetchGpsMetrics(gpsImport.id) : Promise.resolve([] as DbGpsMetric[]),
    ]);
    setDetail((d) => ({
      ...d,
      [match.id]: {
        lineup: details.status === "fulfilled" ? details.value.lineup : [],
        goals: details.status === "fulfilled" ? details.value.goals : [],
        substitutions: details.status === "fulfilled" ? details.value.substitutions : [],
        gps: gps.status === "fulfilled" ? gps.value : [],
      },
    }));
    setLoadingDetail("");
  }

  function resultOf(m: DbMatch) {
    if (m.home_score === null || m.away_score === null) return null;
    const gf = m.is_home ? m.home_score : m.away_score;
    const ga = m.is_home ? m.away_score : m.home_score;
    return {
      letter: gf > ga ? "W" : gf < ga ? "L" : "D",
      tone: gf > ga ? "bg-emerald-500 text-white" : gf < ga ? "bg-red-500 text-white" : "bg-amber-400 text-navy-950",
      score: `${gf}-${ga}`,
    };
  }

  return (
    <AppShell>
      <Link href="/analysis" className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-white">
        <ArrowLeft size={14} /> Back to Analyst Dashboard
      </Link>

      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Fixtures</h1>
        <p className="text-sm text-neutral-500">
          Every match played, with all the stats that have been entered or imported against it.
        </p>
      </div>

      {error && (
        <Card className="mb-4 border-amber-500/30 bg-amber-500/10">
          <p className="text-sm text-amber-200">{error}</p>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : fixtures.length === 0 ? (
        <Card><p className="text-sm text-neutral-400">No fixtures have been played yet.</p></Card>
      ) : (
        <div className="space-y-3">
          {fixtures.map((m) => {
            const r = resultOf(m);
            const stats = matchStats.find((s) => s.match_id === m.id);
            const perPlayer = playerStats.filter((s) => s.match_id === m.id);
            const gpsImport = gpsImports.find((g) => g.match_id === m.id);
            const open = openId === m.id;
            const d = detail[m.id];

            // Which metrics anyone actually recorded for this fixture. Showing
            // every metric the club has defined would be a wall of dashes.
            const usedMetrics = metrics.filter((met) =>
              perPlayer.some((row) => typeof row.values?.[met.key] === "number")
            );

            return (
              <Card key={m.id} className="overflow-hidden">
                <button onClick={() => toggle(m)} className="flex w-full items-center gap-3 text-left">
                  {open ? <ChevronDown size={16} className="shrink-0 text-neutral-500" /> : <ChevronRight size={16} className="shrink-0 text-neutral-500" />}
                  <TeamCrest name={m.opponent} size="md" lookup={crestLookup} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {m.is_home ? "vs" : "@"} {m.opponent}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {new Date(m.kickoff).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                      {" · "}{m.competition}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={competitionVariant(competitionKind(m.competition))}>
                      {competitionKind(m.competition)}
                    </Badge>
                    {r && (
                      <>
                        <span className="text-sm font-semibold tabular-nums">{r.score}</span>
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${r.tone}`}>
                          {r.letter}
                        </span>
                      </>
                    )}
                  </div>
                </button>

                {/* What's on file, visible without expanding — the quickest
                    way to spot a fixture nobody finished writing up. */}
                <div className="mt-2 flex flex-wrap gap-1.5 pl-7">
                  <Chip on={!!stats} icon={<ListChecks size={11} />} label="Team stats" />
                  <Chip on={perPlayer.length > 0} icon={<Users size={11} />} label={`Player stats${perPlayer.length ? ` (${perPlayer.length})` : ""}`} />
                  <Chip on={!!gpsImport} icon={<Activity size={11} />} label="GPS" />
                </div>

                {open && (
                  <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
                    {loadingDetail === m.id && <p className="text-sm text-neutral-400">Loading…</p>}

                    {/* Team stats */}
                    {stats && stats.categories?.length > 0 && (
                      <section>
                        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          <ListChecks size={12} /> Team stats
                        </h3>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {stats.categories.map((cat) => (
                            <div key={cat.key} className="rounded-xl border border-white/10 p-3">
                              <div className="mb-1.5 flex items-baseline gap-2">
                                <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-neutral-400">{cat.label}</p>
                                <span className="shrink-0 text-sm font-semibold tabular-nums">{cat.us ?? "—"}</span>
                                <span className="shrink-0 text-neutral-600">/</span>
                                <span className="shrink-0 text-xs tabular-nums text-neutral-400">{cat.opponent ?? "—"}</span>
                              </div>
                              <ul className="space-y-1 border-t border-white/10 pt-1.5">
                                {cat.detail.map((row) => (
                                  <li key={row.key} className="flex items-center gap-2 text-xs">
                                    <span className="min-w-0 flex-1 truncate text-neutral-400">{row.label}</span>
                                    <span className="shrink-0 font-semibold tabular-nums">{row.us ?? "—"}</span>
                                    <span className="shrink-0 text-neutral-600">/</span>
                                    <span className="shrink-0 tabular-nums text-neutral-400">{row.opponent ?? "—"}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                        <p className="mt-1.5 text-[10px] text-neutral-600">Us / opponent.</p>
                      </section>
                    )}

                    {/* Per-player metrics */}
                    {perPlayer.length > 0 && usedMetrics.length > 0 && (
                      <section>
                        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          <Users size={12} /> Player stats
                        </h3>
                        <div className="overflow-x-auto rounded-xl border border-white/10">
                          <table className="w-full text-xs">
                            <thead className="bg-navy-600/50 dark:bg-navy-800/50">
                              <tr>
                                <th className="px-2 py-2 text-left font-medium text-neutral-400">Player</th>
                                {usedMetrics.map((met) => (
                                  <th key={met.key} className="whitespace-nowrap px-2 py-2 text-right font-medium text-neutral-400">
                                    {met.label}{met.unit ? ` (${met.unit})` : ""}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                              {perPlayer.map((row) => {
                                const p = players.find((x) => x.id === row.player_id);
                                return (
                                  <tr key={row.id}>
                                    <td className="whitespace-nowrap px-2 py-1.5">
                                      <span className="flex items-center gap-1.5">
                                        {p && <PlayerAvatar playerId={p.id} initials={p.initials} photoUrl={p.photo_url} size="sm" />}
                                        {nameFor(row.player_id)}
                                      </span>
                                    </td>
                                    {usedMetrics.map((met) => {
                                      const v = row.values?.[met.key];
                                      return (
                                        <td key={met.key} className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                                          {typeof v === "number" ? formatMetricValue(v, met) : "—"}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    )}

                    {/* GPS */}
                    {d && d.gps.length > 0 && (
                      <section>
                        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          <Activity size={12} /> GPS
                        </h3>
                        <div className="overflow-x-auto rounded-xl border border-white/10">
                          <table className="w-full text-xs">
                            <thead className="bg-navy-600/50 dark:bg-navy-800/50">
                              <tr>
                                <th className="px-2 py-2 text-left font-medium text-neutral-400">Player</th>
                                {GPS_METRICS.map((g) => (
                                  <th key={g.key} className="whitespace-nowrap px-2 py-2 text-right font-medium text-neutral-400" title={g.label}>
                                    {g.short}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                              {d.gps.map((row, i) => (
                                <tr key={i}>
                                  <td className="whitespace-nowrap px-2 py-1.5">
                                    {row.player_id ? nameFor(row.player_id) : row.player_name}
                                  </td>
                                  {GPS_METRICS.map((g) => (
                                    <td key={g.key} className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                                      {formatMetric(row[g.key], g.key)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    )}

                    {/* Team sheet, goals, subs */}
                    {d && (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <section>
                          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                            <Users size={12} /> Team sheet
                          </h3>
                          {d.lineup.length === 0 ? (
                            <p className="text-xs text-neutral-500">Not recorded.</p>
                          ) : (
                            <ul className="space-y-0.5 text-xs">
                              {d.lineup.map((l) => (
                                <li key={l.id} className="flex gap-2">
                                  <span className="w-5 shrink-0 tabular-nums text-neutral-500">{l.shirt_number ?? ""}</span>
                                  <span className="min-w-0 flex-1 truncate">{l.player_name}</span>
                                  <span className="shrink-0 text-neutral-500">{l.is_starting ? l.position ?? "" : "sub"}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </section>

                        <section>
                          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                            <Target size={12} /> Goals
                          </h3>
                          {d.goals.length === 0 ? (
                            <p className="text-xs text-neutral-500">None recorded.</p>
                          ) : (
                            <ul className="space-y-0.5 text-xs">
                              {d.goals.map((g) => (
                                <li key={g.id} className="flex gap-2">
                                  <span className="w-7 shrink-0 tabular-nums text-neutral-500">{g.minute !== null ? `${g.minute}'` : ""}</span>
                                  <span className={`min-w-0 flex-1 truncate ${g.team === "us" ? "" : "text-neutral-500"}`}>
                                    {g.scorer}
                                    {g.assist ? <span className="text-neutral-500"> ({g.assist})</span> : null}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </section>

                        <section>
                          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                            <ArrowLeftRight size={12} /> Substitutions
                          </h3>
                          {d.substitutions.length === 0 ? (
                            <p className="text-xs text-neutral-500">None recorded.</p>
                          ) : (
                            <ul className="space-y-0.5 text-xs">
                              {d.substitutions.map((s) => (
                                <li key={s.id} className="flex gap-2">
                                  <span className="w-7 shrink-0 tabular-nums text-neutral-500">{s.minute !== null ? `${s.minute}'` : ""}</span>
                                  <span className="min-w-0 flex-1 truncate">
                                    {s.player_on} <span className="text-neutral-500">for</span> {s.player_off}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </section>
                      </div>
                    )}

                    {!stats && perPlayer.length === 0 && !gpsImport && d && d.lineup.length === 0 && (
                      <p className="text-sm text-neutral-400">Nothing has been recorded against this fixture yet.</p>
                    )}

                    <Link
                      href={`/matches/${m.id}`}
                      className="inline-flex items-center gap-1.5 text-xs text-neutral-400 underline underline-offset-2 hover:text-white"
                    >
                      Open in Match Centre <ExternalLink size={11} />
                    </Link>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function Chip({ on, icon, label }: { on: boolean; icon: React.ReactNode; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[10px] font-medium ${
        on ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-neutral-600"
      }`}
    >
      {icon} {label}
    </span>
  );
}
