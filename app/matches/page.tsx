import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { matches } from "@/lib/sample-data";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function MatchesPage() {
  const upcoming = matches.filter((m) => m.status === "upcoming");
  const completed = matches.filter((m) => m.status === "completed");

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Match Centre</h1>
        <p className="text-sm text-neutral-500">Fixtures, results, and match preparation.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">Upcoming</h2>
          <div className="space-y-3">
            {upcoming.map((m) => (
              <Card key={m.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">vs {m.opponent}</p>
                  <p className="text-xs text-neutral-400">{m.competition}</p>
                  <p className="text-xs text-neutral-400">{formatDate(m.date)}</p>
                </div>
                <Badge variant="neutral">{m.venue}</Badge>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">Results</h2>
          <div className="space-y-3">
            {completed.map((m) => {
              const won = (m.scoreFor ?? 0) > (m.scoreAgainst ?? 0);
              const drawn = m.scoreFor === m.scoreAgainst;
              return (
                <Card key={m.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">vs {m.opponent}</p>
                    <p className="text-xs text-neutral-400">{m.competition}</p>
                    <p className="text-xs text-neutral-400">{formatDate(m.date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold">{m.scoreFor} – {m.scoreAgainst}</p>
                    <Badge variant={won ? "green" : drawn ? "amber" : "red"}>
                      {won ? "WIN" : drawn ? "DRAW" : "LOSS"}
                    </Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
