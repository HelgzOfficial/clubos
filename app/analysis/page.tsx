"use client";

import { useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VideoPlayer } from "@/components/analysis/video-player";
import { nextAnalysisId, type Clip, type Playlist } from "@/lib/analysis-types";
import { Upload, Film, PlayCircle, ListPlus, Trash2, Plus, X, ListVideo } from "lucide-react";

export default function AnalysisPage() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activeClip, setActiveClip] = useState<Clip | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingTitle, setPendingTitle] = useState("");
  const [pendingTags, setPendingTags] = useState("");
  const [addingToClip, setAddingToClip] = useState<Clip | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChosen(file: File) {
    setPendingFile(file);
    setPendingTitle(file.name.replace(/\.[^.]+$/, ""));
    setPendingTags("");
  }

  function confirmUpload() {
    if (!pendingFile) return;
    const clip: Clip = {
      id: nextAnalysisId("clip"),
      title: pendingTitle.trim() || pendingFile.name,
      url: URL.createObjectURL(pendingFile),
      tags: pendingTags.split(",").map((t) => t.trim()).filter(Boolean),
      addedAt: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    };
    setClips((prev) => [clip, ...prev]);
    setPendingFile(null);
    setPendingTitle("");
    setPendingTags("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function deleteClip(id: string) {
    setClips((prev) => prev.filter((c) => c.id !== id));
    setPlaylists((prev) => prev.map((p) => ({ ...p, clipIds: p.clipIds.filter((cid) => cid !== id) })));
  }

  function createPlaylist() {
    if (!newPlaylistName.trim()) return;
    setPlaylists((prev) => [...prev, { id: nextAnalysisId("pl"), name: newPlaylistName.trim(), clipIds: [] }]);
    setNewPlaylistName("");
    setShowNewPlaylist(false);
  }

  function addClipToPlaylist(playlistId: string) {
    if (!addingToClip) return;
    setPlaylists((prev) =>
      prev.map((p) =>
        p.id === playlistId && !p.clipIds.includes(addingToClip.id)
          ? { ...p, clipIds: [...p.clipIds, addingToClip.id] }
          : p
      )
    );
    setAddingToClip(null);
  }

  function removeClipFromPlaylist(playlistId: string, clipId: string) {
    setPlaylists((prev) =>
      prev.map((p) => (p.id === playlistId ? { ...p, clipIds: p.clipIds.filter((id) => id !== clipId) } : p))
    );
  }

  function deletePlaylist(id: string) {
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Analysis</h1>
          <p className="text-sm text-neutral-500">Clip library, telestration, and playlists.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-xl bg-club-primary text-navy-950 px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Upload size={15} /> Upload Clip
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,.mp4,.mov"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileChosen(e.target.files[0])}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Clip Library</CardTitle>
              <span className="text-xs text-neutral-400">{clips.length} clip{clips.length === 1 ? "" : "s"}</span>
            </CardHeader>

            {clips.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Film size={28} className="mb-3 text-neutral-300 dark:text-neutral-600" />
                <p className="font-medium">No clips yet</p>
                <p className="mt-1 max-w-xs text-sm text-neutral-400">
                  Upload match or training footage (MP4/MOV) to start building your clip library and analyse it with the drawing tools.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {clips.map((clip) => (
                  <div key={clip.id} className="overflow-hidden rounded-xl border border-white/10">
                    <div className="relative aspect-video bg-black">
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <video src={clip.url} className="h-full w-full object-cover opacity-80" muted preload="metadata" />
                      <button
                        onClick={() => setActiveClip(clip)}
                        className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors"
                      >
                        <PlayCircle size={36} className="text-white" />
                      </button>
                    </div>
                    <div className="p-3">
                      <p className="truncate text-sm font-medium">{clip.title}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">Added {clip.addedAt}</p>
                      {clip.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {clip.tags.map((t) => (
                            <Badge key={t} variant="neutral">{t}</Badge>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => setAddingToClip(clip)}
                          className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors"
                        >
                          <ListPlus size={12} /> Add to Playlist
                        </button>
                        <button
                          onClick={() => deleteClip(clip.id)}
                          className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <p className="mt-4 text-xs text-neutral-400">
            Uploaded clips are stored in this browser session only for now — they'll disappear on refresh until we connect permanent
            storage (Supabase).
          </p>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Playlists</CardTitle>
              <button
                onClick={() => setShowNewPlaylist((v) => !v)}
                className="flex items-center gap-1.5 rounded-xl bg-club-primary text-navy-950 px-3 py-1.5 text-xs font-medium hover:opacity-90 transition-opacity"
              >
                <Plus size={13} /> New
              </button>
            </CardHeader>

            {showNewPlaylist && (
              <div className="mb-4 flex gap-2">
                <input
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="Playlist name"
                  className="flex-1 rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                  onKeyDown={(e) => e.key === "Enter" && createPlaylist()}
                />
                <button
                  onClick={createPlaylist}
                  className="rounded-xl bg-club-primary text-navy-950 px-3 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Add
                </button>
              </div>
            )}

            {playlists.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <ListVideo size={24} className="mb-2 text-neutral-300 dark:text-neutral-600" />
                <p className="text-sm text-neutral-400">No playlists yet. Group clips together for a session or opposition review.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {playlists.map((p) => (
                  <div key={p.id} className="rounded-xl border border-white/10 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-medium">{p.name}</p>
                      <button
                        onClick={() => deletePlaylist(p.id)}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    {p.clipIds.length === 0 ? (
                      <p className="text-xs text-neutral-400">No clips added yet.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {p.clipIds.map((cid) => {
                          const clip = clips.find((c) => c.id === cid);
                          if (!clip) return null;
                          return (
                            <li key={cid} className="flex items-center gap-2 text-xs">
                              <button onClick={() => setActiveClip(clip)} className="flex-1 truncate text-left hover:text-club-primary">
                                {clip.title}
                              </button>
                              <button
                                onClick={() => removeClipFromPlaylist(p.id, cid)}
                                className="text-neutral-400 hover:text-red-400"
                              >
                                <X size={12} />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {activeClip && <VideoPlayer clip={activeClip} onClose={() => setActiveClip(null)} />}

      {pendingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-sm">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-medium">Upload clip</p>
              <button onClick={() => setPendingFile(null)} className="text-neutral-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-500">Title</label>
            <input
              value={pendingTitle}
              onChange={(e) => setPendingTitle(e.target.value)}
              className="mb-4 w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
            />
            <label className="mb-1.5 block text-xs font-medium text-neutral-500">Tags (comma separated)</label>
            <input
              value={pendingTags}
              onChange={(e) => setPendingTags(e.target.value)}
              placeholder="e.g. set-piece, opposition, first-half"
              className="mb-5 w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
            />
            <button
              onClick={confirmUpload}
              className="w-full rounded-xl bg-club-primary text-navy-950 px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Add to Library
            </button>
          </Card>
        </div>
      )}

      {addingToClip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-sm">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-medium truncate">Add "{addingToClip.title}" to…</p>
              <button onClick={() => setAddingToClip(null)} className="text-neutral-400 hover:text-white shrink-0">
                <X size={18} />
              </button>
            </div>
            {playlists.length === 0 ? (
              <p className="text-sm text-neutral-400">You don't have any playlists yet. Create one first.</p>
            ) : (
              <ul className="space-y-2">
                {playlists.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => addClipToPlaylist(p.id)}
                      className="w-full rounded-xl border border-white/10 px-3 py-2 text-left text-sm hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors"
                    >
                      {p.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </AppShell>
  );
}
