"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BodyMap } from "@/components/body-map";
import { rehabStages } from "@/lib/sample-data";
import { fetchPlayers, type DbPlayer } from "@/lib/players-db";
import { supabaseConfigured } from "@/lib/supabase";
import {
  fetchActiveInjuries, createInjury, updateInjury, markInjuryRecovered, deleteInjury,
  BODY_PART_OPTIONS, type DbInjury, type InjurySeverity,
} from "@/lib/injuries-db";
import { TreatmentBookings } from "@/components/medical/treatment-bookings";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { AiInjurySearch } from "@/components/medical/ai-injury-search";
import { VoiceNoteButton } from "@/components/voice-note-button";
import { usePermissions } from "@/lib/permissions";
import { ChevronDown, Plus, Pencil, Check, X, Trash2, AlertCircle } from "lucide-react";

const statusVariant = { green: "green", amber: "amber", red: "red" } as const;

const emptyForm = {
  bodyPart: BODY_PART_OPTIONS[0].value,
  injury: "",
  severity: "amber" as InjurySeverity,
  dateOccurred: "",
  expectedReturn: "",
  notes: "",
};

export default function MedicalPage() {
  const { canWrite } = usePermissions();
  const canEdit = canWrite("medical");
  const [players, setPlayers] = useState<DbPlayer[]>([]);
  const [injuries, setInjuries] = useState<DbInjury[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [editingInjuryId, setEditingInjuryId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [p, i] = await Promise.all([fetchPlayers(), fetchActiveInjuries()]);
      setPlayers(p);
      setInjuries(i);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load medical data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const counts = {
    green: players.filter((p) => p.availability === "green").length,
    amber: players.filter((p) => p.availability === "amber").length,
    red: players.filter((p) => p.availability === "red").length,
  };

  const injuredIds = new Set(injuries.map((i) => i.player_id));
  const ordered = [...players].sort((a, b) => (injuredIds.has(a.id) ? 0 : 1) - (injuredIds.has(b.id) ? 0 : 1));

  function startAdd(playerId: string) {
    setAddingFor(playerId);
    setEditingInjuryId(null);
    setForm(emptyForm);
    setOpenId(playerId);
  }

  function startEdit(injury: DbInjury) {
    setEditingInjuryId(injury.id);
    setAddingFor(null);
    setForm({
      bodyPart: injury.body_part,
      injury: injury.injury,
      severity: injury.severity,
      dateOccurred: injury.date_occurred ?? "",
      expectedReturn: injury.expected_return ?? "",
      notes: injury.notes ?? "",
    });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>, playerId: string) {
    e.preventDefault();
    if (!form.injury.trim()) return;
    setSaving(true);
    try {
      if (editingInjuryId) {
        await updateInjury(editingInjuryId, playerId, form);
      } else {
        await createInjury(playerId, { ...form, rehabStage: 0 });
      }
      setAddingFor(null);
      setEditingInjuryId(null);
      setForm(emptyForm);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save injury.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRehabStage(injury: DbInjury, stage: number) {
    await updateInjury(injury.id, injury.player_id, { rehabStage: stage });
    await load();
  }

  async function handleRecovered(injury: DbInjury) {
    if (!window.confirm("Mark this injury as recovered? The player's availability will be set back to Available.")) return;
    await markInjuryRecovered(injury.id, injury.player_id);
    await load();
  }

  async function handleDelete(injury: DbInjury) {
    if (!window.confirm("Delete this injury record?")) return;
    await deleteInjury(injury.id);
    await load();
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Medical Centre</h1>
        <p className="text-sm text-neutral-500">Squad availability, injury tracking, and rehab progress.</p>
      </div>

      {!supabaseConfigured && (
        <Card className="mb-6 flex items-start gap-3 border-amber-500/30 bg-amber-500/10">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-300" />
          <p className="text-sm text-amber-200">Supabase isn&apos;t connected on this deployment yet, so medical records can&apos;t be loaded or saved here.</p>
        </Card>
      )}
      {error && (
        <Card className="mb-6 border-red-500/30 bg-red-500/10">
          <p className="text-sm text-red-300">{error}</p>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-3 gap-4">
        <Card className="text-center">
          <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">{counts.green}</p>
          <p className="text-xs text-neutral-400">Available</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-semibold text-amber-600 dark:text-amber-400">{counts.amber}</p>
          <p className="text-xs text-neutral-400">Doubtful</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-semibold text-red-600 dark:text-red-400">{counts.red}</p>
          <p className="text-xs text-neutral-400">Unavailable</p>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TreatmentBookings players={players} injuries={injuries} canEdit={canEdit} />
        <AiInjurySearch players={players} />
      </div>

      {loading ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : (
        <div className="space-y-3">
          {ordered.map((p) => {
            const injury = injuries.find((i) => i.player_id === p.id);
            const isOpen = openId === p.id;
            const isAdding = addingFor === p.id;
            const isEditing = injury && editingInjuryId === injury.id;

            return (
              <Card key={p.id} className="p-0 overflow-hidden">
                <button
                  onClick={() => setOpenId(isOpen ? null : p.id)}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left"
                >
                  <PlayerAvatar playerId={p.id} initials={p.initials} photoUrl={p.photo_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.name}</p>
                    <p className="text-xs text-neutral-400">#{p.squad_number} · {p.position}</p>
                  </div>
                  <Badge variant={statusVariant[p.availability]} className="max-w-[6rem] truncate sm:max-w-none">{p.availability_note}</Badge>
                  <ChevronDown size={16} className={`shrink-0 text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {isOpen && (
                  <div className="border-t border-white/10 px-5 py-5">
                    {injury && !isEditing && (
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Injury Location</p>
                          <BodyMap markers={[{ bodyPart: injury.body_part, label: injury.injury, severity: injury.severity }]} />
                        </div>

                        <div className="md:col-span-2 space-y-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1">Diagnosis</p>
                              <p className="text-sm font-medium">{injury.injury}</p>
                              <p className="text-xs text-neutral-400">
                                {injury.date_occurred ? `Occurred ${injury.date_occurred}` : "Date not set"}
                                {injury.expected_return ? ` · Expected return ${injury.expected_return}` : ""}
                              </p>
                            </div>
                            {canEdit && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button onClick={() => startEdit(injury)} className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white" title="Edit">
                                <Pencil size={13} />
                              </button>
                              <button onClick={() => handleDelete(injury)} className="flex h-8 w-8 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10" title="Delete">
                                <Trash2 size={13} />
                              </button>
                            </div>
                            )}
                          </div>

                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">Rehab Stage</p>
                            <div className="flex items-center gap-1">
                              {rehabStages.map((stage, i) => (
                                <button key={stage} disabled={!canEdit} onClick={() => handleRehabStage(injury, i)} className="flex-1 disabled:cursor-default" title={stage}>
                                  <div className={`h-1.5 rounded-full transition-colors ${i <= injury.rehab_stage ? "bg-emerald-500" : "bg-neutral-200 dark:bg-neutral-800"}`} />
                                </button>
                              ))}
                            </div>
                            <p className="mt-1.5 text-xs text-neutral-500">
                              Stage {injury.rehab_stage + 1} of {rehabStages.length}: <span className="font-medium">{rehabStages[injury.rehab_stage]}</span>
                              {canEdit && <span className="ml-1 text-neutral-600">(click a bar to update)</span>}
                            </p>
                          </div>

                          {injury.notes && (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1">Medical Notes</p>
                              <p className="text-sm text-neutral-600 dark:text-neutral-300">{injury.notes}</p>
                            </div>
                          )}

                          {canEdit && (
                          <button
                            onClick={() => handleRecovered(injury)}
                            className="flex items-center gap-1.5 rounded-xl bg-emerald-500/15 text-emerald-400 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500/25 transition-colors"
                          >
                            <Check size={14} /> Mark Recovered
                          </button>
                          )}
                        </div>
                      </div>
                    )}

                    {!injury && !isAdding && canEdit && (
                      <button
                        onClick={() => startAdd(p.id)}
                        className="flex items-center gap-1.5 rounded-xl bg-club-primary text-navy-950 px-3 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity"
                      >
                        <Plus size={14} /> Log Injury
                      </button>
                    )}

                    {(isAdding || isEditing) && (
                      <form onSubmit={(e) => handleSubmit(e, p.id)} className="space-y-3 max-w-md">
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-neutral-500">Diagnosis</label>
                          <input value={form.injury} onChange={(e) => setForm({ ...form, injury: e.target.value })} className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <label className="mb-1.5 block text-xs font-medium text-neutral-500">Body part</label>
                            <select value={form.bodyPart} onChange={(e) => setForm({ ...form, bodyPart: e.target.value as typeof form.bodyPart })} className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30">
                              {BODY_PART_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </div>
                          <div className="flex-1">
                            <label className="mb-1.5 block text-xs font-medium text-neutral-500">Severity</label>
                            <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as InjurySeverity })} className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30">
                              <option value="amber">Doubtful</option>
                              <option value="red">Unavailable</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <label className="mb-1.5 block text-xs font-medium text-neutral-500">Date occurred</label>
                            <input type="date" value={form.dateOccurred} onChange={(e) => setForm({ ...form, dateOccurred: e.target.value })} className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
                          </div>
                          <div className="flex-1">
                            <label className="mb-1.5 block text-xs font-medium text-neutral-500">Expected return</label>
                            <input type="date" value={form.expectedReturn} onChange={(e) => setForm({ ...form, expectedReturn: e.target.value })} className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
                          </div>
                        </div>
                        <div>
                          <div className="mb-1.5 flex items-center justify-between">
                            <label className="block text-xs font-medium text-neutral-500">Medical notes</label>
                            <VoiceNoteButton
                              onTranscript={(text) => setForm((f) => ({ ...f, notes: f.notes ? `${f.notes} ${text}` : text }))}
                            />
                          </div>
                          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
                        </div>
                        <div className="flex gap-2">
                          <button type="submit" disabled={saving} className="flex items-center gap-1.5 rounded-xl bg-club-primary text-navy-950 px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60">
                            <Check size={14} /> {saving ? "Saving…" : "Save"}
                          </button>
                          <button type="button" onClick={() => { setAddingFor(null); setEditingInjuryId(null); }} className="flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2 text-sm text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors">
                            <X size={14} /> Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
