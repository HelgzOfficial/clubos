"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { opposition, club, type Opposition } from "@/lib/sample-data";
import { fetchMatches, type DbMatch } from "@/lib/matches-db";
import {
  fetchOppositionReports, uploadOppositionReport, deleteOppositionReport, getOppositionReportDownloadUrl,
  type DbOppositionReport, type StatBar,
} from "@/lib/opposition-reports-db";
import { fetchHeadToHead, refreshHeadToHead, type DbHeadToHead } from "@/lib/opposition-head-to-head-db";
import { loadClubSettings } from "@/lib/club-settings";
import { usePermissions } from "@/lib/permissions";
import Link from "next/link";
import {
  ArrowLeft, ShieldCheck, ShieldAlert, Target, Users, FileText,
  Upload, Trash2, Download, Loader2, Sparkles, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, RefreshCw, Search,
} from "lucide-react";

const formColor: Record<string, string> = {
  W: "bg-emerald-500", D: "bg-amber-400", L: "bg-red-500",
};

const statusVariant = { "Not started": "neutral", "In progress": "amber", Ready: "green" } as const;

// A head-to-head record older than this gets silently refreshed in the
// background when the page loads, so it stays roughly current without
// anyone having to remember to click "Refresh".
const STALE_MS = 14 * 24 * 3600 * 1000;

function norm(s: string) {
  return s.trim().toLowerCase();
}

