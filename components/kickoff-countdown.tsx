"use client";

import { useEffect, useState } from "react";
import { Timer, Radio, CheckCircle2 } from "lucide-react";

// Roughly how long a game plus half time runs. After this, a fixture whose
// result hasn't been entered yet stops saying "in progress" and starts saying
// "played" — a countdown that reads LIVE three days later is worse than no
// countdown at all.
const MATCH_MINUTES = 115;

type Phase = "upcoming" | "live" | "done";

function partsFor(ms: number) {
  const total = Math.floor(ms / 1000);
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

// Deliberately coarse further out and precise close in — "3 days" is all
// anyone needs on a Tuesday, but at ten to three on a Saturday the minutes
// matter.
function label(ms: number): string {
  const { days, hours, minutes, seconds } = partsFor(ms);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function KickoffCountdown({
  kickoff,
  className = "",
}: {
  kickoff: string;
  className?: string;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Nothing on the server — see LiveClock for why.
  if (now === null) return null;

  const start = new Date(kickoff).getTime();
  if (Number.isNaN(start)) return null;

  const untilKickoff = start - now;
  const sinceKickoff = now - start;

  const phase: Phase =
    untilKickoff > 0 ? "upcoming" : sinceKickoff < MATCH_MINUTES * 60_000 ? "live" : "done";

  if (phase === "live") {
    const { hours, minutes } = partsFor(sinceKickoff);
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-lg bg-red-500/15 px-2 py-1 text-xs font-semibold text-red-300 ${className}`}>
        <Radio size={12} className="animate-pulse" />
        Kicked off {hours > 0 ? `${hours}h ` : ""}{minutes}m ago
      </span>
    );
  }

  if (phase === "done") {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1 text-xs font-medium text-neutral-400 ${className}`}>
        <CheckCircle2 size={12} /> Played
      </span>
    );
  }

  // Under an hour is the point where this stops being trivia and starts being
  // something you act on, so it changes colour rather than just counting.
  const urgent = untilKickoff < 60 * 60_000;
  const soon = untilKickoff < 24 * 60 * 60_000;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold tabular-nums ${
        urgent
          ? "bg-red-500/15 text-red-300"
          : soon
            ? "bg-amber-500/15 text-amber-300"
            : "bg-club-primary/15 text-club-primary"
      } ${className}`}
      title={`Kick-off ${new Date(kickoff).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" })}`}
    >
      <Timer size={12} /> {label(untilKickoff)} to kick-off
    </span>
  );
}
