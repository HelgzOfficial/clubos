"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { askInjuryAi, fetchAiSearchLogs, type DbAiSearchLog } from "@/lib/ai-injury-search";
import type { DbPlayer } from "@/lib/players-db";
import { Sparkles, Search, ChevronDown, AlertCircle } from "lucide-react";

function timeAgo(iso: string) {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function AiInjurySearch({ players }: { players: DbPlayer[] }) {
  const [query, setQuery] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [logs, setLogs] = useState<DbAiSearchLog[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  async function loadLogs() {
    try {
      setLogs(await fetchAiSearchLogs());
    } catch {
      // history is a nice-to-have; ignore load failures here
    }
  }

  useEffect(() => {
    loadLogs();
  }, []);

  async function handleAsk(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!query.trim()) return;
    setAsking(true);
    setError("");
    setAnswer("");
    const result = await askInjuryAi(query.trim(), playerId || null);
    if (result.error) {
      setError(result.error);
    } else {
      setAnswer(result.answer ?? "");
      await loadLogs();
    }
    setAsking(false);
  }

  const playerName = (id: string | null) => (id ? players.find((p) => p.id === id)?.name : null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles size={16} className="text-club-primary" /> AI Injury & Rehab Assistant</CardTitle>
      </CardHeader>

      <p className="mb-3 text-xs text-neutral-400">
        Ask about an injury, treatment approach, or rehab exercise progression. This gives general
        informational support only — it&apos;s not a diagnosis and doesn&apos;t replace your own clinical
        judgement or established medical guidelines.
      </p>

      <form onSubmit={handleAsk} className="mb-4 space-y-2">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={2}
          placeholder="e.g. Rehab exercise progression for a grade 2 hamstring strain"
          className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            className="rounded-lg border border-white/10 bg-navy-600 dark:bg-navy-800 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-club-primary/30"
          >
            <option value="">No player linked</option>
            {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button
            type="submit"
            disabled={asking || !query.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-club-primary text-navy-950 px-4 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            <Search size={13} /> {asking ? "Searching…" : "Ask AI"}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-300" />
          <p className="text-sm text-amber-200">{error}</p>
        </div>
      )}

      {answer && (
        <div className="mb-4 whitespace-pre-wrap rounded-xl border border-white/10 bg-navy-600/50 dark:bg-navy-800/50 p-3 text-sm text-neutral-200">
          {answer}
        </div>
      )}

      <button
        onClick={() => setShowHistory((v) => !v)}
        className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white"
      >
        <ChevronDown size={13} className={`transition-transform ${showHistory ? "rotate-180" : ""}`} />
        Recent searches ({logs.length})
      </button>

      {showHistory && (
        <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto divide-y divide-white/10">
          {logs.length === 0 ? (
            <li className="pt-2 text-xs text-neutral-400">No AI searches logged yet.</li>
          ) : (
            logs.map((log) => (
              <li key={log.id} className="pt-2 pb-1">
                <p className="text-sm font-medium">{log.query}</p>
                <p className="mt-1 line-clamp-3 text-xs text-neutral-400 whitespace-pre-wrap">{log.answer}</p>
                <p className="mt-1 text-[10px] text-neutral-500">
                  {timeAgo(log.created_at)}{playerName(log.player_id) ? ` · ${playerName(log.player_id)}` : ""}
                </p>
              </li>
            ))
          )}
        </ul>
      )}
    </Card>
  );
}
