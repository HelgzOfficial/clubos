"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DbPlayer } from "@/lib/players-db";
import type { DbInjury } from "@/lib/injuries-db";
import {
  fetchBookings, createBooking, updateBookingStatus, deleteBooking, sendTreatmentInvite,
  confirmBooking, declineBooking, BOOKING_STEP_MINUTES, snapToBookingInterval,
  TREATMENT_TYPE_OPTIONS, type DbTreatmentBooking, type BookingStatus,
} from "@/lib/treatment-bookings-db";
import { fetchAppUsersByRole } from "@/lib/app-users-db";
import type { AppUserRecord } from "@/lib/permissions";
import { Plus, X, Check, Trash2, CalendarClock, Ban, CalendarPlus, Loader2 } from "lucide-react";

const statusVariant: Record<BookingStatus, "green" | "amber" | "red" | "neutral" | "blue"> = {
  requested: "blue",
  scheduled: "amber",
  completed: "green",
  cancelled: "neutral",
  "no-show": "red",
};

const statusLabel: Record<BookingStatus, string> = {
  requested: "Awaiting your confirmation",
  scheduled: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  "no-show": "No-show",
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

export function TreatmentBookings({ players, injuries, canEdit }: { players: DbPlayer[]; injuries: DbInjury[]; canEdit: boolean }) {
  const [bookings, setBookings] = useState<DbTreatmentBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [dayFilter, setDayFilter] = useState<string>(todayIso());
  const [showAll, setShowAll] = useState(false);
  const [inviteNoteId, setInviteNoteId] = useState<string | null>(null);
  const [inviteNote, setInviteNote] = useState("");
  const [sendingInviteId, setSendingInviteId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  // The time a clinician is setting for each date-only request, keyed by
  // booking. Held per request rather than as one shared value so several can be
  // worked through without the previous entry bleeding into the next.
  const [slotTime, setSlotTime] = useState<Record<string, string>>({});
  const [slotMins, setSlotMins] = useState<Record<string, string>>({});

  const [doctorOptions, setDoctorOptions] = useState<AppUserRecord[]>([]);

  const [playerId, setPlayerId] = useState("");
  const [treatmentType, setTreatmentType] = useState(TREATMENT_TYPE_OPTIONS[0]);
  const [date, setDate] = useState(todayIso());
  const [startTime, setStartTime] = useState("09:00");
  const [durationMins, setDurationMins] = useState("30");
  const [notes, setNotes] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [bookingRows, doctors] = await Promise.all([fetchBookings(), fetchAppUsersByRole("doctor_physio")]);
      setBookings(bookingRows);
      setDoctorOptions(doctors);
      setDoctorId((prev) => prev || doctors[0]?.id || "");
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
      const start = new Date(`${date}T${snapToBookingInterval(startTime)}:00`);
      const end = new Date(start.getTime() + Number(durationMins) * 60 * 1000);
      const activeInjury = injuries.find((i) => i.player_id === playerId);
      const doctor = doctorOptions.find((d) => d.id === doctorId);
      const player = players.find((p) => p.id === playerId);

      const booking = await createBooking({
        playerId,
        injuryId: activeInjury?.id ?? null,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        treatmentType,
        notes: notes.trim(),
        doctorName: doctor?.name ?? "",
        doctorEmail: doctor?.email ?? "",
        // Booked by the medical team themselves, so there's nobody left to
        // confirm it — straight to scheduled, invite sent below.
        status: "scheduled",
      });
      setShowAdd(false);
      setPlayerId("");
      setNotes("");
      setDurationMins("30");
      setStartTime("09:00");
      await load();

      // Best-effort calendar invite — a failure here shouldn't undo the
      // booking, just surface a note next to it so it's not silently missed.
      if (player) {
        setSendingInviteId(booking.id);
        const result = await sendTreatmentInvite(booking, { name: player.name, email: player.email });
        setSendingInviteId(null);
        setInviteNoteId(booking.id);
        setInviteNote(
          result.ok
            ? `Calendar invite sent${player.email ? "" : " to the doctor only — this player has no email on file"}.`
            : `Booking saved, but the calendar invite didn't send: ${result.error}`
        );
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Couldn't book that slot.");
    } finally {
      setSaving(false);
    }
  }

  // Confirming a player's request is the only point at which anyone gets an
  // email about it. The invite goes to the player and to the confirming
  // clinician together, so both ends of the appointment learn about it at the
  // same moment.
  async function handleConfirm(b: DbTreatmentBooking) {
    const doctor = doctorOptions.find((d) => d.id === doctorId) ?? doctorOptions[0];
    if (!doctor) {
      setError("Add a doctor or physio under Staff before confirming requests — the invite needs somewhere to go.");
      return;
    }

    // A date-only request has no agreed time yet, and confirming without one
    // would send the player an invite for the placeholder. Refuse rather than
    // guess: the whole point of the change is that this decision is yours.
    let slot: { startTime: string; endTime: string } | undefined;
    if (!b.time_set) {
      const time = snapToBookingInterval(slotTime[b.id] ?? "");
      if (!/^\d{2}:\d{2}$/.test(time)) {
        setError("Set a start time for this request before confirming it.");
        return;
      }
      const day = b.start_time.slice(0, 10);
      const start = new Date(`${day}T${time}:00`);
      const mins = Number(slotMins[b.id] ?? "30") || 30;
      slot = {
        startTime: start.toISOString(),
        endTime: new Date(start.getTime() + mins * 60 * 1000).toISOString(),
      };
    }

    setConfirmingId(b.id);
    setError("");
    try {
      const confirmed = await confirmBooking(b.id, { name: doctor.name, email: doctor.email }, doctor.name, slot);
      const player = players.find((p) => p.id === b.player_id);
      const result = await sendTreatmentInvite(confirmed, {
        name: player?.name ?? "Player",
        email: player?.email ?? null,
      });
      setInviteNoteId(b.id);
      setInviteNote(
        result.ok
          ? `Confirmed — invite sent to ${player?.email ? `${player.name} and ` : ""}${doctor.name}.`
          : `Confirmed, but the invite didn't send: ${result.error}`
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't confirm that request.");
    } finally {
      setConfirmingId(null);
    }
  }

  async function handleDecline(b: DbTreatmentBooking) {
    const reason = window.prompt("Why can't this slot go ahead? (the player will see this)") ?? "";
    if (reason === null) return;
    setConfirmingId(b.id);
    try {
      await declineBooking(b.id, reason);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't decline that request.");
    } finally {
      setConfirmingId(null);
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

  // Pending requests are pulled out and shown above the day list. They're the
  // thing that needs an action, and they'd otherwise be invisible unless you
  // happened to be looking at the right day.
  const pending = bookings
    .filter((b) => b.status === "requested")
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const visible = (showAll ? bookings : bookings.filter((b) => b.start_time.slice(0, 10) === dayFilter))
    .filter((b) => b.status !== "requested");
  const sorted = [...visible].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Treatment Bookings</CardTitle>
        {canEdit && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 rounded-xl bg-club-primary text-navy-950 px-3 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={13} /> Book Slot
          </button>
        )}
      </CardHeader>

      {pending.length > 0 && (
        <div className="mb-4 rounded-xl border border-blue-500/30 bg-blue-500/5 p-3">
          <p className="mb-1 text-sm font-medium text-blue-200">
            {pending.length} treatment request{pending.length === 1 ? "" : "s"} awaiting confirmation
          </p>
          <p className="mb-2.5 text-xs text-neutral-400">
            Players ask for a day; you set the time. Nothing has been emailed yet — confirming fixes the time and
            sends the calendar invite to the player and the clinician together.
          </p>
          <ul className="divide-y divide-white/10">
            {pending.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 text-sm">
                <div className="w-24 shrink-0 text-xs text-neutral-400">
                  <div>{formatDay(b.start_time)}</div>
                  {b.time_set ? (
                    <div className="font-medium text-neutral-200">{formatTime(b.start_time)}–{formatTime(b.end_time)}</div>
                  ) : (
                    <div className="text-neutral-500">day requested</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{playerName(b.player_id)}</p>
                  <p className="truncate text-xs text-neutral-400">
                    {b.treatment_type}{b.notes ? ` · ${b.notes}` : ""}
                  </p>
                </div>
                {canEdit && !b.time_set && (
                  <span className="flex shrink-0 items-center gap-1.5">
                    <input
                      type="time"
                      step={BOOKING_STEP_MINUTES * 60}
                      value={slotTime[b.id] ?? ""}
                      onChange={(e) => setSlotTime((prev) => ({ ...prev, [b.id]: e.target.value }))}
                      onBlur={(e) =>
                        setSlotTime((prev) => ({ ...prev, [b.id]: snapToBookingInterval(e.target.value) }))
                      }
                      title="Start time you're giving them"
                      className="w-[6.5rem] rounded-lg border border-white/10 bg-navy-600 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
                    />
                    <select
                      value={slotMins[b.id] ?? "30"}
                      onChange={(e) => setSlotMins((prev) => ({ ...prev, [b.id]: e.target.value }))}
                      title="How long you need"
                      className="rounded-lg border border-white/10 bg-navy-600 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
                    >
                      {["5", "10", "15", "20", "30", "45", "60", "90"].map((m) => (
                        <option key={m} value={m}>{m} min</option>
                      ))}
                    </select>
                  </span>
                )}
                {canEdit && (
                  <span className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => handleConfirm(b)}
                      disabled={confirmingId === b.id}
                      className="flex touch-manipulation items-center gap-1.5 rounded-lg bg-club-primary px-2.5 py-1.5 text-xs font-medium text-navy-950 disabled:opacity-60"
                    >
                      {confirmingId === b.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      Confirm &amp; send invite
                    </button>
                    <button
                      onClick={() => handleDecline(b)}
                      disabled={confirmingId === b.id}
                      className="flex touch-manipulation items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-neutral-300 hover:bg-navy-600 disabled:opacity-60 dark:hover:bg-navy-800"
                    >
                      <Ban size={12} /> Decline
                    </button>
                  </span>
                )}
                {inviteNoteId === b.id && <p className="w-full text-xs text-neutral-400">{inviteNote}</p>}
              </li>
            ))}
          </ul>
          {canEdit && doctorOptions.length > 0 && (
            <label className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
              Confirm as:
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="rounded-lg border border-white/10 bg-navy-600 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
              >
                {doctorOptions.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

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
            <li key={b.id} className="py-2.5">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-24 shrink-0 text-xs text-neutral-400">
                  {showAll && <div>{formatDay(b.start_time)}</div>}
                  <div className="font-medium text-neutral-200">
                    {b.time_set ? `${formatTime(b.start_time)}–${formatTime(b.end_time)}` : "time not set"}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{playerName(b.player_id)}</p>
                  <p className="truncate text-xs text-neutral-400">
                    {b.treatment_type}{b.doctor_name ? ` · with ${b.doctor_name}` : ""}{b.notes ? ` · ${b.notes}` : ""}
                  </p>
                </div>
                <Badge variant={statusVariant[b.status]}>{statusLabel[b.status]}</Badge>
                {canEdit && (
                  <>
                    <button
                      onClick={async () => {
                        const player = players.find((p) => p.id === b.player_id);
                        setSendingInviteId(b.id);
                        const result = await sendTreatmentInvite(b, { name: player?.name ?? "Player", email: player?.email ?? null });
                        setSendingInviteId(null);
                        setInviteNoteId(b.id);
                        setInviteNote(result.ok ? "Calendar invite sent." : `Couldn't send invite: ${result.error}`);
                      }}
                      disabled={sendingInviteId === b.id}
                      title="Send/resend calendar invite"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white disabled:opacity-60"
                    >
                      {sendingInviteId === b.id ? <Loader2 size={13} className="animate-spin" /> : <CalendarPlus size={13} />}
                    </button>
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
                  </>
                )}
              </div>
              {inviteNoteId === b.id && <p className="mt-1 ml-24 text-xs text-neutral-400">{inviteNote}</p>}
            </li>
          ))}
        </ul>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-sm max-h-[90vh] overflow-y-auto">
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
                  <input type="time" step={BOOKING_STEP_MINUTES * 60}
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    onBlur={(e) => setStartTime(snapToBookingInterval(e.target.value))}
                    className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Duration (minutes)</label>
                <select value={durationMins} onChange={(e) => setDurationMins(e.target.value)} className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30">
                  {["5", "10", "15", "20", "30", "45", "60", "90"].map((d) => <option key={d} value={d}>{d} min</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Doctor / physio booking this in</label>
                <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30">
                  <option value="">Select…</option>
                  {doctorOptions.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.role})</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Notes (optional)</label>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
              </div>
              <p className="text-xs text-neutral-400">
                A calendar invite is emailed automatically to the player (if they have an email on file) and the doctor
                selected above once this is booked.
              </p>

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
