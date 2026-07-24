import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { players } from "@/lib/sample-data";
import Link from "next/link";

const statusVariant = { green: "green", amber: "amber", red: "red" } as const;
const groupOrder = ["GK", "DEF", "MID", "FWD"] as const;
const groupLabel = { GK: "Goalkeepers", DEF: "Defenders", MID: "Midfielders", FWD: "Forwards" };

export default function PlayersPage() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Players</h1>
        <p className="text-sm text-neutral-500">{players.length} players in the first-team squad.</p>
      </div>

      <div className="space-y-8">
        {groupOrder.map((group) => {
          const groupPlayers = players.filter((p) => p.positionGroup === group);
          if (groupPlayers.length === 0) return null;
          return (
            <div key={group}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                {groupLabel[group]}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {groupPlayers.map((p) => (
                  <Link key={p.id} href={`/players/${p.id}`}>
                    <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-600 dark:bg-navy-800 text-sm font-semibold shrink-0">
                          {p.initials}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{p.name}</p>
                          <p className="text-xs text-neutral-400">#{p.squadNumber} · {p.position}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <Badge variant={statusVariant[p.availability]}>
                          {p.availability === "green" ? "Available" : p.availability === "amber" ? "Doubtful" : "Unavailable"}
                        </Badge>
                        <span className="text-xs text-neutral-400">{p.appearances} apps</span>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
