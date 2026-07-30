"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { opposition } from "@/lib/sample-data";
import { fetchMatches, type DbMatch } from "@/lib/matches-db";
import { supabaseConfigured } from "@/lib/supabase";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { TeamCrest, useCrestLookup } from "@/components/team-crest";

const formColor: Record<string, string> = {
  W: "bg-emerald-500", D: "bg-amber-400", L: "bg-red-500",
};

const statusVariant = { "Not started": "neutral", "In progress": "amber", Ready: "green" } as const;

function ordinal(n: number) {
  return n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function OppositionPage() {
  const [matches, setMatches] = useState<DbMatch[]>([]);
  const [loading, setLoading] = useState(true);
  // One fetch shared by every card, rather than one per crest.
  const crestLookup = useCrestLookup();

  useEffect(() => {
    fetchMatches()
      .then(setMatches)
      .finally(() => setLoading(false));
  }, []);

  const now = Date.now();
  const upcoming = matches
    .filter((m) => new Date(m.kickoff).getTime() >= now && m.status !== "cancelled")
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());

  // Match each upcoming fixture's opponent to any manually-written scouting
  // profile we have on file — this is just for showing extra detail (form,
  // league position) on the card. Every opponent is clickable regardless,
  // since scouting reports and head-to-head data can be added for any of
  // them straight from their page, whether or not a profile exists yet.
  const norm = (s: string) => s.trim().toLowerCase();
  const upcomingWithReports = upcoming.map((m) => {
    const report = opposition.find((o) => norm(o.name) === norm(m.opponent));
    return { match: m, report };
  });

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Opposition</h1>
        <p className="text-sm text-neutral-500">Scouting reports for upcoming and recent opponents, synced with the Match Centre.</p>
      </div>

      {!supabaseConfigured && (
        <Card className="mb-6 flex items-start gap-3 border-amber-500/30 bg-amber-500/10">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-300" />
          <p className="text-sm text-amber-200">Supabase isn&apos;t connected on this deployment yet, so upcoming opponents can&apos;t be loaded here.</p>
        </Card>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Upcoming Opponents ({upcoming.length})
      </h2>

      {loading ? (
        <p className="text-sm text-neutral-400">Loading fixtures…</p>
      ) : upcomingWithReports.length === 0 ? (
        <Card className="mb-8 flex flex-col items-center justify-center py-12 text-center">
          <p className="font-medium">No upcoming fixtures yet</p>
          <p className="mt-1 max-w-sm text-sm text-neutral-400">
            Add fixtures or sync them in the Match Centre and opponents will show up here automatically.
          </p>
        </Card>
      ) : (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {upcomingWithReports.map(({ match, report }) => {
            const card = (
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <TeamCrest name={match.opponent} size="md" lookup={crestLookup} />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{match.opponent}</p>
                      <p className="text-xs text-neutral-400 truncate">
                        {match.competition}{report ? ` · ${report.formation} · ${report.leaguePosition}${ordinal(report.leaguePosition)} in league` : ""}
                      </p>
                    </div>
                  </div>
                  <Badge variant={report ? statusVariant[report.reportStatus] : "neutral"} className="shrink-0">
                    {report ? report.reportStatus : "Add scouting report"}
                  </Badge>
                </div>

                <p className="mt-3 text-xs text-neutral-500">
                  {match.is_home ? "Home" : "Away"} · {formatDate(match.kickoff)}{match.venue ? ` · ${match.venue}` : ""}
                </p>

                {report && (
                  <div className="mt-4 flex items-center gap-1.5">
                    <span className="text-xs text-neutral-400 mr-1">Form:</span>
                    {report.form.map((r, i) => (
                      <span key={i} className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white ${formColor[r]}`}>
                        {r}
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            );
            return (
              <Link key={match.id} href={`/opposition/${encodeURIComponent(match.opponent)}`}>{card}</Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
