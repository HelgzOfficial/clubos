"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { StatsImport } from "@/components/analysis/stats-import";
import { InjuryRiskTracker } from "@/components/analysis/injury-risk-tracker";
import { usePermissions } from "@/lib/permissions";
import { useIsMobileOrTablet } from "@/lib/use-media-query";
import { fetchPlayers, type DbPlayer } from "@/lib/players-db";
import { fetchMatches, type DbMatch } from "@/lib/matches-db";
import { competitionKind } from "@/lib/competition-kind";
import {
  fetchStatMetrics, createStatMetric, updateStatMetric, deactivateStatMetric,
  METRIC_CATEGORIES, CATEGORY_LABELS, slugifyMetricKey, formatMetricValue, type StatMetric,
} from "@/lib/stat-metrics-db";
import {
  fetchAllPlayerMatchStats, fetchStatsForMatch, savePlayerMatchStats,
  fetchOpponentPlayerStats, saveOpponentPlayerStats, averageOpponentValues,
  aggregateSeason, rankByMetric, rankOverall, isCompetitive,
  type DbPlayerMatchStats, type DbOpponentPlayerStats, type StatValues, type PlayerSeasonAggregate,
} from "@/lib/player-match-stats-db";
import {
  ArrowLeft, Save, Plus, X, Sliders, Trophy, GitCompare, ClipboardList, ScanLine, ShieldAlert,
  Check, Loader2, AlertCircle, EyeOff, ChevronDown,
} from "lucide-react";

type Tab = "enter" | "import" | "risk" | "metrics" | "rankings" | "compare";

const TABS: { key: Tab; label: string; icon: typeof Save }[] = [
  { key: "enter", label: "Enter Stats", icon: ClipboardList },
  { key: "import", label: "Import", icon: ScanLine },
  { key: "risk", label: "Injury Risk", icon: ShieldAlert },
  { key: "rankings", label: "Rankings", icon: Trophy },
  { key: "compare", label: "Compare", icon: GitCompare },
  { key: "metrics", label: "Metrics", icon: Sliders },
];

function formatFixture(m: DbMatch) {
  const d = new Date(m.kickoff).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
  return `${m.is_home ? "vs" : "@"} ${m.opponent} · ${d}`;
}

