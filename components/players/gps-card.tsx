"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fetchGpsForPlayer, GPS_METRICS, formatMetric,
  type DbGpsImport, type DbGpsMetric,
} from "@/lib/gps-db";
import { fetchHiddenMetrics, visibleMetrics, NO_HIDDEN, type HiddenMetrics } from "@/lib/hidden-metrics-db";
import { Activity } from "lucide-react";

type Entry = { metric: DbGpsMetric; session: DbGpsImport };

// One player's physical output, session by session, plus their season best for
// each metric. The best is worth showing because a single number in isolation
// means nothing to most people — 9,400 metres only reads as good or bad next
// to what that player normally does.
export function PlayerGpsCard({ playerId }: { playerId: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [hidden, setHidden] = useState<HiddenMetrics>(NO_HIDDEN);

  useEffect(() => { fetchHiddenMetrics().then(setHidden).catch(() => {}); }, []);

  useEffect(() => {
    fetchGpsForPlayer(playerId)
      .then(setEntries)
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "";
        if (/relation|does not exist|schema cache/i.test(msg)) setMissing(true);
      })
      .finally(() => setLoading(false));
  }, [playerId]);

  if (loading) return null;
  // Nothing imported for this player, or the tables aren't set up — either way
  // an empty card is just noise on a profile.
  if (missing || entries.length === 0) return null;

  // Columns the club has switched off don't appear here either — a table that
  // still showed them would make the setting look broken.
  const columns = visibleMetrics(GPS_METRICS, hidden, "gps");

  const bests = columns.map((m) => {
    const values = entries
      .map((e) => e.metric[m.key])
      .filter((v): v is number => typeof v === "number");
    return { meta: m, best: values.length ? Math.max(...values) : null };
  }).filter((b) => b.best !== null);

  return (
    <Card tone="club">
      <CardHeader>
        <CardTitle>GPS</CardTitle>
        <Activity size={18} className="text-neutral-400" />
      </CardHeader>

      <p className="mb-2 text-xs text-neutral-500">
        Season best across {entries.length} {entries.length === 1 ? "session" : "sessions"}.
      </p>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {bests.map(({ meta, best }) => (
          // Deliberately a different shade from the session grid below, so the
          // season bests read as their own thing rather than as a header row
          // for the table.
          <div key={meta.key} className="on-dark rounded-xl border border-white/10 bg-navy-800 p-2.5">
            <p className="text-[10px] uppercase tracking-wide text-neutral-500">{meta.label}</p>
            <p className="text-sm font-semibold tabular-nums">{formatMetric(best, meta.key)}</p>
          </div>
        ))}
      </div>

      <div className="on-dark overflow-x-auto rounded-xl border border-white/10 bg-navy-950">
        <table className="w-full text-xs">
          <thead className="bg-navy-800/70">
            <tr>
              <th className="px-2 py-2 text-left font-medium text-neutral-400">Session</th>
              {columns.map((m) => (
                <th key={m.key} className="px-2 py-2 text-right font-medium text-neutral-400" title={m.label}>
                  {m.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {entries.map(({ metric, session }) => (
              <tr key={metric.id}>
                <td className="whitespace-nowrap px-2 py-1.5">
                  <span className="block">{session.label || "Session"}</span>
                  <span className="block text-[10px] text-neutral-500">
                    {new Date(session.session_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </td>
                {columns.map((m) => (
                  <td key={m.key} className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                    {formatMetric(metric[m.key], m.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
