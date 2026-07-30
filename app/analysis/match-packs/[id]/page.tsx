"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchMatches, type DbMatch } from "@/lib/matches-db";
import {
  fetchMatchPack, updateMatchPack, normaliseBlocks, blankBlock, newBlockId,
  type DbMatchPack, type NormalisedBlock, type MatchPackBlockType, type MatchPackTone,
} from "@/lib/match-packs-db";
import { fetchOppositionReports, type DbOppositionReport } from "@/lib/opposition-reports-db";
import { fetchHeadToHead, type DbHeadToHead } from "@/lib/opposition-head-to-head-db";
import { fetchAllClips, getClipUrl, type DbClip } from "@/lib/clips-db";
import { fetchAnnotatedImages, getAnnotatedImageUrl, type DbAnnotatedImage } from "@/lib/annotated-images-db";
import { VideoPlayer } from "@/components/analysis/video-player";
import { YouTubePlayer } from "@/components/analysis/youtube-player";
import { PitchCanvas } from "@/components/training/pitch-canvas";
import { usePermissions } from "@/lib/permissions";
import type { Clip } from "@/lib/analysis-types";
import {
  ArrowLeft, Film, Image as ImageIcon, Plus, Trash2, X, Printer, Save, Check, Loader2,
  Heading as HeadingIcon, AlignLeft, ListChecks, LayoutGrid, BarChart3, Copy,
  ChevronUp, ChevronDown, Eye, Pencil, PlayCircle, Sparkles,
} from "lucide-react";

// The blocks an analyst can drop into a pack, in the order shown on the toolbar.
const BLOCK_KINDS: { type: MatchPackBlockType; label: string; icon: typeof Save; hint: string }[] = [
  { type: "heading", label: "Section", icon: HeadingIcon, hint: "Break the pack into parts" },
  { type: "text", label: "Notes", icon: AlignLeft, hint: "Written detail or instructions" },
  { type: "points", label: "Key Points", icon: ListChecks, hint: "Bulleted strengths, threats, reminders" },
  { type: "pitch", label: "Pitch Diagram", icon: LayoutGrid, hint: "Draw shape, runs, set pieces" },
  { type: "clip", label: "Clip", icon: Film, hint: "Video from the library" },
  { type: "image", label: "Image", icon: ImageIcon, hint: "Annotated still" },
  { type: "stats", label: "Stat Table", icon: BarChart3, hint: "Us vs them numbers" },
];

