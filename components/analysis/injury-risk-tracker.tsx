"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/players/player-avatar";
import type { DbPlayer } from "@/lib/players-db";
import { matchPlayer } from "@/lib/gps-db";
import { SEASON_START } from "@/lib/season";
import {
  fetchRiskFields, createRiskField, updateRiskField, deactivateRiskField, slugifyFieldKey,
  fetchRiskEntries, saveRiskEntry, deleteRiskEntry, riskRowsToCsv,
  assessRisk, summariseSeason, weekStartOf, formatWeek, shortWeek, seasonWeeks,
  FIELD_ROLES, ROLE_LABELS, ROLE_HELP, RISK_LABEL, RISK_TONE,
  type DbRiskEntry, type DbRiskField, type FieldRole, type RiskBand, type RiskValues,
} from "@/lib/injury-risk-db";
import {
  ShieldAlert, Upload, Loader2, Check, X, AlertTriangle, Download, Plus, Trash2, Info,
  CalendarRange, Table2, Sliders, EyeOff, Sparkles,
} from "lucide-react";

const inputClass =
  "rounded-lg border border-white/10 bg-navy-600 px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800";
const cellClass =
  "w-16 rounded border border-white/10 bg-navy-600 px-1 py-1 text-right text-xs tabular-nums outline-none dark:bg-navy-800";

