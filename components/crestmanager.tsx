"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Upload, Loader2, Trash2, Search, Wand2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  fetchTeamCrests, uploadCrest, deleteCrest, saveCrestAlias, buildCrestLookup, crestFor, canonKey,
  type DbTeamCrest, type CrestKind,
} from "@/lib/team-crests-db";
import { TeamCrest, invalidateCrestCache } from "@/components/team-crest";
import { club as clubFallback } from "@/lib/sample-data";
import { loadClubSettings } from "@/lib/club-settings";
import { fetchClubSettings } from "@/lib/club-settings-db";
import type { DbMatch } from "@/lib/matches-db";

type CrestRow = { kind: CrestKind; name: string; own?: boolean };

// A stable default so the rows memo doesn't recompute on every render.
const NO_EXTRA_TEAMS: string[] = [];

// Bulk crest management, driven off the fixture list: every opponent and every
// competition you actually play in gets a row, so there's no separate list to
// maintain. Uploading is manual by design — club badges are trademarked artwork
// and there's no dependable public source for non-league crests, so the club
// supplies the files it's entitled to use.
export function CrestManager({
  matches, extraTeams = NO_EXTRA_TEAMS, onClose, onChanged,
}: {
  matches: DbMatch[];
  // Teams that belong in the list but aren't in the fixture list — chiefly the
  // rest of the division from the league table. Without these, a club we
  // haven't played yet has no row here at all, so its badge can never be
  // uploaded and it shows initials in the league table forever.
  extraTeams?: string[];
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [crests, setCrests] = useState<DbTeamCrest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [clubName, setClubName] = useState(clubFallback.name);
  const [repairing, setRepairing] = useState(false);
  const [repairNote, setRepairNote] = useState("");
  const pending = useRef<{ kind: CrestKind; name: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      setCrests(await fetchTeamCrests());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load crests.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  // Our own club's name comes from Settings, not from the fixture list — the
  // fixture list only ever names the opposition.
  useEffect(() => {
    setClubName(loadClubSettings(clubFallback).name);
    fetchClubSettings(clubFallback).then((s) => setClubName(s.name)).catch(() => {});
  }, []);

  const lookup = useMemo(() => buildCrestLookup(crests), [crests]);

  // Our own club pinned first, then distinct competitions and opponents from
  // the real fixture list.
  const allRows = useMemo(() => {
    const own = clubName.trim();
    // Every distinct spelling gets its own row rather than being merged away.
    // The fixture list and the league table are typed separately, so the same
    // club really can be stored two ways — hiding that made it impossible to
    // see why a badge showed in one place and not another. Uploading against
    // any one spelling fills in the rest (see handleFile).
    const names = new Set<string>();
    for (const raw of [...matches.map((m) => m.opponent), ...extraTeams]) {
      const name = raw?.trim();
      if (!name || name.toLowerCase() === own.toLowerCase()) continue;
      names.add(name);
    }
    const teams = [...names].sort((a, b) => a.localeCompare(b));
    const comps = [...new Set(matches.map((m) => m.competition.trim()).filter(Boolean))].sort();
    const all: CrestRow[] = [
      ...(own ? [{ kind: "team" as CrestKind, name: own, own: true }] : []),
      ...comps.map((name) => ({ kind: "competition" as CrestKind, name })),
      ...teams.map((name) => ({ kind: "team" as CrestKind, name })),
    ];
    return all;
  }, [matches, extraTeams, clubName]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? allRows.filter((r) => r.name.toLowerCase().includes(q)) : allRows;
  }, [allRows, query]);

  const missing = rows.filter((r) => crestFor(lookup, r.kind, r.name) === null).length;

  function pick(kind: CrestKind, name: string) {
    pending.current = { kind, name };
    inputRef.current?.click();
  }

  async function handleFile(file: File) {
    const target = pending.current;
    if (!target) return;
    const key = `${target.kind}:${target.name}`;
    setBusyKey(key);
    setError("");
    try {
      const saved = await uploadCrest(target.kind, target.name, file);
      // Fill in every other spelling of the same club at the same time. This
      // is what stops a badge showing in Match Centre but not the league
      // table: both spellings now resolve by exact name, so it no longer
      // depends on any clever matching at read time.
      const group = allRows.filter(
        (r) => r.kind === target.kind
          && r.name !== target.name
          && canonKey(r.name) === canonKey(target.name)
      );
      for (const alias of group) {
        await saveCrestAlias(alias.kind, alias.name, saved.crest_url);
      }
      invalidateCrestCache();
      await load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload that crest.");
    } finally {
      setBusyKey(null);
      pending.current = null;
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  // One-click repair for badges uploaded before aliasing existed: for any row
  // with no crest stored under its exact name, find one stored under another
  // spelling of the same club and point this name at it too.
  async function repairSpellings() {
    setRepairing(true);
    setError("");
    try {
      const exact = new Set(crests.map((c) => `${c.kind}:${c.name.trim().toLowerCase()}`));
      let fixed = 0;
      for (const row of allRows) {
        if (exact.has(`${row.kind}:${row.name.trim().toLowerCase()}`)) continue;
        const source = crests.find((c) => c.kind === row.kind && canonKey(c.name) === canonKey(row.name));
        if (!source) continue;
        await saveCrestAlias(row.kind, row.name, source.crest_url);
        fixed++;
      }
      setRepairNote(fixed === 0 ? "Nothing to fix — every badge already matches its team name." : `Filled in ${fixed} name${fixed === 1 ? "" : "s"}.`);
      invalidateCrestCache();
      await load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't fill in the missing names.");
    } finally {
      setRepairing(false);
    }
  }

  async function handleRemove(kind: CrestKind, name: string) {
    // Remove the alias rows alongside the real one, otherwise deleting a badge
    // from one spelling would leave it showing under another.
    const group = crests.filter((c) => c.kind === kind && canonKey(c.name) === canonKey(name));
    if (group.length === 0) return;
    setBusyKey(`${kind}:${name}`);
    try {
      for (const crest of group) await deleteCrest(crest);
      invalidateCrestCache();
      await load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove that crest.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <Card className="max-h-[88dvh] w-full max-w-lg overflow-y-auto">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-medium">Team & League Crests</p>
          <button onClick={onClose} className="text-neutral-400 hover:text-white"><X size={18} /></button>
        </div>

        <p className="mb-3 text-xs text-neutral-400">
          Upload your own club badge — pinned at the top — plus one for any opponent or competition in your fixture
          list. Your club&apos;s badge shows in the sidebar and mobile menu; opponent badges appear beside their name
          everywhere. Until a crest is uploaded the app shows an initials badge in a colour picked from the team&apos;s
          name, so nothing looks unfinished. PNG with a transparent background works best.
        </p>

        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search teams or competitions…"
            className="w-full rounded-xl border border-white/10 bg-navy-600 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
          />
        </div>

        {error && <p className="mb-2 text-xs text-red-300">{error}</p>}

        {!loading && missing > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="text-xs text-amber-300">{missing} of {rows.length} still using initials.</p>
            <button
              onClick={repairSpellings}
              disabled={repairing}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-neutral-300 hover:bg-navy-600 disabled:opacity-60 dark:hover:bg-navy-800"
            >
              {repairing ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
              Fill in alternative spellings
            </button>
          </div>
        )}
        {repairNote && <p className="mb-2 text-xs text-emerald-300">{repairNote}</p>}

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {loading ? (
          <p className="py-6 text-center text-sm text-neutral-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-400">Nothing matches that search.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {rows.map((row) => {
              const key = `${row.kind}:${row.name}`;
              const has = crestFor(lookup, row.kind, row.name) !== null;
              const busy = busyKey === key;
              return (
                <li key={key} className={`flex items-center gap-3 py-2.5 ${row.own ? "rounded-lg bg-club-primary/5 px-2" : ""}`}>
                  <TeamCrest name={row.name} kind={row.kind} size="md" lookup={lookup} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{row.name}</p>
                    <p className="text-[11px] text-neutral-500">
                      {row.own ? "Your club" : row.kind === "competition" ? "Competition" : "Opponent"}
                      {has ? " · crest uploaded" : row.own ? " · using the bundled badge" : " · using initials"}
                    </p>
                  </div>
                  <button
                    onClick={() => pick(row.kind, row.name)}
                    disabled={busy}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-neutral-300 hover:bg-navy-600 disabled:opacity-60 dark:hover:bg-navy-800"
                  >
                    {busy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    {has ? "Replace" : "Upload"}
                  </button>
                  {has && (
                    <button
                      onClick={() => handleRemove(row.kind, row.name)}
                      disabled={busy}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10 disabled:opacity-60"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