const TONE_STYLES: Record<MatchPackTone, { border: string; text: string; label: string }> = {
  neutral: { border: "border-white/25", text: "text-neutral-200", label: "Neutral" },
  strength: { border: "border-emerald-500/50", text: "text-emerald-300", label: "Their strength" },
  weakness: { border: "border-blue-500/50", text: "text-blue-300", label: "Their weakness" },
  threat: { border: "border-red-500/50", text: "text-red-300", label: "Threat / warning" },
};

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
  const [blocks, setBlocks] = useState<NormalisedBlock[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);

  const [playing, setPlaying] = useState<Clip | null>(null);
  const [playingYouTube, setPlayingYouTube] = useState<{ title: string; videoId: string } | null>(null);
  const [picker, setPicker] = useState<{ blockId: string; kind: "clip" | "image" } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      try {
        const [p, allMatches, c, im] = await Promise.all([
          fetchMatchPack(id), fetchMatches(), fetchAllClips(), fetchAnnotatedImages(),
        ]);
        setPack(p);
        setClips(c);
        setImages(im);
        if (p) {
          setTitle(p.title);
          setNotes(p.notes ?? "");
          setBlocks(normaliseBlocks(p.items));
          const m = p.match_id ? allMatches.find((x) => x.id === p.match_id) ?? null : null;
          setMatch(m);
          if (m) {
            const [r, hh] = await Promise.all([fetchOppositionReports(m.opponent), fetchHeadToHead(m.opponent)]);
            setReports(r);
            setH2h(hh);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load this match pack.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const save = useCallback(async () => {
    if (!pack) return;
    setSaving(true);
    setError("");
    try {
      await updateMatchPack(pack.id, { title: title.trim() || pack.title, notes, items: blocks });
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save this pack.");
    } finally {
      setSaving(false);
    }
  }, [pack, title, notes, blocks]);

  function mutate(next: NormalisedBlock[]) {
    setBlocks(next);
    setDirty(true);
  }
  function addBlock(type: MatchPackBlockType) {
    const block = blankBlock(type);
    mutate([...blocks, block]);
    // Media blocks are useless empty, so open the picker straight away.
    if (type === "clip" || type === "image") setPicker({ blockId: block.id, kind: type });
  }
  function patchBlock(blockId: string, patch: Partial<NormalisedBlock>) {
    mutate(blocks.map((b) => (b.id === blockId ? ({ ...b, ...patch } as NormalisedBlock) : b)));
  }
  function removeBlock(blockId: string) {
    mutate(blocks.filter((b) => b.id !== blockId));
  }
  function duplicateBlock(blockId: string) {
    const i = blocks.findIndex((b) => b.id === blockId);
    if (i < 0) return;
    const copy = { ...blocks[i], id: newBlockId() } as NormalisedBlock;
    const next = [...blocks];
    next.splice(i + 1, 0, copy);
    mutate(next);
  }
  function moveBlock(blockId: string, dir: -1 | 1) {
    const i = blocks.findIndex((b) => b.id === blockId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    mutate(next);
  }
  function toggleCollapsed(blockId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  }

  // Turns the head-to-head record the app already holds into a stat block, so
  // the analyst isn't retyping numbers that exist elsewhere.
  function insertHeadToHead() {
    if (!h2h || !match) return;
    mutate([
      ...blocks,
      {
        id: newBlockId(),
        type: "stats",
        title: `Head to head — ${match.opponent}`,
        rows: [
          { label: "Played", us: String(h2h.played ?? "–"), them: "" },
          { label: "Won", us: String(h2h.won ?? "–"), them: "" },
          { label: "Drawn", us: String(h2h.drawn ?? "–"), them: "" },
          { label: "Lost", us: String(h2h.lost ?? "–"), them: "" },
        ],
      },
    ]);
  }

  async function openClip(clipId: string) {
    const c = clips.find((x) => x.id === clipId);
    if (!c) return;
    if (c.source === "youtube" && c.youtube_id) {
      setPlayingYouTube({ title: c.title, videoId: c.youtube_id });
      return;
    }
    if (!c.file_path) return;
    const url = await getClipUrl(c.file_path);
    setPlaying({ id: c.id, title: c.title, url, tags: c.category ? [c.category] : [], addedAt: c.uploaded_at });
  }

  const clipById = useMemo(() => new Map(clips.map((c) => [c.id, c])), [clips]);
  const imageById = useMemo(() => new Map(images.map((i) => [i.id, i])), [images]);

  if (loading) {
    return <AppShell><p className="text-sm text-neutral-400">Loading…</p></AppShell>;
  }
  if (!pack) {
    return (
      <AppShell>
        <Card className="py-14 text-center">
          <p className="font-medium">That match pack couldn&apos;t be found.</p>
          <Link href="/analysis/match-packs" className="mt-2 inline-block text-sm text-club-primary hover:underline">
            Back to match packs
          </Link>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* print:hidden keeps editing furniture out of a printed or PDF'd pack */}
      <div className="mb-5 print:hidden">
        <Link href="/analysis/match-packs" className="mb-1 flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors">
          <ArrowLeft size={12} /> Match Packs
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-[14rem] flex-1">
            {canEdit && !preview ? (
              <input
                value={title}
                onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
                className="w-full rounded-xl border border-white/10 bg-navy-600 px-3 py-2 text-xl font-semibold outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
              />
            ) : (
              <h1 className="text-2xl font-semibold">{title || pack.title}</h1>
            )}
            {match && (
              <p className="mt-1 text-sm text-neutral-500">
                {match.is_home ? "vs" : "@"} {match.opponent} · {new Date(match.kickoff).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPreview((v) => !v)}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors"
            >
              {preview ? <Pencil size={14} /> : <Eye size={14} />} {preview ? "Edit" : "Preview"}
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors"
            >
              <Printer size={14} /> Print / PDF
            </button>
            {canEdit && (
              <button
                onClick={save}
                disabled={saving || !dirty}
                className="flex items-center gap-1.5 rounded-xl bg-club-primary text-navy-950 px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Save size={14} />}
                {saving ? "Saving…" : saved ? "Saved" : dirty ? "Save" : "Saved"}
              </button>
            )}
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        {dirty && !saving && <p className="mt-2 text-xs text-amber-300">Unsaved changes.</p>}
      </div>

      {/* Printed packs get a plain title block, since the header above is hidden */}
      <div className="mb-4 hidden print:block">
        <h1 className="text-xl font-semibold">{title || pack.title}</h1>
        {match && <p className="text-sm">{match.is_home ? "vs" : "@"} {match.opponent}</p>}
      </div>

      {canEdit && !preview ? (
        <Card className="mb-4 print:hidden">
          <label className="mb-1.5 block text-xs font-medium text-neutral-500">Pack summary (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setDirty(true); }}
            rows={2}
            placeholder="The headline message for this game."
            className="w-full resize-none rounded-xl border border-white/10 bg-navy-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
          />
        </Card>
      ) : notes ? (
        <Card className="mb-4"><p className="whitespace-pre-wrap text-sm text-neutral-300">{notes}</p></Card>
      ) : null}

      {blocks.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-14 text-center print:hidden">
          <Sparkles size={26} className="mb-3 text-neutral-400" />
          <p className="font-medium">Empty pack</p>
          <p className="mt-1 max-w-sm text-sm text-neutral-400">
            Build it up from the tools below — sections, written points, tactical diagrams, clips and stills.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {blocks.map((block, i) => (
            <BlockCard
              key={block.id}
              block={block}
              index={i}
              total={blocks.length}
              preview={preview || !canEdit}
              collapsed={collapsed.has(block.id)}
              clip={block.type === "clip" ? clipById.get(block.clipId) ?? null : null}
              image={block.type === "image" ? imageById.get(block.imageId) ?? null : null}
              onToggleCollapsed={() => toggleCollapsed(block.id)}
              onPatch={(patch) => patchBlock(block.id, patch)}
              onRemove={() => removeBlock(block.id)}
              onDuplicate={() => duplicateBlock(block.id)}
              onMove={(dir) => moveBlock(block.id, dir)}
              onPickMedia={(kind) => setPicker({ blockId: block.id, kind })}
              onPlayClip={openClip}
            />
          ))}
        </div>
      )}

      {canEdit && !preview && (
        <Card className="mt-5 print:hidden">
          <CardHeader>
            <CardTitle>Add to pack</CardTitle>
            {h2h && (
              <button onClick={insertHeadToHead} className="text-xs text-club-primary hover:underline">
                Insert head-to-head record
              </button>
            )}
          </CardHeader>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {BLOCK_KINDS.map((k) => (
              <button
                key={k.type}
                onClick={() => addBlock(k.type)}
                title={k.hint}
                className="flex flex-col items-start gap-1 rounded-xl border border-white/10 p-3 text-left transition-colors hover:border-club-primary/40 hover:bg-navy-600 dark:hover:bg-navy-800"
              >
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <k.icon size={14} className="text-club-primary" /> {k.label}
                </span>
                <span className="text-[11px] leading-snug text-neutral-500">{k.hint}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Reference material while building — never part of the printed pack */}
      {match && !preview && (
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2 print:hidden">
          <Card>
            <CardHeader><CardTitle>Opposition reports</CardTitle></CardHeader>
            {reports.length === 0 ? (
              <p className="text-sm text-neutral-400">
                Nothing uploaded for {match.opponent} yet — add one from the{" "}
                <Link href="/opposition" className="text-club-primary hover:underline">Opposition module</Link>.
              </p>
            ) : (
              <ul className="space-y-2">
                {reports.slice(0, 4).map((r) => (
                  <li key={r.id}>
                    <p className="truncate text-sm font-medium">{r.file_name}</p>
                    {r.ai_summary && <p className="mt-0.5 text-xs text-neutral-400">{r.ai_summary}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader><CardTitle>Head to head</CardTitle></CardHeader>
            {!h2h ? (
              <p className="text-sm text-neutral-400">No head-to-head record for {match.opponent} yet.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                {[
                  { label: "Played", value: h2h.played },
                  { label: "Won", value: h2h.won },
                  { label: "Drawn", value: h2h.drawn },
                  { label: "Lost", value: h2h.lost },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="text-lg font-semibold">{s.value ?? "–"}</p>
                    <p className="text-[11px] text-neutral-500">{s.label}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {picker && (
        <MediaPicker
          kind={picker.kind}
          clips={clips}
          images={images}
          onClose={() => setPicker(null)}
          onPick={(mediaId) => {
            patchBlock(picker.blockId, picker.kind === "clip" ? { clipId: mediaId } : { imageId: mediaId });
            setPicker(null);
          }}
        />
      )}

      {playing && <VideoPlayer clip={playing} onClose={() => setPlaying(null)} sourceClipId={playing.id} />}
      {playingYouTube && (
        <YouTubePlayer title={playingYouTube.title} videoId={playingYouTube.videoId} onClose={() => setPlayingYouTube(null)} />
      )}
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
function BlockCard({
  block, index, total, preview, collapsed, clip, image,
  onToggleCollapsed, onPatch, onRemove, onDuplicate, onMove, onPickMedia, onPlayClip,
}: {
  block: NormalisedBlock;
  index: number;
  total: number;
  preview: boolean;
  collapsed: boolean;
  clip: DbClip | null;
  image: DbAnnotatedImage | null;
  onToggleCollapsed: () => void;
  onPatch: (patch: Partial<NormalisedBlock>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (dir: -1 | 1) => void;
  onPickMedia: (kind: "clip" | "image") => void;
  onPlayClip: (clipId: string) => void;
}) {
  const kind = BLOCK_KINDS.find((k) => k.type === block.type);
  const Icon = kind?.icon;

  // In read mode a heading renders as a section rule rather than a card, so a
  // printed pack reads like a document instead of a stack of boxes.
  if (preview && block.type === "heading") {
    return (
      <div className="border-b border-club-primary/40 pb-1.5 pt-2">
        <h2 className="text-lg font-semibold text-club-primary">{block.text}</h2>
      </div>
    );
  }

  return (
    <Card className={preview ? "" : "border-white/15"}>
      {!preview && (
        <div className="mb-3 flex items-center gap-2 border-b border-white/10 pb-2.5 print:hidden">
          <span className="flex items-center gap-1.5 text-xs font-medium text-neutral-400">
            {Icon && <Icon size={13} className="text-club-primary" />} {kind?.label ?? block.type}
          </span>
          <span className="text-[11px] text-neutral-600">#{index + 1}</span>
          <div className="ml-auto flex items-center gap-0.5">
            <button onClick={() => onMove(-1)} disabled={index === 0} title="Move up"
              className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 hover:text-white disabled:opacity-30 dark:hover:bg-navy-800">
              <ChevronUp size={14} />
            </button>
            <button onClick={() => onMove(1)} disabled={index === total - 1} title="Move down"
              className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 hover:text-white disabled:opacity-30 dark:hover:bg-navy-800">
              <ChevronDown size={14} />
            </button>
            <button onClick={onToggleCollapsed} title={collapsed ? "Expand" : "Collapse"}
              className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 hover:text-white dark:hover:bg-navy-800">
              {collapsed ? <Eye size={13} /> : <AlignLeft size={13} />}
            </button>
            <button onClick={onDuplicate} title="Duplicate"
              className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 hover:text-white dark:hover:bg-navy-800">
              <Copy size={13} />
            </button>
            <button onClick={onRemove} title="Remove"
              className="flex h-7 w-7 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      )}

      {collapsed && !preview ? (
        <p className="text-sm text-neutral-500">Collapsed — {kind?.label}</p>
      ) : (
        <BlockBody
          block={block} preview={preview} clip={clip} image={image}
          onPatch={onPatch} onPickMedia={onPickMedia} onPlayClip={onPlayClip}
        />
      )}
    </Card>
  );
}

function BlockBody({
  block, preview, clip, image, onPatch, onPickMedia, onPlayClip,
}: {
  block: NormalisedBlock;
  preview: boolean;
  clip: DbClip | null;
  image: DbAnnotatedImage | null;
  onPatch: (patch: Partial<NormalisedBlock>) => void;
  onPickMedia: (kind: "clip" | "image") => void;
  onPlayClip: (clipId: string) => void;
}) {
  const inputClass = "w-full rounded-xl border border-white/10 bg-navy-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800";

  switch (block.type) {
    case "heading":
      return preview ? (
        <h2 className="text-lg font-semibold text-club-primary">{block.text}</h2>
      ) : (
        <input
          value={block.text}
          onChange={(e) => onPatch({ text: e.target.value })}
          placeholder="Section title"
          className={`${inputClass} text-base font-semibold`}
        />
      );

    case "text":
      return preview ? (
        <div>
          {block.title && <p className="mb-1 font-medium">{block.title}</p>}
          <p className="whitespace-pre-wrap text-sm text-neutral-300">{block.body}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            value={block.title ?? ""}
            onChange={(e) => onPatch({ title: e.target.value })}
            placeholder="Heading (optional)"
            className={inputClass}
          />
          <textarea
            value={block.body}
            onChange={(e) => onPatch({ body: e.target.value })}
            rows={4}
            placeholder="Detail, instructions, context…"
            className={`${inputClass} resize-y`}
          />
        </div>
      );

    case "points": {
      const tone = TONE_STYLES[block.tone] ?? TONE_STYLES.neutral;
      if (preview) {
        return (
          <div className={`border-l-4 ${tone.border} pl-3`}>
            <p className={`mb-1.5 text-sm font-semibold ${tone.text}`}>{block.title}</p>
            <ul className="space-y-1">
              {block.points.filter(Boolean).map((pt, i) => (
                <li key={i} className="flex gap-2 text-sm text-neutral-300">
                  <span className={tone.text}>•</span> {pt}
                </li>
              ))}
            </ul>
          </div>
        );
      }
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              value={block.title}
              onChange={(e) => onPatch({ title: e.target.value })}
              placeholder="List title"
              className={`${inputClass} min-w-[10rem] flex-1`}
            />
            <select
              value={block.tone}
              onChange={(e) => onPatch({ tone: e.target.value as MatchPackTone })}
              className="rounded-xl border border-white/10 bg-navy-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
            >
              {(Object.keys(TONE_STYLES) as MatchPackTone[]).map((t) => (
                <option key={t} value={t}>{TONE_STYLES[t].label}</option>
              ))}
            </select>
          </div>
          {block.points.map((pt, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-neutral-500">•</span>
              <input
                value={pt}
                onChange={(e) => onPatch({ points: block.points.map((p, j) => (j === i ? e.target.value : p)) })}
                placeholder={`Point ${i + 1}`}
                className={inputClass}
              />
              <button
                onClick={() => onPatch({ points: block.points.filter((_, j) => j !== i) })}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 hover:text-white dark:hover:bg-navy-800"
              >
                <X size={13} />
              </button>
            </div>
          ))}
          <button
            onClick={() => onPatch({ points: [...block.points, ""] })}
            className="flex items-center gap-1.5 text-xs text-club-primary hover:underline"
          >
            <Plus size={12} /> Add point
          </button>
        </div>
      );
    }

    case "pitch":
      return (
        <div className="space-y-2">
          {preview ? (
            <p className="font-medium">{block.title}</p>
          ) : (
            <input
              value={block.title}
              onChange={(e) => onPatch({ title: e.target.value })}
              placeholder="Diagram title"
              className={inputClass}
            />
          )}
          {/* The training planner's canvas, so shapes, runs and set pieces are
              drawn with tools the analyst already knows. */}
          <PitchCanvas
            items={block.items}
            lines={block.lines}
            readOnly={preview}
            onChange={(next) => onPatch({ items: next.items, lines: next.lines })}
          />
          {preview ? (
            block.caption ? <p className="text-xs text-neutral-400">{block.caption}</p> : null
          ) : (
            <input
              value={block.caption}
              onChange={(e) => onPatch({ caption: e.target.value })}
              placeholder="Caption (optional)"
              className={inputClass}
            />
          )}
        </div>
      );

    case "clip":
      return (
        <div className="space-y-2">
          {!block.clipId ? (
            <button
              onClick={() => onPickMedia("clip")}
              className="flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed border-white/20 py-8 text-neutral-400 hover:border-club-primary/40 hover:text-white"
            >
              <Film size={20} /> <span className="text-sm">Choose a clip</span>
            </button>
          ) : !clip ? (
            <p className="text-sm text-amber-300">That clip is no longer in the library.</p>
          ) : (
            <button
              onClick={() => onPlayClip(clip.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-white/10 p-3 text-left transition-colors hover:border-club-primary/40"
            >
              <PlayCircle size={22} className="shrink-0 text-club-primary" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{clip.title}</span>
                <span className="block text-[11px] text-neutral-500">
                  {clip.source === "youtube" ? "YouTube" : "Uploaded clip"}
                  {clip.category ? ` · ${clip.category}` : ""}
                </span>
              </span>
            </button>
          )}
          {preview ? (
            block.caption ? <p className="text-xs text-neutral-400">{block.caption}</p> : null
          ) : (
            <div className="flex gap-2">
              <input
                value={block.caption}
                onChange={(e) => onPatch({ caption: e.target.value })}
                placeholder="What to look for in this clip"
                className={inputClass}
              />
              {block.clipId && (
                <button
                  onClick={() => onPickMedia("clip")}
                  className="shrink-0 rounded-xl border border-white/10 px-3 text-xs text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800"
                >
                  Swap
                </button>
              )}
            </div>
          )}
        </div>
      );

    case "image":
      return (
        <div className="space-y-2">
          {!block.imageId ? (
            <button
              onClick={() => onPickMedia("image")}
              className="flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed border-white/20 py-8 text-neutral-400 hover:border-club-primary/40 hover:text-white"
            >
              <ImageIcon size={20} /> <span className="text-sm">Choose an image</span>
            </button>
          ) : !image ? (
            <p className="text-sm text-amber-300">That image is no longer in the library.</p>
          ) : (
            <PackImage filePath={image.file_path} title={image.title} />
          )}
          {preview ? (
            block.caption ? <p className="text-xs text-neutral-400">{block.caption}</p> : null
          ) : (
            <div className="flex gap-2">
              <input
                value={block.caption}
                onChange={(e) => onPatch({ caption: e.target.value })}
                placeholder="Caption"
                className={inputClass}
              />
              {block.imageId && (
                <button
                  onClick={() => onPickMedia("image")}
                  className="shrink-0 rounded-xl border border-white/10 px-3 text-xs text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800"
                >
                  Swap
                </button>
              )}
            </div>
          )}
        </div>
      );

    case "stats":
      return (
        <div className="space-y-2">
          {preview ? (
            <p className="font-medium">{block.title}</p>
          ) : (
            <input
              value={block.title}
              onChange={(e) => onPatch({ title: e.target.value })}
              placeholder="Table title"
              className={inputClass}
            />
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th className="pb-1.5 font-medium">Metric</th>
                <th className="pb-1.5 text-center font-medium">Us</th>
                <th className="pb-1.5 text-center font-medium">Them</th>
                {!preview && <th />}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {preview ? (
                    <>
                      <td className="py-1.5">{row.label}</td>
                      <td className="py-1.5 text-center font-semibold tabular-nums">{row.us || "–"}</td>
                      <td className="py-1.5 text-center font-semibold tabular-nums">{row.them || "–"}</td>
                    </>
                  ) : (
                    <>
                      {(["label", "us", "them"] as const).map((field) => (
                        <td key={field} className="py-1 pr-1.5">
                          <input
                            value={row[field]}
                            onChange={(e) =>
                              onPatch({
                                rows: block.rows.map((r, j) => (j === i ? { ...r, [field]: e.target.value } : r)),
                              })
                            }
                            placeholder={field === "label" ? "e.g. Possession %" : ""}
                            className="w-full rounded-lg border border-white/10 bg-navy-600 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
                          />
                        </td>
                      ))}
                      <td className="py-1">
                        <button
                          onClick={() => onPatch({ rows: block.rows.filter((_, j) => j !== i) })}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 hover:text-white dark:hover:bg-navy-800"
                        >
                          <X size={13} />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!preview && (
            <button
              onClick={() => onPatch({ rows: [...block.rows, { label: "", us: "", them: "" }] })}
              className="flex items-center gap-1.5 text-xs text-club-primary hover:underline"
            >
              <Plus size={12} /> Add row
            </button>
          )}
        </div>
      );

    default:
      return null;
  }
}

// Annotated images live in a private bucket, so the URL is signed on demand
// rather than stored in the block.
function PackImage({ filePath, title }: { filePath: string; title: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    getAnnotatedImageUrl(filePath).then(setUrl).catch(() => setUrl(null));
  }, [filePath]);
  if (!url) return <div className="aspect-video w-full animate-pulse rounded-xl bg-navy-800" />;
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={url} alt={title} className="w-full rounded-xl border border-white/10 object-contain" />
  );
}

// ---------------------------------------------------------------------------
function MediaPicker({
  kind, clips, images, onClose, onPick,
}: {
  kind: "clip" | "image";
  clips: DbClip[];
  images: DbAnnotatedImage[];
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filteredClips = clips.filter((c) => !q || c.title.toLowerCase().includes(q));
  const filteredImages = images.filter((i) => !q || i.title.toLowerCase().includes(q));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <Card className="max-h-[85dvh] w-full max-w-lg overflow-y-auto">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-medium">{kind === "clip" ? "Choose a clip" : "Choose an image"}</p>
          <button onClick={onClose} className="text-neutral-400 hover:text-white"><X size={18} /></button>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title…"
          className="mb-3 w-full rounded-xl border border-white/10 bg-navy-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
        />
        {kind === "clip" ? (
          filteredClips.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-400">No clips found.</p>
          ) : (
            <ul className="divide-y divide-white/10">
              {filteredClips.map((c) => (
                <li key={c.id}>
                  <button onClick={() => onPick(c.id)} className="flex w-full items-center gap-3 py-2.5 text-left hover:text-club-primary">
                    <Film size={15} className="shrink-0 text-neutral-400" />
                    <span className="min-w-0 flex-1 truncate text-sm">{c.title}</span>
                    {c.source === "youtube" && <Badge variant="red">YouTube</Badge>}
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : filteredImages.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-400">No images found.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filteredImages.map((im) => (
              <button
                key={im.id}
                onClick={() => onPick(im.id)}
                className="overflow-hidden rounded-xl border border-white/10 text-left hover:border-club-primary/40"
              >
                <PackImage filePath={im.file_path} title={im.title} />
                <p className="truncate px-2 py-1.5 text-xs">{im.title}</p>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
