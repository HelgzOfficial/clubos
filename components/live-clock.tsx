"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

// A live clock in the top bar, so it's on every module without each one
// having to add it.
//
// Nothing renders until after mount. The server has no idea what time it is
// where you are, so rendering a time during SSR guarantees a hydration
// mismatch — the markup React builds on the client would never match the
// markup that came down the wire.
export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    // Ticks on the second. A minute-long interval would drift and show a
    // clock that's visibly wrong for up to 59 seconds after a page load.
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    // Same footprint as the real thing, so the bar doesn't jump when it
    // appears a moment later.
    return <div className="hidden h-9 w-[104px] sm:block" aria-hidden />;
  }

  const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const date = now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div
      className="hidden shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-navy-700 px-2.5 py-1.5 sm:flex dark:bg-navy-900"
      title={now.toLocaleString("en-GB", { dateStyle: "full", timeStyle: "medium" })}
    >
      <Clock size={14} className="text-neutral-400" />
      <div className="leading-tight">
        <p className="text-sm font-semibold tabular-nums">{time}</p>
        <p className="hidden text-[10px] text-neutral-500 lg:block">{date}</p>
      </div>
    </div>
  );
}
