"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DirectionsLinks } from "@/components/directions-links";
import { PitchCanvas } from "@/components/training/pitch-canvas";
import { SessionTimer } from "@/components/training/session-timer";
import {
  Drill, TrainingSession,
  loadSessions, saveSessions, loadDrills, saveDrills,
  nextId, blankDrill,
} from "@/lib/training-storage";
import { fetchCalendarEvents, expandEvent, type DbCalendarEvent } from "@/lib/calendar-events-db";
import {
  fetchTrainingPlans, uploadTrainingPlan, deleteTrainingPlan, getTrainingPlanDownloadUrl,
  type DbTrainingPlan,
} from "@/lib/training-plans-db";
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Pencil, Upload, FileText, Download, Loader2 } from "lucide-react";

type View = { kind: "archive" } | { kind: "session"; sessionId: string } | { kind: "drill"; sessionId: string; drillId: string };

// Training Plans + directions for one specific calendar date — this is what
// clicking a training entry on the Calendar page lands on, so a coach gets
// the day's plan and travel info immediately instead of a generic archive.
function TrainingDayCard({ date }: { date: string }) {
  const [venue, setVenue] = useState<string | null>(null);
  const [plans, setPlans] = useState<DbTrainingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [events, planRows] = await Promise.all([fetchCalendarEvents(), fetchTrainingPlans(date)]);
      const occurrence = events
        .flatMap((ev: DbCalendarEvent) => expandEvent(ev, date, date))
        .find((occ) => occ.type === "training");
      setVenue(occurrence?.venue ?? null);
      setPlans(planRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load this training day.");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleFile(file: File) {
    setUploading(true);
    setError("");
    try {
      await uploadTrainingPlan(date, file);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload that plan.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(p: DbTrainingPlan) {
    if (!window.confirm(`Remove "${p.file_name}"?`)) return;
    await deleteTrainingPlan(p.id, p.file_path);
    await load();
  }

  async function handleDownload(p: DbTrainingPlan) {
    const url = await getTrainingPlanDownloadUrl(p.file_path);
    window.open(url, "_blank");
  }

  return (
    <Card className="mb-5">
      <CardHeader><CardTitle>{new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</CardTitle></CardHeader>
      {loading ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : (
        <>
          {venue && (
            <div className="mb-4">
              <p className="text-sm text-neutral-300">{venue}</p>
              <DirectionsLinks venue={venue} className="mt-1.5" />
            </div>
          )}

          <p className="mb-2 text-sm font-medium">Session Plans</p>
          <p className="mb-3 text-xs text-neutral-400">Upload a PDF or photo of the session plan for this day so the whole coaching staff can see it.</p>

          {plans.length === 0 ? (
            <p className="mb-3 text-sm text-neutral-400">No session plan uploaded for this day yet.</p>
          ) : (
            <ul className="mb-3 divide-y divide-white/10">
              {plans.map((p) => (
                <li key={p.id} className="flex items-center gap-2.5 py-2.5 text-sm">
                  <FileText size={14} className="shrink-0 text-neutral-400" />
                  <span className="flex-1 truncate">{p.file_name}</span>
                  <button onClick={() => handleDownload(p)} title="Download" className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white">
                    <Download size={13} />
                  </button>
                  <button onClick={() => handleDelete(p)} title="Remove" className="flex h-7 w-7 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10">
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error && <p className="mb-3 text-sm text-red-300">{error}</p>}

          <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors">
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? "Uploading…" : "Upload Session Plan"}
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
          </label>
        </>
      )}
    </Card>
  );
}

export default function TrainingPage() {
  return (
    <Suspense fallback={<AppShell><p className="text-sm text-neutral-400">Loading…</p></AppShell>}>
      <TrainingPageInner />
    </Suspense>
  );
}

function TrainingPageInner() {
  const [ready, setReady] = useState(false);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [drills, setDrills] = useState<Record<string, Drill>>({});
  const [view, setView] = useState<View>({ kind: "archive" });
  const searchParams = useSearchParams();
  const router = useRouter();
  const dateParam = searchParams.get("date");

  useEffect(() => {
    setSessions(loadSessions());
    setDrills(loadDrills());
    setReady(true);
  }, []);

  useEffect(() => { if (ready) saveSessions(sessions); }, [sessions, ready]);
  useEffect(() => { if (ready) saveDrills(drills); }, [drills, ready]);

  function createSession(forDate?: string) {
    const d = forDate ? new Date(`${forDate}T00:00:00`) : new Date();
    const s: TrainingSession = {
      id: nextId("session"),
      name: `Session — ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
      date: d.toISOString(),
      drillIds: [],
    };
    setSessions((prev) => [s, ...prev]);
    setView({ kind: "session", sessionId: s.id });
  }

  function openOrCreateSessionForDate(date: string) {
    const existing = sessions.find((s) => s.date.slice(0, 10) === date);
    if (existing) {
      setView({ kind: "session", sessionId: existing.id });
    } else {
      createSession(date);
    }
  }

  function deleteSession(id: string) {
    const s = sessions.find((x) => x.id === id);
    setSessions((prev) => prev.filter((x) => x.id !== id));
    if (s) {
      setDrills((prev) => {
        const next = { ...prev };
        s.drillIds.forEach((did) => delete next[did]);
        return next;
      });
    }
    setView({ kind: "archive" });
  }

  function addDrillToSession(sessionId: string) {
    const d = blankDrill(`Drill ${((sessions.find((s) => s.id === sessionId)?.drillIds.length) ?? 0) + 1}`);
    setDrills((prev) => ({ ...prev, [d.id]: d }));
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, drillIds: [...s.drillIds, d.id] } : s)));
    setView({ kind: "drill", sessionId, drillId: d.id });
  }

  function removeDrillFromSession(sessionId: string, drillId: string) {
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, drillIds: s.drillIds.filter((id) => id !== drillId) } : s)));
    setDrills((prev) => {
      const next = { ...prev };
      delete next[drillId];
      return next;
    });
  }

  function moveDrill(sessionId: string, drillId: string, dir: -1 | 1) {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        const ids = [...s.drillIds];
        const i = ids.indexOf(drillId);
        const j = i + dir;
        if (j < 0 || j >= ids.length) return s;
        [ids[i], ids[j]] = [ids[j], ids[i]];
        return { ...s, drillIds: ids };
      })
    );
  }

  function updateDrill(drillId: string, patch: Partial<Drill>) {
    setDrills((prev) => ({ ...prev, [drillId]: { ...prev[drillId], ...patch } }));
  }

  function updateSessionName(sessionId: string, name: string) {
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, name } : s)));
  }

  if (!ready) {
    return (
      <AppShell>
        <p className="text-sm text-neutral-400">Loading…</p>
      </AppShell>
    );
  }

  // ---- Archive view ----
  if (view.kind === "archive") {
    return (
      <AppShell>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Training Planner</h1>
            <p className="text-sm text-neutral-500">{sessions.length} saved session{sessions.length === 1 ? "" : "s"} in your archive.</p>
          </div>
          <button
            onClick={() => createSession()}
            className="flex items-center gap-2 rounded-xl bg-club-primary text-navy-950 px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={15} /> New Session
          </button>
        </div>

        {dateParam && (
          <>
            <button
              onClick={() => router.push("/training")}
              className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-white"
            >
              <ArrowLeft size={14} /> Back to full archive
            </button>
            <TrainingDayCard date={dateParam} />
            <button
              onClick={() => openOrCreateSessionForDate(dateParam)}
              className="mb-6 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/10 py-4 text-sm font-medium text-neutral-500 hover:border-club-primary hover:text-club-primary transition-colors"
            >
              <Plus size={16} /> Open/Create Drill Session for This Day
            </button>
          </>
        )}

        {sessions.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-20 text-center">
            <p className="font-medium">No training sessions yet</p>
            <p className="text-sm text-neutral-400 mt-1 max-w-sm">Create a session, then add one or more drills to it — each drill gets its own pitch, timer, and notes.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((s) => {
              const totalMin = s.drillIds.reduce((sum, id) => sum + (drills[id]?.durationMin ?? 0), 0);
              return (
                <Card
                  key={s.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => setView({ kind: "session", sessionId: s.id })}
                >
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-neutral-400 mt-1">{new Date(s.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <Badge variant="neutral">{s.drillIds.length} drill{s.drillIds.length === 1 ? "" : "s"}</Badge>
                    {totalMin > 0 && <Badge variant="neutral">{totalMin} min</Badge>}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <p className="mt-4 text-xs text-neutral-400">
          Sessions are saved in this browser, so they'll be here next time you visit on this device. Connecting Supabase later will make them available from any device and to your whole staff.
        </p>
      </AppShell>
    );
  }

  const activeSession = sessions.find((s) => s.id === view.sessionId);
  if (!activeSession) {
    setView({ kind: "archive" });
    return null;
  }

  // ---- Drill editor view ----
  if (view.kind === "drill") {
    const drill = drills[view.drillId];
    if (!drill) {
      setView({ kind: "session", sessionId: activeSession.id });
      return null;
    }
    return (
      <AppShell>
        <button
          onClick={() => setView({ kind: "session", sessionId: activeSession.id })}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-white"
        >
          <ArrowLeft size={14} /> Back to {activeSession.name}
        </button>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <input
            value={drill.name}
            onChange={(e) => updateDrill(drill.id, { name: e.target.value })}
            className="text-2xl font-semibold bg-transparent outline-none border-b border-transparent focus:border-white/20"
          />
          <div className="ml-auto flex items-center gap-2 text-sm text-neutral-500">
            <label htmlFor="dur">Duration</label>
            <input
              id="dur"
              type="number"
              min={1}
              value={drill.durationMin}
              onChange={(e) => updateDrill(drill.id, { durationMin: Number(e.target.value) || 0 })}
              className="w-16 rounded-lg border border-white/10 bg-navy-600 dark:bg-navy-800 px-2 py-1 text-sm outline-none"
            />
            <span>min</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Pitch</CardTitle></CardHeader>
            <PitchCanvas
              items={drill.items}
              lines={drill.lines}
              onChange={({ items, lines }) => updateDrill(drill.id, { items, lines })}
            />
          </Card>

          <div className="space-y-5">
            <Card>
              <CardHeader><CardTitle>Timer</CardTitle></CardHeader>
              <SessionTimer />
            </Card>

            <Card>
              <CardHeader><CardTitle>Drill Notes</CardTitle></CardHeader>
              <textarea
                value={drill.notes}
                onChange={(e) => updateDrill(drill.id, { notes: e.target.value })}
                rows={8}
                placeholder="Coaching points for this drill..."
                className="w-full resize-none rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 p-3 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
              />
            </Card>
          </div>
        </div>
      </AppShell>
    );
  }

  // ---- Session view ----
  return (
    <AppShell>
      <button
        onClick={() => setView({ kind: "archive" })}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-white"
      >
        <ArrowLeft size={14} /> Back to Archive
      </button>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <input
            value={activeSession.name}
            onChange={(e) => updateSessionName(activeSession.id, e.target.value)}
            className="text-2xl font-semibold bg-transparent outline-none border-b border-transparent focus:border-white/20 w-full"
          />
          <p className="text-sm text-neutral-500 mt-1">{new Date(activeSession.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
        </div>
        <button
          onClick={() => deleteSession(activeSession.id)}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
        >
          <Trash2 size={14} /> Delete Session
        </button>
      </div>

      <div className="space-y-3">
        {activeSession.drillIds.map((drillId, i) => {
          const drill = drills[drillId];
          if (!drill) return null;
          return (
            <Card key={drillId} className="flex items-center gap-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-600 dark:bg-navy-800 text-sm font-semibold shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{drill.name}</p>
                <p className="text-xs text-neutral-400">{drill.durationMin} min · {drill.items.length} item{drill.items.length === 1 ? "" : "s"} on pitch</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => moveDrill(activeSession.id, drillId, -1)} disabled={i === 0} className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 disabled:opacity-30">
                  <ChevronUp size={15} />
                </button>
                <button onClick={() => moveDrill(activeSession.id, drillId, 1)} disabled={i === activeSession.drillIds.length - 1} className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 disabled:opacity-30">
                  <ChevronDown size={15} />
                </button>
                <button onClick={() => setView({ kind: "drill", sessionId: activeSession.id, drillId })} className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800">
                  <Pencil size={14} />
                </button>
                <button onClick={() => removeDrillFromSession(activeSession.id, drillId)} className="flex h-8 w-8 items-center justify-center rounded-full text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10">
                  <Trash2 size={14} />
                </button>
              </div>
            </Card>
          );
        })}

        <button
          onClick={() => addDrillToSession(activeSession.id)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/10 py-6 text-sm font-medium text-neutral-500 hover:border-club-primary hover:text-club-primary transition-colors"
        >
          <Plus size={16} /> Add Drill to Session
        </button>
      </div>
    </AppShell>
  );
}
