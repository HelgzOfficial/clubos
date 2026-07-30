"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchStatMetrics, formatMetricValue, CATEGORY_LABELS, type StatMetric } from "@/lib/stat-metrics-db";
import { fetchStatsForPlayer, aggregateSeason, type DbPlayerMatchStats } from "@/lib/player-match-stats-db";
import { fetchMatches, type DbMatch } from "@/lib/matches-db";
import { Activity } from "lucide-react";

// A player's own performance metrics, computed live from the per-match rows the
// analyst enters rather than from a stored summary. That means the moment a
// fixture's numbers are saved (or corrected) in Analysis, this profile reflects
// it — there's no copy to fall out of step.
export function PlayerMetricsCard({ playerId }: { playerId: string }) {
  const [metrics, setMetrics] = useState<StatMetric[]>([]);
  const [rows, setRows] = useState<DbPlayerMatchStats[]>([]);
  const [matches, setMatches] = useState<DbMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"average" | "total">("average");

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchStatMetrics(), fetchStatsForPlayer(playerId), fetchMatches()])
      .then(([m, r, mt]) => {
        if (cancelled) return;
        setMetrics(m);
        setRows(r);
        setMatches(mt);
      })
      .catch(() => { /* card just shows its empty state */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [playerId]);

  const agg = useMemo(() => {
    const map = aggregateSeason(rows, matches, { competitiveOnly: true });
    return map.get(playerId) ?? null;
  }, [rows, matches, playerId]);

  // Only show metrics this player actually has numbers for, grouped the same
  // way the entry form groups them.
  const grouped = useMemo(() => {
    if (!agg) return [];
    const map = new Map<string, StatMetric[]>();
    for (const m of metrics) {
      if (!agg.byMetric[m.key]) continue;
      const list = map.get(m.category) ?? [];
      list.push(m);
      map.set(m.category, list);
    }
    return [...map.entries()];
  }, [metrics, agg]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Metrics</CardTitle>
        {agg && (
          <div className="flex gap-1 rounded-lg bg-navy-600 p-0.5 dark:bg-navy-800">
            {(["average", "total"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setMode(v)}
                className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  mode === v ? "bg-club-primary text-navy-950" : "text-neutral-400 hover:text-white"
                }`}
              >
                {v === "average" ? "Per game" : "Total"}
              </button>
            ))}
          </div>
        )}
      </CardHeader>

      {loading ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : !agg || grouped.length === 0 ? (
        <div className="flex flex-col items-center py-6 text-center">
          <Activity size={22} className="mb-2 text-neutral-500" />
          <p className="text-sm text-neutral-400">No metrics recorded yet.</p>
          <Link href="/analysis/stats" className="mt-2 text-xs text-club-primary hover:underline">
            Enter stats in Analysis →
          </Link>
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-neutral-500">
            From {agg.games} competitive fixture{agg.games === 1 ? "" : "s"} · friendlies excluded
          </p>
          <div className="space-y-4">
            {grouped.map(([category, list]) => (
              <div key={category}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  {CATEGORY_LABELS[category] ?? category}
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {list.map((m) => {
                    const stat = agg.byMetric[m.key];
                    const value = mode === "average" ? stat.average : stat.total;
                    return (
                      <div key={m.key} className="rounded-xl border border-white/10 p-2.5">
                        <p className="text-lg font-semibold tabular-nums leading-tight">
                          {formatMetricValue(value, m)}
                          {m.unit && <span className="ml-1 text-xs font-normal text-neutral-400">{m.unit}</span>}
                        </p>
                        <p className="truncate text-[11px] text-neutral-500">{m.label}</p>
                        {mode === "average" && stat.games > 1 && (
                          <p className="text-[10px] text-neutral-600">
                            best {formatMetricValue(m.higher_is_better ? stat.best : stat.worst, m)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <Link href="/analysis/stats" className="mt-3 inline-block text-xs text-club-primary hover:underline">
            See squad rankings and comparisons →
          </Link>
        </>
      )}
    </Card>
  );
}
