"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { expandEvent, type DbCalendarEvent } from "@/lib/calendar-events-db";
import type { DbMatch } from "@/lib/matches-db";

type DayItem = {
  key: string;
  time: string | null;
  title: string;
  kind: "match" | "training" | "meeting";
  venue: string | null;
  href?: string;
};

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const kindDot: Record<DayItem["kind"], string> = {
  match: "bg-club-primary",
  training: "bg-emerald-400",
  meeting: "bg-blue-400",
};

// A real month grid rather than a flat agenda, so a player can see the shape
// of their month at a glance — which days have a fixture, which have training.
// Tapping a day lists everything on it underneath, and fixtures link through
// to the match detail page.
export function PortalCalendarModal({
  matches, events, onClose,
}: {
  matches: DbMatch[];
  events: DbCalendarEvent[];
  onClose: () => void;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<string>(isoDate(today));

  // Six weeks starting from the Monday on/before the 1st — a fixed grid size
  // keeps the modal from resizing as you page through months.
  const gridDays = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const offset = (first.getDay() + 6) % 7; // Monday-first
    const start = new Date(viewYear, viewMonth, 1 - offset);
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [viewYear, viewMonth]);

  const itemsByDate = useMemo(() => {
    const rangeStart = isoDate(gridDays[0]);
    const rangeEnd = isoDate(gridDays[gridDays.length - 1]);
    const map = new Map<string, DayItem[]>();

    const push = (date: string, item: DayItem) => {
      const list = map.get(date);
      if (list) list.push(item);
      else map.set(date, [item]);
    };

    for (const m of matches) {
      const d = new Date(m.kickoff);
      const date = isoDate(d);
      if (date < rangeStart || date > rangeEnd) continue;
      push(date, {
        key: `match-${m.id}`,
        time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        title: `${m.is_home ? "vs" : "@"} ${m.opponent}`,
        kind: "match",
        venue: m.venue,
        href: `/portal/matches/${m.id}`,
      });
    }
    for (const e of events) {
      for (const occ of expandEvent(e, rangeStart, rangeEnd)) {
        push(occ.date, {
          key: occ.key,
          time: occ.startTime,
          title: occ.title,
          kind: occ.type,
          venue: occ.venue,
        });
      }
    }

    for (const list of map.values()) {
      list.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
    }
    return map;
  }, [gridDays, matches, events]);

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  const todayIso = isoDate(today);
  const selectedItems = itemsByDate.get(selected) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-card border border-white/10 bg-navy-700 dark:bg-navy-900 shadow-softDark sm:rounded-card">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <button
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="touch-manipulation flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white"
          >
            <ChevronLeft size={17} />
          </button>
          <p className="flex-1 text-center text-sm font-semibold">
            {new Date(viewYear, viewMonth, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </p>
          <button
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="touch-manipulation flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white"
          >
            <ChevronRight size={17} />
          </button>
          <button
            onClick={onClose}
            aria-label="Close calendar"
            className="touch-manipulation flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white"
          >
            <X size={17} />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-3">
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase tracking-wide text-neutral-500">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d}>{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {gridDays.map((d) => {
              const date = isoDate(d);
              const items = itemsByDate.get(date) ?? [];
              const inMonth = d.getMonth() === viewMonth;
              const isSelected = date === selected;
              const isToday = date === todayIso;
              return (
                <button
                  key={date}
                  onClick={() => setSelected(date)}
                  className={`touch-manipulation flex aspect-square flex-col items-center justify-start gap-0.5 rounded-lg border py-1 transition-colors ${
                    isSelected
                      ? "border-club-primary bg-club-primary/15"
                      : items.length > 0
                        ? "border-white/10 bg-navy-600/60 dark:bg-navy-800/60"
                        : "border-transparent"
                  } ${inMonth ? "" : "opacity-35"}`}
                >
                  <span className={`text-xs tabular-nums ${isToday ? "font-bold text-club-primary" : "text-neutral-300"}`}>
                    {d.getDate()}
                  </span>
                  <span className="flex items-center gap-0.5">
                    {items.slice(0, 3).map((it) => (
                      <span key={it.key} className={`h-1.5 w-1.5 rounded-full ${kindDot[it.kind]}`} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-center gap-3 border-t border-white/10 pt-2.5 text-[10px] text-neutral-500">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-club-primary" /> Match</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Training</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-blue-400" /> Meeting</span>
          </div>

          <div className="mt-3">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              {new Date(`${selected}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            {selectedItems.length === 0 ? (
              <p className="pb-2 text-sm text-neutral-400">Nothing scheduled on this day.</p>
            ) : (
              <div className="space-y-1.5 pb-2">
                {selectedItems.map((item) => {
                  const body = (
                    <div className={`rounded-lg border px-2.5 py-2 ${item.kind === "match" ? "border-club-primary/40 bg-club-primary/10" : "border-white/10"}`}>
                      <div className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${kindDot[item.kind]}`} />
                        <p className="min-w-0 flex-1 truncate text-sm font-medium">{item.title}</p>
                        {item.time && <span className="shrink-0 text-[11px] tabular-nums text-neutral-400">{item.time}</span>}
                      </div>
                      {item.venue && <p className="mt-0.5 truncate pl-3.5 text-[11px] text-neutral-500">{item.venue}</p>}
                    </div>
                  );
                  return item.href ? (
                    <Link key={item.key} href={item.href} onClick={onClose} className="block transition-colors hover:brightness-125">
                      {body}
                    </Link>
                  ) : (
                    <div key={item.key}>{body}</div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
