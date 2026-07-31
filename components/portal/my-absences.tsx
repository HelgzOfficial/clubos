"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Check, X, Loader2, Plane } from "lucide-react";
import {
  fetchPlayerAbsences, createPlayerAbsence, deletePlayerAbsence,
  type DbPlayerAbsence, type AbsenceReason,
} from "@/lib/player-absences-db";

const REASONS: AbsenceReason[] = ["Holiday", "International Duty", "Compassionate Leave", "Other"];

const inputClass =
  "w-full rounded-lg border border-white/10 bg-navy-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function shortDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// A player booking their own time off.
//
// The whole point is that it reaches the manager without a WhatsApp message
// that gets lost — these rows are the same ones the Manager module reads for
// squad availability, so telling the app is telling the club.
export function MyAbsences({ playerId }: { playerId: string }) {
  const [absences, setAbsences] = useState<DbPlayerAbsence[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState<AbsenceReason>("Holiday");
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await fetchPlayerAbsences();
      setAbsences(all.filter((a) => a.player_id === playerId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your time off.");
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!startDate || !endDate) return;
    if (endDate < startDate) {
      setError("The end date is before the start date.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const row = await createPlayerAbsence({ playerId, reason, startDate, endDate, notes });
      setAbsences((prev) => [row, ...prev]);
      setAdding(false);
      setNotes("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Remove this from your calendar?")) return;
    try {
      await deletePlayerAbsence(id);
      setAbsences((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove that.");
    }
  }

  if (loading) return <p className="text-sm text-neutral-400">Loading…</p>;

  const t = todayIso();
  const upcoming = absences.filter((a) => a.end_date >= t);
  const past = absences.filter((a) => a.end_date < t);

  return (
    <div>
      <p className="mb-3 text-xs text-neutral-400">
        Let the manager know when you&apos;re away. It shows up straight away on the squad availability list, so
        there&apos;s no need to message anyone separately.
      </p>

      {adding ? (
        <div className="mb-3 space-y-2 rounded-xl border border-white/10 p-3">
          <select value={reason} onChange={(e) => setReason(e.target.value as AbsenceReason)} className={inputClass}>
            {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <label className="block text-xs text-neutral-500">
            From
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <label className="block text-xs text-neutral-500">
            Until
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the manager should know (optional)" className={inputClass} />
          {error && <p className="text-xs text-red-300">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving}
              className="flex flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-xl bg-club-primary px-3 py-2.5 text-sm font-medium text-navy-950 disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
            </button>
            <button
              onClick={() => { setAdding(false); setError(""); }}
              className="flex touch-manipulation items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-neutral-300"
            >
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mb-3 flex w-full touch-manipulation items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800"
        >
          <Plus size={14} /> Add time off
        </button>
      )}

      {error && !adding && <p className="mb-2 text-xs text-red-300">{error}</p>}

      {upcoming.length === 0 && past.length === 0 ? (
        <p className="text-sm text-neutral-400">Nothing booked.</p>
      ) : (
        <>
          {upcoming.length > 0 && (
            <ul className="space-y-1.5">
              {upcoming.map((a) => (
                <li key={a.id} className="flex items-center gap-2.5 rounded-xl border border-white/10 px-3 py-2.5">
                  <Plane size={15} className="shrink-0 text-club-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.reason}</p>
                    <p className="truncate text-[11px] text-neutral-500">
                      {shortDate(a.start_date)} – {shortDate(a.end_date)}
                      {a.notes ? ` · ${a.notes}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(a.id)}
                    aria-label="Remove"
                    className="flex h-7 w-7 shrink-0 touch-manipulation items-center justify-center rounded-full text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {past.length > 0 && (
            <p className="mt-2 text-[11px] text-neutral-500">
              {past.length} past entr{past.length === 1 ? "y" : "ies"} not shown.
            </p>
          )}
        </>
      )}
    </div>
  );
}
