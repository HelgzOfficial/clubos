"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Loader2 } from "lucide-react";
import { fetchMatchPacks, createMatchPack, type DbMatchPack } from "@/lib/match-packs-db";
import { usePermissions } from "@/lib/permissions";

// Opens the match pack for a given fixture, creating it on the spot if one
// doesn't exist yet. Shared by the Opposition and Documents modules so the pack
// builder is reachable from wherever the analyst happens to be, rather than
// only from inside Analysis — and so both places behave identically.
export function MatchPackButton({
  matchId, opponent, kickoff, variant = "primary", className = "",
}: {
  matchId: string;
  opponent: string;
  kickoff?: string;
  variant?: "primary" | "subtle";
  className?: string;
}) {
  const router = useRouter();
  const { canWrite } = usePermissions();
  const canEdit = canWrite("analysis");

  const [existing, setExisting] = useState<DbMatchPack | null>(null);
  const [checking, setChecking] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchMatchPacks()
      .then((packs) => {
        if (!cancelled) setExisting(packs.find((p) => p.match_id === matchId) ?? null);
      })
      .catch(() => { /* falls back to offering to create one */ })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [matchId]);

  async function handleClick() {
    if (existing) {
      router.push(`/analysis/match-packs/${existing.id}`);
      return;
    }
    if (!canEdit) return;
    setWorking(true);
    setError("");
    try {
      const dateLabel = kickoff
        ? new Date(kickoff).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
        : "";
      const pack = await createMatchPack({
        matchId,
        title: `${opponent}${dateLabel ? ` — ${dateLabel}` : ""} match pack`,
      });
      router.push(`/analysis/match-packs/${pack.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start a match pack.");
      setWorking(false);
    }
  }

  // Nothing to offer someone who can't create one and has none to open.
  if (!checking && !existing && !canEdit) return null;

  const base = "flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60";
  const look = variant === "primary"
    ? "bg-club-primary text-navy-950 hover:opacity-90"
    : "border border-white/10 text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800";

  return (
    <div className={className}>
      <button onClick={handleClick} disabled={checking || working} className={`${base} ${look}`}>
        {working || checking ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
        {checking ? "Checking…" : working ? "Creating…" : existing ? "Open Match Pack" : "Build Match Pack"}
      </button>
      {error && <p className="mt-1.5 text-xs text-red-300">{error}</p>}
    </div>
  );
}
