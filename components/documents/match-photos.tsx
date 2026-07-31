"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Trash2, X, Loader2, ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import { fetchMatches, type DbMatch } from "@/lib/matches-db";
import {
  fetchMatchPhotos, uploadMatchPhoto, deleteMatchPhoto,
  type DbMatchPhoto,
} from "@/lib/match-photos-db";

function matchLabel(matches: DbMatch[], matchId: string | null): string | null {
  if (!matchId) return null;
  const m = matches.find((x) => x.id === matchId);
  if (!m) return null;
  const date = new Date(m.kickoff).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${m.is_home ? "vs" : "@"} ${m.opponent} · ${date}`;
}

// The club's match photography. One component covers the full gallery in
// Documents and the read-only strips on both dashboards, so there's a single
// place that knows how a photo is displayed.
export function MatchPhotos({
  canEdit = false,
  limit,
  compact = false,
  uploadedBy = null,
}: {
  canEdit?: boolean;
  // Cap for the dashboard strips; omit for the full gallery.
  limit?: number;
  // compact renders a horizontal scrolling strip instead of a grid.
  compact?: boolean;
  uploadedBy?: string | null;
}) {
  const [photos, setPhotos] = useState<DbMatchPhoto[]>([]);
  const [matches, setMatches] = useState<DbMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [pendingMatchId, setPendingMatchId] = useState("");
  const [pendingCaption, setPendingCaption] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [p, m] = await Promise.all([fetchMatchPhotos(limit ?? 200), fetchMatches()]);
      setPhotos(p);
      setMatches(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load photos.");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => { load(); }, [load]);

  // Uploading several at once is the normal case after a game, so the picker
  // accepts multiple and they're sent one at a time with visible progress.
  async function handleFiles(files: FileList) {
    setUploading(true);
    setError("");
    const list = Array.from(files);
    try {
      for (let i = 0; i < list.length; i++) {
        setProgress(`Uploading ${i + 1} of ${list.length}…`);
        await uploadMatchPhoto({
          file: list[i],
          matchId: pendingMatchId || null,
          caption: pendingCaption,
          uploadedBy,
        });
      }
      setPendingCaption("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload those photos.");
    } finally {
      setUploading(false);
      setProgress("");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(photo: DbMatchPhoto) {
    if (!window.confirm("Delete this photo?")) return;
    try {
      await deleteMatchPhoto(photo);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      setLightboxIndex(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete that photo.");
    }
  }

  const shown = limit ? photos.slice(0, limit) : photos;

  if (loading) return <p className="py-4 text-sm text-neutral-400">Loading photos…</p>;

  return (
    <div>
      {canEdit && (
        <div className="mb-4 rounded-xl border border-white/10 p-3">
          <p className="mb-2 text-xs text-neutral-400">
            Add photos from a match. Pick a fixture to file them against, or leave it blank for general club photos.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={pendingMatchId}
              onChange={(e) => setPendingMatchId(e.target.value)}
              className="flex-1 rounded-lg border border-white/10 bg-navy-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
            >
              <option value="">No fixture</option>
              {matches.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.is_home ? "vs" : "@"} {m.opponent} · {new Date(m.kickoff).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </option>
              ))}
            </select>
            <input
              value={pendingCaption}
              onChange={(e) => setPendingCaption(e.target.value)}
              placeholder="Caption (optional)"
              className="flex-1 rounded-lg border border-white/10 bg-navy-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
            />
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex shrink-0 touch-manipulation items-center justify-center gap-1.5 rounded-lg bg-club-primary px-3 py-2 text-sm font-medium text-navy-950 disabled:opacity-60"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? progress || "Uploading…" : "Add photos"}
            </button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/heic"
            multiple
            className="hidden"
            onChange={(e) => e.target.files?.length && handleFiles(e.target.files)}
          />
        </div>
      )}

      {error && <p className="mb-2 text-xs text-red-300">{error}</p>}

      {shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <ImageIcon size={22} className="mb-2 text-neutral-500" />
          <p className="text-sm text-neutral-400">No match photos yet.</p>
        </div>
      ) : compact ? (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 touch-pan-x">
          {shown.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setLightboxIndex(i)}
              className="h-24 w-32 shrink-0 touch-manipulation overflow-hidden rounded-xl border border-white/10"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.photo_url} alt={p.caption ?? p.file_name} loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((p, i) => (
            <div key={p.id} className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10">
              <button onClick={() => setLightboxIndex(i)} className="h-full w-full touch-manipulation">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.photo_url} alt={p.caption ?? p.file_name} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
              </button>
              {(p.caption || p.match_id) && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="truncate text-[11px] text-white">
                    {p.caption ?? matchLabel(matches, p.match_id)}
                  </p>
                </div>
              )}
              {canEdit && (
                <button
                  onClick={() => handleDelete(p)}
                  aria-label="Delete photo"
                  className="absolute right-1.5 top-1.5 flex h-7 w-7 touch-manipulation items-center justify-center rounded-full bg-black/60 text-red-300 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {lightboxIndex !== null && shown[lightboxIndex] && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black/90" onClick={() => setLightboxIndex(null)}>
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <p className="min-w-0 truncate text-sm">
              {shown[lightboxIndex].caption ?? matchLabel(matches, shown[lightboxIndex].match_id) ?? shown[lightboxIndex].file_name}
            </p>
            <button onClick={() => setLightboxIndex(null)} aria-label="Close" className="ml-3 shrink-0 rounded-full p-1 hover:bg-white/10">
              <X size={20} />
            </button>
          </div>
          <div className="relative flex flex-1 items-center justify-center p-2" onClick={(e) => e.stopPropagation()}>
            {lightboxIndex > 0 && (
              <button
                onClick={() => setLightboxIndex(lightboxIndex - 1)}
                aria-label="Previous"
                className="absolute left-2 flex h-10 w-10 touch-manipulation items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shown[lightboxIndex].photo_url}
              alt={shown[lightboxIndex].caption ?? shown[lightboxIndex].file_name}
              className="max-h-full max-w-full object-contain"
            />
            {lightboxIndex < shown.length - 1 && (
              <button
                onClick={() => setLightboxIndex(lightboxIndex + 1)}
                aria-label="Next"
                className="absolute right-2 flex h-10 w-10 touch-manipulation items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
              >
                <ChevronRight size={20} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