export default function OppositionDetailPage() {
  const { canWrite } = usePermissions();
  const canEdit = canWrite("opposition");
  const params = useParams<{ id: string }>();
  // Supports two ways of reaching this page: a legacy static profile id
  // (e.g. from an older link) or — the normal path now — a URL-encoded
  // opponent name, so any upcoming fixture's opponent has a working page
  // here even if nobody's written a manual scouting profile for them yet.
  const rawParam = params.id;
  const byId = opposition.find((o) => o.id === rawParam) ?? null;
  const opponentName = byId ? byId.name : decodeURIComponent(rawParam);
  const team: Opposition | null = byId ?? opposition.find((o) => norm(o.name) === norm(opponentName)) ?? null;

  const [match, setMatch] = useState<DbMatch | null>(null);

  useEffect(() => {
    // Find the next real fixture against this opponent from the Match Centre
    // (falls back to their most recent meeting if nothing's upcoming).
    fetchMatches().then((matches) => {
      const vsThem = matches.filter((m) => norm(m.opponent) === norm(opponentName));
      const now = Date.now();
      const upcoming = vsThem
        .filter((m) => new Date(m.kickoff).getTime() >= now)
        .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())[0];
      const mostRecent = vsThem
        .filter((m) => new Date(m.kickoff).getTime() < now)
        .sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime())[0];
      setMatch(upcoming ?? mostRecent ?? null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opponentName]);

  const now = Date.now();
  const isUpcoming = match ? new Date(match.kickoff).getTime() >= now : false;

  return (
    <AppShell>
      <Link href="/opposition" className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-white">
        <ArrowLeft size={14} /> Back to Opposition
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-600 dark:bg-navy-800 text-sm font-semibold shrink-0">
          {opponentName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold">{opponentName}</h1>
          <p className="text-sm text-neutral-500">
            {team ? (
              <>
                {team.formation} · {team.leaguePosition}
                {team.leaguePosition === 1 ? "st" : team.leaguePosition === 2 ? "nd" : team.leaguePosition === 3 ? "rd" : "th"} in league
              </>
            ) : (
              "No manual scouting profile yet"
            )}
            {match && (
              <>
                {" "}· {isUpcoming ? "Next meeting" : "Last meeting"} {new Date(match.kickoff).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                {match.venue ? ` (${match.venue})` : ""}
              </>
            )}
          </p>
        </div>
        {team && <Badge variant={statusVariant[team.reportStatus]}>{team.reportStatus}</Badge>}
        {match && (
          <Link
            href={`/matches/${match.id}`}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors"
          >
            <FileText size={14} /> Match reports (Hudl/Wyscout)
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {team && (
          <Card>
            <CardHeader><CardTitle>Recent Form</CardTitle></CardHeader>
            <div className="flex items-center gap-2">
              {team.form.map((r, i) => (
                <span key={i} className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white ${formColor[r]}`}>
                  {r}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-neutral-400">Oldest → most recent</p>
          </Card>
        )}

        <div className={team ? "" : "lg:col-span-2"}>
          <HeadToHeadCard opponentName={opponentName} fallback={team?.headToHead ?? null} fallbackLastMeeting={team?.lastMeeting ?? null} />
        </div>

        {team && (
          <>
            <Card>
              <CardHeader><CardTitle>Playing Style</CardTitle></CardHeader>
              <p className="text-sm text-neutral-600 dark:text-neutral-300">{team.style}</p>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Strengths</CardTitle>
                <ShieldCheck size={18} className="text-emerald-500" />
              </CardHeader>
              <ul className="space-y-2 text-sm">
                {team.strengths.map((s) => (
                  <li key={s} className="flex gap-2"><span className="text-emerald-500">•</span>{s}</li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Weaknesses</CardTitle>
                <ShieldAlert size={18} className="text-red-500" />
              </CardHeader>
              <ul className="space-y-2 text-sm">
                {team.weaknesses.map((s) => (
                  <li key={s} className="flex gap-2"><span className="text-red-500">•</span>{s}</li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Set Pieces</CardTitle>
                <Target size={18} className="text-neutral-400" />
              </CardHeader>
              <p className="text-sm text-neutral-600 dark:text-neutral-300">{team.setPieces}</p>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Key Players</CardTitle>
                <Users size={18} className="text-neutral-400" />
              </CardHeader>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {team.keyPlayers.map((p) => (
                  <div key={p.name} className="flex items-start gap-3 rounded-xl border border-white/10 p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-600 dark:bg-navy-800 text-xs font-semibold shrink-0">
                      {p.name.split(" ").map((w) => w[0]).join("")}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{p.name} <span className="text-xs text-neutral-400 font-normal">· {p.position}</span></p>
                      <p className="text-xs text-neutral-500 mt-0.5">{p.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        <div className="lg:col-span-3">
          <OppositionReportsCard opponentName={opponentName} canEdit={canEdit} />
        </div>
      </div>
    </AppShell>
  );
}

function HeadToHeadCard({
  opponentName, fallback, fallbackLastMeeting,
}: {
  opponentName: string;
  fallback: { played: number; won: number; drawn: number; lost: number } | null;
  fallbackLastMeeting: { date: string; result: string } | null;
}) {
  const [h2h, setH2h] = useState<DbHeadToHead | null | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(autoRefreshIfStale: boolean) {
    const row = await fetchHeadToHead(opponentName);
    setH2h(row);
    const isStale = !row || Date.now() - new Date(row.updated_at).getTime() > STALE_MS;
    if (autoRefreshIfStale && isStale) {
      handleRefresh(true);
    }
  }

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opponentName]);

  async function handleRefresh(silent = false) {
    setRefreshing(true);
    if (!silent) setError("");
    try {
      const branding = loadClubSettings(club);
      const row = await refreshHeadToHead(opponentName, branding.name);
      setH2h(row);
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : "Couldn't research this opponent.");
    } finally {
      setRefreshing(false);
    }
  }

  const played = h2h?.played ?? fallback?.played ?? null;
  const won = h2h?.won ?? fallback?.won ?? null;
  const drawn = h2h?.drawn ?? fallback?.drawn ?? null;
  const lost = h2h?.lost ?? fallback?.lost ?? null;
  const hasRecord = played !== null;

  const lastDate = h2h?.last_meeting_date ?? fallbackLastMeeting?.date ?? null;
  const lastResult = h2h?.last_meeting_result ?? fallbackLastMeeting?.result ?? null;
  const lastVenue = h2h?.last_meeting_venue ?? null;
  const lastCompetition = h2h?.last_meeting_competition ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Head-to-Head</CardTitle>
        <button
          onClick={() => handleRefresh(false)}
          disabled={refreshing}
          title="Research again using the web"
          className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white disabled:opacity-60"
        >
          {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </button>
      </CardHeader>

      {h2h === undefined && !refreshing ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : refreshing && !hasRecord ? (
        <p className="flex items-center gap-1.5 text-sm text-neutral-400"><Search size={14} className="animate-pulse" /> Searching the web for previous meetings…</p>
      ) : hasRecord ? (
        <>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div><p className="text-lg font-semibold">{played}</p><p className="text-xs text-neutral-400">Played</p></div>
            <div><p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{won}</p><p className="text-xs text-neutral-400">Won</p></div>
            <div><p className="text-lg font-semibold text-amber-500">{drawn}</p><p className="text-xs text-neutral-400">Drawn</p></div>
            <div><p className="text-lg font-semibold text-red-600 dark:text-red-400">{lost}</p><p className="text-xs text-neutral-400">Lost</p></div>
          </div>
          {(lastDate || lastResult) && (
            <p className="mt-3 text-xs text-neutral-400">
              Last meeting: {lastDate || "—"}{lastCompetition ? ` · ${lastCompetition}` : ""}{lastVenue ? ` · ${lastVenue}` : ""}
              {lastResult ? ` — ${lastResult}` : ""}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-neutral-400">No reliable head-to-head record found online yet for this opponent.</p>
      )}

      {h2h?.source_note && <p className="mt-2 text-xs text-neutral-500 italic">{h2h.source_note}</p>}
      {h2h?.confidence && hasRecord && (
        <p className="mt-1 text-xs text-neutral-500">
          Confidence: <span className={h2h.confidence === "high" ? "text-emerald-400" : h2h.confidence === "medium" ? "text-amber-400" : "text-neutral-400"}>{h2h.confidence}</span>
          {" "}· auto-updated {h2h ? new Date(h2h.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      <p className="mt-2 text-xs text-neutral-500">
        Researched automatically from the web (non-league records can be patchy) — refreshes itself periodically, or use
        the refresh button any time.
      </p>
    </Card>
  );
}

function OppositionReportsCard({ opponentName, canEdit }: { opponentName: string; canEdit: boolean }) {
  const [reports, setReports] = useState<DbOppositionReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load(expandLatest = false) {
    const rows = await fetchOppositionReports(opponentName);
    setReports(rows);
    setLoading(false);
    if (expandLatest) {
      const latestReady = rows.find((r) => r.summary_status === "ready");
      if (latestReady) setExpandedId(latestReady.id);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opponentName]);

  async function handleFile(file: File) {
    setUploading(true);
    setUploadError("");
    try {
      await uploadOppositionReport(opponentName, file);
      await load(true);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Couldn't upload that file.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(r: DbOppositionReport) {
    if (!window.confirm(`Remove "${r.file_name}"? This also deletes its AI summary.`)) return;
    setDeletingId(r.id);
    try {
      await deleteOppositionReport(r.id, r.file_path);
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDownload(r: DbOppositionReport) {
    const url = await getOppositionReportDownloadUrl(r.file_path);
    window.open(url, "_blank");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scouting Reports & AI Summary</CardTitle>
        <Sparkles size={18} className="text-neutral-400" />
      </CardHeader>
      <p className="mb-3 text-xs text-neutral-400">
        Upload a Wyscout/Hudl team stats export (PDF, CSV or TXT) or a screenshot of one — a multi-match squad view
        like the &quot;Stats&quot; tab works well here, not just a single fixture. ClubOS reads the numbers and asks AI to
        write a short scouting summary (form/trend, style, strengths, weaknesses) below. Always sanity-check the
        summary against the original file before relying on it.
      </p>

      {uploadError && <p className="mb-2 text-sm text-red-300">{uploadError}</p>}

      {canEdit && (
        <label className="mb-4 flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors">
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {uploading ? "Uploading…" : "Upload team report"}
          <input
            type="file"
            accept=".pdf,.csv,.txt,.png,.jpg,.jpeg,.webp"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
        </label>
      )}

      {loading ? (
        <p className="text-sm text-neutral-400">Loading reports…</p>
      ) : reports.length === 0 ? (
        <p className="text-sm text-neutral-400">No scouting reports uploaded yet.</p>
      ) : (
        <ul className="divide-y divide-white/10">
          {reports.map((r) => {
            const expanded = expandedId === r.id;
            return (
              <li key={r.id} className="py-2.5">
                <div className="flex items-center gap-2.5 text-sm">
                  <FileText size={14} className="shrink-0 text-neutral-400" />
                  <span className="flex-1 truncate">{r.file_name}</span>
                  {r.summary_status === "ready" ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 size={13} /> Summary ready</span>
                  ) : r.summary_status === "failed" ? (
                    <span className="flex items-center gap-1 text-xs text-amber-400"><AlertTriangle size={13} /> Couldn&apos;t summarise</span>
                  ) : (
                    <span className="text-xs text-neutral-400">Pending</span>
                  )}
                  {(r.summary_status === "ready" || (r.summary_status === "failed" && r.summary_error)) && (
                    <button
                      onClick={() => setExpandedId(expanded ? null : r.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white"
                      title={expanded ? "Hide detail" : r.summary_status === "ready" ? "View summary" : "Why did this fail?"}
                    >
                      {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  )}
                  <button onClick={() => handleDownload(r)} title="Download" className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white">
                    <Download size={13} />
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => handleDelete(r)}
                      disabled={deletingId === r.id}
                      title="Remove report"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10 disabled:opacity-60"
                    >
                      {deletingId === r.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  )}
                </div>
                {expanded && r.ai_stats && r.ai_stats.length > 0 && <StatBars stats={r.ai_stats} />}
                {expanded && r.ai_summary && (
                  <div className="mt-2.5 ml-6 max-h-80 overflow-y-auto rounded-xl border border-white/10 bg-navy-600/40 dark:bg-navy-800/40 p-3">
                    {r.ai_summary.split(/\n+/).filter(Boolean).map((line, i) => (
                      <p key={i} className="mb-1.5 last:mb-0 text-sm text-neutral-200 whitespace-pre-wrap">{line}</p>
                    ))}
                  </div>
                )}
                {expanded && r.summary_status === "failed" && r.summary_error && (
                  <div className="mt-2.5 ml-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                    <p className="text-sm text-amber-200">{r.summary_error}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// Colours a 0-100 value from red (weak/no threat) to green (strong/dangerous
// for the opponent), through a neutral grey midpoint — plain linear RGB
// interpolation, kept deliberately simple since it always ships with a
// visible numeric label alongside the fill (colour is never the only cue).
const STAT_RED: [number, number, number] = [208, 59, 59]; // #d03b3b
const STAT_GREY: [number, number, number] = [138, 138, 134]; // neutral midpoint
const STAT_GREEN: [number, number, number] = [12, 163, 12]; // #0ca30c

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

function statColor(value: number): string {
  const v = Math.max(0, Math.min(100, value));
  const [from, to, t] =
    v <= 50 ? [STAT_RED, STAT_GREY, v / 50] : [STAT_GREY, STAT_GREEN, (v - 50) / 50];
  const r = lerp(from[0], to[0], t);
  const g = lerp(from[1], to[1], t);
  const b = lerp(from[2], to[2], t);
  return `rgb(${r}, ${g}, ${b})`;
}

function StatBars({ stats }: { stats: StatBar[] }) {
  return (
    <div className="mt-2.5 ml-6 rounded-xl border border-white/10 bg-navy-600/40 dark:bg-navy-800/40 p-3">
      <p className="mb-2.5 text-xs text-neutral-400">
        Green = stronger/more dangerous for this opponent, red = weaker — scored out of 100.
      </p>
      <div className="space-y-2.5">
        {stats.map((s, i) => (
          <div key={i}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-neutral-200">{s.label}</span>
              <span className="tabular-nums text-neutral-300">{s.value}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.max(0, Math.min(100, s.value))}%`, backgroundColor: statColor(s.value) }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
