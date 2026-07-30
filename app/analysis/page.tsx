"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { fetchPlayers, type DbPlayer } from "@/lib/players-db";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VideoPlayer } from "@/components/analysis/video-player";
import { youTubeWatchUrl } from "@/lib/youtube";
import { fetchMatches, type DbMatch } from "@/lib/matches-db";
import { fetchLeagueTable, type DbLeagueRow } from "@/lib/league-table-db";
import { fetchAllMatchStats, type DbMatchStats } from "@/lib/match-stats-db";
import { fetchAllGoals } from "@/lib/match-details-db";
import { fetchAllClips, getClipUrl, CLIP_CATEGORIES, type DbClip, type ClipCategory } from "@/lib/clips-db";
import { fetchRecentMatchReports, type DbMatchReport } from "@/lib/match-reports-db";
import { fetchMatchPacks, type DbMatchPack } from "@/lib/match-packs-db";
import {
  computeSeasonKpis, aggregateSeasonStats, goalsTimeline, topScorers, topAssists,
} from "@/lib/season-analytics";
import type { Clip } from "@/lib/analysis-types";
import {
  Film, MapPin, Package, FileText, PlayCircle, TrendingUp, Trophy, ShieldCheck, Target, Activity,
} from "lucide-react";

const CATEGORY_ICONS: Record<ClipCategory, string> = {
  "Build Up Play": "⚙️", Pressing: "🔥", Transition: "🔁", "Set Pieces": "🎯",
};

