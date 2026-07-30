"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchMatchPacks, normaliseBlocks, type DbMatchPack } from "@/lib/match-packs-db";
import { fetchMatches, type DbMatch } from "@/lib/matches-db";
import { Package, ChevronRight } from "lucide-react";

// The interactive match packs built in Analysis, surfaced wherever else they're
// useful — currently the Documents module, so packs sit alongside the uploaded
// files rather than being hidden inside Analysis. Read-only here: building and
// editing stays in the pack builder itself.
export function MatchPackList({ limit = 6 }: { limit?: number }) {
  const [packs, setPacks] = useState<DbMatchPack[]>([]);
  const [matches, setMatches] = useState<DbMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchMatchPacks(), fetchMatches()])
      .then(([p, m]) => {
        if (cancelled) return;
        setPacks(p);
        setMatches(m);
      })
      .catch(() => { /* empty state covers it */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const matchById = useMemo(() => new Map(matches.map((m) => [m.id, m])), [matches]);

  if (loading) return null;

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle>Interactive Match Packs</CardTitle>
        <Link href="/analysis/match-packs" className="text-xs text-club-primary hover:underline">
          Manage all →
        </Link>
      </CardHeader>

      {packs.length === 0 ? (
        <div className="flex flex-col items-center py-6 text-center">
          <Package size={22} className="mb-2 text-neutral-500" />
          <p className="text-sm text-neutral-400">No match packs built yet.</p>
          <Link href="/analysis/match-packs" className="mt-2 text-xs text-club-primary hover:underline">
            Build one in Analysis →
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-white/10">
          {packs.slice(0, limit).map((pack) => {
            const match = pack.match_id ? matchById.get(pack.match_id) : undefined;
            const blockCount = normaliseBlocks(pack.items).length;
            return (
              <li key={pack.id}>
                <Link
                  href={`/analysis/match-packs/${pack.id}`}
                  className="flex items-center gap-3 py-2.5 transition-colors hover:text-club-primary"
                >
                  <Package size={15} className="shrink-0 text-club-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{pack.title}</p>
                    <p className="text-[11px] text-neutral-500">
                      {match ? `${match.is_home ? "vs" : "@"} ${match.opponent} · ` : ""}
                      {blockCount} section{blockCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  {blockCount === 0 && <Badge variant="neutral">Empty</Badge>}
                  <ChevronRight size={14} className="shrink-0 text-neutral-500" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
