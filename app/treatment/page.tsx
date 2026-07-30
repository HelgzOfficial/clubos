"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/lib/permissions";
import { fetchPlayer, type DbPlayer } from "@/lib/players-db";
import { fetchActiveInjuries, type DbInjury } from "@/lib/injuries-db";
import {
  fetchBookings, createBooking, deleteBooking, sendTreatmentInvite,
  TREATMENT_TYPE_OPTIONS, type DbTreatmentBooking, type BookingStatus,
} from "@/lib/treatment-bookings-db";
import { HeartPulse, Plus, X, CalendarClock, Trash2, AlertCircle, Check, MessageCircle } from "lucide-react";
import { MessageThread } from "@/components/medical/message-thread";

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

export default function TreatmentPage() {
  const { appUser, role } = usePermissions();
  const playerId = appUser?.player_id ?? null;

  const [player, setPlayer] = useState<DbPlayer | null>(null);
  const [injuries, setInjuries] = useState<DbInjury[]>([]);
  const [bookings, setBookings] = useState<DbTreatmentBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const [treatmentType, setTreatmentType] = useState(TREATMENT_TYPE_OPTIONS[0]);
  const [date, setDate] = useState(todayIso());
  const [startTime, setStartTime] = useState("09:00");
  const [durationMins, setDurationMins] = useState("30");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  async function load() {
    if (!playerId) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const [p, inj, allBookings] = await Promise.all([fetchPlayer(playerId), fetchActiveInjuries(), fetchBookings()]);
      setPlayer(p);
      setInjuries(inj.filter((i) => i.player_id === playerId));
      setBookings(allBookings.filter((b) => b.player_id === playerId).sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your treatment bookings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [playerId]);

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!playerId || !date || !startTime) return;
    setSaving(true);
    setFormError("");
    try {
      const start = new Date(`${date}T${startTime}:00`);
      const end = new Date(start.getTime() + Number(durationMins) * 60 * 1000);
      const booking = await createBooking({
        playerId,
        injuryId: injuries[0]?.id ?? null,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        treatmentType,
        notes: notes.trim(),
        doctorName: "",
        doctorEmail: "",
      });
      if (player?.email) await sendTreatmentInvite(booking, { name: player.name, email: player.email });
      setShowAdd(false);
      setTreatmentType(TREATMENT_TYPE_OPTIONS[0]);
      setDate(todayIso());
      setStartTime("09:00");
      setDurationMins("30");
      setNotes("");
      setConfirmed(true);
      setTimeout(() => setConfirmed(false), 4000);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Couldn't book that slot.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(booking: DbTreatmentBooking) {
    if (!window.confirm("Cancel this treatment booking?")) return;
    await deleteBooking(booking.id);
    await load();
  }

  if (role !== "player") {
    return (
      <AppShell>
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <HeartPulse size={28} className="mb-3 text-neutral-400" />
          <p className="font-medium">This page is for player logins</p>
          <p className="mt-1 max-w-sm text-sm text-neutral-400">Staff manage treatment bookings from the Medical module instead.</p>
        </Card>
      </AppShell>
    );
  }

  if (!playerId) {
    return (
      <AppShell>
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle size={28} className="mb-3 text-amber-400" />
          <p className="font-medium">Your account isn&apos;t linked to a player profile yet</p>
          <p className="mt-1 max-w-sm text-sm text-neutral-400">Ask an owner or manager to link your login to your player profile from the Staff module.</p>
        </Card>
      </AppShell>
    );
  }

  const upcoming = bookings.filter((b) => b.status === "scheduled" && new Date(b.start_time).getTime() >= Date.now());
  const history = bookings.filter((b) => !upcoming.includes(b));

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Book Treatment</h1>
          <p className="text-sm text-neutral-500">Request a physio or treatment slot with the medical team.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-xl bg-club-primary text-navy-950 px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={15} /> Request Slot
        </button>
      </div>

      {confirmed && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          <Check size={15} /> Slot requested — the medical team will confirm it.
        </div>
      )}
      {error && <p className="mb-4 text-sm text-red-300">{error}</p>}

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Upcoming</CardTitle>
          <CalendarClock size={18} className="text-neutral-400" />
        </CardHeader>
        {loading ? (
          <p className="text-sm text-neutral-400">Loading…</p>
        ) : upcoming.length === 0 ? (
          <p className="text-sm text-neutral-400">No upcoming treatment slots — request one above.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {upcoming.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">{b.treatment_type}</p>
                  <p className="text-xs text-neutral-400">{formatDay(b.start_time)} · {formatTime(b.start_time)}–{formatTime(b.end_time)}</p>
                  {b.notes && <p className="mt-0.5 text-xs text-neutral-500">{b.notes}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={statusVariant[b.status]}>{b.status}</Badge>
                  <button onClick={() => handleCancel(b)} className="flex h-8 w-8 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10" title="Cancel">
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {history.length > 0 && (
        <Card className="mb-5">
          <CardHeader><CardTitle>History</CardTitle></CardHeader>
          <ul className="divide-y divide-white/10">
            {history.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">{b.treatment_type}</p>
                  <p className="text-xs text-neutral-400">{formatDay(b.start_time)} · {formatTime(b.start_time)}</p>
                </div>
                <Badge variant={statusVariant[b.status]}>{b.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Message the Medical Team</CardTitle>
          <MessageCircle size={18} className="text-neutral-400" />
        </CardHeader>
        <MessageThread playerId={playerId} viewerRole="player" viewerName={player?.name ?? "Player"} viewerEmail={player?.email ?? null} />
      </Card>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-medium">Request Treatment Slot</p>
              <button onClick={() => setShowAdd(false)} className="text-neutral-400 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Treatment type</label>
                <select value={treatmentType} onChange={(e) => setTreatmentType(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30">
                  {TREATMENT_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-neutral-500">Date</label>
                  <input type="date" value={date} min={todayIso()} onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
                </div>
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-neutral-500">Start time</label>
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Duration</label>
                <select value={durationMins} onChange={(e) => setDurationMins(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30">
                  {["15", "30", "45", "60"].map((m) => <option key={m} value={m}>{m} minutes</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Notes (optional)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                  placeholder="Anything the medical team should know beforehand"
                  className="w-full resize-none rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
              </div>
              {formError && (
                <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" /><p>{formError}</p>
                </div>
              )}
              <button type="submit" disabled={saving}
                className="w-full rounded-xl bg-club-primary text-navy-950 px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60">
                {saving ? "Requesting…" : "Request Slot"}
              </button>
            </form>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