export default function AnalysisDashboardPage() {
  const [matches, setMatches] = useState<DbMatch[]>([]);
  const [league, setLeague] = useState<DbLeagueRow[]>([]);
  const [allStats, setAllStats] = useState<DbMatchStats[]>([]);
  const [goals, setGoals] = useState<Awaited<ReturnType<typeof fetchAllGoals>>>([]);
  const [clips, setClips] = useState<DbClip[]>([]);
  const [reports, setReports] = useState<DbMatchReport[]>([]);
  const [packs, setPacks] = useState<DbMatchPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<DbPlayer[]>([]);
  const [playing, setPlaying] = useState<Clip | null>(null);

  async function loadAll() {
    setLoading(true);
    try {
      const [m, lt, stats, g, c, r, p] = await Promise.all([
        fetchMatches(), fetchLeagueTable(), fetchAllMatchStats(), fetchAllGoals(),
        fetchAllClips(), fetchRecentMatchReports(5), fetchMatchPacks(),
      ]);
      setMatches(m);
      setLeague(lt);
      setAllStats(stats);
      setGoals(g);
      setClips(c);
      setReports(r);
      setPacks(p.slice(0, 5));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Scorer/assist names come from goal records as free text, so they're
    // matched back to squad records here purely to show a face next to a name.
    fetchPlayers().then(setPlayers).catch(() => {});
  }, []);

  useEffect(() => {
    loadAll();
  }, []);

  const ownRow = league.find((r) => r.is_own_club) ?? null;
  const kpis = useMemo(() => computeSeasonKpis(matches, ownRow), [matches, ownRow]);
  const statCategories = useMemo(() => aggregateSeasonStats(allStats).slice(0, 3), [allStats]);
  const timeline = useMemo(() => goalsTimeline(goals), [goals]);
  const maxTimelineValue = Math.max(1, ...timeline.flatMap((b) => [b.scored, b.conceded]));
  const scorers = useMemo(() => topScorers(goals, 3), [goals]);
  const assists = useMemo(() => topAssists(goals, 3), [goals]);

  const featuredClips = useMemo(() => {
    return CLIP_CATEGORIES.map((cat) => ({
      category: cat,
      clip: clips.find((c) => c.category === cat) ?? null,
    }));
  }, [clips]);

  async function playClip(c: DbClip) {
    if (c.source === "youtube" && c.youtube_id) {
      window.open(youTubeWatchUrl(c.youtube_id), "_blank");
      return;
    }
    const url = await getClipUrl(c.file_path);
    setPlaying({ id: c.id, title: c.title, url, tags: c.category ? [c.category] : [], addedAt: c.uploaded_at });
  }

  function matchLabel(matchId: string | null) {
    const m = matches.find((mm) => mm.id === matchId);
    return m ? `${m.is_home ? "vs" : "@"} ${m.opponent}` : "Unlinked";
  }

  const kpiTiles: { label: string; value: number | string }[] = [
    { label: "Matches Played", value: kpis.played },
    { label: "Wins", value: kpis.wins },
    { label: "Draws", value: kpis.draws },
    { label: "Losses", value: kpis.losses },
    { label: "Goals Scored", value: kpis.goalsFor },
    { label: "Goals Conceded", value: kpis.goalsAgainst },
    { label: "Clean Sheets", value: kpis.cleanSheets },
    { label: "Points", value: kpis.points },
    { label: "League Points", value: kpis.leaguePoints ?? "—" },
  ];

  const playerByName = useMemo(() => {
    const map = new Map<string, DbPlayer>();
    const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
    const lastName = (v: string) => norm(v).split(" ").slice(-1)[0] ?? "";
    for (const p of players) map.set(norm(p.name), p);
    // Match sheets often abbreviate ("A. Goode"), so fall back to a last name
    // when exactly one player has it — ambiguous ones are simply left without
    // a photo rather than risking the wrong face.
    const byLast = new Map<string, DbPlayer[]>();
    for (const p of players) {
      const key = lastName(p.name);
      byLast.set(key, [...(byLast.get(key) ?? []), p]);
    }
    for (const [key, list] of byLast) if (list.length === 1 && !map.has(key)) map.set(key, list[0]);
    return map;
  }, [players]);

  function lookupPlayer(name: string): DbPlayer | undefined {
    const norm = name.trim().toLowerCase().replace(/\s+/g, " ");
    return playerByName.get(norm) ?? playerByName.get(norm.split(" ").slice(-1)[0] ?? "");
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Analyst Dashboard</h1>
          <p className="text-sm text-neutral-500">Season performance, match reports, and video at a glance.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/analysis/library" className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors">
            <Film size={14} /> Clip Library
          </Link>
          <Link href="/analysis/maps" className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors">
            <MapPin size={14} /> Goals & Assist Maps
          </Link>
          <Link href="/analysis/stats" className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors">
            <Activity size={14} /> Player Stats &amp; Rankings
          </Link>
          <Link href="/analysis/match-packs" className="flex items-center gap-1.5 rounded-xl bg-club-primary text-navy-950 px-3 py-2 text-sm font-medium hover:opacity-90 transition-opacity">
            <Package size={14} /> Match Packs
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : (
        <div className="space-y-5">
          {/* KPI header bar */}
          <Card>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-9">
              {kpiTiles.map((k) => (
                <div key={k.label} className="text-center">
                  <p className="text-2xl font-bold tabular-nums">{k.value}</p>
                  <p className="mt-0.5 text-[11px] text-neutral-400 leading-tight">{k.label}</p>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* Goals timeline */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Goals Timeline — Scored / Conceded</CardTitle>
                <TrendingUp size={18} className="text-neutral-400" />
              </CardHeader>
              {goals.length === 0 ? (
                <p className="text-sm text-neutral-400">No goals logged yet — add them from a match's page in Match Centre.</p>
              ) : (
                <div className="flex items-end justify-between gap-3 pt-2" style={{ height: 140 }}>
                  {timeline.map((b) => (
                    <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
                      <div className="flex h-full items-end gap-1">
                        <div
                          className="w-3.5 rounded-t bg-emerald-500"
                          style={{ height: `${(b.scored / maxTimelineValue) * 100}%`, minHeight: b.scored ? 3 : 0 }}
                          title={`${b.scored} scored`}
                        />
                        <div
                          className="w-3.5 rounded-t bg-red-500"
                          style={{ height: `${(b.conceded / maxTimelineValue) * 100}%`, minHeight: b.conceded ? 3 : 0 }}
                          title={`${b.conceded} conceded`}
                        />
                      </div>
                      <p className="text-[10px] text-neutral-400">{b.label}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 flex gap-4 text-xs text-neutral-400">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Scored</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-500" /> Conceded</span>
              </div>
            </Card>

            {/* Top scorers/assists */}
            <Card>
              <CardHeader>
                <CardTitle>Top Scorers &amp; Assists</CardTitle>
                <Trophy size={18} className="text-neutral-400" />
              </CardHeader>
              {scorers.length === 0 && assists.length === 0 ? (
                <p className="text-sm text-neutral-400">No goals logged yet.</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-neutral-500">Goalscorers</p>
                    <ul className="space-y-1 text-sm">
                      {scorers.map((s) => (
                        <li key={s.name} className="flex items-center gap-2.5">
                          {(() => {
                            const p = lookupPlayer(s.name);
                            return p ? (
                              <PlayerAvatar playerId={p.id} initials={p.initials} photoUrl={p.photo_url} size="sm" />
                            ) : (
                              <span className="h-7 w-7 shrink-0 rounded-full bg-navy-600 dark:bg-navy-800" />
                            );
                          })()}
                          <span className="min-w-0 flex-1 truncate">{s.name}</span>
                          <span className="shrink-0 font-semibold text-club-primary">{s.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-neutral-500">Assists</p>
                    <ul className="space-y-1 text-sm">
                      {assists.map((s) => (
                        <li key={s.name} className="flex items-center gap-2.5">
                          {(() => {
                            const p = lookupPlayer(s.name);
                            return p ? (
                              <PlayerAvatar playerId={p.id} initials={p.initials} photoUrl={p.photo_url} size="sm" />
                            ) : (
                              <span className="h-7 w-7 shrink-0 rounded-full bg-navy-600 dark:bg-navy-800" />
                            );
                          })()}
                          <span className="min-w-0 flex-1 truncate">{s.name}</span>
                          <span className="shrink-0 font-semibold text-club-primary">{s.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              <Link href="/analysis/maps" className="mt-3 inline-block text-xs text-club-primary hover:underline">
                See goal & assist locations on the pitch →
              </Link>
            </Card>
          </div>

          {/* Season stat panels — aggregated from match_stats (parsed reports + manual entry) */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {statCategories.length === 0 ? (
              <Card className="lg:col-span-3">
                <CardHeader><CardTitle>Season Stats</CardTitle></CardHeader>
                <p className="text-sm text-neutral-400">
                  No match stats recorded yet — upload a Hudl/Wyscout report or enter stats manually from a match's page, and season averages
                  will build up here automatically.
                </p>
              </Card>
            ) : (
              statCategories.map((cat) => (
                <Card key={cat.key}>
                  <CardHeader>
                    <CardTitle>{cat.label}</CardTitle>
                    <ShieldCheck size={18} className="text-neutral-400" />
                  </CardHeader>
                  <ul className="space-y-2 text-sm">
                    {cat.rows.map((r) => (
                      <li key={r.key} className="flex items-center justify-between">
                        <span className="text-neutral-400">{r.label}</span>
                        <span className="tabular-nums">
                          <span className="font-semibold">{r.us ?? "—"}{r.unit}</span>
                          <span className="text-neutral-500"> / {r.opponent ?? "—"}{r.unit}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] text-neutral-500">Season average, us / opponent — across {Math.max(...cat.rows.map((r) => r.matchesCounted), 0)} match{cat.rows.length === 1 && cat.rows[0].matchesCounted === 1 ? "" : "es"} with stats on file.</p>
                </Card>
              ))
            )}
          </div>

          {/* Categorised video reels */}
          <Card>
            <CardHeader>
              <CardTitle>Video Reels by Phase of Play</CardTitle>
              <Target size={18} className="text-neutral-400" />
            </CardHeader>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {featuredClips.map(({ category, clip }) => (
                <div key={category} className="overflow-hidden rounded-xl border border-white/10">
                  <div className="relative flex aspect-video items-center justify-center bg-navy-800">
                    {clip ? (
                      <button onClick={() => playClip(clip)} className="flex h-full w-full items-center justify-center hover:bg-black/20 transition-colors">
                        <PlayCircle size={32} className="text-white" />
                      </button>
                    ) : (
                      <span className="text-2xl">{CATEGORY_ICONS[category]}</span>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-sm font-medium">{category}</p>
                    <p className="truncate text-xs text-neutral-400">{clip ? clip.title : "No clip tagged yet"}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/analysis/library" className="mt-3 inline-block text-xs text-club-primary hover:underline">
              Open the full clip library →
            </Link>
          </Card>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Recent match reports */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Match Reports</CardTitle>
                <FileText size={18} className="text-neutral-400" />
              </CardHeader>
              {reports.length === 0 ? (
                <p className="text-sm text-neutral-400">
                  No reports uploaded yet — open any fixture in Match Centre to upload a Hudl/Wyscout/PDF match report.
                </p>
              ) : (
                <ul className="divide-y divide-white/10">
                  {reports.map((r) => (
                    <li key={r.id}>
                      <Link href={`/matches/${r.match_id}`} className="flex items-center justify-between gap-2 py-2.5 text-sm hover:text-club-primary transition-colors">
                        <span className="truncate">{matchLabel(r.match_id)} — {r.file_name}</span>
                        <Badge variant={r.parse_status === "parsed" ? "green" : r.parse_status === "failed" ? "red" : "neutral"}>
                          {r.source.toUpperCase()}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Recent match packs */}
            <Card>
              <CardHeader>
                <CardTitle>Match Packs</CardTitle>
                <Package size={18} className="text-neutral-400" />
              </CardHeader>
              {packs.length === 0 ? (
                <p className="text-sm text-neutral-400">No match packs yet.</p>
              ) : (
                <ul className="divide-y divide-white/10">
                  {packs.map((p) => (
                    <li key={p.id}>
                      <Link href={`/analysis/match-packs/${p.id}`} className="flex items-center justify-between gap-2 py-2.5 text-sm hover:text-club-primary transition-colors">
                        <span className="truncate">{p.title}</span>
                        <span className="text-xs text-neutral-400">{matchLabel(p.match_id)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/analysis/match-packs" className="mt-3 inline-block text-xs text-club-primary hover:underline">
                Manage match packs →
              </Link>
            </Card>
          </div>
        </div>
      )}

      {playing && <VideoPlayer clip={playing} onClose={() => setPlaying(null)} sourceClipId={playing.id} />}
    </AppShell>
  );
}
