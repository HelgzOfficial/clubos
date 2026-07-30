"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { TeamCrest, useCrestLookup } from "@/components/team-crest";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DirectionsLinks } from "@/components/directions-links";
import { fetchMatches, type DbMatch } from "@/lib/matches-db";
import { supabaseConfigured } from "@/lib/supabase";
import {
  fetchCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
  expandEvent, type DbCalendarEvent, type CalendarEventType, type Recurrence,
} from "@/lib/calendar-events-db";
import { usePermissions } from "@/lib/permissions";
import { ChevronLeft, ChevronRight, AlertCircle, Plus, X, Pencil, Trash2, ArrowRight } from "lucide-react";

const typeVariant = {
  match: "green" as const,
  training: "neutral" as const,
  meeting: "amber" as const,
};

// Compact colour dots used on narrow screens instead of full text badges —
// a phone-width grid column has no room to render even a truncated word
// legibly, so each event becomes a small tappable dot instead. Still one
// dot per event, still links straight to its destination.
const dotColor: Record<keyof typeof typeVariant, string> = {
  match: "bg-emerald-500",
  training: "bg-neutral-400",
  meeting: "bg-amber-500",
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(startOffset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

type Instance = {
  key: string;
  date: string;
  title: string;
  type: "match" | CalendarEventType;
  startTime: string | null;
  endTime: string | null;
  venue: string | null;
  href: string | null;
  eventId: string | null; // set for calendar_events, so it can be edited/deleted
  // Matches only — used to draw the opponent's badge beside the fixture.
  crestName?: string;
  competition?: string;
};

const blankForm = {
  title: "",
  type: "training" as CalendarEventType,
  eventDate: "",
  startTime: "18:30",
  endTime: "20:00",
  venue: "",
  notes: "",
  recurrence: "none" as Recurrence,
  recurrenceDays: [] as number[],
  recurrenceUntil: "",
};

export default function CalendarPage() {
  const { canWrite } = usePermissions();
  const canEdit = canWrite("calendar");
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [matches, setMatches] = useState<DbMatch[]>([]);
  const [events, setEvents] = useState<DbCalendarEvent[]>([]);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState(toDateStr(today.getFullYear(), today.getMonth(), today.getDate()));

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function load() {
    setError("");
    try {
      const [m, e] = await Promise.all([fetchMatches(), fetchCalendarEvents()]);
      setMatches(m);
      setEvents(e);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the calendar.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const cells = buildMonthGrid(year, month);
  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  // Widen the expansion range slightly beyond the visible month so a
  // recurring event whose weekday lands right at the grid's edge still shows.
  const crestLookup = useCrestLookup();
  const rangeStart = toDateStr(year, month, 1);
  const rangeEnd = toDateStr(year, month, new Date(year, month + 1, 0).getDate());

  const instances: Instance[] = useMemo(() => {
    const matchInstances: Instance[] = matches.map((m) => ({
      key: `match-${m.id}`,
      date: m.kickoff.slice(0, 10),
      title: `${m.is_home ? "vs" : "@"} ${m.opponent}`,
      type: "match",
      startTime: new Date(m.kickoff).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      endTime: null,
      venue: m.venue,
      href: `/matches/${m.id}`,
      eventId: null,
      crestName: m.opponent,
      competition: m.competition,
    }));

    const matchDates = new Set(matchInstances.map((m) => m.date));

    const eventInstances: Instance[] = events
      .flatMap((ev) =>
        expandEvent(ev, rangeStart, rangeEnd).map((occ) => ({
          key: occ.key,
          date: occ.date,
          title: occ.title,
          type: occ.type,
          startTime: occ.startTime,
          endTime: occ.endTime,
          venue: occ.venue,
          href: occ.type === "training" ? `/training?date=${occ.date}` : null,
          eventId: occ.eventId,
        }))
      )
      // A recurring training slot that lands on a match day is skipped — the
      // squad plays that day instead, so there's no separate training session.
      .filter((occ) => !(occ.type === "training" && matchDates.has(occ.date)));

    return [...matchInstances, ...eventInstances].filter((i) => i.date >= rangeStart && i.date <= rangeEnd);
  }, [matches, events, rangeStart, rangeEnd]);

  const instancesByDate = new Map<string, Instance[]>();
  for (const i of instances) {
    const list = instancesByDate.get(i.date) ?? [];
    list.push(i);
    instancesByDate.set(i.date, list);
  }

  const selectedInstances = (instancesByDate.get(selectedDate) ?? []).sort((a, b) =>
    (a.startTime ?? "").localeCompare(b.startTime ?? "")
  );

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); } else { setMonth((m) => m - 1); }
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); } else { setMonth((m) => m + 1); }
  }

  function openAddForm(date: string) {
    setEditingId(null);
    setForm({ ...blankForm, eventDate: date });
    setFormError("");
    setShowForm(true);
  }

  function openEditForm(ev: DbCalendarEvent) {
    setEditingId(ev.id);
    setForm({
      title: ev.title,
      type: ev.type,
      eventDate: ev.event_date,
      startTime: ev.start_time ?? "",
      endTime: ev.end_time ?? "",
      venue: ev.venue ?? "",
      notes: ev.notes ?? "",
      recurrence: ev.recurrence,
      recurrenceDays: ev.recurrence_days ?? [],
      recurrenceUntil: ev.recurrence_until ?? "",
    });
    setFormError("");
    setShowForm(true);
  }

  function toggleWeekday(d: number) {
    setForm((f) => ({
      ...f,
      recurrenceDays: f.recurrenceDays.includes(d) ? f.recurrenceDays.filter((x) => x !== d) : [...f.recurrenceDays, d].sort(),
    }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.title.trim() || !form.eventDate) {
      setFormError("Title and date are required.");
      return;
    }
    if (form.recurrence === "weekly" && form.recurrenceDays.length === 0) {
      setFormError("Pick at least one day of the week for a recurring event.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      if (editingId) {
        await updateCalendarEvent(editingId, form);
      } else {
        await createCalendarEvent(form);
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't save that event.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Remove this event? If it repeats weekly, every occurrence will be removed.")) return;
    await deleteCalendarEvent(id);
    await load();
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Calendar</h1>
          <p className="text-sm text-neutral-500">Matches, training, and meetings.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <p className="w-40 text-center text-sm font-medium">{monthLabel}</p>
            <button onClick={nextMonth} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
          {canEdit && (
            <button
              onClick={() => openAddForm(selectedDate)}
              className="flex items-center gap-2 rounded-xl bg-club-primary text-navy-950 px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus size={15} /> Add Event
            </button>
          )}
        </div>
      </div>

      {!supabaseConfigured && (
        <Card className="mb-6 flex items-start gap-3 border-amber-500/30 bg-amber-500/10">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-300" />
          <p className="text-sm text-amber-200">Supabase isn&apos;t connected yet, so matches and events won&apos;t appear here.</p>
        </Card>
      )}
      {error && (
        <Card className="mb-6 border-red-500/30 bg-red-500/10">
          <p className="text-sm text-red-300">{error}</p>
        </Card>
      )}

      <Card className="mb-5">
        <div className="grid grid-cols-7 gap-px text-center text-xs font-medium text-neutral-400 mb-2">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} className="min-h-[64px] sm:min-h-[92px]" />;
            const dateStr = toDateStr(year, month, day);
            const dayEvents = instancesByDate.get(dateStr) ?? [];
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === toDateStr(today.getFullYear(), today.getMonth(), today.getDate());
            return (
              // A div (not a button) so the individual event links below can
              // be nested inside it validly — still fully keyboard operable.
              <div
                key={i}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedDate(dateStr)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedDate(dateStr); } }}
                className={`min-h-[64px] sm:min-h-[92px] cursor-pointer rounded-lg sm:rounded-xl border p-1 sm:p-2 text-left transition-colors ${
                  isSelected ? "border-club-primary bg-club-primary/10" : "border-white/10 hover:bg-navy-600/50 dark:hover:bg-navy-800/50"
                }`}
              >
                <p className={`text-[11px] sm:text-xs font-medium ${isToday ? "text-club-primary" : "text-neutral-400"}`}>{day}</p>

                {/* Phones: fixed-size colour dots — never wraps or overflows the column. */}
                <div className="mt-1 flex flex-wrap items-center gap-1 sm:hidden">
                  {dayEvents.slice(0, 6).map((e) =>
                    e.href ? (
                      <Link
                        key={e.key}
                        href={e.href}
                        onClick={(ev) => ev.stopPropagation()}
                        title={e.title}
                        aria-label={e.title}
                        className={`h-3 w-3 shrink-0 rounded-full ring-1 ring-white/20 ${dotColor[e.type]}`}
                      />
                    ) : (
                      e.crestName ? (
                        <Link key={e.key} href={e.href ?? "#"} onClick={(ev) => ev.stopPropagation()} title={e.title}>
                          <TeamCrest name={e.crestName} size="xs" lookup={crestLookup} plain />
                        </Link>
                      ) : (
                        <span key={e.key} title={e.title} className={`h-3 w-3 shrink-0 rounded-full ring-1 ring-white/20 ${dotColor[e.type]}`} />
                      )
                    )
                  )}
                  {dayEvents.length > 6 && <span className="text-[9px] leading-none text-neutral-500">+{dayEvents.length - 6}</span>}
                </div>

                {/* Tablet/desktop: room for a truncated title, still clickable straight to its destination. */}
                <div className="mt-1 hidden space-y-1 sm:block">
                  {dayEvents.slice(0, 3).map((e) =>
                    e.crestName && e.href ? (
                      // A fixture is the most important thing that can happen on
                      // a day, so it gets the crest at full width rather than a
                      // text badge — and the whole tile is the link to the match.
                      <Link
                        key={e.key}
                        href={e.href}
                        onClick={(ev) => ev.stopPropagation()}
                        title={`${e.title}${e.startTime ? ` · ${e.startTime}` : ""}`}
                        className="flex flex-col items-center gap-0.5 rounded-lg border border-club-primary/30 bg-club-primary/10 px-1 py-1.5 transition-colors hover:border-club-primary/60 hover:bg-club-primary/20"
                      >
                        <TeamCrest name={e.crestName} size="md" lookup={crestLookup} plain />
                        <span className="w-full truncate text-center text-[9px] font-medium leading-tight text-neutral-200">
                          {e.title}
                        </span>
                        {e.startTime && (
                          <span className="text-[9px] leading-none text-club-primary">{e.startTime}</span>
                        )}
                      </Link>
                    ) : e.href ? (
                      <Link key={e.key} href={e.href} onClick={(ev) => ev.stopPropagation()} className="block">
                        <Badge variant={typeVariant[e.type]} className="block truncate text-[10px] leading-tight hover:opacity-80 transition-opacity">
                          {e.title}
                        </Badge>
                      </Link>
                    ) : (
                      <Badge key={e.key} variant={typeVariant[e.type]} className="block truncate text-[10px] leading-tight">
                        {e.title}
                      </Badge>
                    )
                  )}
                  {dayEvents.length > 3 && <p className="text-[10px] text-neutral-500">+{dayEvents.length - 3} more</p>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-medium">
            {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          {canEdit && (
            <button
              onClick={() => openAddForm(selectedDate)}
              className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-club-primary"
            >
              <Plus size={13} /> Add to this day
            </button>
          )}
        </div>

        {selectedInstances.length === 0 ? (
          <p className="text-sm text-neutral-400">Nothing on the calendar this day.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {selectedInstances.map((inst) => {
              const owningEvent = inst.eventId ? events.find((e) => e.id === inst.eventId) : null;
              return (
                <li key={inst.key} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={typeVariant[inst.type]}>{inst.type}</Badge>
                      <p className="font-medium">{inst.title}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {inst.href && (
                        <Link
                          href={inst.href}
                          className="flex items-center gap-1 text-xs text-club-primary hover:underline"
                        >
                          {inst.type === "match" ? "Match Centre" : "Training page"} <ArrowRight size={11} />
                        </Link>
                      )}
                      {owningEvent && canEdit && (
                        <>
                          <button onClick={() => openEditForm(owningEvent)} className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => handleDelete(owningEvent.id)} className="flex h-7 w-7 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10">
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-neutral-400">
                    {inst.startTime ? inst.startTime : ""}
                    {inst.endTime ? `–${inst.endTime}` : ""}
                    {inst.venue ? ` · ${inst.venue}` : ""}
                  </p>
                  {inst.venue && <DirectionsLinks venue={inst.venue} className="mt-1.5" />}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-medium">{editingId ? "Edit Event" : "Add Event"}</p>
              <button onClick={() => setShowForm(false)} className="text-neutral-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Title</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Training — Full Squad"
                  className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                />
              </div>

              <div className="flex gap-1 rounded-xl bg-navy-600 dark:bg-navy-800 p-1 text-sm w-fit">
                {[{ v: "training" as const, label: "Training" }, { v: "meeting" as const, label: "Meeting" }].map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, type: o.v }))}
                    className={`rounded-lg px-3 py-1 transition-colors ${form.type === o.v ? "bg-club-primary text-navy-950" : "text-neutral-400"}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-neutral-500">Date</label>
                  <input
                    type="date"
                    value={form.eventDate}
                    onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-neutral-500">Start</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-neutral-500">End</label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Venue / address</label>
                <input
                  value={form.venue}
                  onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
                  placeholder="e.g. Church Road, Caterham CR3 6RA"
                  className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                />
                <p className="mt-1 text-[11px] text-neutral-500">A full address gets you working car/public transport directions — a ground name alone may not.</p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="recurring"
                  type="checkbox"
                  checked={form.recurrence === "weekly"}
                  onChange={(e) => setForm((f) => ({ ...f, recurrence: e.target.checked ? "weekly" : "none" }))}
                  className="h-4 w-4 rounded border-white/20"
                />
                <label htmlFor="recurring" className="text-sm">Repeats weekly</label>
              </div>

              {form.recurrence === "weekly" && (
                <div className="rounded-xl border border-white/10 p-3">
                  <p className="mb-2 text-xs font-medium text-neutral-500">Repeats on</p>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAY_LABELS.map((label, idx) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => toggleWeekday(idx)}
                        className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                          form.recurrenceDays.includes(idx) ? "bg-club-primary text-navy-950" : "bg-navy-600 dark:bg-navy-800 text-neutral-400"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3">
                    <label className="mb-1.5 block text-xs font-medium text-neutral-500">Repeat until (optional)</label>
                    <input
                      type="date"
                      value={form.recurrenceUntil}
                      onChange={(e) => setForm((f) => ({ ...f, recurrenceUntil: e.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                    />
                  </div>
                </div>
              )}

              {formError && <p className="text-sm text-red-300">{formError}</p>}

              <button type="submit" disabled={saving} className="w-full rounded-xl bg-club-primary text-navy-950 px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60">
                {saving ? "Saving…" : editingId ? "Save Changes" : "Add Event"}
              </button>
            </form>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
