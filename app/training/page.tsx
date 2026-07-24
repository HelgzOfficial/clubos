"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PitchCanvas } from "@/components/training/pitch-canvas";
import { SessionTimer } from "@/components/training/session-timer";
import {
  Drill, TrainingSession,
  loadSessions, saveSessions, loadDrills, saveDrills,
  nextId, blankDrill,
} from "@/lib/training-storage";
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Pencil } from "lucide-react";

type View = { kind: "archive" } | { kind: "session"; sessionId: string } | { kind: "drill"; sessionId: string; drillId: string };

export default function TrainingPage() {
  const [ready, setReady] = useState(false);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [drills, setDrills] = useState<Record<string, Drill>>({});
  const [view, setView] = useState<View>({ kind: "archive" });

  useEffect(() => {
    setSessions(loadSessions());
    setDrills(loadDrills());
    setReady(true);
  }, []);

  useEffect(() => { if (ready) saveSessions(sessions); }, [sessions, ready]);
  useEffect(() => { if (ready) saveDrills(drills); }, [drills, ready]);

  function createSession() {
    const s: TrainingSession = {
      id: nextId("session"),
      name: `Session — ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
      date: new Date().toISOString(),
      drillIds: [],
    };
    setSessions((prev) => [s, ...prev]);
    setView({ kind: "session", sessionId: s.id });
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
            onClick={createSession}
            className="flex items-center gap-2 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={15} /> New Session
          </button>
        </div>

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
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
        >
          <ArrowLeft size={14} /> Back to {activeSession.name}
        </button>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <input
            value={drill.name}
            onChange={(e) => updateDrill(drill.id, { name: e.target.value })}
            className="text-2xl font-semibold bg-transparent outline-none border-b border-transparent focus:border-black/10 dark:focus:border-white/20"
          />
          <div className="ml-auto flex items-center gap-2 text-sm text-neutral-500">
            <label htmlFor="dur">Duration</label>
            <input
              id="dur"
              type="number"
              min={1}
              value={drill.durationMin}
              onChange={(e) => updateDrill(drill.id, { durationMin: Number(e.target.value) || 0 })}
              className="w-16 rounded-lg border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 px-2 py-1 text-sm outline-none"
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
                className="w-full resize-none rounded-xl border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 p-3 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
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
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
      >
        <ArrowLeft size={14} /> Back to Archive
      </button>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <input
            value={activeSession.name}
            onChange={(e) => updateSessionName(activeSession.id, e.target.value)}
            className="text-2xl font-semibold bg-transparent outline-none border-b border-transparent focus:border-black/10 dark:focus:border-white/20 w-full"
          />
          <p className="text-sm text-neutral-500 mt-1">{new Date(activeSession.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
        </div>
        <button
          onClick={() => deleteSession(activeSession.id)}
          className="flex items-center gap-1.5 rounded-xl border border-black/5 dark:border-white/10 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
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
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-sm font-semibold shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{drill.name}</p>
                <p className="text-xs text-neutral-400">{drill.durationMin} min · {drill.items.length} item{drill.items.length === 1 ? "" : "s"} on pitch</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => moveDrill(activeSession.id, drillId, -1)} disabled={i === 0} className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30">
                  <ChevronUp size={15} />
                </button>
                <button onClick={() => moveDrill(activeSession.id, drillId, 1)} disabled={i === activeSession.drillIds.length - 1} className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30">
                  <ChevronDown size={15} />
                </button>
                <button onClick={() => setView({ kind: "drill", sessionId: activeSession.id, drillId })} className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800">
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
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-black/10 dark:border-white/10 py-6 text-sm font-medium text-neutral-500 hover:border-club-primary hover:text-club-primary transition-colors"
        >
          <Plus size={16} /> Add Drill to Session
        </button>
      </div>
    </AppShell>
  );
}
