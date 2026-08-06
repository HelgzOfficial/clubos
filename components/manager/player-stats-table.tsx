"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/players/player-avatar";
import type { DbPlayer } from "@/lib/players-db";
import type { DbMatch } from "@/lib/matches-db";
import { disciplineByPlayer, type DbPlayerCard } from "@/lib/manager-db";
import { SEASON_START_LABEL } from "@/lib/season";
import { BarChart3, Download, ArrowUpDown } from "lucide-react";

type SortKey = "name" | "appearances" | "goals" | "assists" | "yellow" | "red" | "points" | "contributions";

const COLUMNS: { key: SortKey; label: string; short: string; numeric: boolean }[] = [
  { key: "name", label: "Player", short: "Player", numeric: false },
  { key: "appearances", label: "Games played", short: "Games", numeric: true },
  { key: "goals", label: "Goals", short: "Goals", numeric: true },
  { key: "assists", label: "Assists", short: "Assists", numeric: true },
  { key: "contributions", label: "Goals + assists", short: "G+A", numeric: true },
  { key: "yellow", label: "Yellow cards", short: "Yellow", numeric: true },
  { key: "red", label: "Red cards", short: "Red", numeric: true },
  { key: "points", label: "Discipline points", short: "Pts", numeric: true },
];

// Games, goals, assists and cards for the whole squad on one screen.
//
// Appearances, goals and assists come from the player records the app keeps in
// step with match data; cards are counted live from the discipline log. Both
// use the same season rule as everywhere else — competitive fixtures from the
// season opener onwards — so this can't disagree with the analyst dashboard.
export function PlayerStatsTable({
  players,
  cards,
  matches,
}: {
  players: DbPlayer[];
  cards: DbPlayerCard[];
  matches: DbMatch[];
}) {
  const [sort, setSort] = useState<SortKey>("appearances");
  const [desc, setDesc] = useState(true);

  const rows = useMemo(() => {
    const discipline = disciplineByPlayer(cards, matches);
    return players.map((p) => {
      const d = discipline.get(p.id) ?? { yellow: 0, red: 0, points: 0 };
      return {
        player: p,
        appearances: p.appearances ?? 0,
        goals: p.goals ?? 0,
        assists: p.assists ?? 0,
        contributions: (p.goals ?? 0) + (p.assists ?? 0),
        yellow: d.yellow,
        red: d.red,
        points: d.points,
      };
    });
  }, [players, cards, matches]);

  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      if (sort === "name") return a.player.name.localeCompare(b.player.name);
      const av = a[sort] as number;
      const bv = b[sort] as number;
      // Ties fall back to name so the order doesn't jitter between renders.
      return bv - av || a.player.name.localeCompare(b.player.name);
    });
    return desc || sort === "name" ? out : out.reverse();
  }, [rows, sort, desc]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (t, r) => ({
          appearances: t.appearances + r.appearances,
          goals: t.goals + r.goals,
          assists: t.assists + r.assists,
          yellow: t.yellow + r.yellow,
          red: t.red + r.red,
        }),
        { appearances: 0, goals: 0, assists: 0, yellow: 0, red: 0 }
      ),
    [rows]
  );

  function toggleSort(key: SortKey) {
    if (key === sort) setDesc((d) => !d);
    else {
      setSort(key);
      setDesc(true);
    }
  }

  function download() {
    const header = COLUMNS.map((c) => c.label);
    const lines = [header.join(",")];
    for (const r of sorted) {
      lines.push([
        `"${r.player.name.replace(/"/g, '""')}"`,
        r.appearances, r.goals, r.assists, r.contributions, r.yellow, r.red, r.points,
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "player-stats.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Player Stats</CardTitle>
        <BarChart3 size={18} className="text-neutral-400" />
      </CardHeader>

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Tile label="Games" value={totals.appearances} />
        <Tile label="Goals" value={totals.goals} tone="text-emerald-300" />
        <Tile label="Assists" value={totals.assists} tone="text-blue-300" />
        <Tile label="Yellows" value={totals.yellow} tone="text-amber-300" />
        <Tile label="Reds" value={totals.red} tone="text-red-300" />
      </div>

      <p className="mb-2 text-xs text-neutral-400">
        Competitive fixtures from {SEASON_START_LABEL} onwards. Friendlies are excluded, matching the rest of the app.
        Tap a column to sort.
      </p>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-xs">
          <thead className="bg-navy-600/50 dark:bg-navy-800/50">
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  title={c.label}
                  className={`cursor-pointer whitespace-nowrap px-2 py-2 font-medium text-neutral-400 hover:text-white ${
                    c.numeric ? "text-right" : "text-left"
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.short}
                    {sort === c.key && <ArrowUpDown size={10} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {sorted.map((r) => (
              <tr key={r.player.id}>
                <td className="whitespace-nowrap px-2 py-1.5">
                  <Link href={`/players/${r.player.id}`} className="flex items-center gap-1.5 hover:text-club-primary">
                    <PlayerAvatar playerId={r.player.id} initials={r.player.initials} photoUrl={r.player.photo_url} size="sm" />
                    <span className="truncate">{r.player.name}</span>
                    <span className="shrink-0 text-neutral-600">#{r.player.squad_number}</span>
                  </Link>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{r.appearances}</td>
                <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{r.goals || "—"}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{r.assists || "—"}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-neutral-400">{r.contributions || "—"}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {r.yellow > 0 ? <span className="text-amber-300">{r.yellow}</span> : "—"}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {r.red > 0 ? <span className="text-red-300">{r.red}</span> : "—"}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-neutral-400">{r.points || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={download}
        className="mt-3 flex touch-manipulation items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800"
      >
        <Download size={14} /> Download CSV
      </button>
    </Card>
  );
}

function Tile({ label, value, tone = "" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-white/10 p-2.5 text-center">
      <p className={`text-lg font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="text-[10px] text-neutral-400">{label}</p>
    </div>
  );
}
