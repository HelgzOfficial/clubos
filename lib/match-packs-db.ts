import { supabase } from "./supabase";

import type { PitchItem, PitchLine } from "./training-storage";

// A match pack is an ordered list of blocks. Clip and image came first; the
// rest turn it from a media list into something an analyst can actually build
// a briefing out of — headings, written points, tactical diagrams, stat
// comparisons.
//
// `id` is optional on the wire because packs created before blocks had ids are
// still in the database; normaliseBlocks() below fills them in on load so the
// editor always has a stable key to reorder and delete against.
export type MatchPackTone = "neutral" | "strength" | "weakness" | "threat";

export type MatchPackItem =
  | { type: "clip"; id?: string; clipId: string; caption: string; timestamp?: string }
  | { type: "image"; id?: string; imageId: string; caption: string }
  | { type: "heading"; id?: string; text: string }
  | { type: "text"; id?: string; title?: string; body: string }
  | { type: "points"; id?: string; title: string; tone: MatchPackTone; points: string[] }
  | { type: "pitch"; id?: string; title: string; caption: string; items: PitchItem[]; lines: PitchLine[] }
  | { type: "stats"; id?: string; title: string; rows: { label: string; us: string; them: string }[] };

export type MatchPackBlockType = MatchPackItem["type"];

// Every block carries an id once loaded, so the editor can key off it.
export type NormalisedBlock = MatchPackItem & { id: string };

let blockIdCounter = 0;
export function newBlockId(): string {
  blockIdCounter += 1;
  return `block-${Date.now().toString(36)}-${blockIdCounter}`;
}

export function normaliseBlocks(items: MatchPackItem[] | null | undefined): NormalisedBlock[] {
  return (items ?? []).map((item, i) => ({
    ...item,
    id: item.id ?? `legacy-${i}-${item.type}`,
  })) as NormalisedBlock[];
}

// A ready-to-edit empty block of the requested kind.
export function blankBlock(type: MatchPackBlockType): NormalisedBlock {
  const id = newBlockId();
  switch (type) {
    case "heading":
      return { id, type: "heading", text: "New section" };
    case "text":
      return { id, type: "text", title: "", body: "" };
    case "points":
      return { id, type: "points", title: "Key points", tone: "neutral", points: [""] };
    case "pitch":
      return { id, type: "pitch", title: "Tactical diagram", caption: "", items: [], lines: [] };
    case "stats":
      return { id, type: "stats", title: "Head to head", rows: [{ label: "", us: "", them: "" }] };
    case "clip":
      return { id, type: "clip", clipId: "", caption: "" };
    default:
      return { id, type: "image", imageId: "", caption: "" };
  }
}

export type DbMatchPack = {
  id: string;
  match_id: string | null;
  title: string;
  notes: string | null;
  items: MatchPackItem[];
  created_at: string;
  updated_at: string;
};

export async function fetchMatchPacks(): Promise<DbMatchPack[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("match_packs").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbMatchPack[];
}

export async function fetchMatchPack(id: string): Promise<DbMatchPack | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("match_packs").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as DbMatchPack) ?? null;
}

export async function createMatchPack(input: { matchId: string | null; title: string }): Promise<DbMatchPack> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("match_packs")
    .insert({ match_id: input.matchId, title: input.title, notes: "", items: [] })
    .select()
    .single();
  if (error) throw error;
  return data as DbMatchPack;
}

export async function updateMatchPack(id: string, patch: { title?: string; notes?: string; items?: MatchPackItem[] }): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase
    .from("match_packs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteMatchPack(id: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("match_packs").delete().eq("id", id);
  if (error) throw error;
}
