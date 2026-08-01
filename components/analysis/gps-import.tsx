"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchPlayers, type DbPlayer } from "@/lib/players-db";
import { fetchMatches, playedMatches, type DbMatch } from "@/lib/matches-db";
import {
  GPS_METRICS, matchPlayer, saveGpsImport, fetchGpsImports, fetchGpsMetrics, deleteGpsImport,
  rowsToCsv, formatMetric,
  type GpsRow, type GpsMetricKey, type DbGpsImport,
} from "@/lib/gps-db";
import {
  Activity, Upload, Loader2, Check, X, AlertTriangle, Download, Trash2, ChevronDown, ChevronRight,
} from "lucide-react";

const inputClass =
  "rounded-lg border border-white/10 bg-navy-600 px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      // "data:image/png;base64,AAAA..." — the API wants only the second half.
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

// Reads a Pitchero GPS report from a screenshot or PDF, shows what it found for
// checking, then saves it against a fixture.
//
// The review step is not optional and not a nicety. Anything reading numbers
// off an image will occasionally misread one, and GPS data that nobody has
// eyeballed is data a coach will quietly stop trusting. Better to spend ten
// seconds confirming than to find out in February that half the sprint
// distances are wrong.
export function GpsImport({ importedBy }: { importedBy: string | null }) {
  const [players, setPlayers] = useState<DbPlayer[]>([]);
  const [matches, setMatches] = useState<DbMatch[]>([]);
  const [imports, setImports] = useState<DbGpsImport[]>([]);
  const [openImport, setOpenImport] = useState<string>("");
  const [openRows, setOpenRows] = useState<GpsRow[]>([]);

  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // The extracted-but-not-yet-saved table.
  const [rows, setRows] = useState<GpsRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [matchId, setMatchId] = useState("");
  const [label, setLabel] = useState("");
  const [sessionDate, setSessionDate] = useState(todayIso());

  const reloadImports = () => fetchGpsImports().then(setImports).catch(() => {});

  useEffect(() => {
    fetchPlayers().then(setPlayers).catch(() => {});
    fetchMatches().then(setMatches).catch(() => {});
    fetchGpsImports()
      .then(setImports)
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "";
        if (/relation|does not exist|schema cache/i.test(msg)) {
          setError("GPS metrics aren't set up yet — run supabase-gps-metrics.sql in Supabase.");
        }
      });
  }, []);

  const fixtures = useMemo(() => playedMatches(matches), [matches]);
  const unmatched = rows?.filter((r) => !r.player_id).length ?? 0;

  async function handleFile(file: File) {
    setReading(true);
    setError("");
    setNotice("");
    setRows(null);
    setFileName(file.name);
    try {
      const fileBase64 = await toBase64(file);
      const res = await fetch("/api/read-gps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileBase64, mediaType: file.type || "image/png" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Couldn't read that report.");
        return;
      }

      const extracted: GpsRow[] = (data.rows as Record<string, unknown>[]).map((r) => {
        const name = String(r.player_name ?? "").trim();
        const matched = matchPlayer(name, players);
        const row: GpsRow = { player_id: matched?.id ?? null, player_name: name };
        for (const m of GPS_METRICS) {
          const v = r[m.key];
          row[m.key] = typeof v === "number" && Number.isFinite(v) ? v : null;
        }
        return row;
      });

      setRows(extracted);
      if (typeof data.sessionDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.sessionDate)) {
        setSessionDate(data.sessionDate);
      }
      if (typeof data.label === "string" && data.label.trim()) setLabel(data.label.trim());
      setNotice(`Read ${extracted.length} ${extracted.length === 1 ? "player" : "players"}. Check the numbers before saving.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that report.");
    } finally {
      setReading(false);
    }
  }

  function setRowPlayer(index: number, playerId: string) {
    setRows((prev) =>
      prev ? prev.map((r, i) => (i === index ? { ...r, player_id: playerId || null } : r)) : prev
    );
  }

  function setRowMetric(index: number, key: GpsMetricKey, raw: string) {
    const value = raw.trim() === "" ? null : Number(raw);
    setRows((prev) =>
      prev
        ? prev.map((r, i) =>
            i === index ? { ...r, [key]: value !== null && Number.isFinite(value) ? value : null } : r
          )
        : prev
    );
  }

  function dropRow(index: number) {
    setRows((prev) => (prev ? prev.filter((_, i) => i !== index) : prev));
  }

  async function save() {
    if (!rows || rows.length === 0) return;
    setSaving(true);
    setError("");
    try {
      await saveGpsImport({
        matchId: matchId || null,
        label: label.trim() || null,
        sessionDate,
        sourceFileName: fileName || null,
        importedBy,
        rows,
      });
      setRows(null);
      setFileName("");
      setLabel("");
      setNotice("Saved. The numbers now show on each player's profile too.");
      await reloadImports();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        /relation|does not exist|schema cache/i.test(msg)
          ? "GPS metrics aren't set up yet — run supabase-gps-metrics.sql in Supabase."
          : msg || "Couldn't save that import."
      );
    } finally {
      setSaving(false);
    }
  }

  function download(csvRows: GpsRow[], name: string) {
    const blob = new Blob([rowsToCsv(csvRows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/[^a-zA-Z0-9-_]+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function toggleImport(imp: DbGpsImport) {
    if (openImport === imp.id) {
      setOpenImport("");
      return;
    }
    setOpenImport(imp.id);
    try {
      setOpenRows(await fetchGpsMetrics(imp.id));
    } catch {
      setOpenRows([]);
    }
  }

  async function removeImport(imp: DbGpsImport) {
    if (!window.confirm(`Delete this import and its ${"player rows"}? The original report isn't affected.`)) return;
    try {
      await deleteGpsImport(imp.id);
      setOpenImport("");
      await reloadImports();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete that import.");
    }
  }

  function fixtureLabel(imp: DbGpsImport): string {
    const m = matches.find((x) => x.id === imp.match_id);
    if (m) return `${m.is_home ? "vs" : "@"} ${m.opponent}`;
    return imp.label || "Session";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>GPS Metrics</CardTitle>
        <Activity size={18} className="text-neutral-400" />
      </CardHeader>

      <p className="mb-3 text-xs text-neutral-400">
        Upload a screenshot or PDF of a Pitchero GPS report. The table is read off it automatically, you check it, and
        it saves against the fixture — and onto each player&apos;s profile.
      </p>

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

      {!rows && (
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800">
          {reading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          {reading ? "Reading the report…" : "Upload GPS report"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            className="hidden"
            disabled={reading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />
        </label>
      )}

      {/* ---- Review before saving ---- */}
      {rows && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <select value={matchId} onChange={(e) => setMatchId(e.target.value)} className={inputClass}>
              <option value="">No fixture (training)</option>
              {fixtures.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.is_home ? "vs" : "@"} {m.opponent} · {new Date(m.kickoff).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </option>
              ))}
            </select>
            <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} className={inputClass} />
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" className={inputClass} />
          </div>

          {unmatched > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <p>
                {unmatched} {unmatched === 1 ? "name" : "names"} didn&apos;t match a squad member. Pick the right player
                below, or leave it — the row still saves against the fixture, it just won&apos;t appear on anyone&apos;s
                profile.
              </p>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-xs">
              <thead className="bg-navy-600/50 dark:bg-navy-800/50">
                <tr>
                  <th className="px-2 py-2 text-left font-medium text-neutral-400">Player</th>
                  {GPS_METRICS.map((m) => (
                    <th key={m.key} className="px-2 py-2 text-right font-medium text-neutral-400" title={m.label}>
                      {m.short}
                    </th>
                  ))}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {rows.map((r, i) => (
                  <tr key={i} className={r.player_id ? "" : "bg-amber-500/5"}>
                    <td className="px-2 py-1.5">
                      <select
                        value={r.player_id ?? ""}
                        onChange={(e) => setRowPlayer(i, e.target.value)}
                        className="w-32 rounded border border-white/10 bg-navy-600 px-1.5 py-1 text-xs outline-none dark:bg-navy-800"
                        title={`Read as "${r.player_name}"`}
                      >
                        <option value="">{r.player_name} — unmatched</option>
                        {players.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </td>
                    {GPS_METRICS.map((m) => (
                      <td key={m.key} className="px-1 py-1.5">
                        <input
                          value={r[m.key] ?? ""}
                          onChange={(e) => setRowMetric(i, m.key, e.target.value)}
                          inputMode="decimal"
                          className="w-16 rounded border border-white/10 bg-navy-600 px-1 py-1 text-right text-xs tabular-nums outline-none dark:bg-navy-800"
                        />
                      </td>
                    ))}
                    <td className="px-1">
                      <button onClick={() => dropRow(i)} className="text-neutral-500 hover:text-red-400" title="Remove this row">
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
              onClick={save}
              disabled={saving || rows.length === 0}
              className="flex touch-manipulation items-center gap-1.5 rounded-xl bg-club-primary px-3 py-2 text-sm font-medium text-navy-950 disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save {rows.length} rows
            </button>
            <button
              onClick={() => download(rows, `gps-${sessionDate}`)}
              className="flex touch-manipulation items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800"
            >
              <Download size={14} /> Download CSV
            </button>
            <button
              onClick={() => { setRows(null); setNotice(""); }}
              className="flex touch-manipulation items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* ---- Previously imported ---- */}
      {!rows && imports.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">Imported</p>
          <ul className="divide-y divide-white/10">
            {imports.map((imp) => (
              <li key={imp.id}>
                <div className="flex items-center gap-2 py-2">
                  <button onClick={() => toggleImport(imp)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    {openImport === imp.id ? <ChevronDown size={13} className="shrink-0 text-neutral-500" /> : <ChevronRight size={13} className="shrink-0 text-neutral-500" />}
                    <span className="min-w-0 flex-1 truncate text-sm">{fixtureLabel(imp)}</span>
                    <span className="shrink-0 text-[11px] text-neutral-500">
                      {new Date(imp.session_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </button>
                  <button onClick={() => removeImport(imp)} className="shrink-0 text-neutral-500 hover:text-red-400">
                    <Trash2 size={13} />
                  </button>
                </div>

                {openImport === imp.id && (
                  <div className="pb-3">
                    <div className="overflow-x-auto rounded-xl border border-white/10">
                      <table className="w-full text-xs">
                        <thead className="bg-navy-600/50 dark:bg-navy-800/50">
                          <tr>
                            <th className="px-2 py-2 text-left font-medium text-neutral-400">Player</th>
                            {GPS_METRICS.map((m) => (
                              <th key={m.key} className="px-2 py-2 text-right font-medium text-neutral-400" title={m.label}>{m.short}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                          {openRows.map((r, i) => (
                            <tr key={i}>
                              <td className="whitespace-nowrap px-2 py-1.5">
                                {players.find((p) => p.id === r.player_id)?.name ?? r.player_name}
                              </td>
                              {GPS_METRICS.map((m) => (
                                <td key={m.key} className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                                  {formatMetric(r[m.key], m.key)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button
                      onClick={() => download(openRows, `gps-${imp.session_date}`)}
                      className="mt-2 flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800"
                    >
                      <Download size={13} /> Download CSV
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