export default function PlayerStatsPage() {
  const { canWrite } = usePermissions();
  const canEdit = canWrite("analysis");

  const [tab, setTab] = useState<Tab>("enter");
  const [players, setPlayers] = useState<DbPlayer[]>([]);
  const [matches, setMatches] = useState<DbMatch[]>([]);
  const [metrics, setMetrics] = useState<StatMetric[]>([]);
  const [allStats, setAllStats] = useState<DbPlayerMatchStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [p, m, met, stats] = await Promise.all([
        fetchPlayers(), fetchMatches(), fetchStatMetrics(true), fetchAllPlayerMatchStats(),
      ]);
      setPlayers(p);
      setMatches(m);
      setMetrics(met);
      setAllStats(stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load player stats.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  const activeMetrics = useMemo(() => metrics.filter((m) => m.is_active), [metrics]);
  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  // Every season figure on this page derives from this one aggregation, so a
  // corrected match instantly corrects totals, averages and every ranking.
  const aggregates = useMemo(
    () => aggregateSeason(allStats, matches, { competitiveOnly: true }),
    [allStats, matches]
  );

  function flashSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3500);
  }

  return (
    <AppShell>
      <div className="mb-6">
        <Link href="/analysis" className="mb-1 flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors">
          <ArrowLeft size={12} /> Analyst Dashboard
        </Link>
        <h1 className="text-2xl font-semibold">Player Stats</h1>
        <p className="text-sm text-neutral-500">
          Record GPS and performance metrics per player per fixture. Season totals, averages and rankings update automatically.
        </p>
      </div>

      {error && (
        <Card className="mb-4 border-red-500/30 bg-red-500/10">
          <p className="text-sm text-red-300">{error}</p>
        </Card>
      )}
      {success && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          <Check size={15} /> {success}
        </div>
      )}

      <div className="mb-5 -mx-4 flex touch-pan-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`touch-manipulation flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? "bg-club-primary text-navy-950" : "bg-navy-600 dark:bg-navy-800 text-neutral-400 hover:text-white"
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : tab === "enter" ? (
        <EnterStatsTab
          players={players} matches={matches} metrics={activeMetrics} canEdit={canEdit}
          onSaved={async (msg) => { flashSuccess(msg); setAllStats(await fetchAllPlayerMatchStats()); }}
          onError={setError}
        />
      ) : tab === "import" ? (
        <StatsImport
          players={players} matches={matches} metrics={activeMetrics}
          onSaved={async () => { flashSuccess("Stats imported."); setAllStats(await fetchAllPlayerMatchStats()); }}
        />
      ) : tab === "risk" ? (
        <InjuryRiskTracker players={players} />
      ) : tab === "rankings" ? (
        <RankingsTab metrics={activeMetrics} aggregates={aggregates} playerById={playerById} />
      ) : tab === "compare" ? (
        <CompareTab
          players={players} matches={matches} metrics={activeMetrics} aggregates={aggregates} canEdit={canEdit}
          onSaved={(msg) => flashSuccess(msg)} onError={setError}
        />
      ) : (
        <MetricsTab
          metrics={metrics} canEdit={canEdit}
          onChanged={async (msg) => { flashSuccess(msg); setMetrics(await fetchStatMetrics(true)); }}
          onError={setError}
        />
      )}
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Enter Stats — pick a fixture, fill in the squad grid
// ---------------------------------------------------------------------------
function EnterStatsTab({
  players, matches, metrics, canEdit, onSaved, onError,
}: {
  players: DbPlayer[];
  matches: DbMatch[];
  metrics: StatMetric[];
  canEdit: boolean;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  // Played fixtures only — there's nothing to record for a game not yet played.
  const playedMatches = useMemo(
    () => matches
      .filter((m) => new Date(m.kickoff).getTime() < Date.now() && m.status !== "cancelled")
      .sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime()),
    [matches]
  );

  // A 13-column table is unusable on a phone — horizontal scrolling hides the
  // metric headings, so you lose track of which column you're typing into.
  // Below `lg` the grid becomes one expandable form per player instead.
  const isMobile = useIsMobileOrTablet();
  const [openPlayerId, setOpenPlayerId] = useState<string | null>(null);

  const [matchId, setMatchId] = useState<string>("");
  const [grid, setGrid] = useState<Record<string, Record<string, string>>>({});
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [loadingMatch, setLoadingMatch] = useState(false);

  useEffect(() => {
    if (!matchId && playedMatches[0]) setMatchId(playedMatches[0].id);
  }, [playedMatches, matchId]);

  // Load whatever's already recorded for this fixture so the grid is an edit,
  // not a blank re-entry.
  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;
    setLoadingMatch(true);
    fetchStatsForMatch(matchId)
      .then((rows) => {
        if (cancelled) return;
        const next: Record<string, Record<string, string>> = {};
        const ids = new Set<string>();
        for (const row of rows) {
          ids.add(row.player_id);
          const cells: Record<string, string> = {};
          for (const [k, v] of Object.entries(row.values ?? {})) cells[k] = String(v);
          next[row.player_id] = cells;
        }
        setGrid(next);
        setExistingIds(ids);
      })
      .catch((e) => onError(e instanceof Error ? e.message : "Couldn't load this fixture's stats."))
      .finally(() => { if (!cancelled) setLoadingMatch(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  const selectedMatch = matches.find((m) => m.id === matchId) ?? null;
  const isFriendly = selectedMatch ? !isCompetitive(selectedMatch) : false;

  function setCell(playerId: string, key: string, raw: string) {
    setGrid((prev) => ({ ...prev, [playerId]: { ...(prev[playerId] ?? {}), [key]: raw } }));
  }

  function valuesFor(playerId: string): StatValues {
    const cells = grid[playerId] ?? {};
    const out: StatValues = {};
    for (const [k, raw] of Object.entries(cells)) {
      if (raw === "" || raw === null) continue;
      const n = Number(raw);
      if (Number.isFinite(n)) out[k] = n;
    }
    return out;
  }

  async function saveRow(playerId: string) {
    if (!matchId) return;
    setSavingId(playerId);
    try {
      await savePlayerMatchStats({ matchId, playerId, values: valuesFor(playerId) });
      setExistingIds((prev) => new Set(prev).add(playerId));
      onSaved("Stats saved.");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't save those stats.");
    } finally {
      setSavingId(null);
    }
  }

  async function saveAll() {
    if (!matchId) return;
    setSavingAll(true);
    try {
      const withValues = players.filter((p) => Object.keys(valuesFor(p.id)).length > 0);
      for (const p of withValues) {
        await savePlayerMatchStats({ matchId, playerId: p.id, values: valuesFor(p.id) });
      }
      setExistingIds(new Set(withValues.map((p) => p.id)));
      onSaved(`Saved stats for ${withValues.length} player${withValues.length === 1 ? "" : "s"}.`);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't save those stats.");
    } finally {
      setSavingAll(false);
    }
  }

  if (metrics.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center py-14 text-center">
        <Sliders size={26} className="mb-3 text-neutral-400" />
        <p className="font-medium">No metrics set up yet</p>
        <p className="mt-1 max-w-sm text-sm text-neutral-400">
          Open the Metrics tab to choose which stats you want to record per player.
        </p>
      </Card>
    );
  }

  return (
    <div>
      <Card className="mb-4">
        <label className="mb-1.5 block text-xs font-medium text-neutral-500">Fixture</label>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={matchId}
            onChange={(e) => setMatchId(e.target.value)}
            className="min-w-[16rem] flex-1 rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
          >
            {playedMatches.length === 0 && <option value="">No played fixtures yet</option>}
            {playedMatches.map((m) => (
              <option key={m.id} value={m.id}>{formatFixture(m)}</option>
            ))}
          </select>
          {selectedMatch && (
            <Badge variant={isFriendly ? "neutral" : "blue"}>
              {isFriendly ? "Friendly — excluded from season totals" : competitionKind(selectedMatch.competition)}
            </Badge>
          )}
          {canEdit && (
            <button
              onClick={saveAll}
              disabled={savingAll || !matchId}
              className="flex items-center gap-1.5 rounded-xl bg-club-primary text-navy-950 px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {savingAll ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {savingAll ? "Saving…" : "Save All"}
            </button>
          )}
        </div>
        {isFriendly && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-300">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            Stats for friendlies are still recorded and visible on the fixture, but deliberately left out of season totals,
            averages and rankings — the same rule the app already uses for appearances and goals.
          </p>
        )}
      </Card>

      {loadingMatch ? (
        <p className="text-sm text-neutral-400">Loading fixture…</p>
      ) : isMobile ? (
        <Card className="p-0">
          <ul className="divide-y divide-white/10">
            {players.map((p) => {
              const cells = grid[p.id] ?? {};
              const filled = metrics.filter((m) => (cells[m.key] ?? "") !== "").length;
              const open = openPlayerId === p.id;
              return (
                <li key={p.id}>
                  <button
                    onClick={() => setOpenPlayerId(open ? null : p.id)}
                    className="touch-manipulation flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <PlayerAvatar playerId={p.id} initials={p.initials} photoUrl={p.photo_url} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-[11px] text-neutral-500">
                        #{p.squad_number} · {p.position}
                      </p>
                    </div>
                    {filled > 0 ? (
                      <Badge variant={filled === metrics.length ? "green" : "amber"}>
                        {filled}/{metrics.length}
                      </Badge>
                    ) : existingIds.has(p.id) ? (
                      <Badge variant="neutral">saved</Badge>
                    ) : null}
                    <ChevronDown size={15} className={`shrink-0 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>

                  {open && (
                    <div className="space-y-2 border-t border-white/10 px-4 py-3">
                      {metrics.map((m) => (
                        <div key={m.key} className="flex items-center gap-3">
                          <label className="min-w-0 flex-1 text-sm text-neutral-300">
                            {m.label}
                            {m.unit && <span className="ml-1 text-xs text-neutral-500">({m.unit})</span>}
                          </label>
                          <input
                            type="number"
                            step="any"
                            inputMode="decimal"
                            disabled={!canEdit}
                            value={cells[m.key] ?? ""}
                            onChange={(e) => setCell(p.id, m.key, e.target.value)}
                            className="w-24 shrink-0 rounded-lg border border-white/10 bg-navy-600 px-2 py-2 text-center text-base outline-none focus:ring-2 focus:ring-club-primary/30 disabled:opacity-50 dark:bg-navy-800"
                          />
                        </div>
                      ))}
                      {canEdit && (
                        <button
                          onClick={() => saveRow(p.id)}
                          disabled={savingId === p.id}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-club-primary px-4 py-2.5 text-sm font-medium text-navy-950 hover:opacity-90 disabled:opacity-60"
                        >
                          {savingId === p.id ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                          {savingId === p.id ? "Saving…" : `Save ${p.name.split(" ")[0]}`}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-neutral-500">
                  <th className="sticky left-0 z-10 bg-navy-700 px-4 py-3 font-medium dark:bg-navy-900">Player</th>
                  {metrics.map((m) => (
                    <th key={m.key} className="whitespace-nowrap px-2 py-3 text-center font-medium">
                      {m.label}
                      {m.unit && <span className="ml-1 text-neutral-600">({m.unit})</span>}
                    </th>
                  ))}
                  {canEdit && <th className="px-3 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {players.map((p) => (
                  <tr key={p.id}>
                    <td className="sticky left-0 z-10 bg-navy-700 px-4 py-2 dark:bg-navy-900">
                      <div className="flex items-center gap-2.5">
                        <PlayerAvatar playerId={p.id} initials={p.initials} photoUrl={p.photo_url} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{p.name}</p>
                          <p className="text-[11px] text-neutral-500">
                            #{p.squad_number}
                            {existingIds.has(p.id) && <span className="ml-1.5 text-emerald-400">recorded</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    {metrics.map((m) => (
                      <td key={m.key} className="px-2 py-2">
                        <input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          disabled={!canEdit}
                          value={grid[p.id]?.[m.key] ?? ""}
                          onChange={(e) => setCell(p.id, m.key, e.target.value)}
                          className="w-20 rounded-lg border border-white/10 bg-navy-600 px-2 py-1.5 text-center text-sm outline-none focus:ring-2 focus:ring-club-primary/30 disabled:opacity-50 dark:bg-navy-800"
                        />
                      </td>
                    ))}
                    {canEdit && (
                      <td className="px-3 py-2">
                        <button
                          onClick={() => saveRow(p.id)}
                          disabled={savingId === p.id}
                          title="Save this player's line"
                          className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 hover:text-white disabled:opacity-60 dark:hover:bg-navy-800"
                        >
                          {savingId === p.id ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rankings — per metric, or an overall standing across all of them
// ---------------------------------------------------------------------------
function RankingsTab({
  metrics, aggregates, playerById,
}: {
  metrics: StatMetric[];
  aggregates: Map<string, PlayerSeasonAggregate>;
  playerById: Map<string, DbPlayer>;
}) {
  const [metricKey, setMetricKey] = useState<string>("__overall__");
  const [mode, setMode] = useState<"average" | "total">("average");

  const metric = metrics.find((m) => m.key === metricKey) ?? null;

  const overall = useMemo(
    () => rankOverall(aggregates, metrics.map((m) => ({ key: m.key, higher_is_better: m.higher_is_better })), mode),
    [aggregates, metrics, mode]
  );

  const perMetric = useMemo(
    () => (metric ? rankByMetric(aggregates, metric.key, mode, metric.higher_is_better) : []),
    [aggregates, metric, mode]
  );

  const isOverall = metricKey === "__overall__";
  const rows = isOverall ? overall : perMetric;

  return (
    <div>
      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <label className="mb-1.5 block text-xs font-medium text-neutral-500">Rank by</label>
            <select
              value={metricKey}
              onChange={(e) => setMetricKey(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-navy-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
            >
              <option value="__overall__">Overall (all metrics combined)</option>
              {metrics.map((m) => (
                <option key={m.key} value={m.key}>{m.label}{m.unit ? ` (${m.unit})` : ""}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-1 rounded-xl bg-navy-600 p-1 dark:bg-navy-800">
            {(["average", "total"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setMode(v)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === v ? "bg-club-primary text-navy-950" : "text-neutral-400 hover:text-white"
                }`}
              >
                {v === "average" ? "Per game" : "Season total"}
              </button>
            ))}
          </div>
        </div>
        {isOverall && (
          <p className="mt-2.5 text-xs text-neutral-500">
            Each player is scored 0–100 on every metric relative to the squad&apos;s best and worst, then those scores are
            averaged. Scaling per metric rather than adding raw numbers keeps distance in km from being drowned out by
            pass counts. Metrics where lower is better are inverted.
          </p>
        )}
      </Card>

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-14 text-center">
          <Trophy size={26} className="mb-3 text-neutral-400" />
          <p className="font-medium">No stats recorded yet</p>
          <p className="mt-1 max-w-sm text-sm text-neutral-400">
            Enter stats against a competitive fixture and rankings will build automatically.
          </p>
        </Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-white/10">
            {rows.map((row, i) => {
              const p = playerById.get(row.playerId);
              if (!p) return null;
              const rank = isOverall ? i + 1 : (row as { rank: number }).rank;
              const value = isOverall ? (row as { score: number }).score : (row as { value: number }).value;
              const display = isOverall
                ? `${value.toFixed(1)}`
                : metric ? formatMetricValue(value, metric) : value.toFixed(1);
              return (
                <li key={row.playerId}>
                  <Link href={`/players/${p.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-navy-600/50 dark:hover:bg-navy-800/50">
                    <span className={`w-7 shrink-0 text-center text-sm font-bold tabular-nums ${rank === 1 ? "text-club-primary" : "text-neutral-500"}`}>
                      {rank}
                    </span>
                    <PlayerAvatar playerId={p.id} initials={p.initials} photoUrl={p.photo_url} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-[11px] text-neutral-500">
                        #{p.squad_number} · {p.position} · {row.games} game{row.games === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-base font-semibold tabular-nums">{display}</p>
                      <p className="text-[10px] text-neutral-500">
                        {isOverall ? "score / 100" : metric?.unit || (mode === "average" ? "per game" : "total")}
                      </p>
                    </div>
                  </Link>
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
// Compare — our players against each other, or against an opponent's players
// ---------------------------------------------------------------------------
function CompareTab({
  players, matches, metrics, aggregates, canEdit, onSaved, onError,
}: {
  players: DbPlayer[];
  matches: DbMatch[];
  metrics: StatMetric[];
  aggregates: Map<string, PlayerSeasonAggregate>;
  canEdit: boolean;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [leftId, setLeftId] = useState<string>("");
  const [rightMode, setRightMode] = useState<"squad" | "opponent">("squad");
  const [rightId, setRightId] = useState<string>("");
  const [opponentRows, setOpponentRows] = useState<DbOpponentPlayerStats[]>([]);
  const [selectedOpponentPlayer, setSelectedOpponentPlayer] = useState<string>("");
  const [showAddOpponent, setShowAddOpponent] = useState(false);

  useEffect(() => {
    fetchOpponentPlayerStats()
      .then(setOpponentRows)
      .catch((e) => onError(e instanceof Error ? e.message : "Couldn't load opponent stats."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const withStats = players.filter((p) => aggregates.has(p.id));
    if (!leftId && withStats[0]) setLeftId(withStats[0].id);
    if (!rightId && withStats[1]) setRightId(withStats[1].id);
  }, [players, aggregates, leftId, rightId]);

  async function reloadOpponents() {
    setOpponentRows(await fetchOpponentPlayerStats());
  }

  // Group opponent rows by "Opponent — Player" so a player with several
  // recorded games shows once, averaged.
  const opponentPlayers = useMemo(() => {
    const map = new Map<string, { label: string; rows: DbOpponentPlayerStats[] }>();
    for (const row of opponentRows) {
      const id = `${row.opponent_name}|${row.player_name}`;
      const entry = map.get(id) ?? { label: `${row.player_name} (${row.opponent_name})`, rows: [] };
      entry.rows.push(row);
      map.set(id, entry);
    }
    return [...map.entries()].map(([id, v]) => ({ id, ...v }));
  }, [opponentRows]);

  const left = players.find((p) => p.id === leftId) ?? null;
  const leftAgg = leftId ? aggregates.get(leftId) : undefined;

  const right = rightMode === "squad" ? players.find((p) => p.id === rightId) ?? null : null;
  const rightAgg = rightMode === "squad" && rightId ? aggregates.get(rightId) : undefined;
  const rightOpponent = rightMode === "opponent"
    ? opponentPlayers.find((o) => o.id === selectedOpponentPlayer) ?? null
    : null;
  const rightOpponentValues = rightOpponent ? averageOpponentValues(rightOpponent.rows) : null;

  const rightLabel = rightMode === "squad" ? right?.name ?? "—" : rightOpponent?.label ?? "—";

  function leftValue(key: string): number | null {
    const m = leftAgg?.byMetric[key];
    return m ? m.average : null;
  }
  function rightValue(key: string): number | null {
    if (rightMode === "squad") {
      const m = rightAgg?.byMetric[key];
      return m ? m.average : null;
    }
    const v = rightOpponentValues?.[key];
    return v === undefined ? null : v;
  }

  return (
    <div>
      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-500">Player</label>
            <select
              value={leftId}
              onChange={(e) => setLeftId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-navy-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
            >
              <option value="">Select…</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>{p.name}{aggregates.has(p.id) ? "" : " (no stats yet)"}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-neutral-500">Compare against</label>
              <div className="flex gap-1 rounded-lg bg-navy-600 p-0.5 dark:bg-navy-800">
                {(["squad", "opponent"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setRightMode(v)}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                      rightMode === v ? "bg-club-primary text-navy-950" : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    {v === "squad" ? "Teammate" : "Opponent"}
                  </button>
                ))}
              </div>
            </div>
            {rightMode === "squad" ? (
              <select
                value={rightId}
                onChange={(e) => setRightId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-navy-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
              >
                <option value="">Select…</option>
                {players.filter((p) => p.id !== leftId).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}{aggregates.has(p.id) ? "" : " (no stats yet)"}</option>
                ))}
              </select>
            ) : (
              <div className="flex gap-2">
                <select
                  value={selectedOpponentPlayer}
                  onChange={(e) => setSelectedOpponentPlayer(e.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-navy-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
                >
                  <option value="">{opponentPlayers.length === 0 ? "No opponent data yet" : "Select…"}</option>
                  {opponentPlayers.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
                {canEdit && (
                  <button
                    onClick={() => setShowAddOpponent(true)}
                    title="Add opponent player stats"
                    className="flex shrink-0 items-center gap-1 rounded-xl border border-white/10 px-3 text-sm text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {!left || (rightMode === "squad" ? !right : !rightOpponent) ? (
        <Card className="flex flex-col items-center justify-center py-14 text-center">
          <GitCompare size={26} className="mb-3 text-neutral-400" />
          <p className="font-medium">Pick two to compare</p>
          <p className="mt-1 max-w-sm text-sm text-neutral-400">
            {rightMode === "opponent" && opponentPlayers.length === 0
              ? "No opponent player data has been entered yet — add some with the + button above."
              : "Choose a player and either a teammate or an opponent."}
          </p>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Per-game averages</CardTitle>
            <span className="text-xs text-neutral-500">competitive fixtures only</span>
          </CardHeader>
          <div className="mb-3 flex items-center justify-between gap-3 text-xs font-medium">
            <span className="truncate text-club-primary">{left.name}</span>
            <span className="truncate text-right text-blue-400">{rightLabel}</span>
          </div>
          <div className="space-y-3">
            {metrics.map((m) => {
              const lv = leftValue(m.key);
              const rv = rightValue(m.key);
              if (lv === null && rv === null) return null;
              const max = Math.max(lv ?? 0, rv ?? 0) || 1;
              const lPct = ((lv ?? 0) / max) * 100;
              const rPct = ((rv ?? 0) / max) * 100;
              // Who's "ahead" respects metrics where a lower number is better.
              const leftAhead = lv !== null && rv !== null && (m.higher_is_better ? lv > rv : lv < rv);
              const rightAhead = lv !== null && rv !== null && (m.higher_is_better ? rv > lv : rv < lv);
              return (
                <div key={m.key}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                    <span className={`tabular-nums ${leftAhead ? "font-bold text-club-primary" : "text-neutral-400"}`}>
                      {lv === null ? "–" : formatMetricValue(lv, m)}
                    </span>
                    <span className="truncate text-neutral-500">{m.label}{m.unit ? ` (${m.unit})` : ""}</span>
                    <span className={`tabular-nums ${rightAhead ? "font-bold text-blue-400" : "text-neutral-400"}`}>
                      {rv === null ? "–" : formatMetricValue(rv, m)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="flex h-2 flex-1 justify-end overflow-hidden rounded-full bg-navy-600 dark:bg-navy-800">
                      <div className="h-full rounded-full bg-club-primary" style={{ width: `${lPct}%` }} />
                    </div>
                    <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-navy-600 dark:bg-navy-800">
                      <div className="h-full rounded-full bg-blue-400" style={{ width: `${rPct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {!m0HasAny(metrics, leftValue, rightValue) && (
            <p className="mt-3 text-sm text-neutral-400">No overlapping metrics recorded for these two yet.</p>
          )}
        </Card>
      )}

      {showAddOpponent && (
        <OpponentStatsModal
          metrics={metrics}
          matches={matches}
          existing={opponentRows}
          onClose={() => setShowAddOpponent(false)}
          onSaved={async (msg) => { onSaved(msg); await reloadOpponents(); }}
          onError={onError}
        />
      )}
    </div>
  );
}

// Small helper so the "nothing overlaps" message doesn't need a second pass
// through the metric list inline.
function m0HasAny(
  metrics: StatMetric[],
  leftValue: (k: string) => number | null,
  rightValue: (k: string) => number | null
): boolean {
  return metrics.some((m) => leftValue(m.key) !== null || rightValue(m.key) !== null);
}

// ---------------------------------------------------------------------------
// Opponent player stat entry
// ---------------------------------------------------------------------------
function OpponentStatsModal({
  metrics, matches, existing, onClose, onSaved, onError,
}: {
  metrics: StatMetric[];
  matches: DbMatch[];
  existing: DbOpponentPlayerStats[];
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const knownOpponents = useMemo(
    () => [...new Set([...matches.map((m) => m.opponent), ...existing.map((e) => e.opponent_name)])].sort(),
    [matches, existing]
  );
  const [opponentName, setOpponentName] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [position, setPosition] = useState("");
  const [cells, setCells] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!opponentName.trim() || !playerName.trim()) return;
    const values: StatValues = {};
    for (const [k, raw] of Object.entries(cells)) {
      if (raw === "") continue;
      const n = Number(raw);
      if (Number.isFinite(n)) values[k] = n;
    }
    setSaving(true);
    try {
      await saveOpponentPlayerStats({ opponentName, playerName, position, values });
      onSaved(`Added ${playerName.trim()} (${opponentName.trim()}).`);
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't save those stats.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <Card className="max-h-[90dvh] w-full max-w-md overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-medium">Add Opponent Player</p>
          <button onClick={onClose} className="text-neutral-400 hover:text-white"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-500">Opponent</label>
            <input
              list="known-opponents"
              value={opponentName}
              onChange={(e) => setOpponentName(e.target.value)}
              placeholder="e.g. Chipstead"
              className="w-full rounded-xl border border-white/10 bg-navy-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
            />
            <datalist id="known-opponents">
              {knownOpponents.map((o) => <option key={o} value={o} />)}
            </datalist>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-neutral-500">Player name</label>
              <input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-navy-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-neutral-500">Position</label>
              <input
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="optional"
                className="w-full rounded-xl border border-white/10 bg-navy-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
              />
            </div>
          </div>
          <div className="space-y-2 border-t border-white/10 pt-3">
            {metrics.map((m) => (
              <div key={m.key} className="flex items-center gap-3">
                <label className="min-w-0 flex-1 truncate text-xs text-neutral-400">
                  {m.label}{m.unit ? ` (${m.unit})` : ""}
                </label>
                <input
                  type="number"
                  step="any"
                  value={cells[m.key] ?? ""}
                  onChange={(e) => setCells((prev) => ({ ...prev, [m.key]: e.target.value }))}
                  className="w-24 shrink-0 rounded-lg border border-white/10 bg-navy-600 px-2 py-1.5 text-center text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
                />
              </div>
            ))}
          </div>
          <button
            type="submit"
            disabled={saving || !opponentName.trim() || !playerName.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-club-primary text-navy-950 px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            <Save size={15} /> {saving ? "Saving…" : "Save"}
          </button>
        </form>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metrics — the analyst decides what gets recorded
// ---------------------------------------------------------------------------
function MetricsTab({
  metrics, canEdit, onChanged, onError,
}: {
  metrics: StatMetric[];
  canEdit: boolean;
  onChanged: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState("");
  const [unit, setUnit] = useState("");
  const [category, setCategory] = useState<string>("gps");
  const [higherIsBetter, setHigherIsBetter] = useState(true);
  const [decimals, setDecimals] = useState("1");
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const key = slugifyMetricKey(label);
    if (!key) { onError("Give the metric a name."); return; }
    if (metrics.some((m) => m.key === key)) {
      onError(`A metric with the key "${key}" already exists.`);
      return;
    }
    setSaving(true);
    try {
      await createStatMetric({
        key, label: label.trim(), unit, category, higherIsBetter,
        decimals: Number(decimals) || 0,
        sortOrder: (metrics[metrics.length - 1]?.sort_order ?? 0) + 10,
      });
      setShowAdd(false);
      setLabel(""); setUnit(""); setCategory("gps"); setHigherIsBetter(true); setDecimals("1");
      onChanged("Metric added.");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't add that metric.");
    } finally {
      setSaving(false);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, StatMetric[]>();
    for (const m of metrics) {
      const list = map.get(m.category) ?? [];
      list.push(m);
      map.set(m.category, list);
    }
    return [...map.entries()];
  }, [metrics]);

  return (
    <div>
      <Card className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-400">
          These are the stats that appear on the entry grid. Turning one off hides it from new entries but keeps the
          numbers already recorded against it.
        </p>
        {canEdit && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-club-primary text-navy-950 px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={15} /> Add Metric
          </button>
        )}
      </Card>

      <div className="space-y-4">
        {grouped.map(([cat, list]) => (
          <Card key={cat} className="p-0">
            <p className="border-b border-white/10 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {CATEGORY_LABELS[cat] ?? cat}
            </p>
            <ul className="divide-y divide-white/10">
              {list.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-[10rem] flex-1">
                    <p className={`text-sm font-medium ${m.is_active ? "" : "text-neutral-500 line-through"}`}>
                      {m.label}{m.unit ? ` (${m.unit})` : ""}
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      {m.key} · {m.higher_is_better ? "higher is better" : "lower is better"} · {m.decimals} dp
                    </p>
                  </div>
                  {!m.is_active && <Badge variant="neutral">Off</Badge>}
                  {canEdit && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={async () => {
                          try {
                            await updateStatMetric(m.id, { higherIsBetter: !m.higher_is_better });
                            onChanged("Metric updated.");
                          } catch (e) { onError(e instanceof Error ? e.message : "Couldn't update that metric."); }
                        }}
                        title="Flip whether higher or lower is better"
                        className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800"
                      >
                        Flip direction
                      </button>
                      {m.is_active ? (
                        <button
                          onClick={async () => {
                            try { await deactivateStatMetric(m.id); onChanged("Metric turned off."); }
                            catch (e) { onError(e instanceof Error ? e.message : "Couldn't turn that off."); }
                          }}
                          title="Turn off (keeps existing data)"
                          className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 hover:text-white dark:hover:bg-navy-800"
                        >
                          <EyeOff size={13} />
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            try { await updateStatMetric(m.id, { isActive: true }); onChanged("Metric turned back on."); }
                            catch (e) { onError(e instanceof Error ? e.message : "Couldn't turn that on."); }
                          }}
                          className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800"
                        >
                          Turn on
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="max-h-[90dvh] w-full max-w-sm overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-medium">Add Metric</p>
              <button onClick={() => setShowAdd(false)} className="text-neutral-400 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Name</label>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Progressive Carries"
                  className="w-full rounded-xl border border-white/10 bg-navy-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
                />
                {label.trim() && (
                  <p className="mt-1 text-[11px] text-neutral-500">Stored as <code>{slugifyMetricKey(label)}</code></p>
                )}
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-neutral-500">Unit</label>
                  <input
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="km, %, …"
                    className="w-full rounded-xl border border-white/10 bg-navy-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-neutral-500">Decimal places</label>
                  <select
                    value={decimals}
                    onChange={(e) => setDecimals(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-navy-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
                  >
                    {["0", "1", "2"].map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Group</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-navy-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
                >
                  {METRIC_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-neutral-300">
                <input
                  type="checkbox"
                  checked={higherIsBetter}
                  onChange={(e) => setHigherIsBetter(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-navy-600 dark:bg-navy-800"
                />
                A higher number is better
              </label>
              <p className="rounded-xl border border-white/10 bg-navy-600/50 p-2.5 text-[11px] text-neutral-400 dark:bg-navy-800/50">
                Untick for something you want to keep low, like turnovers conceded — rankings then order it the other way.
              </p>
              <button
                type="submit"
                disabled={saving || !label.trim()}
                className="w-full rounded-xl bg-club-primary text-navy-950 px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {saving ? "Adding…" : "Add Metric"}
              </button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