type View = "week" | "season" | "fields";
type Draft = { playerId: string | null; reportName: string; previousInjury: boolean; values: RiskValues };

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = String(reader.result);
      resolve(r.slice(r.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

const BAND_DOT: Record<RiskBand, string> = {
  low: "bg-emerald-500",
  moderate: "bg-amber-400",
  high: "bg-red-500",
  unknown: "bg-white/15",
};

export function InjuryRiskTracker({ players }: { players: DbPlayer[] }) {
  const [view, setView] = useState<View>("week");
  const [fields, setFields] = useState<DbRiskField[]>([]);
  const [allFields, setAllFields] = useState<DbRiskField[]>([]);
  const [entries, setEntries] = useState<DbRiskEntry[]>([]);
  const [week, setWeek] = useState(weekStartOf(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addDraft, setAddDraft] = useState<Draft>({ playerId: null, reportName: "", previousInjury: false, values: {} });

  const nameFor = useCallback(
    (id: string) => players.find((p) => p.id === id)?.name ?? "Unknown player",
    [players]
  );

  // The whole season is loaded once. It's one row per player per week — a few
  // hundred rows at most — so paging it week by week would mean more round
  // trips for no benefit, and the season view needs all of it anyway.
  const load = useCallback(async () => {
    setError("");
    try {
      const [active, every, rows] = await Promise.all([
        fetchRiskFields(false), fetchRiskFields(true), fetchRiskEntries(),
      ]);
      setFields(active);
      setAllFields(every);
      setEntries(rows);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        /relation|does not exist|schema cache/i.test(msg)
          ? "The injury risk tracker isn't set up yet — run supabase-injury-risk.sql in Supabase."
          : msg || "Couldn't load the tracker."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const weeks = useMemo(() => {
    const fromSeason = seasonWeeks(SEASON_START);
    // Anything recorded outside the season window still needs to be reachable,
    // otherwise a mis-dated entry becomes invisible and un-fixable.
    const extra = entries.map((e) => e.week_start).filter((w) => !fromSeason.includes(w));
    return [...new Set([...fromSeason, ...extra])].sort().reverse();
  }, [entries]);

  const weekEntries = useMemo(() => entries.filter((e) => e.week_start === week), [entries, week]);

  const assessed = useMemo(
    () =>
      weekEntries
        .map((e) => ({ entry: e, risk: assessRisk(e, fields) }))
        .sort((a, b) => {
          const order: Record<RiskBand, number> = { high: 0, moderate: 1, low: 2, unknown: 3 };
          return order[a.risk.band] - order[b.risk.band] || nameFor(a.entry.player_id).localeCompare(nameFor(b.entry.player_id));
        }),
    [weekEntries, fields, nameFor]
  );

  const counts = useMemo(() => {
    const c: Record<RiskBand, number> = { high: 0, moderate: 0, low: 0, unknown: 0 };
    for (const a of assessed) c[a.risk.band] += 1;
    return c;
  }, [assessed]);

  const season = useMemo(() => summariseSeason(entries, fields), [entries, fields]);
  const extractable = useMemo(() => fields.filter((f) => f.ai_extract), [fields]);

  // -------------------------------------------------------------------------
  // Upload
  // -------------------------------------------------------------------------

  async function handleFile(file: File) {
    setReading(true);
    setError("");
    setNotice("");
    setDrafts(null);
    try {
      const fileBase64 = await toBase64(file);
      const res = await fetch("/api/read-injury-risk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileBase64,
          mediaType: file.type || "image/png",
          fields: extractable.map((f) => ({
            key: f.key, label: f.label, unit: f.unit, role: f.role,
            higherIsBetter: f.higher_is_better, hint: f.extraction_hint,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Couldn't read that file.");
        return;
      }

      const valid = new Set(extractable.map((f) => f.key));
      const rows: Draft[] = (data.rows as Record<string, unknown>[]).map((r) => {
        const name = String(r.player_name ?? "").trim();
        const raw = (r.values ?? {}) as Record<string, unknown>;
        const values: RiskValues = {};
        for (const [k, v] of Object.entries(raw)) {
          if (!valid.has(k)) continue;
          if (typeof v === "number" && Number.isFinite(v)) values[k] = v;
        }
        return {
          playerId: matchPlayer(name, players)?.id ?? null,
          reportName: name,
          previousInjury: r.previous_injury === true,
          values,
        };
      });

      if (typeof data.weekStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.weekStart)) {
        setWeek(weekStartOf(data.weekStart));
      }
      setView("week");
      setDrafts(rows);
      setNotice(`Read ${rows.length} ${rows.length === 1 ? "player" : "players"}. Check the figures before saving.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      setReading(false);
    }
  }

  async function saveDrafts() {
    if (!drafts) return;
    const saveable = drafts.filter((d) => d.playerId);
    if (saveable.length === 0) { setError("None of these rows are matched to a player yet."); return; }
    setSaving(true);
    setError("");
    try {
      for (const d of saveable) {
        await saveRiskEntry({
          playerId: d.playerId as string, weekStart: week, values: d.values, previousInjury: d.previousInjury,
        });
      }
      const skipped = drafts.length - saveable.length;
      setDrafts(null);
      setNotice(
        `Saved ${saveable.length} ${saveable.length === 1 ? "player" : "players"}.` +
          (skipped > 0 ? ` ${skipped} unmatched ${skipped === 1 ? "row was" : "rows were"} skipped.` : "")
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save those rows.");
    } finally {
      setSaving(false);
    }
  }

  async function saveManual() {
    if (!addDraft.playerId) return;
    setSaving(true);
    setError("");
    try {
      await saveRiskEntry({
        playerId: addDraft.playerId, weekStart: week, values: addDraft.values, previousInjury: addDraft.previousInjury,
      });
      setAddDraft({ playerId: null, reportName: "", previousInjury: false, values: {} });
      setShowAdd(false);
      setNotice("Saved.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that entry.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(entry: DbRiskEntry) {
    if (!window.confirm(`Remove this week's entry for ${nameFor(entry.player_id)}?`)) return;
    try { await deleteRiskEntry(entry.id); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't remove that entry."); }
  }

  function downloadCsv(rows: DbRiskEntry[], name: string) {
    const blob = new Blob([riskRowsToCsv(rows, fields, nameFor)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const VIEWS: { key: View; label: string; icon: typeof Table2 }[] = [
    { key: "week", label: "This week", icon: Table2 },
    { key: "season", label: "Season", icon: CalendarRange },
    { key: "fields", label: "Fields", icon: Sliders },
  ];

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Season Injury Risk Tracker</CardTitle>
          <ShieldAlert size={18} className="text-neutral-400" />
        </CardHeader>

        <div className="mb-3 flex items-start gap-2 rounded-xl border border-white/10 bg-navy-600/40 p-3 text-xs text-neutral-300 dark:bg-navy-800/40">
          <Info size={14} className="mt-0.5 shrink-0 text-neutral-400" />
          <p>
            These bands are a prompt to have a conversation, not a medical opinion and not a prediction. A player
            showing amber should be asked how they feel — nothing more is being claimed. Fitness and selection
            decisions belong to the manager and the medical staff, on the evidence in front of them.
          </p>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => { setView(v.key); setError(""); setNotice(""); }}
              className={`flex touch-manipulation items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                view === v.key ? "bg-club-primary text-navy-950" : "border border-white/10 text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800"
              }`}
            >
              <v.icon size={13} /> {v.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}
        {notice && !error && (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            <Check size={15} className="mt-0.5 shrink-0" />
            <p>{notice}</p>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-neutral-400">Loading…</p>
        ) : view === "fields" ? (
          <FieldsEditor fields={allFields} onChanged={load} onError={setError} />
        ) : view === "season" ? (
          <SeasonView
            season={season} weeks={weeks} nameFor={nameFor} players={players}
            onPickWeek={(w) => { setWeek(w); setView("week"); }}
            onExport={() => downloadCsv(entries, `injury-risk-season`)}
            hasEntries={entries.length > 0}
          />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <select value={week} onChange={(e) => setWeek(e.target.value)} className={inputClass}>
                {weeks.map((w) => <option key={w} value={w}>{formatWeek(w)}</option>)}
              </select>
              <button
                onClick={() => { setShowAdd((v) => !v); setError(""); }}
                className="flex touch-manipulation items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800"
              >
                <Plus size={14} /> {showAdd ? "Cancel" : "Add a player"}
              </button>
              <label
                className={`flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm ${
                  extractable.length === 0 || reading ? "cursor-not-allowed opacity-50" : "cursor-pointer text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800"
                }`}
                title={extractable.length === 0 ? "No fields are marked for reading — see the Fields tab" : undefined}
              >
                {reading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {reading ? "Reading…" : "Upload screenshot or PDF"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  className="hidden"
                  disabled={reading || extractable.length === 0}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
                />
              </label>
              {weekEntries.length > 0 && (
                <button
                  onClick={() => downloadCsv(weekEntries, `injury-risk-${week}`)}
                  className="flex touch-manipulation items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800"
                >
                  <Download size={14} /> CSV
                </button>
              )}
            </div>

            {fields.length === 0 && (
              <p className="mb-3 text-sm text-neutral-400">
                No fields set up yet. Open the Fields tab and add what you want to track.
              </p>
            )}

            {showAdd && fields.length > 0 && (
              <div className="mb-4 space-y-2 rounded-xl border border-white/10 bg-navy-600/40 p-3 dark:bg-navy-800/40">
                <select
                  value={addDraft.playerId ?? ""}
                  onChange={(e) => setAddDraft((d) => ({ ...d, playerId: e.target.value || null }))}
                  className={`${inputClass} w-full sm:max-w-xs`}
                >
                  <option value="">Choose a player…</option>
                  {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  {fields.map((f) => (
                    <label key={f.key} className="block">
                      <span className="mb-0.5 block text-[10px] text-neutral-500">
                        {f.label}{f.unit ? ` (${f.unit})` : ""}
                      </span>
                      <input
                        value={addDraft.values[f.key] ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          setAddDraft((d) => {
                            const values = { ...d.values };
                            const n = Number(raw);
                            if (raw === "" || !Number.isFinite(n)) delete values[f.key];
                            else values[f.key] = n;
                            return { ...d, values };
                          });
                        }}
                        inputMode="decimal"
                        className="w-full rounded border border-white/10 bg-navy-600 px-2 py-1.5 text-sm tabular-nums outline-none dark:bg-navy-800"
                      />
                    </label>
                  ))}
                </div>

                <label className="flex items-center gap-2 text-xs text-neutral-300">
                  <input
                    type="checkbox"
                    checked={addDraft.previousInjury}
                    onChange={(e) => setAddDraft((d) => ({ ...d, previousInjury: e.target.checked }))}
                    className="h-4 w-4 rounded border-white/20 bg-navy-600 dark:bg-navy-800"
                  />
                  Injured earlier this season
                </label>

                <button
                  onClick={saveManual}
                  disabled={saving || !addDraft.playerId}
                  className="flex touch-manipulation items-center gap-1.5 rounded-xl bg-club-primary px-3 py-2 text-sm font-medium text-navy-950 disabled:opacity-60"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save entry
                </button>
              </div>
            )}

            {drafts && (
              <div className="mb-4 space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="text-xs text-amber-100">
                  Read from your file, for the week of {formatWeek(week)}. Correct anything that looks wrong, then
                  save. Unmatched rows are skipped.
                </p>
                <div className="overflow-x-auto rounded-lg border border-white/10 bg-navy-700/50 dark:bg-navy-900/50">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="px-2 py-2 text-left font-medium text-neutral-400">Player</th>
                        {extractable.map((f) => (
                          <th key={f.key} className="whitespace-nowrap px-2 py-2 text-right font-medium text-neutral-400" title={f.label}>
                            {f.label}
                          </th>
                        ))}
                        <th className="px-2 py-2 text-center font-medium text-neutral-400">Prev</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {drafts.map((d, i) => (
                        <tr key={i} className={d.playerId ? "" : "bg-red-500/5"}>
                          <td className="px-2 py-1.5">
                            <select
                              value={d.playerId ?? ""}
                              onChange={(e) =>
                                setDrafts((prev) => prev ? prev.map((x, j) => (j === i ? { ...x, playerId: e.target.value || null } : x)) : prev)
                              }
                              className="w-32 rounded border border-white/10 bg-navy-600 px-1.5 py-1 text-xs outline-none dark:bg-navy-800"
                            >
                              <option value="">{d.reportName} — unmatched</option>
                              {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          </td>
                          {extractable.map((f) => (
                            <td key={f.key} className="px-1 py-1.5">
                              <input
                                value={d.values[f.key] ?? ""}
                                onChange={(e) => {
                                  const raw = e.target.value.trim();
                                  setDrafts((prev) =>
                                    prev
                                      ? prev.map((x, j) => {
                                          if (j !== i) return x;
                                          const values = { ...x.values };
                                          const n = Number(raw);
                                          if (raw === "" || !Number.isFinite(n)) delete values[f.key];
                                          else values[f.key] = n;
                                          return { ...x, values };
                                        })
                                      : prev
                                  );
                                }}
                                inputMode="decimal"
                                className={cellClass}
                              />
                            </td>
                          ))}
                          <td className="px-2 text-center">
                            <input
                              type="checkbox"
                              checked={d.previousInjury}
                              onChange={(e) =>
                                setDrafts((prev) => prev ? prev.map((x, j) => (j === i ? { ...x, previousInjury: e.target.checked } : x)) : prev)
                              }
                              className="h-3.5 w-3.5 rounded border-white/20 bg-navy-600 dark:bg-navy-800"
                            />
                          </td>
                          <td className="px-1">
                            <button
                              onClick={() => setDrafts((prev) => prev ? prev.filter((_, j) => j !== i) : prev)}
                              className="text-neutral-500 hover:text-red-400"
                            >
                              <X size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={saveDrafts}
                    disabled={saving}
                    className="flex touch-manipulation items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-navy-950 disabled:opacity-60"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save {drafts.length} rows
                  </button>
                  <button
                    onClick={() => { setDrafts(null); setNotice(""); }}
                    className="rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800"
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}

            {weekEntries.length === 0 ? (
              <p className="text-sm text-neutral-400">
                Nothing recorded for {formatWeek(week)} yet. Add a player by hand, or upload a screenshot of your
                workload table.
              </p>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap gap-2">
                  {(["high", "moderate", "low"] as RiskBand[]).map((b) => (
                    <span key={b} className={`rounded-lg px-2.5 py-1 text-xs font-medium ${RISK_TONE[b]}`}>
                      {RISK_LABEL[b]}: {counts[b]}
                    </span>
                  ))}
                </div>

                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-xs">
                    <thead className="bg-navy-600/50 dark:bg-navy-800/50">
                      <tr>
                        <th className="px-2 py-2 text-left font-medium text-neutral-400">Player</th>
                        <th className="px-2 py-2 text-left font-medium text-neutral-400">Band</th>
                        <th className="px-2 py-2 text-right font-medium text-neutral-400" title="Acute:chronic workload ratio">A:C</th>
                        {fields.map((f) => (
                          <th key={f.key} className="whitespace-nowrap px-2 py-2 text-right font-medium text-neutral-400" title={ROLE_LABELS[f.role]}>
                            {f.label}
                          </th>
                        ))}
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {assessed.map(({ entry, risk }) => {
                        const p = players.find((x) => x.id === entry.player_id);
                        return (
                          <tr key={entry.id}>
                            <td className="whitespace-nowrap px-2 py-1.5">
                              <span className="flex items-center gap-1.5">
                                {p && <PlayerAvatar playerId={p.id} initials={p.initials} photoUrl={p.photo_url} size="sm" />}
                                {nameFor(entry.player_id)}
                              </span>
                            </td>
                            <td className="px-2 py-1.5">
                              <span
                                className={`inline-block rounded-lg px-1.5 py-0.5 text-[10px] font-medium ${RISK_TONE[risk.band]}`}
                                title={risk.reasons.join(" · ") || undefined}
                              >
                                {RISK_LABEL[risk.band]}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums">
                              {risk.ratio === null ? "—" : risk.ratio.toFixed(2)}
                            </td>
                            {fields.map((f) => {
                              const v = entry.values[f.key];
                              return (
                                <td key={f.key} className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                                  {typeof v === "number" ? v.toFixed(f.decimals) : "—"}
                                </td>
                              );
                            })}
                            <td className="px-1">
                              <button onClick={() => remove(entry)} className="text-neutral-500 hover:text-red-400" title="Remove">
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {assessed.some((a) => a.risk.band !== "low" && a.risk.reasons.length > 0) && (
                  <div className="mt-3 space-y-1">
                    {assessed
                      .filter((a) => a.risk.band !== "low" && a.risk.reasons.length > 0)
                      .map((a) => (
                        <p key={a.entry.id} className="text-xs text-neutral-400">
                          <span className="font-medium text-neutral-200">{nameFor(a.entry.player_id)}</span> —{" "}
                          {a.risk.reasons.join("; ")}
                        </p>
                      ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Season view — every week since the season started, per player
// ---------------------------------------------------------------------------

function SeasonView({
  season, weeks, nameFor, players, onPickWeek, onExport, hasEntries,
}: {
  season: ReturnType<typeof summariseSeason>;
  weeks: string[];
  nameFor: (id: string) => string;
  players: DbPlayer[];
  onPickWeek: (week: string) => void;
  onExport: () => void;
  hasEntries: boolean;
}) {
  // Oldest first across the top, which is how a season reads.
  const timeline = useMemo(() => [...weeks].sort(), [weeks]);

  if (!hasEntries) {
    return <p className="text-sm text-neutral-400">Nothing recorded yet this season.</p>;
  }

  const sorted = [...season].sort(
    (a, b) => b.elevatedWeeks - a.elevatedWeeks || nameFor(a.playerId).localeCompare(nameFor(b.playerId))
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-400">
        Every week since the season began. Each square is one week — click it to open that week. Blank means nothing
        was recorded, which is worth seeing in its own right.
      </p>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-xs">
          <thead className="bg-navy-600/50 dark:bg-navy-800/50">
            <tr>
              <th className="sticky left-0 z-10 bg-navy-700 px-2 py-2 text-left font-medium text-neutral-400 dark:bg-navy-900">Player</th>
              <th className="px-2 py-2 text-right font-medium text-neutral-400" title="Weeks banded Elevated">Elev.</th>
              <th className="px-2 py-2 text-right font-medium text-neutral-400" title="Average acute:chronic ratio">Avg A:C</th>
              {timeline.map((w) => (
                <th key={w} className="px-1 py-2 text-center text-[9px] font-normal text-neutral-500" title={formatWeek(w)}>
                  {shortWeek(w)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {sorted.map((s) => {
              const p = players.find((x) => x.id === s.playerId);
              const byWeek = new Map(s.trend.map((t) => [t.week, t]));
              return (
                <tr key={s.playerId}>
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-navy-700 px-2 py-1.5 dark:bg-navy-900">
                    <span className="flex items-center gap-1.5">
                      {p && <PlayerAvatar playerId={p.id} initials={p.initials} photoUrl={p.photo_url} size="sm" />}
                      {nameFor(s.playerId)}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {s.elevatedWeeks > 0 ? <span className="text-red-300">{s.elevatedWeeks}</span> : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {s.averageRatio === null ? "—" : s.averageRatio.toFixed(2)}
                  </td>
                  {timeline.map((w) => {
                    const t = byWeek.get(w);
                    return (
                      <td key={w} className="px-1 py-1.5 text-center">
                        <button
                          onClick={() => onPickWeek(w)}
                          title={t ? `${formatWeek(w)} — ${RISK_LABEL[t.band]}${t.ratio !== null ? ` (${t.ratio.toFixed(2)})` : ""}` : `${formatWeek(w)} — nothing recorded`}
                          className={`h-4 w-4 rounded-sm ${t ? BAND_DOT[t.band] : "bg-white/5"} hover:ring-2 hover:ring-white/40`}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onExport}
          className="flex touch-manipulation items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800"
        >
          <Download size={14} /> Export the whole season
        </button>
        <span className="flex items-center gap-3 text-[11px] text-neutral-500">
          {(["low", "moderate", "high"] as RiskBand[]).map((b) => (
            <span key={b} className="flex items-center gap-1">
              <span className={`h-3 w-3 rounded-sm ${BAND_DOT[b]}`} /> {RISK_LABEL[b]}
            </span>
          ))}
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-white/5" /> No entry</span>
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fields editor — the analyst decides what's tracked and what the AI looks for
// ---------------------------------------------------------------------------

function FieldsEditor({
  fields, onChanged, onError,
}: {
  fields: DbRiskField[];
  onChanged: () => Promise<void> | void;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [label, setLabel] = useState("");
  const [unit, setUnit] = useState("");
  const [role, setRole] = useState<FieldRole>("other");
  const [higherIsBetter, setHigherIsBetter] = useState(true);
  const [hint, setHint] = useState("");
  const [aiExtract, setAiExtract] = useState(true);
  const [decimals, setDecimals] = useState(0);

  const key = slugifyFieldKey(label);
  const clash = fields.some((f) => f.key === key);

  async function add() {
    if (!label.trim() || !key || clash) return;
    setBusy(true);
    try {
      await createRiskField({
        key, label: label.trim(), unit: unit.trim(), role, higherIsBetter,
        extractionHint: hint.trim(), aiExtract, decimals,
        sortOrder: (fields[fields.length - 1]?.sort_order ?? 0) + 10,
      });
      setLabel(""); setUnit(""); setHint(""); setRole("other"); setDecimals(0);
      setShowNew(false);
      await onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't add that field.");
    } finally {
      setBusy(false);
    }
  }

  async function patch(f: DbRiskField, changes: Parameters<typeof updateRiskField>[1]) {
    try { await updateRiskField(f.id, changes); await onChanged(); }
    catch (e) { onError(e instanceof Error ? e.message : "Couldn't update that field."); }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-400">
        What the tracker records, and which of those the AI should look for when you upload a report. The hint is the
        useful bit — a line like &quot;the column headed CHR, in metres&quot; is usually enough for it to find the
        right column on your particular report.
      </p>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-xs">
          <thead className="bg-navy-600/50 dark:bg-navy-800/50">
            <tr>
              <th className="px-2 py-2 text-left font-medium text-neutral-400">Field</th>
              <th className="px-2 py-2 text-left font-medium text-neutral-400">Used for</th>
              <th className="px-2 py-2 text-center font-medium text-neutral-400" title="Read this field from uploads">Read</th>
              <th className="px-2 py-2 text-left font-medium text-neutral-400">Hint for the AI</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {fields.map((f) => (
              <tr key={f.id} className={f.is_active ? "" : "opacity-50"}>
                <td className="whitespace-nowrap px-2 py-1.5">
                  <span className="font-medium">{f.label}</span>
                  {f.unit && <span className="text-neutral-500"> ({f.unit})</span>}
                  <span className="block text-[10px] text-neutral-600">{f.key}</span>
                </td>
                <td className="px-2 py-1.5">
                  <select
                    value={f.role}
                    onChange={(e) => patch(f, { role: e.target.value as FieldRole })}
                    className="w-36 rounded border border-white/10 bg-navy-600 px-1.5 py-1 text-xs outline-none dark:bg-navy-800"
                    title={ROLE_HELP[f.role]}
                  >
                    {FIELD_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                  {f.role === "wellness" && (
                    <label className="mt-1 flex items-center gap-1 text-[10px] text-neutral-500">
                      <input
                        type="checkbox"
                        checked={f.higher_is_better}
                        onChange={(e) => patch(f, { higherIsBetter: e.target.checked })}
                        className="h-3 w-3 rounded border-white/20 bg-navy-600 dark:bg-navy-800"
                      />
                      5 is best
                    </label>
                  )}
                </td>
                <td className="px-2 py-1.5 text-center">
                  <input
                    type="checkbox"
                    checked={f.ai_extract}
                    onChange={(e) => patch(f, { aiExtract: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-white/20 bg-navy-600 dark:bg-navy-800"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    defaultValue={f.extraction_hint ?? ""}
                    onBlur={(e) => { if (e.target.value !== (f.extraction_hint ?? "")) patch(f, { extractionHint: e.target.value }); }}
                    placeholder="e.g. the column headed CHR, in metres"
                    className="w-full min-w-[200px] rounded border border-white/10 bg-navy-600 px-1.5 py-1 text-xs outline-none dark:bg-navy-800"
                  />
                </td>
                <td className="px-1">
                  {f.is_active ? (
                    <button
                      onClick={() => { if (window.confirm(`Hide "${f.label}"? Past entries keep their values.`)) deactivateRiskField(f.id).then(onChanged); }}
                      title="Hide this field"
                      className="text-neutral-500 hover:text-amber-300"
                    >
                      <EyeOff size={13} />
                    </button>
                  ) : (
                    <button onClick={() => patch(f, { isActive: true })} title="Show again" className="text-neutral-500 hover:text-emerald-300">
                      <Check size={13} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!showNew ? (
        <button
          onClick={() => setShowNew(true)}
          className="flex touch-manipulation items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800"
        >
          <Plus size={14} /> Add a field
        </button>
      ) : (
        <div className="space-y-2 rounded-xl border border-white/10 bg-navy-600/40 p-3 dark:bg-navy-800/40">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name, e.g. Hamstring soreness" className={inputClass} />
            <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unit (optional)" className={inputClass} />
            <select value={role} onChange={(e) => setRole(e.target.value as FieldRole)} className={inputClass}>
              {FIELD_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <input
              value={decimals}
              onChange={(e) => setDecimals(Math.max(0, Math.min(3, Number(e.target.value) || 0)))}
              inputMode="numeric"
              placeholder="Decimals"
              className={inputClass}
            />
          </div>

          <p className="text-[11px] text-neutral-500">{ROLE_HELP[role]}</p>

          <input
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder="Where to find it on your report — e.g. the column headed HSR, in metres"
            className={`${inputClass} w-full`}
          />

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-neutral-300">
              <input
                type="checkbox"
                checked={aiExtract}
                onChange={(e) => setAiExtract(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-navy-600 dark:bg-navy-800"
              />
              <Sparkles size={12} /> Read this from uploads
            </label>
            {role === "wellness" && (
              <label className="flex items-center gap-2 text-xs text-neutral-300">
                <input
                  type="checkbox"
                  checked={higherIsBetter}
                  onChange={(e) => setHigherIsBetter(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-navy-600 dark:bg-navy-800"
                />
                5 is best on our scale
              </label>
            )}
          </div>

          {clash && <p className="text-xs text-amber-300">A field with that name already exists.</p>}

          <div className="flex gap-2">
            <button
              onClick={add}
              disabled={busy || !label.trim() || clash}
              className="flex touch-manipulation items-center gap-1.5 rounded-xl bg-club-primary px-3 py-2 text-sm font-medium text-navy-950 disabled:opacity-60"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add field
            </button>
            <button
              onClick={() => setShowNew(false)}
              className="rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
