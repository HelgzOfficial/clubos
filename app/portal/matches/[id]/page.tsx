"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { fetchMatch, type DbMatch } from "@/lib/matches-db";
import { fetchMatchDetails, type DbLineupEntry, type DbGoal, type DbSubstitution } from "@/lib/match-details-db";
import {
  fetchMatchDocuments, getMatchDocumentUrl, getMatchDocumentDownloadUrl, type DbMatchDocument,
} from "@/lib/match-documents-db";
import { fetchClipsForMatch, getClipUrl, type DbClip } from "@/lib/clips-db";
import { DocumentViewerModal } from "@/components/document-viewer-modal";
import { VideoPlayer } from "@/components/analysis/video-player";
import { DirectionsLinks } from "@/components/directions-links";
import { Collapsible } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import type { Clip } from "@/lib/analysis-types";
import { ArrowLeft, FileText, Download, Users, Goal, RefreshCw, Film, Play } from "lucide-react";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// The companion app's own match detail view. Deliberately a separate page
// from the staff-facing /matches/[id]: portal players sign in by magic link
// and may have no app_users role at all, which means the gated staff route
// would just show them "No access set up yet". Everything under /portal is
// ungated, so this reaches them — and it's read-only by design.
export default function PortalMatchPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [match, setMatch] = useState<DbMatch | null>(null);
  const [lineup, setLineup] = useState<DbLineupEntry[]>([]);
  const [goals, setGoals] = useState<DbGoal[]>([]);
  const [subs, setSubs] = useState<DbSubstitution[]>([]);
  const [docs, setDocs] = useState<DbMatchDocument[]>([]);
  const [clips, setClips] = useState<DbClip[]>([]);
  const [viewing, setViewing] = useState<DbMatchDocument | null>(null);
  const [playingClip, setPlayingClip] = useState<Clip | null>(null);

  useEffect(() => {
    async function init() {
      if (!supabase) { setLoading(false); return; }
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user?.email) { router.replace("/portal/login"); return; }
      try {
        const [m, details, d, c] = await Promise.all([
          fetchMatch(params.id),
          fetchMatchDetails(params.id),
          fetchMatchDocuments(params.id),
          fetchClipsForMatch(params.id),
        ]);
        setMatch(m);
        setLineup(details.lineup);
        setGoals(details.goals);
        setSubs(details.substitutions);
        setDocs(d);
        setClips(c);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load this match.");
      } finally {
        setLoading(false);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handlePlayClip(c: DbClip) {
    const url = await getClipUrl(c.file_path);
    setPlayingClip({ id: c.id, title: c.title, url, tags: c.category ? [c.category] : [], addedAt: c.uploaded_at });
  }

  if (!supabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-800 dark:bg-navy-950 px-4 text-white">
        <p className="text-sm text-neutral-400">The companion app isn&apos;t connected yet.</p>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-800 dark:bg-navy-950 px-4 text-white">
        <p className="text-sm text-neutral-400">Loading…</p>
      </div>
    );
  }

  const starting = lineup.filter((l) => l.is_starting);
  const bench = lineup.filter((l) => !l.is_starting);
  const played = match?.status === "completed" && match.home_score !== null && match.away_score !== null;
  const gf = played && match ? (match.is_home ? match.home_score! : match.away_score!) : null;
  const ga = played && match ? (match.is_home ? match.away_score! : match.home_score!) : null;
  const result = gf !== null && ga !== null ? (gf > ga ? "Won" : gf < ga ? "Lost" : "Drew") : null;
  const resultVariant = result === "Won" ? "green" : result === "Lost" ? "red" : "amber";

  return (
    <div className="min-h-screen bg-navy-800 dark:bg-navy-950 pb-10 text-white">
      <div className="sticky top-0 z-20 border-b border-white/10 bg-navy-700/90 dark:bg-navy-950/90 backdrop-blur px-4 py-3.5">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Link href="/portal" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white transition-colors">
            <ArrowLeft size={17} />
          </Link>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">
            {match ? `${match.is_home ? "vs" : "@"} ${match.opponent}` : "Match"}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-4 px-4 pt-4">
        {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

        {!match ? (
          <p className="text-sm text-neutral-400">That match couldn&apos;t be found.</p>
        ) : (
          <>
            <div className="rounded-card border border-white/10 bg-navy-700 dark:bg-navy-900 p-4 text-center shadow-softDark">
              <p className="text-xs text-neutral-500">{match.competition}</p>
              <p className="mt-1 text-lg font-semibold">{match.is_home ? "vs" : "@"} {match.opponent}</p>
              {played ? (
                <>
                  <p className="mt-2 text-3xl font-bold tabular-nums">{gf} – {ga}</p>
                  <Badge variant={resultVariant} className="mt-2">{result}</Badge>
                </>
              ) : (
                <Badge variant="neutral" className="mt-2">{match.status}</Badge>
              )}
              <p className="mt-3 text-xs text-neutral-400">
                {formatDate(match.kickoff)} · {formatTime(match.kickoff)}{match.venue ? ` · ${match.venue}` : ""}
              </p>
              <div className="mt-2 flex justify-center"><DirectionsLinks venue={match.venue} /></div>
            </div>

            {goals.length > 0 && (
              <Collapsible title="Goals" icon={<Goal size={16} />} defaultOpen>
                <ul className="divide-y divide-white/10">
                  {goals.map((g) => (
                    <li key={g.id} className="flex items-center gap-3 py-2 text-sm">
                      <span className="w-9 shrink-0 tabular-nums text-xs text-neutral-500">{g.minute !== null ? `${g.minute}'` : "–"}</span>
                      <span className="min-w-0 flex-1 truncate">{g.scorer}{g.assist ? <span className="text-neutral-500"> (assist {g.assist})</span> : null}</span>
                      <Badge variant={g.team === "us" ? "green" : "neutral"} className="shrink-0">{g.team === "us" ? "Us" : match.opponent}</Badge>
                    </li>
                  ))}
                </ul>
              </Collapsible>
            )}

            {lineup.length > 0 && (
              <Collapsible title="Lineup" icon={<Users size={16} />}>
                {starting.length > 0 && (
                  <>
                    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500">Starting XI</p>
                    <ul className="mb-3 divide-y divide-white/10">
                      {starting.map((l) => (
                        <li key={l.id} className="flex items-center gap-3 py-1.5 text-sm">
                          <span className="w-6 shrink-0 tabular-nums text-xs text-neutral-500">{l.shirt_number ?? "–"}</span>
                          <span className="min-w-0 flex-1 truncate">{l.player_name}</span>
                          {l.position && <span className="shrink-0 text-xs text-neutral-500">{l.position}</span>}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {bench.length > 0 && (
                  <>
                    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500">Bench</p>
                    <ul className="divide-y divide-white/10">
                      {bench.map((l) => (
                        <li key={l.id} className="flex items-center gap-3 py-1.5 text-sm">
                          <span className="w-6 shrink-0 tabular-nums text-xs text-neutral-500">{l.shirt_number ?? "–"}</span>
                          <span className="min-w-0 flex-1 truncate">{l.player_name}</span>
                          {l.position && <span className="shrink-0 text-xs text-neutral-500">{l.position}</span>}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Collapsible>
            )}

            {subs.length > 0 && (
              <Collapsible title="Substitutions" icon={<RefreshCw size={16} />}>
                <ul className="divide-y divide-white/10">
                  {subs.map((s) => (
                    <li key={s.id} className="flex items-center gap-3 py-2 text-sm">
                      <span className="w-9 shrink-0 tabular-nums text-xs text-neutral-500">{s.minute !== null ? `${s.minute}'` : "–"}</span>
                      <span className="min-w-0 flex-1 truncate">
                        <span className="text-emerald-400">{s.player_on}</span>
                        <span className="text-neutral-500"> for </span>
                        <span className="text-red-400">{s.player_off}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Collapsible>
            )}

            {clips.length > 0 && (
              <Collapsible title="Highlights" icon={<Film size={16} />}>
                <div className="grid grid-cols-2 gap-2">
                  {clips.map((c) => (
                    <button key={c.id} onClick={() => handlePlayClip(c)} className="group relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-navy-800">
                      <Play size={20} className="text-neutral-400 group-hover:text-white transition-colors" />
                      <p className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-2 py-1 text-left text-[10px]">{c.title}</p>
                    </button>
                  ))}
                </div>
              </Collapsible>
            )}

            {docs.length > 0 && (
              <Collapsible title="Match Documents" icon={<FileText size={16} />}>
                <div className="space-y-1.5">
                  {docs.map((d) => (
                    <div key={d.id} className="flex w-full items-center gap-2 rounded-lg border border-white/10 px-2.5 py-2 text-left text-xs">
                      <button onClick={() => setViewing(d)} className="flex min-w-0 flex-1 items-center gap-1.5 hover:text-white transition-colors">
                        <FileText size={12} className="shrink-0 text-neutral-400" />
                        <span className="flex-1 truncate">{d.file_name}</span>
                      </button>
                      <button
                        onClick={async () => window.open(await getMatchDocumentDownloadUrl(d.file_path, d.file_name), "_blank")}
                        title="Download"
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white"
                      >
                        <Download size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </Collapsible>
            )}

            {goals.length === 0 && lineup.length === 0 && subs.length === 0 && clips.length === 0 && docs.length === 0 && (
              <p className="text-center text-sm text-neutral-400">No match details have been recorded for this fixture yet.</p>
            )}
          </>
        )}
      </div>

      {viewing && (
        <DocumentViewerModal
          fileName={viewing.file_name}
          fileType={viewing.file_type}
          getViewUrl={() => getMatchDocumentUrl(viewing.file_path)}
          getDownloadUrl={() => getMatchDocumentDownloadUrl(viewing.file_path, viewing.file_name)}
          onClose={() => setViewing(null)}
        />
      )}

      {playingClip && <VideoPlayer clip={playingClip} onClose={() => setPlayingClip(null)} sourceClipId={playingClip.id} />}
    </div>
  );
}
