"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { TeamCrest } from "@/components/team-crest";
import type { CrestLookup } from "@/lib/team-crests-db";
import type { DbPlayer } from "@/lib/players-db";
import type { DbMatch } from "@/lib/matches-db";
import {
  fetchAllLineups, syncLineupToMatchCentre, slotName, isTrialistSlot,
  type DbLineup,
} from "@/lib/lineups-db";
import {
  ClipboardList, ChevronDown, ChevronRight, RefreshCw, Loader2, Check, AlertTriangle, ExternalLink,
} from "lucide-react";

// Every side picked this season, newest first, with the fixture it was picked
// for. Expanding one shows the XI and bench as they were named.
//
// The re-push button matters more than it looks: selections made before the
// fixture sync existed were never written to Match Centre, so this is how a
// season's worth of old team sheets get pushed through without re-entering
// any of them.
export function PastSelections({
  matches,
  players,
  crestLookup,
}: {
  matches: DbMatch[];
  players: DbPlayer[];
  crestLookup: CrestLookup | null;
}) {
  const [lineups, setLineups] = useState<DbLineup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState("");
  const [pushing, setPushing] = useState("");
  const [pushed, setPushed] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchAllLineups()
      .then(setLineups)
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "";
        setError(
          /relation|does not exist|schema cache/i.test(msg)
            ? "Line-ups aren't set up yet — run supabase-match-lineups.sql in Supabase."
            : msg || "Couldn't load previous selections."
        );
      })
      .finally(() => setLoading(false));
  }, []);

  // Sorted by kickoff rather than by when the row was last touched — a side
  // corrected last night shouldn't jump above this weekend's fixture.
  const rows = useMemo(() => {
    return lineups
      .map((l) => ({ lineup: l, match: matches.find((m) => m.id === l.match_id) ?? null }))
      .sort((a, b) => {
        const at = a.match ? new Date(a.match.kickoff).getTime() : 0;
        const bt = b.match ? new Date(b.match.kickoff).getTime() : 0;
        return bt - at;
      });
  }, [lineups, matches]);

  async function push(lineup: DbLineup) {
    setPushing(lineup.match_id);
    setError("");
    try {
      const written = await syncLineupToMatchCentre(lineup, players);
      setPushed((p) => ({ ...p, [lineup.match_id]: `${written} ${written === 1 ? "name" : "names"} pushed` }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't push that selection to its fixture.");
    } finally {
      setPushing("");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Previous Selections</CardTitle>
        <ClipboardList size={18} className="text-neutral-400" />
      </CardHeader>

      <p className="mb-3 text-xs text-neutral-400">
        Every side picked this season and the fixture it was picked for. Sides selected before fixtures started syncing
        won&apos;t be showing in Match Centre — use Push to fixture to send one across without re-entering it.
      </p>

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-neutral-400">No team selections saved yet.</p>
      ) : (
        <ul className="divide-y divide-white/10">
          {rows.map(({ lineup, match }) => {
            const open = openId === lineup.match_id;
            const label = match
              ? `${match.is_home ? "vs" : "@"} ${match.opponent}`
              : "Fixture no longer in the list";
            return (
              <li key={lineup.match_id}>
                <div className="flex items-center gap-2 py-2.5">
                  <button
                    onClick={() => setOpenId(open ? "" : lineup.match_id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    {open ? <ChevronDown size={14} className="shrink-0 text-neutral-500" /> : <ChevronRight size={14} className="shrink-0 text-neutral-500" />}
                    {match && <TeamCrest name={match.opponent} size="sm" lookup={crestLookup} />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{label}</span>
                      <span className="block text-[11px] text-neutral-500">
                        {match ? new Date(match.kickoff).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "—"}
                        {" · "}{lineup.formation}
                        {" · "}{lineup.starters.length} + {lineup.subs.length} sub{lineup.subs.length === 1 ? "" : "s"}
                      </span>
                    </span>
                  </button>

                  {lineup.published_at ? (
                    <Badge variant="green">Published</Badge>
                  ) : (
                    <Badge variant="neutral">Draft</Badge>
                  )}

                  <button
                    onClick={() => push(lineup)}
                    disabled={pushing === lineup.match_id || lineup.starters.length === 0}
                    title="Write this selection onto the fixture"
                    className="flex shrink-0 touch-manipulation items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-neutral-200 hover:bg-navy-600 disabled:opacity-40 dark:hover:bg-navy-800"
                  >
                    {pushing === lineup.match_id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    Push
                  </button>

                  <Link
                    href="/manager/lineup"
                    title="Open team selection"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:text-white"
                  >
                    <ExternalLink size={13} />
                  </Link>
                </div>

                {pushed[lineup.match_id] && (
                  <p className="flex items-center gap-1.5 pb-2 pl-6 text-[11px] text-emerald-300">
                    <Check size={12} /> {pushed[lineup.match_id]} — this fixture now shows the same team everywhere.
                  </p>
                )}

                {open && (
                  <div className="grid grid-cols-1 gap-4 pb-3 pl-6 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Starting XI</p>
                      <ol className="space-y-1">
                        {lineup.starters.map((s, i) => {
                          const p = players.find((x) => x.id === s.playerId);
                          return (
                            <li key={s.playerId} className="flex items-center gap-2 text-xs">
                              <span className="w-4 shrink-0 tabular-nums text-neutral-500">{i + 1}</span>
                              {p && <PlayerAvatar playerId={p.id} initials={p.initials} photoUrl={p.photo_url} size="sm" />}
                              <span className="min-w-0 flex-1 truncate">
                                {slotName(players, s)}
                                {lineup.captain_id === s.playerId && <span className="text-club-primary"> (C)</span>}
                                {isTrialistSlot(s) && <span className="text-amber-300"> · trialist</span>}
                              </span>
                              <span className="shrink-0 text-neutral-500">{s.position}</span>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Substitutes</p>
                      {lineup.subs.length === 0 ? (
                        <p className="text-xs text-neutral-500">None named.</p>
                      ) : (
                        <ol className="space-y-1">
                          {lineup.subs.map((s, i) => {
                            const p = players.find((x) => x.id === s.playerId);
                            return (
                              <li key={s.playerId} className="flex items-center gap-2 text-xs">
                                <span className="w-4 shrink-0 tabular-nums text-neutral-500">{i + 1}</span>
                                {p && <PlayerAvatar playerId={p.id} initials={p.initials} photoUrl={p.photo_url} size="sm" />}
                                <span className="min-w-0 flex-1 truncate">
                                  {slotName(players, s)}
                                  {isTrialistSlot(s) && <span className="text-amber-300"> · trialist</span>}
                                </span>
                              </li>
                            );
                          })}
                        </ol>
                      )}
                      {lineup.notes && (
                        <p className="mt-2 text-[11px] text-neutral-400">{lineup.notes}</p>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
