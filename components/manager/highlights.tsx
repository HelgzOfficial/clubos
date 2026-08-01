"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { TeamCrest } from "@/components/team-crest";
import type { CrestLookup } from "@/lib/team-crests-db";
import { YouTubePlayer } from "@/components/analysis/youtube-player";
import { fetchAllClips, type DbClip } from "@/lib/clips-db";
import { playedMatches, type DbMatch } from "@/lib/matches-db";
import { youTubeThumbnailUrl } from "@/lib/youtube";
import { Play, Film, ExternalLink } from "lucide-react";

type MatchHighlights = { match: DbMatch; clips: DbClip[] };

function resultOf(m: DbMatch): { letter: string; tone: string } | null {
  if (m.home_score === null || m.away_score === null) return null;
  const gf = m.is_home ? m.home_score : m.away_score;
  const ga = m.is_home ? m.away_score : m.home_score;
  if (gf > ga) return { letter: "W", tone: "bg-emerald-500 text-white" };
  if (gf < ga) return { letter: "L", tone: "bg-red-500 text-white" };
  return { letter: "D", tone: "bg-amber-400 text-navy-950" };
}

// Every YouTube link that's been attached to a fixture, gathered in one place
// and grouped by match. The links themselves are added in Match Centre, on
// each fixture's Highlights card — this doesn't introduce a second place to
// upload them, it just saves a manager opening fifteen fixtures one at a time
// to find the footage.
export function ManagerHighlights({
  matches,
  crestLookup,
}: {
  matches: DbMatch[];
  crestLookup: CrestLookup | null;
}) {
  const [clips, setClips] = useState<DbClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState<{ title: string; videoId: string } | null>(null);

  useEffect(() => {
    fetchAllClips()
      .then((c) => setClips(c))
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "";
        setError(
          /relation|does not exist|schema cache/i.test(msg)
            ? "The clip library isn't set up in Supabase yet."
            : msg || "Couldn't load highlights."
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const youtubeClips = useMemo(
    () => clips.filter((c) => c.source === "youtube" && c.youtube_id),
    [clips]
  );

  // Only fixtures that have actually been played — a highlights reel for a
  // game that hasn't kicked off yet would be a data-entry mistake, not
  // something worth showing.
  const grouped: MatchHighlights[] = useMemo(() => {
    const played = playedMatches(matches);
    return played
      .map((match) => ({ match, clips: youtubeClips.filter((c) => c.match_id === match.id) }))
      .filter((g) => g.clips.length > 0);
  }, [matches, youtubeClips]);

  // Worth saying out loud rather than silently omitting them, because "why
  // isn't my video here" is otherwise impossible for a manager to work out.
  const unlinked = youtubeClips.filter((c) => !c.match_id).length;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Highlights</CardTitle>
          {grouped.length > 0 && (
            <span className="text-sm text-neutral-400 tabular-nums">
              {grouped.length} {grouped.length === 1 ? "fixture" : "fixtures"}
            </span>
          )}
        </CardHeader>

        {error && (
          <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-neutral-400">Loading…</p>
        ) : grouped.length === 0 ? (
          <p className="text-sm text-neutral-400">
            No YouTube highlights linked to a played fixture yet. Add them from Match Centre — open a fixture and use
            the Highlights card to paste the link.
          </p>
        ) : (
          <div className="space-y-5">
            {grouped.map(({ match, clips: matchClips }) => {
              const result = resultOf(match);
              const gf = match.is_home ? match.home_score : match.away_score;
              const ga = match.is_home ? match.away_score : match.home_score;
              return (
                <div key={match.id}>
                  <div className="mb-2 flex items-center gap-2.5">
                    <TeamCrest name={match.opponent} size="sm" lookup={crestLookup} />
                    <Link
                      href={`/matches/${match.id}#highlights`}
                      className="min-w-0 flex-1 truncate text-sm font-medium hover:text-club-primary"
                    >
                      {match.is_home ? "vs" : "@"} {match.opponent}
                    </Link>
                    {result && (
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${result.tone}`}>
                        {result.letter}
                      </span>
                    )}
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-neutral-300">
                      {gf !== null && ga !== null ? `${gf}-${ga}` : "—"}
                    </span>
                    <span className="w-16 shrink-0 text-right text-[11px] text-neutral-500">
                      {new Date(match.kickoff).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {matchClips.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => c.youtube_id && setPlaying({ title: c.title, videoId: c.youtube_id })}
                        className="group touch-manipulation overflow-hidden rounded-xl border border-white/10 text-left transition-colors hover:border-club-primary/50"
                      >
                        <span className="relative block w-full bg-black" style={{ aspectRatio: "16/9" }}>
                          {/* Straight <img>: these are YouTube's own CDN
                              thumbnails, not files we host, so there's nothing
                              for next/image to optimise. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={youTubeThumbnailUrl(c.youtube_id as string)}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
                          />
                          <span className="absolute inset-0 flex items-center justify-center">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm">
                              <Play size={15} />
                            </span>
                          </span>
                        </span>
                        <span className="block px-2 py-1.5">
                          <span className="block truncate text-[11px] font-medium leading-tight">{c.title}</span>
                          {c.category && (
                            <span className="mt-0.5 block truncate text-[10px] text-neutral-500">{c.category}</span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {unlinked > 0 && (
          <p className="mt-4 flex items-start gap-1.5 text-xs text-neutral-500">
            <Film size={13} className="mt-0.5 shrink-0" />
            <span>
              {unlinked} more YouTube {unlinked === 1 ? "clip isn't" : "clips aren't"} attached to a fixture, so
              {unlinked === 1 ? " it doesn't" : " they don't"} appear here.{" "}
              <Link href="/analysis" className="inline-flex items-center gap-1 text-neutral-400 underline underline-offset-2 hover:text-white">
                Analysis library <ExternalLink size={10} />
              </Link>
            </span>
          </p>
        )}
      </Card>

      {playing && (
        <YouTubePlayer title={playing.title} videoId={playing.videoId} onClose={() => setPlaying(null)} />
      )}
    </>
  );
}
