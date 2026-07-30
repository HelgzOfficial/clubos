"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchMatches, type DbMatch } from "@/lib/matches-db";
import {
  fetchMatchPack, updateMatchPack, type DbMatchPack, type MatchPackItem,
} from "@/lib/match-packs-db";
import { fetchOppositionReports, type DbOppositionReport } from "@/lib/opposition-reports-db";
import { fetchHeadToHead, type DbHeadToHead } from "@/lib/opposition-head-to-head-db";
import { fetchAllClips, getClipUrl, type DbClip } from "@/lib/clips-db";
import { fetchAnnotatedImages, getAnnotatedImageUrl, type DbAnnotatedImage } from "@/lib/annotated-images-db";
import { VideoPlayer } from "@/components/analysis/video-player";
import { youTubeWatchUrl } from "@/lib/youtube";
import { usePermissions } from "@/lib/permissions";
import type { Clip } from "@/lib/analysis-types";
import {
  ArrowLeft, Film, Image as ImageIcon, Plus, Trash2, X, Printer, Users, ShieldCheck, Save, Check, Loader2,
} from "lucide-react";

export default function MatchPackDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { canWrite } = usePermissions();
  const canEdit = canWrite("analysis");

  const [pack, setPack] = useState<DbMatchPack | null>(null);
  const [match, setMatch] = useState<DbMatch | null>(null);
  const [reports, setReports] = useState<DbOppositionReport[]>([]);
  const [h2h, setH2h] = useState<DbHeadToHead | null>(null);
  const [clips, setClips] = useState<DbClip[]>([]);
  const [images, setImages] = useState<DbAnnotatedImage[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [showAddClip, setShowAddClip] = useState(false);
  const [showAddImage, setShowAddImage] = useState(false);
  const [playing, setPlaying] = useState<Clip | null>(null);
  const [viewingImage, setViewingImage] = useState<{ title: string; url: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [p, matches, allClips, allImages] = await Promise.all([
        fetchMatchPack(id),
        fetchMatches(),
        fetchAllClips(),
        fetchAnnotatedImages(),
      ]);
      setPack(p);
      setTitle(p?.title ?? "");
      setNotes(p?.notes ?? "");
      setClips(allClips);
      setImages(allImages);

      const m = p?.match_id ? matches.find((mm) => mm.id === p.match_id) ?? null : null;
      setMatch(m);

      if (m) {
        const [r, h] = await Promise.all([fetchOppositionReports(m.opponent), fetchHeadToHead(m.opponent)]);
        setReports(r);
        setH2h(h);
      } else {
        setReports([]);
        setH2h(null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSaveMeta() {
    if (!pack) return;
    setSaving(true);
    try {
      await updateMatchPack(pack.id, { title: title.trim() || pack.title, notes });
      setPack({ ...pack, title: title.trim() || pack.title, notes });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } finally {
      setSaving(false);
    }
  }

  async function persistItems(items: MatchPackItem[]) {
    if (!pack) return;
    setPack({ ...pack, items });
    await updateMatchPack(pack.id, { items });
  }

  function addClipItem(clip: DbClip) {
    if (!pack) return;
    const items: MatchPackItem[] = [...pack.items, { type: "clip", clipId: clip.id, caption: clip.title }];
    persistItems(items);
    setShowAddClip(false);
  }

  function addImageItem(image: DbAnnotatedImage) {
    if (!pack) return;
    const items: MatchPackItem[] = [...pack.items, { type: "image", imageId: image.id, caption: image.title }];
    persistItems(items);
    setShowAddImage(false);
  }

  function removeItem(index: number) {
    if (!pack) return;
    const items = pack.items.filter((_, i) => i !== index);
    persistItems(items);
  }

  function updateCaption(index: number, caption: string) {
    if (!pack) return;
    const items = pack.items.map((it, i) => (i === index ? { ...it, caption } : it));
    setPack({ ...pack, items });
  }

  function commitCaption(index: number) {
    if (!pack) return;
    persistItems(pack.items);
  }

  async function openItem(item: MatchPackItem) {
    if (item.type === "clip") {
      const c = clips.find((cc) => cc.id === item.clipId);
      if (!c) return;
      if (c.source === "youtube" && c.youtube_id) {
        window.open(youTubeWatchUrl(c.youtube_id), "_blank");
        return;
      }
      const url = await getClipUrl(c.file_path);
      setPlaying({ id: c.id, title: c.title, url, tags: c.category ? [c.category] : [], addedAt: c.uploaded_at });
    } else {
      const img = images.find((ii) => ii.id === item.imageId);
      if (!img) return;
      const url = await getAnnotatedImageUrl(img.file_path);
      setViewingImage({ title: img.title, url });
    }
  }

  function itemLabel(item: MatchPackItem): string {
    if (item.type === "clip") return clips.find((c) => c.id === item.clipId)?.title ?? "Clip";
    return images.find((i) => i.id === item.imageId)?.title ?? "Image";
  }

  const availableClips = useMemo(
    () => clips.filter((c) => !pack?.items.some((it) => it.type === "clip" && it.clipId === c.id)),
    [clips, pack]
  );
  const availableImages = useMemo(
    () => images.filter((i) => !pack?.items.some((it) => it.type === "image" && it.imageId === i.id)),
    [images, pack]
  );

  if (loading) {
    return (
      <AppShell>
        <p className="text-sm text-neutral-400">Loading…</p>
      </AppShell>
    );
  }

  if (!pack) {
    return (
      <AppShell>
        <p className="text-sm text-neutral-400">Match pack not found.</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="print:hidden mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/analysis/match-packs" className="mb-1 flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors">
            <ArrowLeft size={12} /> Match Packs
          </Link>
          <h1 className="text-2xl font-semibold">{pack.title}</h1>
          {match && (
            <p className="text-sm text-neutral-500">
              {match.is_home ? "vs" : "@"} {match.opponent} — {new Date(match.kickoff).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          )}
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors"
        >
          <Printer size={15} /> Export / Print PDF
        </button>
      </div>

      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-semibold">{pack.title}</h1>
        {match && (
          <p className="text-sm text-neutral-600">
            {match.is_home ? "vs" : "@"} {match.opponent} — {new Date(match.kickoff).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader><CardTitle>Title &amp; Tactical Notes</CardTitle></CardHeader>
            <div className="print:hidden">
              <label className="mb-1.5 block text-xs font-medium text-neutral-500">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!canEdit}
                className="mb-4 w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 disabled:opacity-60"
              />
              <label className="mb-1.5 block text-xs font-medium text-neutral-500">Notes / written analysis</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={!canEdit}
                rows={8}
                placeholder="Formation, key threats, set-piece routines, instructions…"
                className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 disabled:opacity-60"
              />
              {canEdit && (
                <button
                  onClick={handleSaveMeta}
                  disabled={saving}
                  className="mt-3 flex items-center gap-1.5 rounded-xl bg-club-primary text-navy-950 px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Save size={14} />}
                  {saving ? "Saving…" : saved ? "Saved" : "Save"}
                </button>
              )}
            </div>
            <div className="hidden print:block whitespace-pre-wrap text-sm">{notes || "No notes added."}</div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between print:hidden">
              <CardTitle>Clips &amp; Annotated Images</CardTitle>
              {canEdit && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddClip(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-medium hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors"
                  >
                    <Film size={13} /> Add Clip
                  </button>
                  <button
                    onClick={() => setShowAddImage(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-medium hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors"
                  >
                    <ImageIcon size={13} /> Add Image
                  </button>
                </div>
              )}
            </div>
            {pack.items.length === 0 ? (
              <p className="py-6 text-center text-sm text-neutral-400 print:hidden">No clips or images added yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {pack.items.map((item, i) => (
                  <li key={`${item.type}-${i}`} className="flex items-center gap-3 rounded-xl border border-white/10 p-2.5">
                    <button
                      onClick={() => openItem(item)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-600 dark:bg-navy-800 text-club-primary print:hidden"
                    >
                      {item.type === "clip" ? <Film size={14} /> : <ImageIcon size={14} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-neutral-400 print:hidden">{itemLabel(item)}</p>
                      <input
                        value={item.caption}
                        onChange={(e) => updateCaption(i, e.target.value)}
                        onBlur={() => commitCaption(i)}
                        disabled={!canEdit}
                        className="w-full bg-transparent text-sm outline-none disabled:opacity-80 print:hidden"
                        placeholder="Caption…"
                      />
                      <p className="hidden print:block text-sm">{item.caption || itemLabel(item)}</p>
                    </div>
                    {canEdit && (
                      <button onClick={() => removeItem(i)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10 print:hidden">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-1.5"><ShieldCheck size={14} /> Opposition Reports</CardTitle></CardHeader>
            {!match ? (
              <p className="text-sm text-neutral-400">Link a fixture to this pack to pull in opposition info automatically.</p>
            ) : reports.length === 0 ? (
              <p className="text-sm text-neutral-400">
                No opposition reports uploaded for {match.opponent} yet. Upload one from the{" "}
                <Link href="/opposition" className="text-club-primary hover:underline">Opposition</Link> page.
              </p>
            ) : (
              <div className="space-y-3">
                {reports.slice(0, 2).map((r) => (
                  <div key={r.id} className="rounded-xl border border-white/10 p-2.5">
                    <p className="text-xs font-medium text-neutral-300">{r.file_name}</p>
                    {r.summary_status === "ready" && r.ai_summary ? (
                      <p className="mt-1 text-xs text-neutral-400 line-clamp-4">{r.ai_summary}</p>
                    ) : r.summary_status === "failed" ? (
                      <p className="mt-1 text-xs text-red-300">Summary failed.</p>
                    ) : (
                      <p className="mt-1 text-xs text-neutral-500">Summary pending…</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-1.5"><Users size={14} /> Head-to-Head</CardTitle></CardHeader>
            {!match ? (
              <p className="text-sm text-neutral-400">Link a fixture to see head-to-head history.</p>
            ) : !h2h ? (
              <p className="text-sm text-neutral-400">
                No head-to-head history yet. Refresh it from the{" "}
                <Link href="/opposition" className="text-club-primary hover:underline">Opposition</Link> page.
              </p>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: "Played", value: h2h.played },
                    { label: "Won", value: h2h.won },
                    { label: "Drawn", value: h2h.drawn },
                    { label: "Lost", value: h2h.lost },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg bg-navy-600 dark:bg-navy-800 py-1.5">
                      <p className="text-sm font-semibold">{s.value ?? "—"}</p>
                      <p className="text-[10px] text-neutral-400">{s.label}</p>
                    </div>
                  ))}
                </div>
                {h2h.last_meeting_date && (
                  <p className="text-xs text-neutral-400">
                    Last meeting: {new Date(h2h.last_meeting_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    {h2h.last_meeting_result ? ` — ${h2h.last_meeting_result}` : ""}
                    {h2h.last_meeting_venue ? ` (${h2h.last_meeting_venue})` : ""}
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      {showAddClip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-sm max-h-[80vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-medium">Add a Clip</p>
              <button onClick={() => setShowAddClip(false)} className="text-neutral-400 hover:text-white"><X size={18} /></button>
            </div>
            {availableClips.length === 0 ? (
              <p className="text-sm text-neutral-400">No more clips to add.</p>
            ) : (
              <ul className="space-y-1.5">
                {availableClips.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => addClipItem(c)}
                      className="flex w-full items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-left text-sm hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors"
                    >
                      <Film size={13} className="shrink-0 text-club-primary" />
                      <span className="truncate">{c.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {showAddImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-sm max-h-[80vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-medium">Add an Image</p>
              <button onClick={() => setShowAddImage(false)} className="text-neutral-400 hover:text-white"><X size={18} /></button>
            </div>
            {availableImages.length === 0 ? (
              <p className="text-sm text-neutral-400">No more images to add.</p>
            ) : (
              <ul className="space-y-1.5">
                {availableImages.map((im) => (
                  <li key={im.id}>
                    <button
                      onClick={() => addImageItem(im)}
                      className="flex w-full items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-left text-sm hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors"
                    >
                      <ImageIcon size={13} className="shrink-0 text-club-primary" />
                      <span className="truncate">{im.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {playing && <VideoPlayer clip={playing} onClose={() => setPlaying(null)} sourceClipId={playing.id} />}

      {viewingImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={() => setViewingImage(null)}>
          <div className="max-h-[85vh] max-w-3xl overflow-hidden rounded-card border border-white/10 bg-navy-700 dark:bg-navy-900 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="truncate text-sm font-medium">{viewingImage.title}</p>
              <button onClick={() => setViewingImage(null)} className="text-neutral-400 hover:text-white"><X size={16} /></button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewingImage.url} alt={viewingImage.title} className="max-h-[70vh] w-full rounded-xl object-contain" />
          </div>
        </div>
      )}
    </AppShell>
  );
}
