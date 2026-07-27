"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchMatches, type DbMatch } from "@/lib/matches-db";
import { fetchAllGoals } from "@/lib/match-details-db";
import { PitchMapDisplay, type PitchPoint } from "@/components/analysis/pitch-map";
import { topScorers, topAssists } from "@/lib/season-analytics";
import { ArrowLeft } from "lucide-react";

type MapTab = "scored" | "conceded" | "assists";

export default function GoalsMapsPage() {
  const [matches, setMatches] = useState<DbMatch[]>([]);
  const [goals, setGoals] = useState<Awaited<ReturnType<typeof fetchAllGoals>>>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<MapTab>("scored");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [m, g] = await Promise.all([fetchMatches(), fetchAllGoals()]);
        setMatches(m);
        setGoals(g);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function matchLabel(matchId: string) {
    const m = matches.find((mm) => mm.id === matchId);
    return m ? `${m.is_home ? "vs" : "@"} ${m.opponent}` : "Unknown fixture";
  }

  const withLocation = goals.filter((g) => g.x !== null && g.y !== null);
  const scoredGoals = withLocation.filter((g) => g.team === "us");
  const concededGoals = withLocation.filter((g) => g.team === "opponent");
  const assistedGoals = withLocation.filter((g) => g.team === "us" && g.assist);

  const points: PitchPoint[] = useMemo(() => {
    const source = tab === "scored" ? scoredGoals : tab === "conceded" ? concededGoals : assistedGoals;
    return source.map((g) => ({
      x: g.x as number,
      y: g.y as number,
      color: tab === "conceded" ? "#EF4444" : "#22C55E",
      label: tab === "assists"
        ? `${g.assist} → ${g.scorer} (${g.minute ?? "?"}') — ${matchLabel(g.match_id)}`
        : `${g.scorer} (${g.minute ?? "?"}') — ${matchLabel(g.match_id)}`,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, goals, matches]);

  const scorers = useMemo(() => topScorers(goals, 8), [goals]);
  const assists = useMemo(() => topAssists(goals, 8), [goals]);

  const missingLocationCount = goals.length - withLocation.length;

  const tabs: { key: MapTab; label: string; count: number }[] = [
    { key: "scored", label: "Goals Scored", count: scoredGoals.length },
    { key: "conceded", label: "Goals Conceded", count: concededGoals.length },
    { key: "assists", label: "Assist Map", count: assistedGoals.length },
  ];

  return (
    <AppShell>
      <div className="mb-6">
        <Link href="/analysis" className="mb-1 flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors">
          <ArrowLeft size={12} /> Analyst Dashboard
        </Link>
        <h1 className="text-2xl font-semibold">Goals &amp; Assist Maps</h1>
        <p className="text-sm text-neutral-500">Where it's happening on the pitch, from locations logged in Match Centre.</p>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : goals.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-400">
            No goals logged yet. Add them from a match's page in Match Centre — tap "Mark location" on the pitch diagram when logging a
            goal to have it show up here.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-4 flex flex-wrap gap-2">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    tab === t.key ? "bg-club-primary text-navy-950" : "bg-navy-600 dark:bg-navy-800 text-neutral-500 hover:text-white"
                  }`}
                >
                  {t.label} ({t.count})
                </button>
              ))}
            </div>
            <Card>
              {points.length === 0 ? (
                <p className="py-10 text-center text-sm text-neutral-400">No locations logged for this yet.</p>
              ) : (
                <div className="mx-auto max-w-xs">
                  <PitchMapDisplay points={points} />
                </div>
              )}
              {missingLocationCount > 0 && (
                <p className="mt-3 text-xs text-neutral-500">
                  {missingLocationCount} goal{missingLocationCount === 1 ? "" : "s"} logged without a location and {missingLocationCount === 1 ? "isn't" : "aren't"} shown on this map.
                </p>
              )}
            </Card>
          </div>

          <div className="space-y-5">
            <Card>
              <CardHeader><CardTitle>Top Goalscorers</CardTitle></CardHeader>
              {scorers.length === 0 ? (
                <p className="text-sm text-neutral-400">None yet.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {scorers.map((s) => (
                    <li key={s.name} className="flex items-center justify-between">
                      <span className="truncate">{s.name}</span>
                      <span className="font-semibold text-club-primary">{s.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <CardHeader><CardTitle>Top Assists</CardTitle></CardHeader>
              {assists.length === 0 ? (
                <p className="text-sm text-neutral-400">None yet.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {assists.map((s) => (
                    <li key={s.name} className="flex items-center justify-between">
                      <span className="truncate">{s.name}</span>
                      <span className="font-semibold text-club-primary">{s.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}
