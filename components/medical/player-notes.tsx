"use client";

import { useCallback, useEffect, useState } from "react";
import { NotebookPen, Plus, Trash2, Pencil, Check, X, Loader2 } from "lucide-react";
import { VoiceNoteButton } from "@/components/voice-note-button";
import {
  fetchPlayerNotes, addPlayerNote, updatePlayerNote, deletePlayerNote,
  type DbPlayerMedicalNote,
} from "@/lib/player-medical-notes-db";

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// An append-only notes log against a player, separate from any one injury.
// Entries are timestamped and attributed, so the history reads as a record of
// what was observed and when — which is the point. Editing is allowed for
// fixing a typo; it stamps an "edited" marker rather than hiding the change.
export function PlayerNotes({
  playerId, canEdit, authorName, authorEmail,
}: {
  playerId: string;
  canEdit: boolean;
  authorName: string | null;
  authorEmail: string | null;
}) {
  const [notes, setNotes] = useState<DbPlayerMedicalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setNotes(await fetchPlayerNotes(playerId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load notes.");
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!draft.trim()) return;
    setSaving(true);
    setError("");
    try {
      const note = await addPlayerNote({ playerId, body: draft, authorName, authorEmail });
      setNotes((prev) => [note, ...prev]);
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that note.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(id: string) {
    if (!editBody.trim()) return;
    setBusyId(id);
    try {
      const updated = await updatePlayerNote(id, editBody);
      setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update that note.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this note? This can't be undone.")) return;
    setBusyId(id);
    try {
      await deletePlayerNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete that note.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        <NotebookPen size={13} /> Notes
      </p>

      {canEdit && (
        <div className="mb-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-xs text-neutral-400">
              Anything worth recording that isn&apos;t tied to a specific injury.
            </p>
            <VoiceNoteButton onTranscript={(text) => setDraft((d) => (d ? `${d} ${text}` : text))} />
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="e.g. Tight left calf after Tuesday's session — modified running load, monitor Thursday."
            className="w-full rounded-xl border border-white/10 bg-navy-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
          />
          <button
            onClick={handleAdd}
            disabled={saving || !draft.trim()}
            className="mt-2 flex touch-manipulation items-center gap-1.5 rounded-xl bg-club-primary px-3 py-1.5 text-sm font-medium text-navy-950 transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Add note
          </button>
        </div>
      )}

      {error && <p className="mb-2 text-xs text-red-300">{error}</p>}

      {loading ? (
        <p className="text-sm text-neutral-400">Loading notes…</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-neutral-400">No notes recorded for this player yet.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-xl border border-white/10 px-3 py-2.5">
              {editingId === n.id ? (
                <>
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-white/10 bg-navy-600 px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => handleSaveEdit(n.id)}
                      disabled={busyId === n.id}
                      className="flex touch-manipulation items-center gap-1.5 rounded-lg bg-club-primary px-2.5 py-1 text-xs font-medium text-navy-950 disabled:opacity-60"
                    >
                      <Check size={12} /> Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex touch-manipulation items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800"
                    >
                      <X size={12} /> Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-[11px] text-neutral-500">
                      {when(n.created_at)}
                      {n.author_name ? ` · ${n.author_name}` : ""}
                      {n.updated_at !== n.created_at ? " · edited" : ""}
                    </p>
                    {canEdit && (
                      <span className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => { setEditingId(n.id); setEditBody(n.body); }}
                          aria-label="Edit note"
                          className="flex h-6 w-6 touch-manipulation items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 hover:text-white dark:hover:bg-navy-800"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(n.id)}
                          disabled={busyId === n.id}
                          aria-label="Delete note"
                          className="flex h-6 w-6 touch-manipulation items-center justify-center rounded-full text-red-400 hover:bg-red-500/10 disabled:opacity-60"
                        >
                          <Trash2 size={12} />
                        </button>
                      </span>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
