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
import { fetchPlayerByEmail, type DbPlayer } from "@/lib/players-db";
import { supabase } from "@/lib/supabase";
import {
  fetchMyAttendance, setPlayerResponse, effectiveStatus, isOverridden,
  STATUS_LABEL, STATUS_TONE, type DbTrainingAttendance,
} from "@/lib/training-attendance-db";

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
  const [player, setPlayer] = useState<DbPlayer | null>(null);
  const [attendance, setAttendance] = useState<DbTrainingAttendance | null>(null);
  const [savingReply, setSavingReply] = useState(false);

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

  // The player's own attendance row, so they can see and change their answer.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase || !date) return;
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email;
      if (!email) return;
      try {
        const p = await fetchPlayerByEmail(email);
        if (cancelled || !p) return;
        setPlayer(p);
        setAttendance(await fetchMyAttendance(date, p.id));
      } catch {
        // Attendance is a bonus on this page — a failure here shouldn't stop
        // the session plan showing.
      }
    })();
    return () => { cancelled = true; };
  }, [date]);

  async function reply(response: "yes" | "no") {
    if (!player) return;
    setSavingReply(true);
    setError("");
    try {
      setAttendance(await setPlayerResponse(date, player.id, response));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your answer.");
    } finally {
      setSavingReply(false);
    }
  }

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

            {player && (
              <div className="mt-4 rounded-card border border-white/10 bg-navy-700 p-4 dark:bg-navy-900">
                <p className="mb-1 text-sm font-medium">Are you training?</p>
                <p className="mb-3 text-xs text-neutral-400">
                  Let the coaches know so they can plan the session. You can change your answer any time.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => reply("yes")}
                    disabled={savingReply}
                    className={`touch-manipulation flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                      attendance?.player_response === "yes"
                        ? "bg-emerald-500 text-navy-950"
                        : "border border-white/10 text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800"
                    }`}
                  >
                    {savingReply && attendance?.player_response !== "yes" ? <Loader2 size={15} className="mx-auto animate-spin" /> : "I'll be there"}
                  </button>
                  <button
                    onClick={() => reply("no")}
                    disabled={savingReply}
                    className={`touch-manipulation flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                      attendance?.player_response === "no"
                        ? "bg-red-500 text-white"
                        : "border border-white/10 text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800"
                    }`}
                  >
                    Can&apos;t make it
                  </button>
                </div>

                {/* If a coach has recorded something different, say so plainly
                    rather than letting the player think their answer stuck. */}
                {attendance?.coach_status && (
                  <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-neutral-400">
                    Marked by the coaching staff as
                    <span className={`rounded px-1.5 py-0.5 font-medium ${STATUS_TONE[effectiveStatus(attendance)]}`}>
                      {STATUS_LABEL[effectiveStatus(attendance)]}
                    </span>
                    {isOverridden(attendance) && <span className="text-amber-400">— this overrides your answer</span>}
                  </p>
                )}
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
