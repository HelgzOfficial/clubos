"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { UserPlus, Trash2, Loader2, X } from "lucide-react";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { fetchPlayers, type DbPlayer } from "@/lib/players-db";
import {
  fetchAttendance, setCoachStatus, setGuestStatus, addGuest, removeAttendanceRow,
  effectiveStatus, isOverridden, STATUS_LABEL, STATUS_TONE,
  type DbTrainingAttendance, type CoachStatus, type EffectiveStatus,
} from "@/lib/training-attendance-db";

const COACH_MARKS: { value: CoachStatus; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "excused", label: "Excused" },
];

// The register for one training day. Squad players are listed whether or not
// they've replied, because "who hasn't answered" is the question a coach
// actually needs the night before. Guests — trialists, players up from another
// age group — are added by name and sit in their own section.
export function AttendanceRegister({ date, canEdit }: { date: string; canEdit: boolean }) {
  const [players, setPlayers] = useState<DbPlayer[]>([]);
  const [rows, setRows] = useState<DbTrainingAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestNote, setGuestNote] = useState("");
  const [savingGuest, setSavingGuest] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [p, a] = await Promise.all([fetchPlayers(), fetchAttendance(date)]);
      setPlayers(p);
      setRows(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the register.");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const byPlayer = useMemo(() => {
    const map = new Map<string, DbTrainingAttendance>();
    for (const r of rows) if (r.player_id) map.set(r.player_id, r);
    return map;
  }, [rows]);

  const guests = useMemo(() => rows.filter((r) => !r.player_id), [rows]);

  const counts = useMemo(() => {
    const all: EffectiveStatus[] = [
      ...players.map((p) => effectiveStatus(byPlayer.get(p.id))),
      ...guests.map((g) => effectiveStatus(g)),
    ];
    return {
      in: all.filter((s) => s === "present" || s === "said-yes").length,
      out: all.filter((s) => s === "absent" || s === "said-no" || s === "excused").length,
      awaiting: all.filter((s) => s === "awaiting").length,
      total: all.length,
    };
  }, [players, byPlayer, guests]);

  async function mark(playerId: string, status: CoachStatus | null) {
    setBusyKey(playerId);
    setError("");
    try {
      const updated = await setCoachStatus(date, playerId, status);
      setRows((prev) => {
        const rest = prev.filter((r) => r.id !== updated.id && r.player_id !== playerId);
        return [...rest, updated];
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setBusyKey(null);
    }
  }

  async function markGuest(row: DbTrainingAttendance, status: CoachStatus | null) {
    setBusyKey(row.id);
    try {
      await setGuestStatus(row.id, status);
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, coach_status: status } : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleAddGuest() {
    if (!guestName.trim()) return;
    setSavingGuest(true);
    setError("");
    try {
      const row = await addGuest(date, guestName, guestNote);
      setRows((prev) => [...prev, row]);
      setGuestName("");
      setGuestNote("");
      setShowAddGuest(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that person.");
    } finally {
      setSavingGuest(false);
    }
  }

  async function handleRemove(row: DbTrainingAttendance) {
    if (!window.confirm(`Remove ${row.guest_name} from this register?`)) return;
    setBusyKey(row.id);
    try {
      await removeAttendanceRow(row.id);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove that person.");
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) return <p className="py-3 text-sm text-neutral-400">Loading the register…</p>;

  const markBtn = "touch-manipulation rounded-lg border border-white/10 px-2 py-1 text-[11px] font-medium transition-colors hover:bg-navy-600 dark:hover:bg-navy-800 disabled:opacity-50";

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
        <span className="rounded-lg bg-emerald-500/15 px-2 py-1 font-medium text-emerald-300">{counts.in} in</span>
        <span className="rounded-lg bg-red-500/15 px-2 py-1 font-medium text-red-300">{counts.out} out</span>
        <span className="rounded-lg bg-white/10 px-2 py-1 font-medium text-neutral-400">{counts.awaiting} no reply</span>
        {canEdit && (
          <button
            onClick={() => setShowAddGuest((v) => !v)}
            className="ml-auto flex touch-manipulation items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 font-medium text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800"
          >
            <UserPlus size={12} /> Add someone
          </button>
        )}
      </div>

      {showAddGuest && canEdit && (
        <div className="mb-3 rounded-xl border border-white/10 p-3">
          <p className="mb-2 text-xs text-neutral-400">
            For anyone not in the squad list — a trialist, a player up from another age group, a guest goalkeeper.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Name"
              className="flex-1 rounded-lg border border-white/10 bg-navy-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
            />
            <input
              value={guestNote}
              onChange={(e) => setGuestNote(e.target.value)}
              placeholder="Note (e.g. trialist, U18s)"
              className="flex-1 rounded-lg border border-white/10 bg-navy-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
            />
            <button
              onClick={handleAddGuest}
              disabled={savingGuest || !guestName.trim()}
              className="touch-manipulation rounded-lg bg-club-primary px-3 py-2 text-sm font-medium text-navy-950 disabled:opacity-60"
            >
              {savingGuest ? <Loader2 size={14} className="animate-spin" /> : "Add"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mb-2 text-xs text-red-300">{error}</p>}

      <ul className="divide-y divide-white/10">
        {players.map((p) => {
          const row = byPlayer.get(p.id);
          const status = effectiveStatus(row);
          const overridden = isOverridden(row);
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
              <PlayerAvatar playerId={p.id} initials={p.initials} photoUrl={p.photo_url} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="text-[11px] text-neutral-500">
                  #{p.squad_number} · {p.position}
                  {overridden && row?.player_response && (
                    <span className="text-amber-400"> · player said {row.player_response === "yes" ? "yes" : "no"}</span>
                  )}
                </p>
              </div>
              <span className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium ${STATUS_TONE[status]}`}>
                {STATUS_LABEL[status]}
              </span>
              {canEdit && (
                <span className="flex shrink-0 items-center gap-1">
                  {COACH_MARKS.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => mark(p.id, m.value)}
                      disabled={busyKey === p.id}
                      className={`${markBtn} ${row?.coach_status === m.value ? "bg-club-primary text-navy-950" : ""}`}
                    >
                      {m.label}
                    </button>
                  ))}
                  {row?.coach_status && (
                    <button
                      onClick={() => mark(p.id, null)}
                      disabled={busyKey === p.id}
                      title="Clear the override and use the player's own answer"
                      className="flex h-6 w-6 touch-manipulation items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 hover:text-white dark:hover:bg-navy-800"
                    >
                      <X size={12} />
                    </button>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {guests.length > 0 && (
        <>
          <p className="mb-1 mt-4 text-[11px] font-medium uppercase tracking-wide text-neutral-500">Not in the squad</p>
          <ul className="divide-y divide-white/10">
            {guests.map((g) => {
              const status = effectiveStatus(g);
              return (
                <li key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-600 text-[11px] font-semibold dark:bg-navy-800">
                    {g.guest_name?.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{g.guest_name}</p>
                    {g.guest_note && <p className="truncate text-[11px] text-neutral-500">{g.guest_note}</p>}
                  </div>
                  <span className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium ${STATUS_TONE[status]}`}>
                    {STATUS_LABEL[status]}
                  </span>
                  {canEdit && (
                    <span className="flex shrink-0 items-center gap-1">
                      {COACH_MARKS.map((m) => (
                        <button
                          key={m.value}
                          onClick={() => markGuest(g, m.value)}
                          disabled={busyKey === g.id}
                          className={`${markBtn} ${g.coach_status === m.value ? "bg-club-primary text-navy-950" : ""}`}
                        >
                          {m.label}
                        </button>
                      ))}
                      <button
                        onClick={() => handleRemove(g)}
                        disabled={busyKey === g.id}
                        className="flex h-6 w-6 touch-manipulation items-center justify-center rounded-full text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 size={12} />
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <p className="mt-3 text-xs text-neutral-400">
        Players confirm from the companion app. Marking someone here overrides their answer without erasing it — if
        they said they were coming and didn&apos;t, the register shows both.
      </p>
    </div>
  );
}
