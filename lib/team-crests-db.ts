import { supabase } from "./supabase";

export type CrestKind = "team" | "competition";

export type DbTeamCrest = {
  id: string;
  kind: CrestKind;
  name: string;
  crest_url: string;
  file_path: string | null;
};

function norm(name: string): string {
  return name.trim().toLowerCase();
}

export async function fetchTeamCrests(): Promise<DbTeamCrest[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("team_crests").select("id,kind,name,crest_url,file_path");
  if (error) throw error;
  return (data ?? []) as DbTeamCrest[];
}

// Lookup keyed by "kind:lowercased name", so callers can resolve a crest for a
// fixture without another round trip per row.
export type CrestLookup = Map<string, string>;

export function buildCrestLookup(crests: DbTeamCrest[]): CrestLookup {
  const map: CrestLookup = new Map();
  for (const c of crests) map.set(`${c.kind}:${norm(c.name)}`, c.crest_url);
  return map;
}

export function crestFor(lookup: CrestLookup | null, kind: CrestKind, name: string | null | undefined): string | null {
  if (!lookup || !name) return null;
  return lookup.get(`${kind}:${norm(name)}`) ?? null;
}

export async function uploadCrest(kind: CrestKind, name: string, file: File): Promise<DbTeamCrest> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const safeName = norm(name).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${kind}/${safeName}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from("team-crests").upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;

  const { data: pub } = supabase.storage.from("team-crests").getPublicUrl(path);

  // Upsert on (kind, name) so re-uploading replaces the badge rather than
  // creating a second row that would then race the first.
  const { data, error } = await supabase
    .from("team_crests")
    .upsert(
      { kind, name: name.trim(), crest_url: pub.publicUrl, file_path: path, updated_at: new Date().toISOString() },
      { onConflict: "kind,name" }
    )
    .select()
    .single();

  // Some Postgres setups won't accept onConflict against a functional unique
  // index (ours is on lower(name)), so fall back to an explicit update.
  if (error) {
    const existing = await supabase.from("team_crests").select("id").eq("kind", kind).ilike("name", name.trim()).limit(1);
    if (existing.data?.[0]) {
      const { data: updated, error: updateError } = await supabase
        .from("team_crests")
        .update({ crest_url: pub.publicUrl, file_path: path, updated_at: new Date().toISOString() })
        .eq("id", existing.data[0].id)
        .select()
        .single();
      if (updateError) throw updateError;
      return updated as DbTeamCrest;
    }
    const { data: inserted, error: insertError } = await supabase
      .from("team_crests")
      .insert({ kind, name: name.trim(), crest_url: pub.publicUrl, file_path: path })
      .select()
      .single();
    if (insertError) throw insertError;
    return inserted as DbTeamCrest;
  }

  return data as DbTeamCrest;
}

export async function deleteCrest(crest: DbTeamCrest): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  if (crest.file_path) await supabase.storage.from("team-crests").remove([crest.file_path]);
  const { error } = await supabase.from("team_crests").delete().eq("id", crest.id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Fallback badge appearance
// ---------------------------------------------------------------------------

// Up to three initials from a club name, skipping the filler words that would
// otherwise crowd them out ("Whyteleafe FC" -> "W", "AFC Hornchurch" -> "H").
const FILLER = new Set(["fc", "afc", "utd", "united", "town", "city", "the", "and", "&"]);

export function crestInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => !FILLER.has(w.toLowerCase().replace(/[^a-z&]/gi, "")));
  const source = words.length > 0 ? words : name.trim().split(/\s+/);
  return source.slice(0, 3).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

// A stable hue per club so the same team always gets the same colour, without
// storing anything — a simple string hash mapped onto the colour wheel.
export function crestColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${hash}, 45%, 32%)`;
}
