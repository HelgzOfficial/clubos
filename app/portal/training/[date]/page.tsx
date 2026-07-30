"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Eye, Download, Loader2, MapPin, AlertCircle } from "lucide-react";
import { DocumentViewerModal } from "@/components/document-viewer-modal";
import { DirectionsLinks } from "@/components/directions-links";
import {
  fetchTrainingPlans, getTrainingPlanViewUrl, getTrainingPlanDownloadUrl, type DbTrainingPlan,
} from "@/lib/training-plans-db";
import { fetchCalendarEvents, expandEvent, type DbCalendarEvent } from "@/lib/calendar-events-db";
import { fetchMatches } from "@/lib/matches-db";

// A player-facing version of the staff Training Planner's day card. It exists
// for the same reason /portal/matches/[id] does: the staff pages are
// role-gated and a portal player has no app_users row, so sending them to
// /training?date=... would just show "No access set up yet".
export default function PortalTrainingDayPage() {
  const params = useParams();
  const date = decodeURIComponent(String(params.date ?? ""));

  const [plans, setPlans] = useState<DbTrainingPlan[]>([]);
  const [venue, setVenue] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [title, setTitle] = useState("Training");
  const [matchOnDay, setMatchOnDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<DbTrainingPlan | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [planRows, events, matches] = await Promise.all([
        fetchTrainingPlans(date), fetchCalendarEvents(), fetchMatches(),
      ]);
      setPlans(planRows);
      const occurrence = events
        .flatMap((ev: DbCalendarEvent) => expandEvent(ev, date, date))
        .find((occ) => occ.type === "training");
      setVenue(occurrence?.venue ?? null);
      setTime(occurrence?.startTime ?? null);
      if (occurrence?.title) setTitle(occurrence.title);
      // Same rule as the staff page: a match that day means training is off.
      const match = matches.find((m) => m.kickoff.slice(0, 10) === date);
      setMatchOnDay(match ? `${match.is_home ? "vs" : "@"} ${match.opponent}` : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load this training day.");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

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

  const heading = date
    ? new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
    : "Training";

  return (
    <div className="min-h-dvh bg-navy-800 dark:bg-navy-950 pb-10 text-white">
      <div className="sticky top-0 z-10 border-b border-white/10 bg-navy-700/95 px-4 py-3 backdrop-blur dark:bg-navy-900/95">
        <Link href="/portal" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white">
          <ArrowLeft size={15} /> Back
        </Link>
      </div>

      <div className="mx-auto max-w-lg px-4 py-4">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm text-neutral-400">{heading}{time ? ` · ${time}` : ""}</p>

        {loading ? (
          <p className="mt-6 text-sm text-neutral-400">Loading…</p>
        ) : matchOnDay ? (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3.5 py-3 text-sm text-amber-200">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>There&apos;s a match on this day ({matchOnDay}) — training is off.</span>
          </div>
        ) : (
          <>
            {venue && (
              <div className="mt-4 rounded-card border border-white/10 bg-navy-700 p-4 dark:bg-navy-900">
                <p className="flex items-start gap-2 text-sm text-neutral-300">
                  <MapPin size={15} className="mt-0.5 shrink-0 text-neutral-500" />
                  <span>{venue}</span>
                </p>
                <DirectionsLinks venue={venue} className="mt-2" />
              </div>
            )}

            <div className="mt-4 rounded-card border border-white/10 bg-navy-700 p-4 dark:bg-navy-900">
              <p className="mb-3 text-sm font-medium">Session Plan</p>

              {error && <p className="mb-2 text-xs text-red-300">{error}</p>}

              {plans.length === 0 ? (
                <p className="text-sm text-neutral-400">
                  No session plan has been uploaded for this day yet. It&apos;ll appear here as soon as a coach adds one.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {plans.map((p) => (
                    <div key={p.id} className="flex items-center gap-2.5 rounded-xl border border-white/10 px-3 py-2.5">
                      <FileText size={16} className="shrink-0 text-club-primary" />
                      <p className="min-w-0 flex-1 truncate text-sm">{p.file_name}</p>
                      <button
                        onClick={() => setViewing(p)}
                        aria-label={`View ${p.file_name}`}
                        className="touch-manipulation flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 hover:text-white dark:hover:bg-navy-800"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        onClick={() => handleDownload(p)}
                        disabled={busyId === p.id}
                        aria-label={`Download ${p.file_name}`}
                        className="touch-manipulation flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 hover:text-white disabled:opacity-60 dark:hover:bg-navy-800"
                      >
                        {busyId === p.id ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {viewing && (
        <DocumentViewerModal
          fileName={viewing.file_name}
          fileType={viewing.file_type}
          getViewUrl={() => getTrainingPlanViewUrl(viewing.file_path)}
          getDownloadUrl={() => getTrainingPlanDownloadUrl(viewing.file_path)}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
