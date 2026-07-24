import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { opposition, matches } from "@/lib/sample-data";
import Link from "next/link";

const formColor: Record<string, string> = {
  W: "bg-emerald-500", D: "bg-amber-400", L: "bg-red-500",
};

const statusVariant = { "Not started": "neutral", "In progress": "amber", Ready: "green" } as const;

export default function OppositionPage() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Opposition</h1>
        <p className="text-sm text-neutral-500">Scouting reports for upcoming and recent opponents.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {opposition.map((o) => {
          const match = matches.find((m) => m.id === o.matchId);
          return (
            <Link key={o.id} href={`/opposition/${o.id}`}>
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{o.name}</p>
                    <p className="text-xs text-neutral-400">{o.formation} · {o.leaguePosition}{o.leaguePosition === 1 ? "st" : o.leaguePosition === 2 ? "nd" : o.leaguePosition === 3 ? "rd" : "th"} in league</p>
                  </div>
                  <Badge variant={statusVariant[o.reportStatus]}>{o.reportStatus}</Badge>
                </div>

                {match && (
                  <p className="mt-3 text-xs text-neutral-500">
                    {match.status === "upcoming" ? "Next meeting" : "Last meeting"}: {new Date(match.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · {match.venue}
                  </p>
                )}

                <div className="mt-4 flex items-center gap-1.5">
                  <span className="text-xs text-neutral-400 mr-1">Form:</span>
                  {o.form.map((r, i) => (
                    <span key={i} className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white ${formColor[r]}`}>
                      {r}
                    </span>
                  ))}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
