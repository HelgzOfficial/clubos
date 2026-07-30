"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Upload, Loader2, Trash2, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  fetchTeamCrests, uploadCrest, deleteCrest, buildCrestLookup, crestFor, canonKey,
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
  const rows = useMemo(() => {
    const own = clubName.trim();
    // Fixture opponents and league-table clubs are typed separately, so the
    // same club can appear as "Carshalton Athletic FC" in one and "Carshalton
    // Athletic" in the other. Dedupe on the loose key to keep one row per
    // club, and keep the longer spelling as the label since it's the more
    // complete one.
    const byClub = new Map<string, string>();
    for (const raw of [...matches.map((m) => m.opponent), ...extraTeams]) {
      const name = raw?.trim();
      if (!name || name.toLowerCase() === own.toLowerCase()) continue;
      const key = canonKey(name);
      const existing = byClub.get(key);
      if (!existing || name.length > existing.length) byClub.set(key, name);
    }
    const teams = [...byClub.values()].sort((a, b) => a.localeCompare(b));
    const comps = [...new Set(matches.map((m) => m.competition.trim()).filter(Boolean))].sort();
    const all: CrestRow[] = [
      ...(own ? [{ kind: "team" as CrestKind, name: own, own: true }] : []),
      ...comps.map((name) => ({ kind: "competition" as CrestKind, name })),
      ...teams.map((name) => ({ kind: "team" as CrestKind, name })),
    ];
    const q = query.trim().toLowerCase();
    return q ? all.filter((r) => r.name.toLowerCase().includes(q)) : all;
  }, [matches, extraTeams, query, clubName]);

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
      await uploadCrest(target.kind, target.name, file);
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

  async function handleRemove(kind: CrestKind, name: string) {
    const crest = crests.find((c) => c.kind === kind && c.name.toLowerCase() === name.toLowerCase());
    if (!crest) return;
    setBusyKey(`${kind}:${name}`);
    try {
      await deleteCrest(crest);
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
          <p className="mb-2 text-xs text-amber-300">
            {missing} of {rows.length} still using initials.
          </p>
        )}

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
