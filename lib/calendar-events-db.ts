import { supabase } from "./supabase";

export type CalendarEventType = "training" | "meeting";
export type Recurrence = "none" | "weekly";

export type DbCalendarEvent = {
  id: string;
  title: string;
  type: CalendarEventType;
  event_date: string; // YYYY-MM-DD
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  notes: string | null;
  recurrence: Recurrence;
  recurrence_days: number[] | null;
  recurrence_until: string | null;
  created_at: string;
  updated_at: string;
};

export type CalendarEventInput = {
  title: string;
  type: CalendarEventType;
  eventDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  notes: string;
  recurrence: Recurrence;
  recurrenceDays: number[];
  recurrenceUntil: string;
};

export async function fetchCalendarEvents(): Promise<DbCalendarEvent[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("calendar_events").select("*").order("event_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbCalendarEvent[];
}

export async function createCalendarEvent(input: CalendarEventInput): Promise<DbCalendarEvent> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      title: input.title,
      type: input.type,
      event_date: input.eventDate,
      start_time: input.startTime || null,
      end_time: input.endTime || null,
      venue: input.venue || null,
      notes: input.notes || null,
      recurrence: input.recurrence,
      recurrence_days: input.recurrence === "weekly" ? input.recurrenceDays : null,
      recurrence_until: input.recurrence === "weekly" && input.recurrenceUntil ? input.recurrenceUntil : null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DbCalendarEvent;
}

export async function updateCalendarEvent(id: string, input: CalendarEventInput): Promise<DbCalendarEvent> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("calendar_events")
    .update({
      title: input.title,
      type: input.type,
      event_date: input.eventDate,
      start_time: input.startTime || null,
      end_time: input.endTime || null,
      venue: input.venue || null,
      notes: input.notes || null,
      recurrence: input.recurrence,
      recurrence_days: input.recurrence === "weekly" ? input.recurrenceDays : null,
      recurrence_until: input.recurrence === "weekly" && input.recurrenceUntil ? input.recurrenceUntil : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbCalendarEvent;
}

export async function deleteCalendarEvent(id: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("calendar_events").delete().eq("id", id);
  if (error) throw error;
}

export type EventOccurrence = {
  key: string;
  eventId: string;
  date: string; // YYYY-MM-DD
  title: string;
  type: CalendarEventType;
  startTime: string | null;
  endTime: string | null;
  venue: string | null;
  notes: string | null;
};

function toDateOnly(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Expands one calendar_events row into its concrete occurrence dates that
// fall inside [rangeStart, rangeEnd] (both YYYY-MM-DD, inclusive) — a plain
// one-off event yields at most one occurrence, a weekly-recurring one yields
// every matching weekday in range up to its optional end date.
export function expandEvent(event: DbCalendarEvent, rangeStart: string, rangeEnd: string): EventOccurrence[] {
  const occurrences: EventOccurrence[] = [];
  const base = {
    eventId: event.id,
    title: event.title,
    type: event.type,
    startTime: event.start_time,
    endTime: event.end_time,
    venue: event.venue,
    notes: event.notes,
  };

  if (event.recurrence !== "weekly" || !event.recurrence_days || event.recurrence_days.length === 0) {
    if (event.event_date >= rangeStart && event.event_date <= rangeEnd) {
      occurrences.push({ ...base, key: `${event.id}-${event.event_date}`, date: event.event_date });
    }
    return occurrences;
  }

  const start = new Date(`${event.event_date}T00:00:00`);
  const rangeStartDate = new Date(`${rangeStart}T00:00:00`);
  const rangeEndDate = new Date(`${rangeEnd}T00:00:00`);
  const until = event.recurrence_until ? new Date(`${event.recurrence_until}T00:00:00`) : null;

  const cursorStart = start > rangeStartDate ? start : rangeStartDate;
  const cursor = new Date(cursorStart);
  const effectiveEnd = until && until < rangeEndDate ? until : rangeEndDate;

  while (cursor <= effectiveEnd) {
    if (cursor >= start && event.recurrence_days.includes(cursor.getDay())) {
      occurrences.push({ ...base, key: `${event.id}-${toDateOnly(cursor)}`, date: toDateOnly(cursor) });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return occurrences;
}
