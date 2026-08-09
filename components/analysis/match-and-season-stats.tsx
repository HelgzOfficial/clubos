"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { tabState } from "@/lib/tab-styles";
import { formatMetricValue, type StatMetric } from "@/lib/stat-metrics-db";
import {
  aggregateSeason, isCompetitive,
  type DbPlayerMatchStats, type PlayerSeasonAggregate,
} from "@/lib/player-match-stats-db";
import { playedMatches, type DbMatch } from "@/lib/matches-db";
import type { DbPlayer } from "@/lib/players-db";
import { SEASON_START_LABEL } from "@/lib/season";
import { CalendarDays, Sigma, Download, ArrowUpDown } from "lucide-react";

type View = "match" | "season";
type SeasonMode = "average" | "total" | "best";

const SEASON_MODES: { key: SeasonMode; label: string }[] = [
  { key: "average", label: "Average" },
  { key: "total", label: "Total" },
  { key: "best", label: "Best" },
];

function fixtureLabel(m: DbMatch): string {
  const date = new Date(m.kickoff).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `${date} — ${m.opponent} (${m.is_home ? "H" : "A"})`;
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function download(name: string, lines: string[]) {
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// Two ways of reading the same uploaded numbers: one game on its own, and the
// season compiled across every game.
//
// They answer genuinely different questions and neither substitutes for the
// other. A single match tells you what happened on Saturday; a season average
// tells you whether Saturday was normal. Showing a lone figure without the
// second is how a good performance gets mistaken for a trend, and a bad one for
// a problem.
export function MatchAndSeasonStats({
  players, matches, metrics, allStats,
}: {
  players: DbPlayer[];
  matches: DbMatch[];
  metrics: StatMetric[];
  allStats: DbPlayerMatchStats[];
}) {
  const [view, setView] = useState<View>("match");
  const [mode, setMode] = useState<SeasonMode>("average");
  const [sortKey, setSortKey] = useState<string>("");

  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  // Fixtures that have both been played and have stats recorded against them —
  // an empty fixture in the picker is a dead end, so it isn't offered.
  const fixtures = useMemo(() => {
    const withStats = new Set(allStats.map((s) => s.match_id));
    return playedMatches(matches).filter((m) => withStats.has(m.id));
  }, [matches, allStats]);

  const [matchId, setMatchId] = useState("");
  const selected = fixtures.find((m) => m.id === matchId) ?? fixtures[0] ?? null;

  const matchRows = useMemo(() => {
    if (!selected) return [];
    return allStats
      .filter((s) => s.match_id === selected.id)
      .map((s) => ({ stat: s, player: playerById.get(s.player_id) }))
      .filter((r): r is { stat: DbPlayerMatchStats; player: DbPlayer } => Boolean(r.player))
      .sort((a, b) => a.player.name.localeCompare(b.player.name));
  }, [allStats, selected, playerById]);

  const aggregates = useMemo(
    () => aggregateSeason(allStats, matches, { competitiveOnly: true }),
    [allStats, matches]
  );

  const seasonRows = useMemo(() => {
    const rows: { player: DbPlayer; agg: PlayerSeasonAggregate }[] = [];
    for (const [playerId, agg] of aggregates) {
      const player = playerById.get(playerId);
      if (player) rows.push({ player, agg });
    }
    rows.sort((a, b) => {
      if (sortKey) {
        const av = a.agg.byMetric[sortKey]?.[mode] ?? null;
        const bv = b.agg.byMetric[sortKey]?.[mode] ?? null;
        // Players with no reading for this metric sink, rather than sorting as
        // if they'd scored zero.
        if (av === null && bv === null) return a.player.name.localeCompare(b.player.name);
        if (av === null) return 1;
        if (bv === null) return -1;
        if (bv !== av) return bv - av;
      }
      return a.player.name.localeCompare(b.player.name);
    });
    return rows;
  }, [aggregates, playerById, sortKey, mode]);

  // How many competitive fixtures the season figures are built from — context
  // for an average that would otherwise be a number with no denominator.
  const seasonGames = useMemo(
    () => playedMatches(matches).filter(isCompetitive).filter(
      (m) => allStats.some((s) => s.match_id === m.id)
    ).length,
    [matches, allStats]
  );

  function downloadMatch() {
    if (!selected) return;
    const header = ["Player", ...metrics.map((m) => m.unit ? `${m.label} (${m.unit})` : m.label)];
    const lines = [header.map(csvCell).join(",")];
    for (const r of matchRows) {
      lines.push([
        csvCell(r.player.name),
        ...metrics.map((m) => {
          const v = r.stat.values?.[m.key];
          return typeof v === "number" && Number.isFinite(v) ? v : "";
        }),
      ].join(","));
    }
    download(`stats-${selected.opponent.replace(/\W+/g, "-").toLowerCase()}.csv`, lines);
  }

  function downloadSeason() {
    const header = ["Player", "Games", ...metrics.map((m) => m.unit ? `${m.label} (${m.unit})` : m.label)];
    const lines = [header.map(csvCell).join(",")];
    for (const r of seasonRows) {
      lines.push([
        csvCell(r.player.name),
        r.agg.games,
        ...metrics.map((m) => {
          const a = r.agg.byMetric[m.key];
          return a ? (mode === "average" ? a.average.toFixed(m.decimals) : a[mode]) : "";
        }),
      ].join(","));
    }
    download(`season-${mode}.csv`, lines);
  }

  if (metrics.length === 0) {
    return (
      <Card>
        <p className="text-sm text-neutral-400">
          No metrics set up yet. Add some on the Metrics tab first, then enter or import stats against a fixture.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{view === "match" ? "Individual Game" : "Season Averages"}</CardTitle>
        <div className="flex gap-1.5">
          {([
            { key: "match" as const, label: "Individual game", icon: CalendarDays },
            { key: "season" as const, label: "Season table", icon: Sigma },
          ]).map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`flex touch-manipulation items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                tabState(view === v.key, "outline")
              }`}
            >
              <v.icon size={12} /> {v.label}
            </button>
          ))}
        </div>
      </CardHeader>

      {view === "match" ? (
        <>
          {fixtures.length === 0 ? (
            <p className="text-sm text-neutral-400">
              No stats recorded against a played fixture yet. Use Enter Stats or Import first.
            </p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <select
                  value={selected?.id ?? ""}
                  onChange={(e) => setMatchId(e.target.value)}
                  className="min-w-[15rem] flex-1 rounded-xl border border-white/10 bg-navy-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
                >
                  {fixtures.map((m) => (
                    <option key={m.id} value={m.id}>{fixtureLabel(m)}</option>
                  ))}
                </select>
                {selected && (
                  <Link
                    href={`/matches/${selected.id}`}
                    className="rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800"
                  >
                    Open fixture
                  </Link>
                )}
              </div>

              {selected && !isCompetitive(selected) && (
                <p className="mb-3 rounded-xl border border-white/10 p-2.5 text-xs text-neutral-400">
                  This is a friendly, so these numbers are shown here but are left out of the season table — the same
                  rule the rest of the app uses.
                </p>
              )}

              <p className="mb-2 text-xs text-neutral-400">
                {matchRows.length} {matchRows.length === 1 ? "player" : "players"} with stats recorded for this fixture.
              </p>

              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-xs">
                  <thead className="bg-navy-600/50 dark:bg-navy-800/50">
                    <tr>
                      <th className="sticky left-0 bg-navy-600/50 px-2 py-2 text-left font-medium text-neutral-400 dark:bg-navy-800/50">
                        Player
                      </th>
                      {metrics.map((m) => (
                        <th key={m.key} className="whitespace-nowrap px-2 py-2 text-right font-medium text-neutral-400" title={m.label}>
                          {m.label}{m.unit ? <span className="text-neutral-600"> {m.unit}</span> : null}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {matchRows.map((r) => (
                      <tr key={r.stat.id}>
                        <td className="sticky left-0 whitespace-nowrap bg-navy-700 px-2 py-1.5 dark:bg-navy-900">
                          <Link href={`/players/${r.player.id}`} className="flex items-center gap-1.5 hover:text-club-primary">
                            <PlayerAvatar playerId={r.player.id} initials={r.player.initials} photoUrl={r.player.photo_url} size="sm" />
                            <span className="truncate">{r.player.name}</span>
                          </Link>
                        </td>
                        {metrics.map((m) => {
                          const v = r.stat.values?.[m.key];
                          const has = typeof v === "number" && Number.isFinite(v);
                          const season = aggregates.get(r.player.id)?.byMetric[m.key];
                          // Compared against their own season average, so a
                          // number can be read as good or bad without leaving
                          // the row. Only meaningful once there's more than one
                          // game to average — against a single game the figure
                          // would just be comparing a number with itself.
                          const comparable =
                            has && season && season.games > 1 && Math.abs(v - season.average) > 0.0001
                              ? { delta: v - season.average, average: season.average, games: season.games }
                              : null;
                          return (
                            <td key={m.key} className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                              {has ? formatMetricValue(v, m) : <span className="text-neutral-600">—</span>}
                              {comparable && (
                                <span
                                  className={`ml-1 text-[10px] ${
                                    (comparable.delta > 0) === m.higher_is_better ? "text-emerald-400" : "text-red-400"
                                  }`}
                                  title={`Season average ${formatMetricValue(comparable.average, m)} across ${comparable.games} games`}
                                >
                                  {comparable.delta > 0 ? "▲" : "▼"}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-2 text-[11px] text-neutral-500">
                The small arrow compares that figure with the player&apos;s own season average — green means better for
                that metric, red worse. It only appears once they have more than one game recorded.
              </p>

              <button
                onClick={downloadMatch}
                className="mt-3 flex touch-manipulation items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800"
              >
                <Download size={14} /> Download this game
              </button>
            </>
          )}
        </>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-xl bg-navy-600 p-1 dark:bg-navy-800">
              {SEASON_MODES.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMode(m.key)}
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${tabState(mode === m.key, "plain")}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-neutral-400">
              Compiled from {seasonGames} competitive {seasonGames === 1 ? "fixture" : "fixtures"} since{" "}
              {SEASON_START_LABEL}. Friendlies excluded.
            </p>
          </div>

          {seasonRows.length === 0 ? (
            <p className="text-sm text-neutral-400">
              No competitive fixtures with stats yet, so there&apos;s nothing to average.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-xs">
                  <thead className="bg-navy-600/50 dark:bg-navy-800/50">
                    <tr>
                      <th className="sticky left-0 bg-navy-600/50 px-2 py-2 text-left font-medium text-neutral-400 dark:bg-navy-800/50">
                        Player
                      </th>
                      <th className="px-2 py-2 text-right font-medium text-neutral-400">Games</th>
                      {metrics.map((m) => (
                        <th
                          key={m.key}
                          onClick={() => setSortKey((k) => (k === m.key ? "" : m.key))}
                          title={`Sort by ${m.label}`}
                          className="cursor-pointer whitespace-nowrap px-2 py-2 text-right font-medium text-neutral-400 hover:text-white"
                        >
                          <span className="inline-flex items-center gap-1">
                            {m.label}{m.unit ? <span className="text-neutral-600"> {m.unit}</span> : null}
                            {sortKey === m.key && <ArrowUpDown size={10} />}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {seasonRows.map(({ player, agg }) => (
                      <tr key={player.id}>
                        <td className="sticky left-0 whitespace-nowrap bg-navy-700 px-2 py-1.5 dark:bg-navy-900">
                          <Link href={`/players/${player.id}`} className="flex items-center gap-1.5 hover:text-club-primary">
                            <PlayerAvatar playerId={player.id} initials={player.initials} photoUrl={player.photo_url} size="sm" />
                            <span className="truncate">{player.name}</span>
                          </Link>
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-neutral-400">{agg.games}</td>
                        {metrics.map((m) => {
                          const a = agg.byMetric[m.key];
                          return (
                            <td key={m.key} className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                              {a ? (
                                <>
                                  {formatMetricValue(a[mode], m)}
                                  {/* How many games this particular figure rests on. A metric
                                      recorded in two games out of twelve is a much weaker
                                      average than one recorded in all twelve, and without this
                                      the two look identical. */}
                                  {a.games !== agg.games && (
                                    <span className="ml-1 text-[10px] text-neutral-600" title={`From ${a.games} of ${agg.games} games`}>
                                      ({a.games})
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-neutral-600">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-2 text-[11px] text-neutral-500">
                Tap a column to sort by it. A number in brackets means that metric was only recorded in some of the
                player&apos;s games, and the figure covers just those.
              </p>

              <button
                onClick={downloadSeason}
                className="mt-3 flex touch-manipulation items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800"
              >
                <Download size={14} /> Download season {mode}
              </button>
            </>
          )}
        </>
      )}
    </Card>
  );
}
