"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DbPlayer } from "@/lib/players-db";
import type { DbInjury } from "@/lib/injuries-db";
import {
  fetchBookings, createBooking, updateBookingStatus, deleteBooking,
  TREATMENT_TYPE_OPTIONS, type DbTreatmentBooking, type BookingStatus,
} from "@/lib/treatment-bookings-db";
import { Plus, X, Check, Trash2, CalendarClock, Ban } from "lucide-react";

const statusVariant: Record<BookingStatus, "green" | "amber" | "red" | "neutral"> = {
  scheduled: "amber",
  completed: "green",
  cancelled: "neutral",
  "no-show": "red",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function TreatmentBookings({ players, injuries }: { players: DbPlayer[]; injuries: DbInjury[] }) {
  const [bookings, setBookings] = useState<DbTreatmentBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [dayFilter, setDayFilter] = useState<string>(todayIso());
  const [showAll, setShowAll] = useState(false);

  const [playerId, setPlayerId] = useState("");
  const [treatmentType, setTreatmentType] = useState(TREATMENT_TYPE_OPTIONS[0]);
  const [date, setDate] = useState(todayIso());
  const [startTime, setStartTime] = useState("09:00");
  const [durationMins, setDurationMins] = useState("30");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setBookings(await fetchBookings());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load treatment bookings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!playerId || !date || !startTime) {
      setFormError("Player, date, and start time are required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const start = new Date(`${date}T${startTime}:00`);
      const end = new Date(start.getTime() + Number(durationMins) * 60 * 1000);
      const activeInjury = injuries.find((i) => i.player_id === playerId);
      await createBooking({
        playerId,
        injuryId: activeInjury?.id ?? null,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        treatmentType,
        notes: notes.trim(),
      });
      setShowAdd(false);
      setPlayerId("");
      setNotes("");
      setDurationMins("30");
      setStartTime("09:00");
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Couldn't book that slot.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(id: string, status: BookingStatus) {
    await updateBookingStatus(id, status);
    await load();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Remove this booking?")) return;
    await deleteBooking(id);
    await load();
  }

  const playerName = (id: string) => players.find((p) => p.id === id)?.name ?? "Unknown player";

  const visible = showAll ? bookings : bookings.filter((b) => b.start_time.slice(0, 10) === dayFilter);
  const sorted = [...visible].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Treatment Bookings</CardTitle>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 rounded-xl bg-club-primary text-navy-950 px-3 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={13} /> Book Slot
        </button>
      </CardHeader>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-neutral-400">
          <CalendarClock size={13} /> Day:
        </label>
        <input
          type="date"
          value={dayFilter}
          onChange={(e) => { setDayFilter(e.target.value); setShowAll(false); }}
          className="rounded-lg border border-white/10 bg-navy-600 dark:bg-navy-800 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-club-primary/30"
        />
        <button
          onClick={() => setShowAll((v) => !v)}
          className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${showAll ? "bg-club-primary text-navy-950" : "border border-white/10 text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800"}`}
        >
          {showAll ? "Showing all" : "Show all upcoming"}
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-300">{error}</p>}

      {loading ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-neutral-400">No treatment slots booked {showAll ? "yet" : "for this day"}.</p>
      ) : (
        <ul className="divide-y divide-white/10">
          {sorted.map((b) => (
            <li key={b.id} className="flex items-center gap-3 py-2.5 text-sm">
              <div className="w-24 shrink-0 text-xs text-neutral-400">
                {showAll && <div>{formatDay(b.start_time)}</div>}
                <div className="font-medium text-neutral-200">{formatTime(b.start_time)}–{formatTime(b.end_time)}</div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{playerName(b.player_id)}</p>
                <p className="truncate text-xs text-neutral-400">{b.treatment_type}{b.notes ? ` · ${b.notes}` : ""}</p>
              </div>
              <Badge variant={statusVariant[b.status]}>{b.status}</Badge>
              {b.status === "scheduled" && (
                <>
                  <button onClick={() => handleStatus(b.id, "completed")} title="Mark completed" className="flex h-7 w-7 items-center justify-center rounded-full text-emerald-400 hover:bg-emerald-500/10">
                    <Check size={13} />
                  </button>
                  <button onClick={() => handleStatus(b.id, "cancelled")} title="Cancel" className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800">
                    <Ban size={13} />
                  </button>
                </>
              )}
              <button onClick={() => handleDelete(b.id)} title="Delete" className="flex h-7 w-7 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10">
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-sm">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-medium">Book Treatment Slot</p>
              <button onClick={() => setShowAdd(false)} className="text-neutral-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Player</label>
                <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30">
                  <option value="">Select a player…</option>
                  {players.map((p) => <option key={p.id} value={p.id}>{p.name} (#{p.squad_number})</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Treatment type</label>
                <select value={treatmentType} onChange={(e) => setTreatmentType(e.target.value)} className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30">
                  {TREATMENT_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-neutral-500">Date</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
                </div>
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-neutral-500">Start time</label>
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Duration (minutes)</label>
                <select value={durationMins} onChange={(e) => setDurationMins(e.target.value)} className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30">
                  {["15", "30", "45", "60", "90"].map((d) => <option key={d} value={d}>{d} min</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Notes (optional)</label>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
              </div>

              {formError && <p className="text-sm text-red-300">{formError}</p>}

              <button type="submit" disabled={saving} className="w-full rounded-xl bg-club-primary text-navy-950 px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60">
                {saving ? "Booking…" : "Book Slot"}
              </button>
            </form>
          </Card>
        </div>
      )}
    </Card>
  );
}
