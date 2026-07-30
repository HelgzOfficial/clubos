"use client";

import { X, ExternalLink } from "lucide-react";
import { youTubeEmbedUrl, youTubeWatchUrl } from "@/lib/youtube";

// Plays a YouTube-linked clip in a modal. Deliberately separate from
// VideoPlayer: that one draws an annotation canvas over the video and grabs
// freeze frames off it, neither of which is possible over a YouTube iframe
// (it's cross-origin, so the frame can't be read). So this is playback only,
// plus a link out to YouTube itself.
export function YouTubePlayer({
  title, videoId, onClose,
}: {
  title: string;
  videoId: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4">
      <div className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-y-auto rounded-card border border-white/10 bg-navy-700 dark:bg-navy-900 p-4 shadow-softDark">
        <div className="mb-3 flex items-center gap-3">
          <p className="min-w-0 flex-1 truncate font-medium">{title}</p>
          <a
            href={youTubeWatchUrl(videoId)}
            target="_blank"
            rel="noopener noreferrer"
            title="Open on YouTube"
            className="flex shrink-0 items-center gap-1.5 text-xs text-neutral-400 hover:text-club-primary"
          >
            <ExternalLink size={13} /> YouTube
          </a>
          <button onClick={onClose} className="shrink-0 text-neutral-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="relative w-full shrink-0 overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "16/9" }}>
          <iframe
            src={youTubeEmbedUrl(videoId)}
            title={title}
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        <p className="mt-3 text-xs text-neutral-400">
          This clip is a YouTube link rather than an uploaded file, so the drawing tools and freeze-frame capture aren&apos;t
          available on it. Upload the video file itself if you need to annotate it.
        </p>
      </div>
    </div>
  );
}
