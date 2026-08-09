"use client";

import { useEffect, useState } from "react";
import { GPS_METRICS } from "@/lib/gps-db";
import {
  fetchHiddenMetrics, setMetricHidden, NO_HIDDEN, type HiddenMetrics,
} from "@/lib/hidden-metrics-db";
import { Columns3, Loader2, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";

// Choose which of the built-in GPS columns appear on the tables.
//
// Unticking hides the column everywhere — the GPS card here, the panel on a
// player's profile and the GPS section under each fixture. It does not stop the
// figures being imported or stored, so a column switched back on still has all
// its history. That's the right trade for a fixed set of metrics: a club whose
// kit doesn't measure power score wants the column gone, not their data.
export function GpsColumns({ onChanged }: { onChanged?: (hidden: HiddenMetrics) => void }) {
  const [hidden, setHidden] = useState<HiddenMetrics>(NO_HIDDEN);
  const [open, setOpen] = useState(false);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchHiddenMetrics().then(setHidden).catch(() => {});
  }, []);

  async function toggle(key: string, show: boolean) {
    setBusyKey(key);
    setError("");
    try {
      await setMetricHidden("gps", key, !show);
      const next = await fetchHiddenMetrics();
      setHidden(next);
      onChanged?.(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setBusyKey("");
    }
  }

  const hiddenCount = GPS_METRICS.filter((m) => hidden.has("gps", m.key)).length;

  return (
    <div className="rounded-xl border border-white/10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-neutral-300 hover:text-white"
      >
        {open ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
        <Columns3 size={14} className="shrink-0 text-neutral-400" />
        <span className="flex-1">Columns</span>
        <span className="text-xs text-neutral-500">
          {hiddenCount === 0 ? "all showing" : `${hiddenCount} hidden`}
        </span>
      </button>

      {open && (
        <div className="border-t border-white/10 p-3">
          <p className="mb-2.5 text-xs text-neutral-400">
            Untick anything your GPS kit doesn&apos;t record, or that you simply don&apos;t want on the table. The
            readings are still imported and kept, so ticking it again brings the history back with it.
          </p>

          {error && (
            <div className="mb-2.5 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {GPS_METRICS.map((m) => {
              const shown = !hidden.has("gps", m.key);
              return (
                <label
                  key={m.key}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-navy-600 dark:hover:bg-navy-800"
                >
                  <input
                    type="checkbox"
                    checked={shown}
                    disabled={busyKey === m.key}
                    onChange={(e) => toggle(m.key, e.target.checked)}
                    className="h-4 w-4 shrink-0 accent-club-primary"
                  />
                  <span className={shown ? "" : "text-neutral-500 line-through"}>
                    {m.label}{m.unit ? <span className="text-neutral-500"> ({m.unit})</span> : null}
                  </span>
                  {busyKey === m.key && <Loader2 size={12} className="animate-spin text-neutral-500" />}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
