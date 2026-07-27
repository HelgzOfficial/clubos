"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchMatches, type DbMatch } from "@/lib/matches-db";
import { fetchAllGoals, addGoal, updateGoalLocation, type DbGoal } from "@/lib/match-details-db";
import { PitchMapDisplay, PitchMapInput, type PitchPoint } from "@/components/analysis/pitch-map";
import { topScorers, topAssists } from "@/lib/season-analytics";
import { usePermissions } from "@/lib/permissions";
import { ArrowLeft, Plus, MapPin, X } from "lucide-react";

type MapTab = "scored" | "conceded" | "assists";

const blankAddForm = { matchId: "", team: "us" as "us" | "opponent", minute: "", scorer: "", assist: "" };

export default function GoalsMapsPage() {
  const { canWrite } = usePermissions();
  const canEdit = canWrite("analysis");

  const [matches, setMatches] = useState<DbMatch[]>([]);
  const [goals, setGoals] = useState<DbGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<MapTab>("scored");

  // Full manual entry — record a brand-new goal/assist, with its pitch
  // location, directly from this page instead of going through a match's
  // Match Centre page first.
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(blankAddForm);
  const [addLocation, setAddLocation] = useState<PitchPoint | null>(null);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");

  // Backfill — set a location on a goal that was logged without one.
  const [locatingGoal, setLocatingGoal] = useState<DbGoal | null>(null);
  const [backfillPoint, setBackfillPoint] = useState<PitchPoint | null>(null);
  const [backfillSaving, setBackfillSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [m, g] = await Promise.all([fetchMatches(), fetchAllGoals()]);
      setMatches(m);
      setGoals(g);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function matchLabel(matchId: string) {
    const m = matches.find((mm) => mm.id === matchId);
    return m ? `${m.is_home ? "vs" : "@"} ${m.opponent}` : "Unknown fixture";
  }

  const withLocation = goals.filter((g) => g.x !== null && g.y !== null);
  const missingLocation = goals.filter((g) => g.x === null || g.y === null);
  const scoredGoals = withLocation.filter((g) => g.team === "us");
  const concededGoals = withLocation.filter((g) => g.team === "opponent");
  const assistedGoals = withLocation.filter((g) => g.team === "us" && g.assist);

  const points: PitchPoint[] = useMemo(() => {
    const source = tab === "scored" ? scoredGoals : tab === "conceded" ? concededGoals : assistedGoals;
    return source.map((g) => ({
      x: g.x as number,
      y: g.y as number,
      color: tab === "conceded" ? "#EF4444" : "#22C55E",
      label: tab === "assists"
        ? `${g.assist} → ${g.scorer} (${g.minute ?? "?"}') — ${matchLabel(g.match_id)}`
        : `${g.scorer} (${g.minute ?? "?"}') — ${matchLabel(g.match_id)}`,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, goals, matches]);

  const scorers = useMemo(() => topScorers(goals, 8), [goals]);
  const assists = useMemo(() => topAssists(goals, 8), [goals]);

  const tabs: { key: MapTab; label: string; count: number }[] = [
    { key: "scored", label: "Goals Scored", count: scoredGoals.length },
    { key: "conceded", label: "Goals Conceded", count: concededGoals.length },
    { key: "assists", label: "Assist Map", count: assistedGoals.length },
  ];

  function openAdd() {
    setAddForm(blankAddForm);
    setAddLocation(null);
    setAddError("");
    setShowAdd(true);
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.matchId) {
      setAddError("Pick which fixture this happened in.");
      return;
    }
    if (!addForm.scorer.trim()) {
      setAddError("Enter who scored.");
      return;
    }
    setAddSaving(true);
    setAddError("");
    try {
      await addGoal(addForm.matchId, {
        minute: addForm.minute,
        team: addForm.team,
        scorer: addForm.scorer.trim(),
        assist: addForm.team === "us" ? addForm.assist.trim() : "",
        x: addLocation?.x ?? null,
        y: addLocation?.y ?? null,
      });
      setShowAdd(false);
      await load();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setAddSaving(false);
    }
  }

  function openBackfill(goal: DbGoal) {
    setLocatingGoal(goal);
    setBackfillPoint(null);
  }

  async function handleBackfillSave() {
    if (!locatingGoal || !backfillPoint) return;
    setBackfillSaving(true);
    try {
      await updateGoalLocation(locatingGoal.id, backfillPoint.x, backfillPoint.y);
      setLocatingGoal(null);
      await load();
    } finally {
      setBackfillSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/analysis" className="mb-1 flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors">
            <ArrowLeft size={12} /> Analyst Dashboard
          </Link>
          <h1 className="text-2xl font-semibold">Goals &amp; Assist Maps</h1>
          <p className="text-sm text-neutral-500">Where it's happening on the pitch — click to record a goal or assist location.</p>
        </div>
        {canEdit && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 rounded-xl bg-club-primary text-navy-950 px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={15} /> Add Goal / Assist
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : goals.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-400">
            No goals logged yet. Use "Add Goal / Assist" above, or tap "Mark location" when logging a goal from a match's page in Match
            Centre.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-5">
            <div>
              <div className="mb-4 flex flex-wrap gap-2">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      tab === t.key ? "bg-club-primary text-navy-950" : "bg-navy-600 dark:bg-navy-800 text-neutral-500 hover:text-white"
                    }`}
                  >
                    {t.label} ({t.count})
                  </button>
                ))}
              </div>
              <Card>
                {points.length === 0 ? (
                  <p className="py-10 text-center text-sm text-neutral-400">No locations logged for this yet.</p>
                ) : (
                  <div className="mx-auto max-w-xs">
                    <PitchMapDisplay points={points} />
                  </div>
                )}
              </Card>
            </div>

            {missingLocation.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Missing a Location</CardTitle></CardHeader>
                <p className="mb-3 text-xs text-neutral-500">
                  These are logged but don't have a pitch location yet, so they're left off the maps above.
                  {canEdit ? " Tap one to add it." : ""}
                </p>
                <ul className="divide-y divide-white/10">
                  {missingLocation.map((g) => (
                    <li key={g.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {g.scorer} {g.assist ? `(assist: ${g.assist})` : ""} {g.minute ? `— ${g.minute}'` : ""}
                        </p>
                        <p className="truncate text-xs text-neutral-400">
                          {g.team === "us" ? "Us" : "Opponent"} · {matchLabel(g.match_id)}
                        </p>
                      </div>
                      {canEdit && (
                        <button
                          onClick={() => openBackfill(g)}
                          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800"
                        >
                          <MapPin size={12} /> Add location
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>

          <div className="space-y-5">
            <Card>
              <CardHeader><CardTitle>Top Goalscorers</CardTitle></CardHeader>
              {scorers.length === 0 ? (
                <p className="text-sm text-neutral-400">None yet.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {scorers.map((s) => (
                    <li key={s.name} className="flex items-center justify-between">
                      <span className="truncate">{s.name}</span>
                      <span className="font-semibold text-club-primary">{s.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <CardHeader><CardTitle>Top Assists</CardTitle></CardHeader>
              {assists.length === 0 ? (
                <p className="text-sm text-neutral-400">None yet.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {assists.map((s) => (
                    <li key={s.name} className="flex items-center justify-between">
                      <span className="truncate">{s.name}</span>
                      <span className="font-semibold text-club-primary">{s.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-medium">Add Goal / Assist</p>
              <button onClick={() => setShowAdd(false)} className="text-neutral-400 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Fixture</label>
                <select
                  value={addForm.matchId}
                  onChange={(e) => setAddForm((f) => ({ ...f, matchId: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                >
                  <option value="">Select a fixture…</option>
                  {matches.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.is_home ? "vs" : "@"} {m.opponent} — {new Date(m.kickoff).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-1 rounded-xl bg-navy-600 dark:bg-navy-800 p-1 text-sm w-fit">
                {[{ v: "us" as const, label: "Us" }, { v: "opponent" as const, label: "Opponent" }].map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setAddForm((f) => ({ ...f, team: o.v }))}
                    className={`rounded-lg px-3 py-1 transition-colors ${addForm.team === o.v ? "bg-club-primary text-navy-950" : "text-neutral-400"}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <div className="w-24">
                  <label className="mb-1.5 block text-xs font-medium text-neutral-500">Minute</label>
                  <input
                    type="number"
                    min={0}
                    max={130}
                    value={addForm.minute}
                    onChange={(e) => setAddForm((f) => ({ ...f, minute: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-neutral-500">{addForm.team === "us" ? "Scorer" : "Scorer (opponent)"}</label>
                  <input
                    value={addForm.scorer}
                    onChange={(e) => setAddForm((f) => ({ ...f, scorer: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                  />
                </div>
              </div>

              {addForm.team === "us" && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-neutral-500">Assist (optional)</label>
                  <input
                    value={addForm.assist}
                    onChange={(e) => setAddForm((f) => ({ ...f, assist: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Pitch location</label>
                <PitchMapInput value={addLocation} onChange={setAddLocation} />
              </div>

              {addError && <p className="text-sm text-red-300">{addError}</p>}

              <button
                type="submit"
                disabled={addSaving}
                className="w-full rounded-xl bg-club-primary text-navy-950 px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {addSaving ? "Saving…" : "Save"}
              </button>
            </form>
          </Card>
        </div>
      )}

      {locatingGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-medium">
                {locatingGoal.scorer} {locatingGoal.minute ? `— ${locatingGoal.minute}'` : ""}
              </p>
              <button onClick={() => setLocatingGoal(null)} className="text-neutral-400 hover:text-white"><X size={18} /></button>
            </div>
            <PitchMapInput value={backfillPoint} onChange={setBackfillPoint} />
            <button
              onClick={handleBackfillSave}
              disabled={!backfillPoint || backfillSaving}
              className="mt-4 w-full rounded-xl bg-club-primary text-navy-950 px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {backfillSaving ? "Saving…" : "Save Location"}
            </button>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
