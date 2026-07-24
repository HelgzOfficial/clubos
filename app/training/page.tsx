"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PitchCanvas } from "@/components/training/pitch-canvas";
import { SessionTimer } from "@/components/training/session-timer";
import { todaysSchedule } from "@/lib/sample-data";

export default function TrainingPage() {
  const [notes, setNotes] = useState(
    "Focus: possession under pressure.\n- 4v2 rondo, rotate every 3 mins\n- Progress to 6v4 in the middle third\n- Emphasise first-touch direction away from pressure"
  );

  const session = todaysSchedule.find((s) => s.title.toLowerCase().includes("training"));

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Training Planner</h1>
        <p className="text-sm text-neutral-500">
          {session ? `${session.title} — ${session.time}, ${session.location}` : "Build your session on the pitch below."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Session Pitch</CardTitle></CardHeader>
          <PitchCanvas />
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Session Timer</CardTitle></CardHeader>
            <SessionTimer />
          </Card>

          <Card>
            <CardHeader><CardTitle>Coaching Notes</CardTitle></CardHeader>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={8}
              className="w-full resize-none rounded-xl border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 p-3 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
            />
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
