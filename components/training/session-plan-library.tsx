"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Download, Eye, Trash2, Search, Loader2 } from "lucide-react";
import { DocumentViewerModal } from "@/components/document-viewer-modal";
import {
  fetchAllTrainingPlans, deleteTrainingPlan,
  getTrainingPlanViewUrl, getTrainingPlanDownloadUrl,
  type DbTrainingPlan,
} from "@/lib/training-plans-db";

function prettyDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

// Every session plan ever uploaded, grouped by the day it was for. Shared
// between the staff Training Planner and the players' companion app so both
// read the same list — a plan uploaded by a coach is immediately viewable and
// downloadable by the squad, with no separate publish step to forget.
export function SessionPlanLibrary({
  canDelete = false, compact = false, onOpenDate, refreshKey = 0,
}: {
  canDelete?: boolean;
  // compact drops the search box and shows fewer entries — for the phone.
  compact?: boolean;
  onOpenDate?: (date: string) => void;
  // Bump to re-fetch after an upload elsewhere on the page.
  refreshKey?: number;
}) {
  const [plans, setPlans] = useState<DbTrainingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<DbTrainingPlan | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAllTrainingPlans(compact ? 30 : 200)
      .then((rows) => { if (!cancelled) setPlans(rows); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load session plans."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [compact, refreshKey]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? plans.filter((p) => p.file_name.toLowerCase().includes(q) || prettyDate(p.plan_date).toLowerCase().includes(q))
      : plans;
    const map = new Map<string, DbTrainingPlan[]>();
    for (const p of filtered) {
      const list = map.get(p.plan_date);
      if (list) list.push(p);
      else map.set(p.plan_date, [p]);
    }
    return [...map.entries()];
  }, [plans, query]);

  async function handleDownload(p: DbTrainingPlan) {
    setBusyId(p.id);
    setError("");
    try {
      window.open(await getTrainingPlanDownloadUrl(p.file_path), "_blank");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open that file.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(p: DbTrainingPlan) {
    if (!window.confirm(`Remove "${p.file_name}"?`)) return;
    setBusyId(p.id);
    try {
      await deleteTrainingPlan(p.id, p.file_path);
      setPlans((rows) => rows.filter((r) => r.id !== p.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove that plan.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="py-4 text-sm text-neutral-400">Loading session plans…</p>;

  return (
    <>
      {error && <p className="mb-2 text-xs text-red-300">{error}</p>}

      {!compact && plans.length > 0 && (
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by file name or date…"
            className="w-full rounded-xl border border-white/10 bg-navy-600 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
          />
        </div>
      )}

      {plans.length === 0 ? (
        <p className="py-4 text-sm text-neutral-400">No session plans have been uploaded yet.</p>
      ) : groups.length === 0 ? (
        <p className="py-4 text-sm text-neutral-400">Nothing matches that search.</p>
      ) : (
        <div className="space-y-4">
          {groups.map(([date, items]) => (
            <div key={date}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">{prettyDate(date)}</p>
                {onOpenDate && (
                  <button
                    onClick={() => onOpenDate(date)}
                    className="touch-manipulation text-[11px] text-club-primary hover:underline"
                  >
                    Open this day
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {items.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2.5 rounded-xl border border-white/10 px-3 py-2.5"
                  >
                    <FileText size={16} className="shrink-0 text-club-primary" />
                    <p className="min-w-0 flex-1 truncate text-sm">{p.file_name}</p>
                    <button
                      onClick={() => setViewing(p)}
                      title="View"
                      aria-label={`View ${p.file_name}`}
                      className="touch-manipulation flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 hover:text-white dark:hover:bg-navy-800"
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      onClick={() => handleDownload(p)}
                      disabled={busyId === p.id}
                      title="Download"
                      aria-label={`Download ${p.file_name}`}
                      className="touch-manipulation flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 hover:text-white disabled:opacity-60 dark:hover:bg-navy-800"
                    >
                      {busyId === p.id ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(p)}
                        disabled={busyId === p.id}
                        title="Remove"
                        aria-label={`Remove ${p.file_name}`}
                        className="touch-manipulation flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10 disabled:opacity-60"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewing && (
        <DocumentViewerModal
          fileName={viewing.file_name}
          fileType={viewing.file_type}
          getViewUrl={() => getTrainingPlanViewUrl(viewing.file_path)}
          getDownloadUrl={() => getTrainingPlanDownloadUrl(viewing.file_path)}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  );
}
