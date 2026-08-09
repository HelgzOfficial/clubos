"use client";

import { useMemo, useRef, useState } from "react";
import {
  replaceLeagueTable, rankRows, rowWarning, isOwnClubName,
  type LeagueRowInput,
} from "@/lib/league-table-db";
import { Upload, Loader2, Check, X, AlertTriangle, Trophy } from "lucide-react";

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

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0;
}

const cell =
  "w-full rounded-md border border-white/10 bg-navy-600 px-1.5 py-1 text-right text-xs tabular-nums outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800";

// Reads the league's published table from a screenshot or PDF and puts it
// straight into the app, replacing what's there.
//
// The review step before saving is deliberate. Reading numbers off an image is
// good but not perfect, and a league table nobody has glanced at is one the
// squad will quietly stop believing. Two checks run automatically on every row
// — that won + drawn + lost matches played, and that points match the wins and
// draws — and anything that fails is flagged rather than silently accepted. A
// real points deduction breaks the second rule legitimately, which is exactly
// why it's a flag for a human and not a refusal to save.
export function LeagueTableImport({
  clubName,
  onSaved,
}: {
  clubName: string;
  onSaved: () => Promise<void> | void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fileName, setFileName] = useState("");
  const [competition, setCompetition] = useState("");
  const [rows, setRows] = useState<LeagueRowInput[] | null>(null);

  const warnings = useMemo(
    () => (rows ?? []).map((r) => rowWarning(r)),
    [rows]
  );
  const warningCount = warnings.filter(Boolean).length;
  const ownCount = (rows ?? []).filter((r) => r.isOwnClub).length;

  async function handleFile(file: File) {
    setReading(true);
    setError("");
    setNotice("");
    setRows(null);
    setFileName(file.name);
    try {
      const fileBase64 = await toBase64(file);
      const res = await fetch("/api/read-league-table", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileBase64, mediaType: file.type || "image/png" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Couldn't read that table.");
        return;
      }

      const extracted: LeagueRowInput[] = (data.rows as Record<string, unknown>[]).map((r, i) => {
        const team = String(r.team ?? "").trim();
        return {
          position: num(r.position) || i + 1,
          team,
          played: num(r.played),
          won: num(r.won),
          drawn: num(r.drawn),
          lost: num(r.lost),
          goalsFor: num(r.goals_for),
          goalsAgainst: num(r.goals_against),
          points: num(r.points),
          isOwnClub: isOwnClubName(team, clubName),
        };
      }).filter((r) => r.team.length > 0);

      if (extracted.length === 0) {
        setError("No clubs were found in that file.");
        return;
      }

      setRows(extracted);
      if (typeof data.competition === "string" && data.competition.trim()) {
        setCompetition(data.competition.trim());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      setReading(false);
    }
  }

  function patch(index: number, patchRow: Partial<LeagueRowInput>) {
    setRows((prev) => (prev ? prev.map((r, i) => (i === index ? { ...r, ...patchRow } : r)) : prev));
  }

  function setOwnClub(index: number) {
    // Exactly one row can be the club, since the Dashboard highlights it and
    // works out "our position" from it.
    setRows((prev) => (prev ? prev.map((r, i) => ({ ...r, isOwnClub: i === index })) : prev));
  }

  async function handleSave() {
    if (!rows) return;
    setSaving(true);
    setError("");
    try {
      await replaceLeagueTable(rankRows(rows));
      await onSaved();
      setNotice(`League table updated — ${rows.length} clubs saved.`);
      setRows(null);
      setFileName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the table.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Trophy size={15} className="text-neutral-400" />
        <p className="text-sm font-medium">Import from the league website</p>
      </div>
      <p className="mb-3 text-xs text-neutral-400">
        Screenshot the table on the league&apos;s website and upload it here — the app reads every club and fills in the
        whole table at once. Check it over, then save. Saving replaces the table currently in the app.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={reading}
          className="flex touch-manipulation items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-200 hover:bg-navy-600 disabled:opacity-60 dark:hover:bg-navy-800"
        >
          {reading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {reading ? "Reading the table…" : "Upload screenshot or PDF"}
        </button>
        {fileName && !reading && <span className="text-xs text-neutral-500">{fileName}</span>}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {notice && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          <Check size={15} className="mt-0.5 shrink-0" />
          <p>{notice}</p>
        </div>
      )}

      {rows && (
        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-neutral-400">
              Found {rows.length} clubs{competition ? ` — ${competition}` : ""}. Tap any number to correct it.
            </p>
            <button
              type="button"
              onClick={() => { setRows(null); setFileName(""); }}
              className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white"
            >
              <X size={12} /> Discard
            </button>
          </div>

          {ownCount !== 1 && (
            <div className="mb-2 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-200">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <p>
                {ownCount === 0
                  ? `None of these rows was recognised as ${clubName}. Tick the row for your club so the Dashboard knows which position is yours.`
                  : `More than one row is ticked as ${clubName}. Pick the right one.`}
              </p>
            </div>
          )}

          {warningCount > 0 && (
            <div className="mb-2 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-200">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <p>
                {warningCount} {warningCount === 1 ? "row doesn't" : "rows don't"} add up — marked below. A points
                deduction is a real reason for this, so check before correcting.
              </p>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="bg-navy-600/50 dark:bg-navy-800/50">
                <tr className="text-neutral-400">
                  <th className="w-10 px-2 py-2 text-left font-medium">Us</th>
                  <th className="px-2 py-2 text-left font-medium">Team</th>
                  <th className="w-12 px-1 py-2 text-right font-medium">P</th>
                  <th className="w-12 px-1 py-2 text-right font-medium">W</th>
                  <th className="w-12 px-1 py-2 text-right font-medium">D</th>
                  <th className="w-12 px-1 py-2 text-right font-medium">L</th>
                  <th className="w-14 px-1 py-2 text-right font-medium">GF</th>
                  <th className="w-14 px-1 py-2 text-right font-medium">GA</th>
                  <th className="w-14 px-1 py-2 text-right font-medium">Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {rows.map((r, i) => (
                  <tr key={i} className={warnings[i] ? "bg-amber-500/5" : ""}>
                    <td className="px-2 py-1.5">
                      <input
                        type="radio"
                        name="own-club"
                        checked={r.isOwnClub}
                        onChange={() => setOwnClub(i)}
                        title="This is our club"
                        className="accent-club-primary"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={r.team}
                        onChange={(e) => patch(i, { team: e.target.value })}
                        className="w-full min-w-[130px] rounded-md border border-white/10 bg-navy-600 px-1.5 py-1 text-xs outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
                      />
                      {warnings[i] && (
                        <p className="mt-1 text-[10px] leading-tight text-amber-300">{warnings[i]}</p>
                      )}
                    </td>
                    {([
                      ["played", r.played], ["won", r.won], ["drawn", r.drawn], ["lost", r.lost],
                      ["goalsFor", r.goalsFor], ["goalsAgainst", r.goalsAgainst], ["points", r.points],
                    ] as [keyof LeagueRowInput, number][]).map(([key, value]) => (
                      <td key={String(key)} className="px-1 py-1.5">
                        <input
                          type="number"
                          value={value}
                          onChange={(e) => patch(i, { [key]: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                          className={cell}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-2 text-[11px] text-neutral-500">
            Positions are worked out on saving — points, then goal difference, then goals scored — so they stay right
            even if a position was misread.
          </p>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="mt-3 flex touch-manipulation items-center gap-2 rounded-xl bg-club-primary px-4 py-2 text-sm font-medium text-navy-950 hover:opacity-90 disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? "Saving…" : `Replace table with these ${rows.length} clubs`}
          </button>
        </div>
      )}
    </div>
  );
}
