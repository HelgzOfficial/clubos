"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchMatches, type DbMatch } from "@/lib/matches-db";
import { fetchMatchPacks, createMatchPack, deleteMatchPack, type DbMatchPack } from "@/lib/match-packs-db";
import { usePermissions } from "@/lib/permissions";
import { ArrowLeft, Plus, Trash2, Package, X } from "lucide-react";

export default function MatchPacksPage() {
  const { canWrite } = usePermissions();
  const canEdit = canWrite("analysis");

  const [matches, setMatches] = useState<DbMatch[]>([]);
  const [packs, setPacks] = useState<DbMatchPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newMatchId, setNewMatchId] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [m, p] = await Promise.all([fetchMatches(), fetchMatchPacks()]);
      setMatches(m);
      setPacks(p);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function matchLabel(matchId: string | null) {
    const m = matches.find((mm) => mm.id === matchId);
    if (!m) return "Not linked to a fixture";
    return `${m.is_home ? "vs" : "@"} ${m.opponent} — ${new Date(m.kickoff).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
  }

  function openCreate(matchId?: string) {
    const match = matches.find((m) => m.id === matchId);
    setNewMatchId(matchId ?? "");
    setNewTitle(match ? `${match.is_home ? "vs" : "@"} ${match.opponent} — Match Pack` : "");
    setShowCreate(true);
  }

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const pack = await createMatchPack({ matchId: newMatchId || null, title: newTitle.trim() });
      setShowCreate(false);
      window.location.href = `/analysis/match-packs/${pack.id}`;
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this match pack? This can't be undone.")) return;
    await deleteMatchPack(id);
    await load();
  }

  const upcomingMatches = matches.filter((m) => m.status === "scheduled").slice(0, 10);

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/analysis" className="mb-1 flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors">
            <ArrowLeft size={12} /> Analyst Dashboard
          </Link>
          <h1 className="text-2xl font-semibold">Match Packs</h1>
          <p className="text-sm text-neutral-500">Opposition info, clips, and notes bundled per fixture — exportable as a PDF.</p>
        </div>
        {canEdit && (
          <button
            onClick={() => openCreate()}
            className="flex items-center gap-2 rounded-xl bg-club-primary text-navy-950 px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={15} /> New Match Pack
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader><CardTitle>All Match Packs</CardTitle></CardHeader>
              {packs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <Package size={26} className="mb-3 text-neutral-300 dark:text-neutral-600" />
                  <p className="font-medium">No match packs yet</p>
                  <p className="mt-1 max-w-xs text-sm text-neutral-400">Create one for an upcoming fixture to start pulling together opposition info, clips, and notes.</p>
                </div>
              ) : (
                <ul className="divide-y divide-white/10">
                  {packs.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 py-3">
                      <Link href={`/analysis/match-packs/${p.id}`} className="flex-1 min-w-0 hover:text-club-primary transition-colors">
                        <p className="truncate text-sm font-medium">{p.title}</p>
                        <p className="truncate text-xs text-neutral-400">{matchLabel(p.match_id)} · {p.items.length} item{p.items.length === 1 ? "" : "s"}</p>
                      </Link>
                      {canEdit && (
                        <button onClick={() => handleDelete(p.id)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {canEdit && (
            <Card>
              <CardHeader><CardTitle>Quick Start — Upcoming Fixtures</CardTitle></CardHeader>
              {upcomingMatches.length === 0 ? (
                <p className="text-sm text-neutral-400">No upcoming fixtures on the calendar.</p>
              ) : (
                <ul className="space-y-1.5">
                  {upcomingMatches.map((m) => (
                    <li key={m.id}>
                      <button
                        onClick={() => openCreate(m.id)}
                        className="w-full rounded-xl border border-white/10 px-3 py-2 text-left text-sm hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors"
                      >
                        {m.is_home ? "vs" : "@"} {m.opponent}
                        <span className="ml-1.5 text-xs text-neutral-400">{new Date(m.kickoff).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-medium">New Match Pack</p>
              <button onClick={() => setShowCreate(false)} className="text-neutral-400 hover:text-white"><X size={18} /></button>
            </div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-500">Fixture (optional)</label>
            <select
              value={newMatchId}
              onChange={(e) => setNewMatchId(e.target.value)}
              className="mb-4 w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
            >
              <option value="">Not linked to a fixture</option>
              {matches.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.is_home ? "vs" : "@"} {m.opponent} — {new Date(m.kickoff).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </option>
              ))}
            </select>
            <label className="mb-1.5 block text-xs font-medium text-neutral-500">Title</label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="mb-5 w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
              placeholder="e.g. vs East Grinstead — Match Pack"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newTitle.trim()}
              className="w-full rounded-xl bg-club-primary text-navy-950 px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create & Open"}
            </button>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
