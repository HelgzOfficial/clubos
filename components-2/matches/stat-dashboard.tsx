"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchMatchStats, saveManualStats, flattenCategories, STAT_FIELDS, type DbMatchStats } from "@/lib/match-stats-db";
import { CATEGORY_DEFS, type StatCategory } from "@/lib/match-stat-defs";
import { ChevronRight, X, Pencil, BarChart3 } from "lucide-react";

const CATEGORY_ICON_COLOR: Record<string, string> = {
  possession: "text-blue-400",
  shooting: "text-red-400",
  defensive: "text-emerald-400",
  discipline: "text-amber-400",
  setPieces: "text-purple-400",
  goalkeeping: "text-club-primary",
};

function Bar({ us, opponent }: { us: number | null; opponent: number | null }) {
  const u = us ?? 0;
  const o = opponent ?? 0;
  const total = u + o;
  const usPct = total > 0 ? (u / total) * 100 : 50;
  return (
    <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
      <div className="bg-club-primary" style={{ width: `${usPct}%` }} />
      <div className="bg-neutral-500" style={{ width: `${100 - usPct}%` }} />
    </div>
  );
}

function fmt(v: number | null, unit: string) {
  if (v === null) return "–";
  return `${v}${unit}`;
}

export function StatDashboard({
  matchId, opponentName, initialStats,
}: {
  matchId: string; opponentName: string; initialStats: DbMatchStats | null;
}) {
  const [stats, setStats] = useState<DbMatchStats | null>(initialStats);
  const [openCategory, setOpenCategory] = useState<StatCategory | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState<Record<string, { us: string; opponent: string }>>(() => initFormFromStats(initialStats));
  const [saving, setSaving] = useState(false);

  // Keep in sync with the parent's copy — e.g. right after a report upload
  // auto-populates stats for the first time.
  useEffect(() => {
    setStats(initialStats);
    setForm(initFormFromStats(initialStats));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStats]);

  function initFormFromStats(s: DbMatchStats | null) {
    const flat = flattenCategories(s?.categories ?? []);
    const f: Record<string, { us: string; opponent: string }> = {};
    for (const field of STAT_FIELDS) {
      const v = flat[field.key];
      f[field.key] = {
        us: v?.us !== null && v?.us !== undefined ? String(v.us) : "",
        opponent: v?.opponent !== null && v?.opponent !== undefined ? String(v.opponent) : "",
      };
    }
    return f;
  }

  async function refresh() {
    const updated = await fetchMatchStats(matchId);
    setStats(updated);
    setForm(initFormFromStats(updated));
  }

  function openEdit() {
    setForm(initFormFromStats(stats));
    setShowEdit(true);
  }

  async function handleSaveManual() {
    setSaving(true);
    try {
      const values: Record<string, { us: number | null; opponent: number | null }> = {};
      for (const field of STAT_FIELDS) {
        const raw = form[field.key];
        const us = raw?.us.trim() ? Number(raw.us) : null;
        const opponent = raw?.opponent.trim() ? Number(raw.opponent) : null;
        values[field.key] = { us, opponent };
      }
      await saveManualStats(matchId, values);
      setShowEdit(false);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  const categories = stats?.categories ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BarChart3 size={16} className="text-club-primary" /> Match Stats Dashboard</CardTitle>
        <button
          onClick={openEdit}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-sm text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors"
        >
          <Pencil size={13} /> Edit Stats
        </button>
      </CardHeader>

      <div className="mb-3 flex items-center justify-between text-xs text-neutral-400">
        <span className="font-medium text-club-primary">Us</span>
        <span className="font-medium text-neutral-400">{opponentName}</span>
      </div>

      {categories.length === 0 ? (
        <p className="text-sm text-neutral-400">
          No stats yet — upload a Wyscout/Hudl match report below to auto-fill this dashboard, or click &quot;Edit Stats&quot; to enter them by hand.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setOpenCategory(cat)}
              className="rounded-xl border border-white/10 p-3.5 text-left hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors"
            >
              <div className="flex items-center justify-between">
                <p className={`text-xs font-semibold uppercase tracking-wide ${CATEGORY_ICON_COLOR[cat.key] ?? "text-neutral-400"}`}>{cat.label}</p>
                <ChevronRight size={14} className="text-neutral-500" />
              </div>
              <div className="mt-2 flex items-end justify-between">
                <span className="text-xl font-semibold">{fmt(cat.us, cat.unit)}</span>
                <span className="text-xl font-semibold text-neutral-400">{fmt(cat.opponent, cat.unit)}</span>
              </div>
              <Bar us={cat.us} opponent={cat.opponent} />
              <p className="mt-2 text-[11px] text-neutral-500">{cat.detail.length} stat{cat.detail.length === 1 ? "" : "s"} · tap for breakdown</p>
            </button>
          ))}
        </div>
      )}

      {openCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setOpenCategory(null)}>
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{openCategory.label}</p>
                <p className="text-xs text-neutral-400">{openCategory.description}</p>
              </div>
              <button onClick={() => setOpenCategory(null)} className="text-neutral-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="mb-3 flex items-center justify-between text-xs text-neutral-400">
              <span className="font-medium text-club-primary">Us</span>
              <span className="font-medium text-neutral-400">{opponentName}</span>
            </div>
            <ul className="divide-y divide-white/10">
              {openCategory.detail.map((row) => (
                <li key={row.key} className="py-2.5">
                  <p className="mb-1 text-xs text-neutral-400">{row.label}</p>
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>{fmt(row.us, row.unit)}</span>
                    <span className="text-neutral-400">{fmt(row.opponent, row.unit)}</span>
                  </div>
                  <Bar us={row.us} opponent={row.opponent} />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="max-h-[85vh] w-full max-w-lg overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-medium">Edit Match Stats</p>
              <button onClick={() => setShowEdit(false)} className="text-neutral-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <p className="mb-4 text-xs text-neutral-400">
              Enter values manually, or correct anything an uploaded report got wrong. Leave a field blank to hide that stat.
            </p>
            <div className="space-y-5">
              {CATEGORY_DEFS.map((cat) => {
                const fields = STAT_FIELDS.filter((f) => f.category === cat.key);
                return (
                  <div key={cat.key}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{cat.label}</p>
                    <div className="space-y-2">
                      {fields.map((f) => (
                        <div key={f.key} className="flex items-center gap-2">
                          <span className="w-40 shrink-0 truncate text-xs text-neutral-400">{f.label}{f.unit ? ` (${f.unit})` : ""}</span>
                          <input
                            value={form[f.key]?.us ?? ""}
                            onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: { ...prev[f.key], us: e.target.value } }))}
                            placeholder="Us"
                            className="w-full rounded-lg border border-white/10 bg-navy-600 dark:bg-navy-800 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                          />
                          <input
                            value={form[f.key]?.opponent ?? ""}
                            onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: { ...prev[f.key], opponent: e.target.value } }))}
                            placeholder={opponentName}
                            className="w-full rounded-lg border border-white/10 bg-navy-600 dark:bg-navy-800 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              onClick={handleSaveManual}
              disabled={saving}
              className="mt-5 w-full rounded-xl bg-club-primary text-navy-950 px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Stats"}
            </button>
          </Card>
        </div>
      )}
    </Card>
  );
}
