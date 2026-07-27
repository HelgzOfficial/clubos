"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchMatch, type DbMatch } from "@/lib/matches-db";
import {
  fetchMatchDetails, addLineupEntry, deleteLineupEntry,
  addGoal, deleteGoal, addSubstitution, deleteSubstitution,
  type DbLineupEntry, type DbGoal, type DbSubstitution,
} from "@/lib/match-details-db";
import {
  fetchMatchReports, uploadMatchReport, deleteMatchReport, getReportDownloadUrl,
  type DbMatchReport, type ReportSource,
} from "@/lib/match-reports-db";
import { fetchMatchStats, type DbMatchStats } from "@/lib/match-stats-db";
import {
  fetchMatchDocuments, uploadMatchDocument, deleteMatchDocument, getMatchDocumentUrl, getMatchDocumentDownloadUrl, fetchDocumentViewers,
  type DbMatchDocument, type DocumentViewer,
} from "@/lib/match-documents-db";
import { DocumentViewerModal } from "@/components/document-viewer-modal";
import { fetchPlayers, type DbPlayer } from "@/lib/players-db";
import { StatDashboard } from "@/components/matches/stat-dashboard";
import { club } from "@/lib/sample-data";
import { fetchClubSettings } from "@/lib/club-settings-db";
import { competitionKind, competitionVariant } from "@/lib/competition-kind";
import { syncPlayerStatsFromMatches } from "@/lib/player-stats-sync";
import { DirectionsLinks } from "@/components/directions-links";
import { PitchMapInput, type PitchPoint } from "@/components/analysis/pitch-map";
import { fetchClipsForMatch, uploadClip, getClipUrl, deleteClip, type DbClip } from "@/lib/clips-db";
import { VideoPlayer } from "@/components/analysis/video-player";
import type { Clip } from "@/lib/analysis-types";
import {
  ArrowLeft, Plus, Trash2, Upload, FileText, Download, CheckCircle2, AlertTriangle, Loader2, Eye, Maximize2, MapPin, Film, Play,
} from "lucide-react";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export default function MatchDetailPage() {
  const params = useParams<{ id: string }>();
  const [match, setMatch] = useState<DbMatch | null | undefined>(undefined);
  const [lineup, setLineup] = useState<DbLineupEntry[]>([]);
  const [goals, setGoals] = useState<DbGoal[]>([]);
  const [subs, setSubs] = useState<DbSubstitution[]>([]);
  const [reports, setReports] = useState<DbMatchReport[]>([]);
  const [stats, setStats] = useState<DbMatchStats | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const m = await fetchMatch(params.id);
    setMatch(m);
    if (m) {
      try {
        const [details, reportRows, statsRow] = await Promise.all([fetchMatchDetails(m.id), fetchMatchReports(m.id), fetchMatchStats(m.id)]);
        setLineup(details.lineup);
        setGoals(details.goals);
        setSubs(details.substitutions);
        setReports(reportRows);
        setStats(statsRow);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load match details.");
      }
      // Keep player season stats (appearances, goals, assists, clean sheets) in
      // step with whatever's just been imported or edited for this fixture.
      // Best-effort and silent — a sync hiccup shouldn't block viewing the match.
      if (m.status === "completed" && competitionKind(m.competition) !== "friendly") {
        syncPlayerStatsFromMatches().catch(() => {});
      }
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  if (match === undefined) {
    return (
      <AppShell>
        <p className="text-sm text-neutral-400">Loading…</p>
      </AppShell>
    );
  }

  if (match === null) {
    return (
      <AppShell>
        <Link href="/matches" className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-white">
          <ArrowLeft size={14} /> Back to Match Centre
        </Link>
        <Card><p className="text-sm text-neutral-400">This match couldn&apos;t be found.</p></Card>
      </AppShell>
    );
  }

  const starting = lineup.filter((l) => l.is_starting);
  const bench = lineup.filter((l) => !l.is_starting);
  const hasScore = match.home_score !== null && match.away_score !== null;

  return (
    <AppShell>
      <Link href="/matches" className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-white">
        <ArrowLeft size={14} /> Back to Match Centre
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{match.is_home ? "vs" : "@"} {match.opponent}</h1>
          <p className="text-sm text-neutral-500">{formatDate(match.kickoff)}{match.venue ? ` · ${match.venue}` : ""}</p>
          <DirectionsLinks venue={match.venue} className="mt-1.5" />
        </div>
        <div className="flex items-center gap-2">
          {match.competition && (
            <Badge variant={competitionVariant[competitionKind(match.competition)]}>{match.competition}</Badge>
          )}
          <Badge variant={match.is_home ? "green" : "neutral"}>{match.is_home ? "Home" : "Away"}</Badge>
          {hasScore && <span className="text-xl font-semibold">{match.home_score} – {match.away_score}</span>}
        </div>
      </div>

      {error && (
        <Card className="mb-6 border-red-500/30 bg-red-500/10">
          <p className="text-sm text-red-300">{error}</p>
        </Card>
      )}

      <div className="mb-5">
        <StatDashboard matchId={match.id} opponentName={match.opponent} initialStats={stats} />
      </div>

      <div id="documents" className="mb-5 scroll-mt-6">
        <MatchDocumentsCard matchId={match.id} />
      </div>

      <div id="reports" className="mb-5 scroll-mt-6">
        <ReportsCard matchId={match.id} opponentName={match.opponent} reports={reports} lineup={lineup} goals={goals} subs={subs} onChanged={load} />
      </div>

      <div id="highlights" className="mb-5 scroll-mt-6">
        <HighlightsCard matchId={match.id} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <LineupCard title="Starting XI" matchId={match.id} entries={starting} isStarting onAdded={load} />
        <LineupCard title="Substitutes" matchId={match.id} entries={bench} isStarting={false} onAdded={load} />
        <GoalsCard matchId={match.id} goals={goals} onAdded={load} />
        <SubsCard matchId={match.id} subs={subs} onAdded={load} />
      </div>
    </AppShell>
  );
}

// ---- Match highlights / clips ----
function HighlightsCard({ matchId }: { matchId: string }) {
  const [clips, setClips] = useState<DbClip[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState<Clip | null>(null);

  async function load() {
    setError("");
    try {
      setClips(await fetchClipsForMatch(matchId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load highlights.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  async function handleFile(file: File) {
    setUploading(true);
    setError("");
    try {
      await uploadClip(file.name.replace(/\.[^.]+$/, ""), file, null, matchId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload that clip.");
    } finally {
      setUploading(false);
    }
  }

  async function handlePlay(c: DbClip) {
    const url = await getClipUrl(c.file_path);
    setPlaying({ id: c.id, title: c.title, url, tags: c.category ? [c.category] : [], addedAt: c.uploaded_at });
  }

  async function handleDelete(c: DbClip) {
    if (!window.confirm(`Remove "${c.title}"?`)) return;
    await deleteClip(c.id, c.file_path);
    await load();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Highlights</CardTitle>
        <Film size={18} className="text-neutral-400" />
      </CardHeader>
      <p className="mb-3 text-xs text-neutral-400">
        Upload clips or highlights for this fixture — they'll show up here and in the Analysis clip library, ready to review or annotate.
      </p>

      {error && <p className="mb-3 text-sm text-red-300">{error}</p>}

      {clips.length === 0 ? (
        <p className="mb-3 text-sm text-neutral-400">No highlights uploaded yet for this match.</p>
      ) : (
        <ul className="mb-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {clips.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-xl border border-white/10 p-2.5 text-sm">
              <button
                onClick={() => handlePlay(c)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy-600 dark:bg-navy-800 text-club-primary"
              >
                <Play size={13} />
              </button>
              <button onClick={() => handlePlay(c)} className="flex-1 truncate text-left hover:text-club-primary">
                {c.title}
              </button>
              <button onClick={() => handleDelete(c)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10">
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800">
        {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
        {uploading ? "Uploading…" : "Upload Highlight"}
        <input
          type="file"
          accept="video/*"
          className="hidden"
          disabled={uploading}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />
      </label>

      {playing && <VideoPlayer clip={playing} onClose={() => setPlaying(null)} sourceClipId={playing.id} />}
    </Card>
  );
}

function ReportsCard({
  matchId, opponentName, reports, lineup, goals, subs, onChanged,
}: {
  matchId: string; opponentName: string; reports: DbMatchReport[];
  lineup: DbLineupEntry[]; goals: DbGoal[]; subs: DbSubstitution[];
  onChanged: () => void;
}) {
  const [source, setSource] = useState<ReportSource>("hudl");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [importingId, setImportingId] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setUploadError("");
    try {
      const branding = await fetchClubSettings(club);
      await uploadMatchReport(matchId, file, source, { clubName: branding.name, opponentName });
      onChanged();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Couldn't upload that report.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(r: DbMatchReport) {
    if (!window.confirm(`Remove "${r.file_name}"?`)) return;
    await deleteMatchReport(r.id, r.file_path);
    onChanged();
  }

  async function handleDownload(r: DbMatchReport) {
    const url = await getReportDownloadUrl(r.file_path);
    window.open(url, "_blank");
  }

  async function handleImport(r: DbMatchReport) {
    if (!r.parsed_summary) return;
    setImportingId(r.id);
    try {
      const existingScorers = new Set(goals.map((g) => `${g.minute}-${g.scorer}`));
      for (const g of r.parsed_summary.goals) {
        if (existingScorers.has(`${g.minute}-${g.scorer}`)) continue;
        await addGoal(matchId, { minute: g.minute !== null ? String(g.minute) : "", team: "us", scorer: g.scorer, assist: g.assist });
      }
      const existingSubs = new Set(subs.map((s) => `${s.minute}-${s.player_off}-${s.player_on}`));
      for (const s of r.parsed_summary.substitutions) {
        if (existingSubs.has(`${s.minute}-${s.playerOff}-${s.playerOn}`)) continue;
        await addSubstitution(matchId, { minute: s.minute !== null ? String(s.minute) : "", playerOff: s.playerOff, playerOn: s.playerOn });
      }
      const existingPlayers = new Set(lineup.map((l) => l.player_name));
      let order = lineup.length;
      // Only our own lineup gets imported here — the opponent's XI is in the parsed
      // data too (useful for the "who's us" detection) but this app doesn't track
      // opposition players individually.
      for (const l of r.parsed_summary.lineup.filter((entry) => entry.side === "us")) {
        if (existingPlayers.has(l.playerName)) continue;
        await addLineupEntry(matchId, { isStarting: l.isStarting, shirtNumber: l.shirtNumber, playerName: l.playerName, position: "", sortOrder: order++ });
      }
      onChanged();
    } finally {
      setImportingId(null);
    }
  }

  const extractedCount = (r: DbMatchReport) =>
    r.parsed_summary
      ? r.parsed_summary.goals.length + r.parsed_summary.lineup.length + r.parsed_summary.substitutions.length + r.parsed_summary.statCategories.length
      : 0;

  return (
    <Card>
      <CardHeader><CardTitle>Match Reports (Hudl / Wyscout)</CardTitle></CardHeader>
      <p className="mb-3 text-xs text-neutral-400">
        Upload a Wyscout/Hudl &quot;Match Report&quot; PDF (or CSV/TXT export) for this fixture. ClubOS reads the Team Stats page
        straight into the dashboard above, plus the goalscorers and starting lineup — matched to whichever side is us by
        comparing the report&apos;s scoreline to this fixture&apos;s opponent. It&apos;s still best-effort against real report
        layouts, so always check the &quot;Import&quot; preview before pulling lineup/goals into the fixture (stats populate the
        dashboard automatically). Other Hudl/Wyscout export types — like a multi-match squad &quot;Team Report&quot; — don&apos;t
        contain per-match team stats and won&apos;t fill this dashboard. You can also upload a screenshot/photo (PNG/JPG) of a
        stats or lineup screen — that goes through an AI reader instead, so double-check its results before importing too.
        Once goals and lineup are imported (for league/cup fixtures), player season stats — appearances, goals, assists, and
        clean sheets for goalkeepers/defenders — update automatically.
      </p>

      {reports.length === 0 ? (
        <p className="mb-3 text-sm text-neutral-400">No reports uploaded yet.</p>
      ) : (
        <ul className="mb-3 divide-y divide-white/10">
          {reports.map((r) => (
            <li key={r.id} className="py-2.5">
              <div className="flex items-center gap-2.5 text-sm">
                <FileText size={14} className="shrink-0 text-neutral-400" />
                <span className="flex-1 truncate">{r.file_name}</span>
                <Badge variant="neutral">{r.source}</Badge>
                {r.parse_status === "parsed" ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 size={13} /> {extractedCount(r)} found</span>
                ) : r.parse_status === "failed" ? (
                  <span className="flex items-center gap-1 text-xs text-amber-400"><AlertTriangle size={13} /> Couldn&apos;t auto-read</span>
                ) : (
                  <span className="text-xs text-neutral-400">Unparsed</span>
                )}
                <button onClick={() => handleDownload(r)} title="Download" className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white">
                  <Download size={13} />
                </button>
                <button onClick={() => handleDelete(r)} title="Remove" className="flex h-7 w-7 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10">
                  <Trash2 size={13} />
                </button>
              </div>
              {r.parse_status === "parsed" && r.parsed_summary && (
                <div className="mt-2 ml-6 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-neutral-400">
                    {r.parsed_summary.goals.length} goal{r.parsed_summary.goals.length === 1 ? "" : "s"},{" "}
                    {r.parsed_summary.substitutions.length} sub{r.parsed_summary.substitutions.length === 1 ? "" : "s"},{" "}
                    {r.parsed_summary.lineup.length} lineup entries,{" "}
                    {r.parsed_summary.statCategories.length} stat categor{r.parsed_summary.statCategories.length === 1 ? "y" : "ies"} detected
                  </span>
                  <button
                    onClick={() => handleImport(r)}
                    disabled={importingId === r.id}
                    className="flex items-center gap-1 rounded-lg bg-club-primary text-navy-950 px-2.5 py-1 text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
                  >
                    {importingId === r.id ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                    Import into fixture
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {uploadError && <p className="mb-2 text-sm text-red-300">{uploadError}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as ReportSource)}
          className="rounded-lg border border-white/10 bg-navy-600 dark:bg-navy-800 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
        >
          <option value="hudl">Hudl</option>
          <option value="wyscout">Wyscout</option>
          <option value="other">Other</option>
        </select>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors">
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {uploading ? "Uploading…" : "Upload report"}
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
      </div>
    </Card>
  );
}

function LineupCard({
  title, matchId, entries, isStarting, onAdded,
}: {
  title: string; matchId: string; entries: DbLineupEntry[]; isStarting: boolean; onAdded: () => void;
}) {
  const [shirtNumber, setShirtNumber] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [position, setPosition] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!playerName.trim()) return;
    setSaving(true);
    try {
      await addLineupEntry(matchId, { isStarting, shirtNumber, playerName: playerName.trim(), position: position.trim(), sortOrder: entries.length });
      setShirtNumber("");
      setPlayerName("");
      setPosition("");
      onAdded();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteLineupEntry(id);
    onAdded();
  }

  return (
    <Card>
      <CardHeader><CardTitle>{title} ({entries.length})</CardTitle></CardHeader>
      {entries.length === 0 ? (
        <p className="mb-3 text-sm text-neutral-400">No players added yet.</p>
      ) : (
        <ul className="mb-3 divide-y divide-white/10">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-2.5 py-2 text-sm">
              <span className="w-6 text-xs text-neutral-400">{e.shirt_number ?? "-"}</span>
              <span className="flex-1 truncate">{e.player_name}</span>
              {e.position && <Badge variant="neutral">{e.position}</Badge>}
              <button onClick={() => handleDelete(e.id)} className="flex h-6 w-6 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10">
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleAdd} className="flex flex-wrap gap-2">
        <input value={shirtNumber} onChange={(e) => setShirtNumber(e.target.value)} placeholder="#" type="number" className="w-14 rounded-lg border border-white/10 bg-navy-600 dark:bg-navy-800 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
        <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Player name" className="min-w-[9rem] flex-1 rounded-lg border border-white/10 bg-navy-600 dark:bg-navy-800 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
        <input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Pos" className="w-20 rounded-lg border border-white/10 bg-navy-600 dark:bg-navy-800 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
        <button type="submit" disabled={saving} className="flex items-center gap-1 rounded-lg bg-club-primary text-navy-950 px-3 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60">
          <Plus size={13} /> Add
        </button>
      </form>
    </Card>
  );
}

function GoalsCard({ matchId, goals, onAdded }: { matchId: string; goals: DbGoal[]; onAdded: () => void }) {
  const [minute, setMinute] = useState("");
  const [team, setTeam] = useState<"us" | "opponent">("us");
  const [scorer, setScorer] = useState("");
  const [assist, setAssist] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPitch, setShowPitch] = useState(false);
  const [location, setLocation] = useState<PitchPoint | null>(null);

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!scorer.trim()) return;
    setSaving(true);
    try {
      await addGoal(matchId, {
        minute, team, scorer: scorer.trim(), assist: assist.trim(),
        x: location?.x ?? null, y: location?.y ?? null,
      });
      setMinute("");
      setScorer("");
      setAssist("");
      setLocation(null);
      setShowPitch(false);
      onAdded();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteGoal(id);
    onAdded();
  }

  return (
    <Card>
      <CardHeader><CardTitle>Goals ({goals.length})</CardTitle></CardHeader>
      {goals.length === 0 ? (
        <p className="mb-3 text-sm text-neutral-400">No goals logged yet.</p>
      ) : (
        <ul className="mb-3 divide-y divide-white/10">
          {goals.map((g) => (
            <li key={g.id} className="flex items-center gap-2.5 py-2 text-sm">
              <span className="w-10 text-xs text-neutral-400">{g.minute !== null ? `${g.minute}'` : "-"}</span>
              <span className="flex-1 truncate">
                {g.scorer}{g.assist ? <span className="text-neutral-400"> (assist: {g.assist})</span> : ""}
                {g.x !== null && g.y !== null && <MapPin size={11} className="ml-1.5 inline text-neutral-400" />}
              </span>
              <Badge variant={g.team === "us" ? "green" : "neutral"}>{g.team === "us" ? "Us" : "Them"}</Badge>
              <button onClick={() => handleDelete(g.id)} className="flex h-6 w-6 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10">
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleAdd} className="flex flex-wrap gap-2">
        <input value={minute} onChange={(e) => setMinute(e.target.value)} placeholder="Min" type="number" className="w-16 rounded-lg border border-white/10 bg-navy-600 dark:bg-navy-800 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
        <select value={team} onChange={(e) => setTeam(e.target.value as "us" | "opponent")} className="rounded-lg border border-white/10 bg-navy-600 dark:bg-navy-800 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-club-primary/30">
          <option value="us">Us</option>
          <option value="opponent">Them</option>
        </select>
        <input value={scorer} onChange={(e) => setScorer(e.target.value)} placeholder="Scorer" className="min-w-[8rem] flex-1 rounded-lg border border-white/10 bg-navy-600 dark:bg-navy-800 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
        <input value={assist} onChange={(e) => setAssist(e.target.value)} placeholder="Assist (optional)" className="min-w-[8rem] flex-1 rounded-lg border border-white/10 bg-navy-600 dark:bg-navy-800 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
        <button
          type="button"
          onClick={() => setShowPitch((v) => !v)}
          className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-sm transition-colors ${
            location ? "border-club-primary/50 text-club-primary" : "border-white/10 text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800"
          }`}
        >
          <MapPin size={13} /> {location ? "Location set" : "Mark location"}
        </button>
        <button type="submit" disabled={saving} className="flex items-center gap-1 rounded-lg bg-club-primary text-navy-950 px-3 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60">
          <Plus size={13} /> Add
        </button>
        {showPitch && (
          <div className="w-full pt-2">
            <PitchMapInput value={location} onChange={setLocation} />
          </div>
        )}
      </form>
    </Card>
  );
}

function SubsCard({ matchId, subs, onAdded }: { matchId: string; subs: DbSubstitution[]; onAdded: () => void }) {
  const [minute, setMinute] = useState("");
  const [playerOff, setPlayerOff] = useState("");
  const [playerOn, setPlayerOn] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!playerOff.trim() || !playerOn.trim()) return;
    setSaving(true);
    try {
      await addSubstitution(matchId, { minute, playerOff: playerOff.trim(), playerOn: playerOn.trim() });
      setMinute("");
      setPlayerOff("");
      setPlayerOn("");
      onAdded();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteSubstitution(id);
    onAdded();
  }

  return (
    <Card>
      <CardHeader><CardTitle>Substitutions ({subs.length})</CardTitle></CardHeader>
      {subs.length === 0 ? (
        <p className="mb-3 text-sm text-neutral-400">No substitutions logged yet.</p>
      ) : (
        <ul className="mb-3 divide-y divide-white/10">
          {subs.map((s) => (
            <li key={s.id} className="flex items-center gap-2.5 py-2 text-sm">
              <span className="w-10 text-xs text-neutral-400">{s.minute !== null ? `${s.minute}'` : "-"}</span>
              <span className="flex-1 truncate">
                <span className="text-red-300">{s.player_off}</span> <span className="text-neutral-400">off,</span>{" "}
                <span className="text-emerald-300">{s.player_on}</span> <span className="text-neutral-400">on</span>
              </span>
              <button onClick={() => handleDelete(s.id)} className="flex h-6 w-6 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10">
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleAdd} className="flex flex-wrap gap-2">
        <input value={minute} onChange={(e) => setMinute(e.target.value)} placeholder="Min" type="number" className="w-16 rounded-lg border border-white/10 bg-navy-600 dark:bg-navy-800 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
        <input value={playerOff} onChange={(e) => setPlayerOff(e.target.value)} placeholder="Player off" className="min-w-[8rem] flex-1 rounded-lg border border-white/10 bg-navy-600 dark:bg-navy-800 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
        <input value={playerOn} onChange={(e) => setPlayerOn(e.target.value)} placeholder="Player on" className="min-w-[8rem] flex-1 rounded-lg border border-white/10 bg-navy-600 dark:bg-navy-800 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
        <button type="submit" disabled={saving} className="flex items-center gap-1 rounded-lg bg-club-primary text-navy-950 px-3 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60">
          <Plus size={13} /> Add
        </button>
      </form>
    </Card>
  );
}

function MatchDocumentsCard({ matchId }: { matchId: string }) {
  const [docs, setDocs] = useState<DbMatchDocument[]>([]);
  const [squadSize, setSquadSize] = useState(0);
  const [viewers, setViewers] = useState<Record<string, DocumentViewer[]>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState<DbMatchDocument | null>(null);

  async function load() {
    setError("");
    try {
      const [docRows, players] = await Promise.all([fetchMatchDocuments(matchId), fetchPlayers()]);
      setDocs(docRows);
      setSquadSize((players as DbPlayer[]).length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load documents.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  async function loadViewers(documentId: string) {
    const rows = await fetchDocumentViewers(documentId);
    setViewers((prev) => ({ ...prev, [documentId]: rows }));
  }

  async function handleFile(file: File) {
    setUploading(true);
    setError("");
    try {
      await uploadMatchDocument(matchId, file);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload that document.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(d: DbMatchDocument) {
    if (!window.confirm(`Remove "${d.file_name}"?`)) return;
    await deleteMatchDocument(d.id, d.file_path);
    await load();
  }

  async function handleDownload(d: DbMatchDocument) {
    const url = await getMatchDocumentDownloadUrl(d.file_path, d.file_name);
    window.open(url, "_blank");
  }

  function toggleExpand(d: DbMatchDocument) {
    if (expandedId === d.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(d.id);
    if (!viewers[d.id]) loadViewers(d.id);
  }

  return (
    <Card>
      <CardHeader><CardTitle>Match Documents</CardTitle></CardHeader>
      <p className="mb-3 text-xs text-neutral-400">
        Upload the match pack or any other document for this fixture. Players can open it from their own portal
        login, and each one who has viewed it is tracked here — useful for confirming everyone&apos;s seen the details
        before matchday.
      </p>

      {docs.length === 0 ? (
        <p className="mb-3 text-sm text-neutral-400">No documents uploaded yet.</p>
      ) : (
        <ul className="mb-3 divide-y divide-white/10">
          {docs.map((d) => {
            const seenCount = viewers[d.id]?.length ?? 0;
            const expanded = expandedId === d.id;
            return (
              <li key={d.id} className="py-2.5">
                <div className="flex items-center gap-2.5 text-sm">
                  <FileText size={14} className="shrink-0 text-neutral-400" />
                  <span className="flex-1 truncate">{d.file_name}</span>
                  <button
                    onClick={() => toggleExpand(d)}
                    className="flex items-center gap-1 rounded-full bg-navy-600 dark:bg-navy-800 px-2.5 py-1 text-xs text-neutral-300 hover:text-white"
                    title="See who's opened this"
                  >
                    <Eye size={12} /> {expanded ? seenCount : "Seen by"}{expanded ? ` / ${squadSize}` : ""}
                  </button>
                  <button onClick={() => setViewing(d)} title="View" className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white">
                    <Maximize2 size={13} />
                  </button>
                  <button onClick={() => handleDownload(d)} title="Download" className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white">
                    <Download size={13} />
                  </button>
                  <button onClick={() => handleDelete(d)} title="Remove" className="flex h-7 w-7 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10">
                    <Trash2 size={13} />
                  </button>
                </div>
                {expanded && (
                  <div className="mt-2.5 ml-6 rounded-xl border border-white/10 bg-navy-600/40 dark:bg-navy-800/40 p-3">
                    {(viewers[d.id]?.length ?? 0) === 0 ? (
                      <p className="text-sm text-neutral-400">No one has opened this yet.</p>
                    ) : (
                      <ul className="space-y-1">
                        {viewers[d.id].map((v) => (
                          <li key={v.player_id} className="flex items-center justify-between text-sm">
                            <span className="text-neutral-200">{v.player_name}</span>
                            <span className="text-xs text-neutral-500">{new Date(v.viewed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="mb-3 text-sm text-red-300">{error}</p>}

      <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors">
        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        {uploading ? "Uploading…" : "Upload Document"}
        <input
          type="file"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </label>

      {viewing && (
        <DocumentViewerModal
          fileName={viewing.file_name}
          fileType={viewing.file_type}
          getViewUrl={() => getMatchDocumentUrl(viewing.file_path)}
          getDownloadUrl={() => getMatchDocumentDownloadUrl(viewing.file_path, viewing.file_name)}
          onClose={() => setViewing(null)}
        />
      )}
    </Card>
  );
}
