"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VideoPlayer } from "@/components/analysis/video-player";
import { ImageAnnotator } from "@/components/analysis/image-annotator";
import {
  fetchAllClips, uploadClip, deleteClip, getClipUrl, CLIP_CATEGORIES, type DbClip, type ClipCategory,
} from "@/lib/clips-db";
import {
  fetchAnnotatedImages, uploadRawImage, deleteAnnotatedImage, getAnnotatedImageUrl, type DbAnnotatedImage,
} from "@/lib/annotated-images-db";
import { usePermissions } from "@/lib/permissions";
import type { Clip } from "@/lib/analysis-types";
import { ArrowLeft, Upload, Film, Image as ImageIcon, PlayCircle, Trash2, Loader2, X, Pencil } from "lucide-react";

export default function AnalysisLibraryPage() {
  const { canWrite } = usePermissions();
  const canEdit = canWrite("analysis");

  const [tab, setTab] = useState<"clips" | "images">("clips");
  const [clips, setClips] = useState<DbClip[]>([]);
  const [images, setImages] = useState<DbAnnotatedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<"All" | ClipCategory | "Uncategorised">("All");

  const [playing, setPlaying] = useState<Clip | null>(null);
  const [annotating, setAnnotating] = useState<{ url: string; title: string } | null>(null);

  const [pendingClipFile, setPendingClipFile] = useState<File | null>(null);
  const [pendingTitle, setPendingTitle] = useState("");
  const [pendingCategory, setPendingCategory] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const clipInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const [c, i] = await Promise.all([fetchAllClips(), fetchAnnotatedImages()]);
      setClips(c);
      setImages(i);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function handleClipChosen(file: File) {
    setPendingClipFile(file);
    setPendingTitle(file.name.replace(/\.[^.]+$/, ""));
    setPendingCategory("");
  }

  async function confirmClipUpload() {
    if (!pendingClipFile) return;
    setUploading(true);
    try {
      await uploadClip(pendingTitle, pendingClipFile, pendingCategory || null);
      setPendingClipFile(null);
      setPendingTitle("");
      setPendingCategory("");
      if (clipInputRef.current) clipInputRef.current.value = "";
      await load();
    } finally {
      setUploading(false);
    }
  }

  async function handleImageChosen(file: File) {
    setUploading(true);
    try {
      await uploadRawImage(file.name.replace(/\.[^.]+$/, ""), file);
      if (imageInputRef.current) imageInputRef.current.value = "";
      await load();
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteClip(c: DbClip) {
    if (!window.confirm(`Remove "${c.title}"?`)) return;
    await deleteClip(c.id, c.file_path);
    await load();
  }

  async function handleDeleteImage(img: DbAnnotatedImage) {
    if (!window.confirm(`Remove "${img.title}"?`)) return;
    await deleteAnnotatedImage(img.id, img.file_path);
    await load();
  }

  async function playClip(c: DbClip) {
    const url = await getClipUrl(c.file_path);
    setPlaying({ id: c.id, title: c.title, url, tags: c.category ? [c.category] : [], addedAt: c.uploaded_at });
  }

  async function annotateImage(img: DbAnnotatedImage) {
    const url = await getAnnotatedImageUrl(img.file_path);
    setAnnotating({ url, title: img.title });
  }

  const filteredClips = clips.filter((c) => {
    if (categoryFilter === "All") return true;
    if (categoryFilter === "Uncategorised") return !c.category;
    return c.category === categoryFilter;
  });

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/analysis" className="mb-1 flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors">
            <ArrowLeft size={12} /> Analyst Dashboard
          </Link>
          <h1 className="text-2xl font-semibold">Clip &amp; Image Library</h1>
          <p className="text-sm text-neutral-500">Upload footage and images, tag by phase of play, and mark them up.</p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => clipInputRef.current?.click()}
              className="flex items-center gap-2 rounded-xl bg-club-primary text-navy-950 px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Upload size={15} /> Upload Clip
            </button>
            <input ref={clipInputRef} type="file" accept="video/mp4,.mp4,.mov" className="hidden" onChange={(e) => e.target.files?.[0] && handleClipChosen(e.target.files[0])} />

            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors disabled:opacity-60"
            >
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <ImageIcon size={15} />}
              Upload Image
            </button>
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageChosen(e.target.files[0])} />
          </div>
        )}
      </div>

      <div className="mb-5 flex gap-1 rounded-xl bg-navy-600 dark:bg-navy-800 p-1 text-sm w-fit">
        {[{ v: "clips" as const, label: "Clips", icon: Film }, { v: "images" as const, label: "Images", icon: ImageIcon }].map((t) => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-medium transition-colors ${
              tab === t.v ? "bg-club-primary text-navy-950" : "text-neutral-400"
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : tab === "clips" ? (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {(["All", ...CLIP_CATEGORIES, "Uncategorised"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  categoryFilter === c ? "bg-club-primary text-navy-950" : "bg-navy-600 dark:bg-navy-800 text-neutral-500 hover:text-white"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {filteredClips.length === 0 ? (
            <Card>
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Film size={28} className="mb-3 text-neutral-300 dark:text-neutral-600" />
                <p className="font-medium">No clips here yet</p>
                <p className="mt-1 max-w-xs text-sm text-neutral-400">Upload match or training footage (MP4/MOV) and tag it by phase of play.</p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredClips.map((clip) => (
                <div key={clip.id} className="overflow-hidden rounded-xl border border-white/10">
                  <div className="relative flex aspect-video items-center justify-center bg-navy-800">
                    <button onClick={() => playClip(clip)} className="flex h-full w-full items-center justify-center hover:bg-black/20 transition-colors">
                      <PlayCircle size={32} className="text-white" />
                    </button>
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium">{clip.title}</p>
                    <p className="mt-0.5 text-xs text-neutral-400">{new Date(clip.uploaded_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                    {clip.category && <Badge variant="neutral" className="mt-2">{clip.category}</Badge>}
                    {canEdit && (
                      <button
                        onClick={() => handleDeleteClip(clip)}
                        className="mt-2 ml-auto flex h-7 w-7 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : images.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ImageIcon size={28} className="mb-3 text-neutral-300 dark:text-neutral-600" />
            <p className="font-medium">No images here yet</p>
            <p className="mt-1 max-w-xs text-sm text-neutral-400">Upload an image or save a video freeze-frame to start marking things up.</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {images.map((img) => (
            <ImageTile key={img.id} img={img} canEdit={canEdit} onAnnotate={() => annotateImage(img)} onDelete={() => handleDeleteImage(img)} />
          ))}
        </div>
      )}

      {playing && <VideoPlayer clip={playing} onClose={() => setPlaying(null)} sourceClipId={playing.id} onSaved={load} />}
      {annotating && (
        <ImageAnnotator imageUrl={annotating.url} title={annotating.title} onClose={() => setAnnotating(null)} onSaved={load} />
      )}

      {pendingClipFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-medium">Upload clip</p>
              <button onClick={() => setPendingClipFile(null)} className="text-neutral-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-500">Title</label>
            <input
              value={pendingTitle}
              onChange={(e) => setPendingTitle(e.target.value)}
              className="mb-4 w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
            />
            <label className="mb-1.5 block text-xs font-medium text-neutral-500">Category (optional)</label>
            <select
              value={pendingCategory}
              onChange={(e) => setPendingCategory(e.target.value)}
              className="mb-5 w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
            >
              <option value="">Uncategorised</option>
              {CLIP_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button
              onClick={confirmClipUpload}
              disabled={uploading}
              className="w-full rounded-xl bg-club-primary text-navy-950 px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {uploading ? "Uploading…" : "Add to Library"}
            </button>
          </Card>
        </div>
      )}
    </AppShell>
  );
}

function ImageTile({
  img, canEdit, onAnnotate, onDelete,
}: { img: DbAnnotatedImage; canEdit: boolean; onAnnotate: () => void; onDelete: () => void }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    getAnnotatedImageUrl(img.file_path).then(setUrl).catch(() => setUrl(null));
  }, [img.file_path]);

  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <button onClick={onAnnotate} className="relative block aspect-video w-full bg-navy-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url && <img src={url} alt={img.title} className="h-full w-full object-cover" />}
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-colors">
          <Pencil size={20} className="text-white opacity-0 hover:opacity-100 transition-opacity" />
        </span>
      </button>
      <div className="p-3">
        <p className="truncate text-sm font-medium">{img.title}</p>
        <p className="mt-0.5 text-xs text-neutral-400">{new Date(img.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
        {canEdit && (
          <button onClick={onDelete} className="mt-2 flex h-7 w-7 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10">
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
