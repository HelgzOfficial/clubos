"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { opposition, type Opposition } from "@/lib/sample-data";
import { fetchMatches, type DbMatch } from "@/lib/matches-db";
import {
  fetchOppositionReports, uploadOppositionReport, deleteOppositionReport, getOppositionReportDownloadUrl,
  type DbOppositionReport,
} from "@/lib/opposition-reports-db";
import Link from "next/link";
import {
  ArrowLeft, ShieldCheck, ShieldAlert, Target, Users, FileText,
  Upload, Trash2, Download, Loader2, Sparkles, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp,
} from "lucide-react";

const formColor: Record<string, string> = {
  W: "bg-emerald-500", D: "bg-amber-400", L: "bg-red-500",
};

const statusVariant = { "Not started": "neutral", "In progress": "amber", Ready: "green" } as const;

export default function OppositionDetailPage() {
  const params = useParams<{ id: string }>();
  const [team, setTeam] = useState<Opposition | null | undefined>(undefined);
  const [match, setMatch] = useState<DbMatch | null>(null);

  useEffect(() => {
    const found = opposition.find((o) => o.id === params.id) ?? null;
    setTeam(found);
    if (!found) return;

    // Find the next real fixture against this opponent from the Match Centre
    // (falls back to their most recent meeting if nothing's upcoming).
    fetchMatches().then((matches) => {
      const norm = (s: string) => s.trim().toLowerCase();
      const vsThem = matches.filter((m) => norm(m.opponent) === norm(found.name));
      const now = Date.now();
      const upcoming = vsThem
        .filter((m) => new Date(m.kickoff).getTime() >= now)
        .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())[0];
      const mostRecent = vsThem
        .filter((m) => new Date(m.kickoff).getTime() < now)
        .sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime())[0];
      setMatch(upcoming ?? mostRecent ?? null);
    });
  }, [params.id]);

  if (team === undefined) {
    return (
      <AppShell>
        <p className="text-sm text-neutral-400">Loading…</p>
      </AppShell>
    );
  }

  if (team === null) {
    return (
      <AppShell>
        <Link href="/opposition" className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-white">
          <ArrowLeft size={14} /> Back to Opposition
        </Link>
        <Card><p className="text-sm text-neutral-400">This scouting report couldn&apos;t be found.</p></Card>
      </AppShell>
    );
  }

  const now = Date.now();
  const isUpcoming = match ? new Date(match.kickoff).getTime() >= now : false;

  return (
    <AppShell>
      <Link href="/opposition" className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-white">
        <ArrowLeft size={14} /> Back to Opposition
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-600 dark:bg-navy-800 text-sm font-semibold shrink-0">
          {team.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold">{team.name}</h1>
          <p className="text-sm text-neutral-500">
            {team.formation} · {team.leaguePosition}
            {team.leaguePosition === 1 ? "st" : team.leaguePosition === 2 ? "nd" : team.leaguePosition === 3 ? "rd" : "th"} in league
            {match && (
              <>
                {" "}· {isUpcoming ? "Next meeting" : "Last meeting"} {new Date(match.kickoff).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                {match.venue ? ` (${match.venue})` : ""}
              </>
            )}
          </p>
        </div>
        <Badge variant={statusVariant[team.reportStatus]}>{team.reportStatus}</Badge>
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

        <Card>
          <CardHeader><CardTitle>Head-to-Head</CardTitle></CardHeader>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div><p className="text-lg font-semibold">{team.headToHead.played}</p><p className="text-xs text-neutral-400">Played</p></div>
            <div><p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{team.headToHead.won}</p><p className="text-xs text-neutral-400">Won</p></div>
            <div><p className="text-lg font-semibold text-amber-500">{team.headToHead.drawn}</p><p className="text-xs text-neutral-400">Drawn</p></div>
            <div><p className="text-lg font-semibold text-red-600 dark:text-red-400">{team.headToHead.lost}</p><p className="text-xs text-neutral-400">Lost</p></div>
          </div>
          <p className="mt-3 text-xs text-neutral-400">Last meeting: {team.lastMeeting.date} — {team.lastMeeting.result}</p>
        </Card>

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

        <div className="lg:col-span-3">
          <OppositionReportsCard opponentName={team.name} />
        </div>
      </div>
    </AppShell>
  );
}

function OppositionReportsCard({ opponentName }: { opponentName: string }) {
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
                  {r.summary_status === "ready" && (
                    <button
                      onClick={() => setExpandedId(expanded ? null : r.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white"
                      title={expanded ? "Hide summary" : "View summary"}
                    >
                      {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  )}
                  <button onClick={() => handleDownload(r)} title="Download" className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white">
                    <Download size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(r)}
                    disabled={deletingId === r.id}
                    title="Remove report"
                    className="flex h-7 w-7 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10 disabled:opacity-60"
                  >
                    {deletingId === r.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                </div>
                {expanded && r.ai_summary && (
                  <div className="mt-2.5 ml-6 rounded-xl border border-white/10 bg-navy-600/40 dark:bg-navy-800/40 p-3">
                    {r.ai_summary.split(/\n+/).filter(Boolean).map((line, i) => (
                      <p key={i} className="mb-1.5 last:mb-0 text-sm text-neutral-200 whitespace-pre-wrap">{line}</p>
                    ))}
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
