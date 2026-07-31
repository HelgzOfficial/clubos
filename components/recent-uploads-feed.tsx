"use client";

import { useEffect, useState } from "react";
import { Film, PlayCircle, Image as ImageIcon, FileText, Paperclip, Camera } from "lucide-react";
import { fetchRecentUploads, type RecentUpload, type RecentUploadKind } from "@/lib/recent-uploads-db";
import { getClipUrl } from "@/lib/clips-db";
import { getAnnotatedImageUrl } from "@/lib/annotated-images-db";
import { getClubDocumentUrl, getClubDocumentDownloadUrl } from "@/lib/club-documents-db";
import { getMatchDocumentUrl, getMatchDocumentDownloadUrl } from "@/lib/match-documents-db";
import { VideoPlayer } from "@/components/analysis/video-player";
import { YouTubePlayer } from "@/components/analysis/youtube-player";
import { DocumentViewerModal } from "@/components/document-viewer-modal";
import type { Clip } from "@/lib/analysis-types";

// Partial + fallback rather than exhaustive Records: these maps live in a
// different file from RecentUploadKind, so an exhaustive one meant adding a
// new upload kind broke the build here until this file was changed too.
const kindIcon: Partial<Record<RecentUploadKind, typeof Film>> = {
  clip: Film,
  youtube: PlayCircle,
  image: ImageIcon,
  photo: Camera,
  "club-document": FileText,
  "match-document": Paperclip,
};

const kindTint: Partial<Record<RecentUploadKind, string>> = {
  clip: "text-club-primary",
  youtube: "text-red-400",
  image: "text-blue-400",
  photo: "text-amber-400",
  "club-document": "text-neutral-400",
  "match-document": "text-emerald-400",
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// The newest clips, images and documents from anywhere in ClubOS, in one list,
// each opening in the right viewer. Shared by the desktop dashboard and the
// player companion app so both stay in step automatically.
export function RecentUploadsFeed({ limit = 8, compact = false }: { limit?: number; compact?: boolean }) {
  const [items, setItems] = useState<RecentUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [playingClip, setPlayingClip] = useState<Clip | null>(null);
  const [playingYouTube, setPlayingYouTube] = useState<{ title: string; videoId: string } | null>(null);
  const [viewingDoc, setViewingDoc] = useState<RecentUpload | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchRecentUploads(limit)
      .then((r) => { if (!cancelled) setItems(r); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load recent uploads."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [limit]);

  async function open(item: RecentUpload) {
    try {
      if (item.kind === "youtube" && item.youtubeId) {
        setPlayingYouTube({ title: item.title, videoId: item.youtubeId });
        return;
      }
      if (item.kind === "clip" && item.filePath) {
        const url = await getClipUrl(item.filePath);
        setPlayingClip({ id: item.id, title: item.title, url, tags: item.subtitle ? [item.subtitle] : [], addedAt: item.createdAt });
        return;
      }
      // Images and both document kinds all go through the shared viewer.
      setViewingDoc(item);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open that file.");
    }
  }

  // The viewer needs a per-kind way to resolve view/download URLs.
  function viewUrlFor(item: RecentUpload): () => Promise<string> {
    if (item.kind === "photo") return async () => item.filePath!;
    if (item.kind === "image") return () => getAnnotatedImageUrl(item.filePath!);
    if (item.kind === "club-document") return () => getClubDocumentUrl(item.filePath!);
    return () => getMatchDocumentUrl(item.filePath!);
  }
  function downloadUrlFor(item: RecentUpload): () => Promise<string> {
    if (item.kind === "photo") return async () => item.filePath!;
    if (item.kind === "image") return () => getAnnotatedImageUrl(item.filePath!);
    if (item.kind === "club-document") return () => getClubDocumentDownloadUrl(item.filePath!, item.fileName ?? item.title);
    return () => getMatchDocumentDownloadUrl(item.filePath!, item.fileName ?? item.title);
  }

  return (
    <>
      {loading ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-neutral-400">Nothing uploaded yet — clips, images and documents will appear here.</p>
      ) : (
        <ul className="divide-y divide-white/10">
          {items.map((item) => {
            const Icon = kindIcon[item.kind] ?? FileText;
            return (
              <li key={item.id}>
                <button
                  onClick={() => open(item)}
                  className={`flex w-full items-center gap-3 text-left transition-colors hover:text-club-primary ${compact ? "py-2" : "py-2.5"}`}
                >
                  <Icon size={compact ? 14 : 16} className={`shrink-0 ${kindTint[item.kind] ?? "text-neutral-400"}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate font-medium ${compact ? "text-xs" : "text-sm"}`}>{item.title}</span>
                    {item.subtitle && <span className="block truncate text-[11px] text-neutral-500">{item.subtitle}</span>}
                  </span>
                  <span className="shrink-0 text-[11px] text-neutral-500">{relativeTime(item.createdAt)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {playingClip && <VideoPlayer clip={playingClip} onClose={() => setPlayingClip(null)} />}
      {playingYouTube && (
        <YouTubePlayer title={playingYouTube.title} videoId={playingYouTube.videoId} onClose={() => setPlayingYouTube(null)} />
      )}
      {viewingDoc && viewingDoc.filePath && (
        <DocumentViewerModal
          fileName={viewingDoc.fileName ?? viewingDoc.title}
          fileType={viewingDoc.fileType ?? ""}
          getViewUrl={viewUrlFor(viewingDoc)}
          getDownloadUrl={downloadUrlFor(viewingDoc)}
          onClose={() => setViewingDoc(null)}
        />
      )}
    </>
  );
}
