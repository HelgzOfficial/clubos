"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { calendarEvents } from "@/lib/sample-data";
import { fetchMatches, type DbMatch } from "@/lib/matches-db";
import { supabaseConfigured } from "@/lib/supabase";
import { ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";

const typeVariant = {
  match: "green" as const,
  training: "neutral" as const,
  meeting: "amber" as const,
};

function buildMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(startOffset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

type CalEvent = { title: string; date: string; type: "match" | "training" | "meeting" };

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [matches, setMatches] = useState<DbMatch[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMatches()
      .then(setMatches)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load matches."));
  }, []);

  const cells = buildMonthGrid(year, month);
  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const nonMatchEvents = useMemo(() => calendarEvents.filter((e) => e.type !== "match"), []);

  const matchEvents: CalEvent[] = useMemo(
    () =>
      matches.map((m) => ({
        title: `${m.is_home ? "vs" : "@"} ${m.opponent}`,
        date: m.kickoff.slice(0, 10),
        type: "match" as const,
      })),
    [matches]
  );

  const allEvents: CalEvent[] = [...nonMatchEvents, ...matchEvents];

  const eventsByDate = new Map<string, CalEvent[]>();
  for (const e of allEvents) {
    const list = eventsByDate.get(e.date) ?? [];
    list.push(e);
    eventsByDate.set(e.date, list);
  }

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); } else { setMonth((m) => m - 1); }
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); } else { setMonth((m) => m + 1); }
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Calendar</h1>
          <p className="text-sm text-neutral-500">Matches, training, and meetings.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <p className="w-40 text-center text-sm font-medium">{monthLabel}</p>
          <button onClick={nextMonth} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {!supabaseConfigured && (
        <Card className="mb-6 flex items-start gap-3 border-amber-500/30 bg-amber-500/10">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-300" />
          <p className="text-sm text-amber-200">Supabase isn&apos;t connected yet, so matches won&apos;t appear here — only sample training/meeting entries.</p>
        </Card>
      )}
      {error && (
        <Card className="mb-6 border-red-500/30 bg-red-500/10">
          <p className="text-sm text-red-300">{error}</p>
        </Card>
      )}

      <Card>
        <div className="grid grid-cols-7 gap-px text-center text-xs font-medium text-neutral-400 mb-2">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} className="min-h-[92px]" />;
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const events = eventsByDate.get(dateStr) ?? [];
            return (
              <div key={i} className="min-h-[92px] rounded-xl border border-white/10 p-2 text-left">
                <p className="text-xs font-medium text-neutral-400">{day}</p>
                <div className="mt-1 space-y-1">
                  {events.map((e, idx) => (
                    <Badge key={idx} variant={typeVariant[e.type]} className="block truncate text-[10px] leading-tight">
                      {e.title}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </AppShell>
  );
}
