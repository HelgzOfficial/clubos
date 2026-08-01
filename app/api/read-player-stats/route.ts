"use client";

import { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/players/player-avatar";
import type { DbPlayer } from "@/lib/players-db";
import type { DbMatch } from "@/lib/matches-db";
import type { StatMetric } from "@/lib/stat-metrics-db";
import { savePlayerMatchStats, type StatValues } from "@/lib/player-match-stats-db";
import { matchPlayer } from "@/lib/gps-db";
import {
  Upload, Loader2, Check, X, AlertTriangle, Download, ScanLine,
} from "lucide-react";

type ImportRow = {
  playerId: string | null;
  reportName: string;
  values: Record<string, number | null>;
};

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

function fixtureLabel(m: DbMatch) {
  const d = new Date(m.kickoff).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
  return `${m.is_home ? "vs" : "@"} ${m.opponent} · ${d}`;
}

// Upload a GPS or stats report as a screenshot or PDF, and the table is read
// off it and mapped onto the club's own metrics.
//
// The metric list is sent along with the file, so whatever an analyst has set
// up on the Metrics tab is what the columns get matched to. Add a metric there
// and this picks it up with no change here.
//
// The review step before saving is deliberate. Anything reading numbers off an
// image will occasionally misread one, and stats nobody has eyeballed are
// stats a coach quietly stops trusting.
export function StatsImport({
  players,
  matches,
  metrics,
  onSaved,
}: {
  players: DbPlayer[];
  matches: DbMatch[];
  metrics: StatMetric[];
  onSaved?: () => void;
}) {
  const [matchId, setMatchId] = useState("");
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Only metrics the report actually filled in get a column, so a squad's
  // worth of empty columns doesn't push the ones that matter off screen.
  const usedMetrics = useMemo(() => {
    if (!rows) return [];
    return metrics.filter((m) => rows.some((r) => r.values[m.key] !== null && r.values[m.key] !== undefined));
  }, [rows, metrics]);

  const unmatched = rows?.filter((r) => !r.playerId).length ?? 0;
  const fixtures = useMemo(
    () => [...matches].sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime()),
    [matches]
  );

  async function handleFile(file: File) {
    setReading(true);
    setError("");
    setNotice("");
    setRows(null);
    setFileName(file.name);
    try {
      const fileBase64 = await toBase64(file);
      const res = await fetch("/api/read-player-stats", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileBase64,
          mediaType: file.type || "image/png",
          metrics: metrics.map((m) => ({ key: m.key, label: m.label, unit: m.unit })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Couldn't read that report.");
        return;
      }

      const valid = new Set(metrics.map((m) => m.key));
      const extracted: ImportRow[] = (data.rows as Record<string, unknown>[]).map((r) => {
        const name = String(r.player_name ?? "").trim();
        const raw = (r.values ?? {}) as Record<string, unknown>;
        const values: Record<string, number | null> = {};
        for (const [k, v] of Object.entries(raw)) {
          // Ignore anything that isn't one of ours, however confidently it
          // came back.
          if (!valid.has(k)) continue;
          values[k] = typeof v === "number" && Number.isFinite(v) ? v : null;
        }
        return { playerId: matchPlayer(name, players)?.id ?? null, reportName: name, values };
      });

      setRows(extracted);

      // If the report names a fixture and we can find it, pre-select it —
      // but never silently, since picking the wrong match writes stats
      // against the wrong game.
      setNotice(
        `Read ${extracted.length} ${extracted.length === 1 ? "player" : "players"}. Pick the fixture, check the numbers, then save.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that report.");
    } finally {
      setReading(false);
    }
  }

  function setRowPlayer(index: number, playerId: string) {
    setRows((prev) => (prev ? prev.map((r, i) => (i === index ? { ...r, playerId: playerId || null } : r)) : prev));
  }

  function setValue(index: number, key: string, raw: string) {
    const n = raw.trim() === "" ? null : Number(raw);
    setRows((prev) =>
      prev
        ? prev.map((r, i) =>
            i === index ? { ...r, values: { ...r.values, [key]: n !== null && Number.isFinite(n) ? n : null } } : r
          )
        : prev
    );
  }

  function dropRow(index: number) {
    setRows((prev) => (prev ? prev.filter((_, i) => i !== index) : prev));
  }

  async function save() {
    if (!rows || !matchId) return;
    const saveable = rows.filter((r) => r.playerId);
    if (saveable.length === 0) {
      setError("None of these rows are matched to a player yet.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      for (const r of saveable) {
        const values: StatValues = {};
        for (const [k, v] of Object.entries(r.values)) {
          if (v !== null && v !== undefined) values[k] = v;
        }
        await savePlayerMatchStats({ matchId, playerId: r.playerId as string, values });
      }
      const skipped = rows.length - saveable.length;
      setRows(null);
      setFileName("");
      setNotice(
        `Saved ${saveable.length} ${saveable.length === 1 ? "player" : "players"}.` +
          (skipped > 0 ? ` ${skipped} unmatched ${skipped === 1 ? "row was" : "rows were"} skipped.` : "")
      );
      onSaved?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        /relation|does not exist|schema cache/i.test(msg)
          ? "Player stats aren't set up in Supabase yet."
          : msg || "Couldn't save those stats."
      );
    } finally {
      setSaving(false);
    }
  }

  function downloadCsv() {
    if (!rows) return;
    const header = ["Player", ...usedMetrics.map((m) => (m.unit ? `${m.label} (${m.unit})` : m.label))];
    const lines = [header.join(",")];
    for (const r of rows) {
      const name = players.find((p) => p.id === r.playerId)?.name ?? r.reportName;
      lines.push([
        `"${name.replace(/"/g, '""')}"`,
        ...usedMetrics.map((m) => {
          const v = r.values[m.key];
          return v === null || v === undefined ? "" : String(v);
        }),
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stats-import-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import from a screenshot or PDF</CardTitle>
        <ScanLine size={18} className="text-neutral-400" />
      </CardHeader>

      <p className="mb-3 text-xs text-neutral-400">
        Upload a GPS or stats report and the table is read off it and matched to your squad and your metrics. Nothing
        is saved until you&apos;ve looked it over.
      </p>

      {metrics.length === 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <p>Set up some metrics on the Metrics tab first — there&apos;s nothing to map the report&apos;s columns onto yet.</p>
        </div>
      )}

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
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

      {!rows && (
        <label
          className={`flex w-fit items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-medium ${
            metrics.length === 0 || reading
              ? "cursor-not-allowed opacity-50"
              : "cursor-pointer text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800"
          }`}
        >
          {reading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {reading ? "Reading the report…" : "Upload report"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            className="hidden"
            disabled={reading || metrics.length === 0}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />
        </label>
      )}

      {rows && (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-400">Fixture these stats belong to</label>
            <select
              value={matchId}
              onChange={(e) => setMatchId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-navy-600 px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800 sm:max-w-md"
            >
              <option value="">Choose a fixture…</option>
              {fixtures.map((m) => (
                <option key={m.id} value={m.id}>{fixtureLabel(m)}</option>
              ))}
            </select>
            {fileName && <p className="mt-1 text-[11px] text-neutral-500">Read from {fileName}</p>}
          </div>

          {unmatched > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <p>
                {unmatched} {unmatched === 1 ? "name" : "names"} didn&apos;t match a squad member. Pick the right player,
                or leave it and that row is skipped when you save.
              </p>
            </div>
          )}

          {usedMetrics.length === 0 ? (
            <p className="text-sm text-neutral-400">
              None of the report&apos;s columns matched a metric you have set up. Add the ones you need on the Metrics
              tab and try again.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-xs">
                <thead className="bg-navy-600/50 dark:bg-navy-800/50">
                  <tr>
                    <th className="px-2 py-2 text-left font-medium text-neutral-400">Player</th>
                    {usedMetrics.map((m) => (
                      <th key={m.key} className="whitespace-nowrap px-2 py-2 text-right font-medium text-neutral-400">
                        {m.label}{m.unit ? ` (${m.unit})` : ""}
                      </th>
                    ))}
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {rows.map((r, i) => {
                    const p = players.find((x) => x.id === r.playerId);
                    return (
                      <tr key={i} className={r.playerId ? "" : "bg-amber-500/5"}>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1.5">
                            {p && <PlayerAvatar playerId={p.id} initials={p.initials} photoUrl={p.photo_url} size="sm" />}
                            <select
                              value={r.playerId ?? ""}
                              onChange={(e) => setRowPlayer(i, e.target.value)}
                              className="w-32 rounded border border-white/10 bg-navy-600 px-1.5 py-1 text-xs outline-none dark:bg-navy-800"
                              title={`Read as "${r.reportName}"`}
                            >
                              <option value="">{r.reportName} — unmatched</option>
                              {players.map((pl) => (
                                <option key={pl.id} value={pl.id}>{pl.name}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                        {usedMetrics.map((m) => (
                          <td key={m.key} className="px-1 py-1.5">
                            <input
                              value={r.values[m.key] ?? ""}
                              onChange={(e) => setValue(i, m.key, e.target.value)}
                              inputMode="decimal"
                              className="w-16 rounded border border-white/10 bg-navy-600 px-1 py-1 text-right text-xs tabular-nums outline-none dark:bg-navy-800"
                            />
                          </td>
                        ))}
                        <td className="px-1">
                          <button onClick={() => dropRow(i)} title="Remove this row" className="text-neutral-500 hover:text-red-400">
                            <X size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={save}
              disabled={saving || !matchId || usedMetrics.length === 0}
              title={!matchId ? "Choose a fixture first" : undefined}
              className="flex touch-manipulation items-center gap-1.5 rounded-xl bg-club-primary px-3 py-2 text-sm font-medium text-navy-950 disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save to fixture
            </button>
            <button
              onClick={downloadCsv}
              className="flex touch-manipulation items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800"
            >
              <Download size={14} /> Download CSV
            </button>
            <button
              onClick={() => { setRows(null); setNotice(""); setError(""); }}
              className="flex touch-manipulation items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800"
            >
              Discard
            </button>
          </div>

          <p className="text-[11px] text-neutral-500">
            Saving overwrites whatever is already recorded for these players in that fixture.
          </p>
        </div>
      )}
    </Card>
  );
}
