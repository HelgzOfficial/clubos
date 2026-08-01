"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { TeamCrest, useCrestLookup } from "@/components/team-crest";
import { LineupEditor } from "@/components/manager/lineup-editor";
import { usePermissions } from "@/lib/permissions";
import { club as clubFallback } from "@/lib/sample-data";
import { loadClubSettings } from "@/lib/club-settings";
import { fetchClubSettings } from "@/lib/club-settings-db";
import { fetchMatches, upcomingMatches, playedMatches, type DbMatch } from "@/lib/matches-db";
import { ArrowLeft, ShieldAlert } from "lucide-react";

// The page is now just a fixture picker wrapped around the editor. All the
// selection behaviour lives in LineupEditor, which Match Centre also uses, so
// there is exactly one team-selection screen in the app rather than two that
// slowly diverge.
export default function LineupPage() {
  const { can, appUser, loading: permsLoading } = usePermissions();
  const allowed = can("manager");
  const crestLookup = useCrestLookup();

  const [matches, setMatches] = useState<DbMatch[]>([]);
  const [matchId, setMatchId] = useState("");
  const [clubName, setClubName] = useState(clubFallback.name);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!allowed) return;
    fetchMatches()
      .then((m) => {
        setMatches(m);
        setMatchId((prev) => prev || upcomingMatches(m)[0]?.id || playedMatches(m)[0]?.id || "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the fixtures."))
      .finally(() => setLoading(false));

    setClubName(loadClubSettings(clubFallback).name);
    fetchClubSettings(clubFallback).then((s) => setClubName(s.name)).catch(() => {});
  }, [allowed]);

  if (permsLoading) return <AppShell><p className="text-sm text-neutral-400">Loading…</p></AppShell>;

  if (!allowed) {
    return (
      <AppShell>
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldAlert size={24} className="mb-3 text-neutral-500" />
          <p className="font-medium">Manager access only</p>
          <p className="mt-1 text-sm text-neutral-400">Team selection is limited to the manager and the owner.</p>
        </Card>
      </AppShell>
    );
  }

  const match = matches.find((m) => m.id === matchId) ?? null;
  // Upcoming first, then recent results — a side is usually picked before a
  // game but sometimes recorded after one.
  const fixtures = [...upcomingMatches(matches), ...playedMatches(matches)];

  return (
    <AppShell>
      <Link href="/manager" className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-white">
        <ArrowLeft size={14} /> Back to Manager
      </Link>

      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Team Selection</h1>
        <p className="text-sm text-neutral-500">Pick the side, then read it straight into iFAS.</p>
      </div>

      {error && (
        <Card className="mb-4 border-amber-500/30 bg-amber-500/10">
          <p className="text-sm text-amber-200">{error}</p>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : fixtures.length === 0 ? (
        <p className="text-sm text-neutral-400">No fixtures to pick a side for yet.</p>
      ) : (
        <div className="space-y-5">
          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                value={matchId}
                onChange={(e) => setMatchId(e.target.value)}
                className="flex-1 rounded-lg border border-white/10 bg-navy-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
              >
                {fixtures.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.is_home ? "vs" : "@"} {m.opponent} · {new Date(m.kickoff).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </option>
                ))}
              </select>
              {match && <TeamCrest name={match.opponent} size="md" lookup={crestLookup} />}
            </div>
          </Card>

          <LineupEditor
            matchId={matchId}
            match={match}
            clubName={clubName}
            editorName={appUser?.name ?? null}
          />
        </div>
      )}
    </AppShell>
  );
}
