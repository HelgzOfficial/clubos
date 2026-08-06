"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/players/player-avatar";
import type { DbPlayer } from "@/lib/players-db";
import type { DbMatch } from "@/lib/matches-db";
import type { DbPlayerCard, DbSuspension } from "@/lib/manager-db";
import {
  fetchThresholds, createThreshold, updateThreshold, deleteThreshold,
  tallyFor, triggerCount, pendingSuspensions, applyPendingSuspensions,
  COUNT_MODES, COUNT_LABELS, COUNT_HELP, SCOPES, SCOPE_LABELS,
  type DbCardThreshold, type CountMode, type Scope,
} from "@/lib/card-thresholds-db";
import {
  Gavel, Plus, Trash2, Loader2, Check, AlertTriangle, EyeOff, Eye, ShieldAlert,
} from "lucide-react";

const inputClass =
  "rounded-lg border border-white/10 bg-navy-600 px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800";

// Card counters and the rules that turn them into bans.
//
// The counter matters as much as the automatic ban. A manager wants to know a
// player is one yellow away before they pick him for a cup tie, not after the
// app has already ruled him out.
export function CardThresholds({
  players,
  cards,
  matches,
  suspensions,
  onChanged,
}: {
  players: DbPlayer[];
  cards: DbPlayerCard[];
  matches: DbMatch[];
  suspensions: DbSuspension[];
  onChanged: () => void | Promise<void>;
}) {
  const [rules, setRules] = useState<DbCardThreshold[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [showNew, setShowNew] = useState(false);
  const [label, setLabel] = useState("");
  const [counts, setCounts] = useState<CountMode>("yellow");
  const [scope, setScope] = useState<Scope>("league");
  const [threshold, setThreshold] = useState("5");
  const [banned, setBanned] = useState("1");
  const [repeating, setRepeating] = useState(true);
  const [notes, setNotes] = useState("");

  const load = () =>
    fetchThresholds(true)
      .then(setRules)
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "";
        setError(
          /relation|does not exist|schema cache/i.test(msg)
            ? "Card thresholds aren't set up yet — run supabase-card-thresholds.sql in Supabase."
            : msg || "Couldn't load the rules."
        );
      })
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const active = useMemo(() => rules.filter((r) => r.is_active), [rules]);
  const playerIds = useMemo(() => players.map((p) => p.id), [players]);

  // Bans that are due but haven't been raised. Shown rather than written
  // silently — a player being suspended is not something that should happen
  // behind a manager's back.
  const pending = useMemo(
    () => pendingSuspensions(playerIds, active, cards, matches, suspensions),
    [playerIds, active, cards, matches, suspensions]
  );

  // Everyone with anything on their record, closest to a ban first.
  const counters = useMemo(() => {
    const rows: { player: DbPlayer; rule: DbCardThreshold; tally: number; nextAt: number; remaining: number }[] = [];
    for (const rule of active) {
      for (const player of players) {
        const tally = tallyFor(player.id, rule, cards, matches);
        if (tally === 0) continue;
        const fired = triggerCount(rule, tally);
        const nextAt = rule.repeating ? rule.threshold * (fired + 1) : rule.threshold;
        rows.push({ player, rule, tally, nextAt, remaining: Math.max(0, nextAt - tally) });
      }
    }
    return rows.sort((a, b) => a.remaining - b.remaining || b.tally - a.tally);
  }, [active, players, cards, matches]);

  async function applyAll() {
    setBusy(true);
    setError("");
    try {
      const n = await applyPendingSuspensions(pending);
      setNotice(`${n} ${n === 1 ? "suspension" : "suspensions"} raised. Those players are now unavailable for selection.`);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't raise those suspensions.");
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    const t = Number(threshold);
    const b = Number(banned);
    if (!label.trim() || !Number.isFinite(t) || t < 1 || !Number.isFinite(b) || b < 1) return;
    setBusy(true);
    setError("");
    try {
      await createThreshold({
        label: label.trim(), counts, scope, threshold: t, matchesBanned: b, repeating, notes,
      });
      setLabel(""); setNotes(""); setShowNew(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that rule.");
    } finally {
      setBusy(false);
    }
  }

  async function patch(rule: DbCardThreshold, changes: Parameters<typeof updateThreshold>[1]) {
    try {
      await updateThreshold(rule.id, changes);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update that rule.");
    }
  }

  async function remove(rule: DbCardThreshold) {
    if (!window.confirm(`Delete "${rule.label}"?\n\nSuspensions it already raised stay in place.`)) return;
    try {
      await deleteThreshold(rule.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete that rule.");
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-300" />
            <p className="text-sm text-amber-200">{error}</p>
          </div>
        </Card>
      )}
      {notice && !error && (
        <Card className="border-emerald-500/30 bg-emerald-500/10">
          <div className="flex items-start gap-2">
            <Check size={15} className="mt-0.5 shrink-0 text-emerald-300" />
            <p className="text-sm text-emerald-200">{notice}</p>
          </div>
        </Card>
      )}

      {/* Bans that are due */}
      {pending.length > 0 && (
        <Card className="border-red-500/30 bg-red-500/10">
          <CardHeader>
            <CardTitle>Suspensions due</CardTitle>
            <ShieldAlert size={18} className="text-red-300" />
          </CardHeader>
          <p className="mb-2 text-xs text-red-200/80">
            These players have hit a threshold. Nothing is applied until you say so — a player being ruled out
            shouldn&apos;t happen behind your back.
          </p>
          <ul className="mb-3 space-y-1.5">
            {pending.map((p, i) => {
              const player = players.find((x) => x.id === p.playerId);
              return (
                <li key={i} className="flex items-center gap-2 text-sm">
                  {player && <PlayerAvatar playerId={player.id} initials={player.initials} photoUrl={player.photo_url} size="sm" />}
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{player?.name ?? "Unknown player"}</span>
                    <span className="text-red-200/70"> — {p.rule.label}, {p.atTotal} reached</span>
                  </span>
                  <span className="shrink-0 text-xs text-red-200">
                    {p.rule.matches_banned} match{p.rule.matches_banned === 1 ? "" : "es"}
                  </span>
                </li>
              );
            })}
          </ul>
          <button
            onClick={applyAll}
            disabled={busy}
            className="flex touch-manipulation items-center gap-1.5 rounded-xl bg-red-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Gavel size={14} />}
            Apply {pending.length} {pending.length === 1 ? "suspension" : "suspensions"}
          </button>
        </Card>
      )}

      {/* Counters */}
      <Card>
        <CardHeader>
          <CardTitle>Card Counter</CardTitle>
          <Gavel size={18} className="text-neutral-400" />
        </CardHeader>
        <p className="mb-3 text-xs text-neutral-400">
          Where every player stands against each rule, closest to a ban first.
        </p>

        {loading ? (
          <p className="text-sm text-neutral-400">Loading…</p>
        ) : counters.length === 0 ? (
          <p className="text-sm text-neutral-400">No cards recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-xs">
              <thead className="bg-navy-600/50 dark:bg-navy-800/50">
                <tr>
                  <th className="px-2 py-2 text-left font-medium text-neutral-400">Player</th>
                  <th className="px-2 py-2 text-left font-medium text-neutral-400">Rule</th>
                  <th className="px-2 py-2 text-right font-medium text-neutral-400">Count</th>
                  <th className="px-2 py-2 text-right font-medium text-neutral-400">Next ban at</th>
                  <th className="px-2 py-2 text-right font-medium text-neutral-400">To go</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {counters.map((c, i) => (
                  <tr key={i} className={c.remaining === 0 ? "bg-red-500/5" : c.remaining === 1 ? "bg-amber-500/5" : ""}>
                    <td className="whitespace-nowrap px-2 py-1.5">
                      <span className="flex items-center gap-1.5">
                        <PlayerAvatar playerId={c.player.id} initials={c.player.initials} photoUrl={c.player.photo_url} size="sm" />
                        {c.player.name}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-neutral-400">{c.rule.label}</td>
                    <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{c.tally}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-neutral-400">{c.nextAt}</td>
                    <td className="px-2 py-1.5 text-right">
                      <span
                        className={`rounded-lg px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${
                          c.remaining === 0
                            ? "bg-red-500/15 text-red-300"
                            : c.remaining === 1
                              ? "bg-amber-500/15 text-amber-300"
                              : "bg-white/5 text-neutral-400"
                        }`}
                      >
                        {c.remaining === 0 ? "Due" : c.remaining}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Rules */}
      <Card>
        <CardHeader>
          <CardTitle>Thresholds</CardTitle>
          {!showNew && (
            <button
              onClick={() => setShowNew(true)}
              className="flex touch-manipulation items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800"
            >
              <Plus size={13} /> Add a rule
            </button>
          )}
        </CardHeader>

        <p className="mb-3 text-xs text-neutral-400">
          Your league&apos;s rules, not the app&apos;s. Change these when the competition changes them — nothing is
          hard-coded.
        </p>

        {showNew && (
          <div className="mb-4 space-y-2 rounded-xl border border-white/10 bg-navy-600/40 p-3 dark:bg-navy-800/40">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Name, e.g. 5 yellows in the league"
              className={`${inputClass} w-full`}
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <label className="block">
                <span className="mb-0.5 block text-[10px] text-neutral-500">Counts</span>
                <select value={counts} onChange={(e) => setCounts(e.target.value as CountMode)} className={`${inputClass} w-full`}>
                  {COUNT_MODES.map((c) => <option key={c} value={c}>{COUNT_LABELS[c]}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-0.5 block text-[10px] text-neutral-500">In</span>
                <select value={scope} onChange={(e) => setScope(e.target.value as Scope)} className={`${inputClass} w-full`}>
                  {SCOPES.map((sc) => <option key={sc} value={sc}>{SCOPE_LABELS[sc]}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-0.5 block text-[10px] text-neutral-500">Threshold</span>
                <input value={threshold} onChange={(e) => setThreshold(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className={`${inputClass} w-full`} />
              </label>
              <label className="block">
                <span className="mb-0.5 block text-[10px] text-neutral-500">Matches banned</span>
                <input value={banned} onChange={(e) => setBanned(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className={`${inputClass} w-full`} />
              </label>
            </div>
            <p className="text-[11px] text-neutral-500">{COUNT_HELP[counts]}</p>
            <label className="flex items-center gap-2 text-xs text-neutral-300">
              <input type="checkbox" checked={repeating} onChange={(e) => setRepeating(e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-navy-600 dark:bg-navy-800" />
              Fires again at every multiple ({threshold || "5"}, {Number(threshold || 5) * 2}, {Number(threshold || 5) * 3}…)
            </label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className={`${inputClass} w-full`} />
            <div className="flex gap-2">
              <button
                onClick={add}
                disabled={busy || !label.trim()}
                className="flex touch-manipulation items-center gap-1.5 rounded-xl bg-club-primary px-3 py-2 text-sm font-medium text-navy-950 disabled:opacity-60"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add rule
              </button>
              <button onClick={() => setShowNew(false)} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800">
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-neutral-400">Loading…</p>
        ) : rules.length === 0 ? (
          <p className="text-sm text-neutral-400">No rules yet.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {rules.map((r) => (
              <li key={r.id} className={`flex items-center gap-2 py-2.5 ${r.is_active ? "" : "opacity-50"}`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.label}</p>
                  <p className="truncate text-[11px] text-neutral-500">
                    {r.threshold} {COUNT_LABELS[r.counts].toLowerCase()} · {SCOPE_LABELS[r.scope].toLowerCase()} ·{" "}
                    {r.matches_banned} match{r.matches_banned === 1 ? "" : "es"} banned
                    {r.repeating ? " · repeats" : ""}
                    {r.notes ? ` · ${r.notes}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => patch(r, { isActive: !r.is_active })}
                  title={r.is_active ? "Turn this rule off" : "Turn this rule on"}
                  className="shrink-0 text-neutral-500 hover:text-white"
                >
                  {r.is_active ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <button onClick={() => remove(r)} className="shrink-0 text-neutral-500 hover:text-red-400">
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
