"use client";

import { X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TeamCrest, useCrestLookup } from "@/components/team-crest";
import type { DbLeagueRow } from "@/lib/league-table-db";

// The full division, every team with its badge — the dashboard card only has
// room for the few places either side of us. Opened from "Full table" there.
export function LeagueTableModal({
  league, competition = "League Table", onClose,
}: {
  league: DbLeagueRow[];
  competition?: string;
  onClose: () => void;
}) {
  const crestLookup = useCrestLookup();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <Card className="max-h-[88dvh] w-full max-w-2xl overflow-y-auto">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-medium">{competition}</p>
          <button onClick={onClose} aria-label="Close table" className="touch-manipulation text-neutral-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {league.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-400">No league table set up yet.</p>
        ) : (
          // The full set of columns doesn't fit a phone, so it scrolls
          // sideways rather than squeezing the team names to nothing.
          <div className="-mx-1 overflow-x-auto px-1 touch-pan-x">
            <table className="w-full min-w-[420px] text-xs">
              <thead>
                <tr className="border-b border-white/10 text-left text-neutral-500">
                  <th className="pb-2 pr-2 font-medium">#</th>
                  <th className="pb-2 pr-2 font-medium">Team</th>
                  <th className="pb-2 px-1.5 text-center font-medium">P</th>
                  <th className="pb-2 px-1.5 text-center font-medium">W</th>
                  <th className="pb-2 px-1.5 text-center font-medium">D</th>
                  <th className="pb-2 px-1.5 text-center font-medium">L</th>
                  <th className="pb-2 px-1.5 text-center font-medium">GF</th>
                  <th className="pb-2 px-1.5 text-center font-medium">GA</th>
                  <th className="pb-2 px-1.5 text-center font-medium">GD</th>
                  <th className="pb-2 pl-1.5 text-center font-medium">Pts</th>
                </tr>
              </thead>
              <tbody>
                {league.map((r) => {
                  const gd = r.goals_for - r.goals_against;
                  return (
                    <tr
                      key={r.id}
                      className={`border-b border-white/5 last:border-0 ${
                        r.is_own_club ? "bg-club-primary/10 font-semibold text-club-primary" : "text-neutral-300"
                      }`}
                    >
                      <td className="py-2 pr-2 tabular-nums">{r.position}</td>
                      <td className="py-2 pr-2">
                        <span className="flex items-center gap-2">
                          <span className="min-w-0 truncate">{r.team}</span>
                          <TeamCrest name={r.team} size="sm" lookup={crestLookup} />
                        </span>
                      </td>
                      <td className="px-1.5 py-2 text-center tabular-nums">{r.played}</td>
                      <td className="px-1.5 py-2 text-center tabular-nums">{r.won}</td>
                      <td className="px-1.5 py-2 text-center tabular-nums">{r.drawn}</td>
                      <td className="px-1.5 py-2 text-center tabular-nums">{r.lost}</td>
                      <td className="px-1.5 py-2 text-center tabular-nums">{r.goals_for}</td>
                      <td className="px-1.5 py-2 text-center tabular-nums">{r.goals_against}</td>
                      <td className="px-1.5 py-2 text-center tabular-nums">{gd > 0 ? `+${gd}` : gd}</td>
                      <td className="py-2 pl-1.5 text-center font-semibold tabular-nums">{r.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
