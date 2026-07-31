"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Check, X, Loader2, Phone, AlertTriangle } from "lucide-react";
import {
  fetchMedicalProfile, saveEmergencySelf, toEmergencySelf,
  type DbPlayerMedicalProfile, type EmergencySelfInput,
} from "@/lib/player-medical-profiles-db";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-navy-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800";

// A player's own emergency details, maintained by them.
//
// Only the fields a player is the right person to keep current: who to call,
// and what a paramedic would need to know. Their injury history, GP record and
// the medical team's own notes are not shown or editable here — those belong
// to the medical team even though they sit in the same database row.
export function PortalEmergencyContact({
  playerId, playerName,
}: {
  playerId: string;
  playerName: string;
}) {
  const [profile, setProfile] = useState<DbPlayerMedicalProfile | null>(null);
  const [form, setForm] = useState<EmergencySelfInput>(toEmergencySelf(null));
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedNote, setSavedNote] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const row = await fetchMedicalProfile(playerId);
      setProfile(row);
      setForm(toEmergencySelf(row));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your details.");
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const saved = await saveEmergencySelf(playerId, form, playerName);
      setProfile(saved);
      setForm(toEmergencySelf(saved));
      setEditing(false);
      setSavedNote(true);
      setTimeout(() => setSavedNote(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your details.");
    } finally {
      setSaving(false);
    }
  }

  const set = (key: keyof EmergencySelfInput) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  if (loading) return <p className="text-sm text-neutral-400">Loading…</p>;

  const hasContact = Boolean(profile?.emergency_contact_name || profile?.emergency_contact_phone);

  if (editing) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-neutral-400">
          Who should the club call if something happens to you at training or on a matchday?
        </p>
        <input value={form.emergency_contact_name} onChange={(e) => set("emergency_contact_name")(e.target.value)} placeholder="Their name" className={inputClass} />
        <input value={form.emergency_contact_relationship} onChange={(e) => set("emergency_contact_relationship")(e.target.value)} placeholder="Relationship to you (e.g. mum, partner)" className={inputClass} />
        <input value={form.emergency_contact_phone} onChange={(e) => set("emergency_contact_phone")(e.target.value)} placeholder="Phone number" inputMode="tel" className={inputClass} />
        <input value={form.emergency_contact_alt_phone} onChange={(e) => set("emergency_contact_alt_phone")(e.target.value)} placeholder="Another number (optional)" inputMode="tel" className={inputClass} />

        <p className="pt-1 text-xs text-neutral-400">
          Anything a paramedic would need to know. Leave blank if it doesn&apos;t apply.
        </p>
        <input value={form.allergies} onChange={(e) => set("allergies")(e.target.value)} placeholder="Allergies" className={inputClass} />
        <input value={form.conditions} onChange={(e) => set("conditions")(e.target.value)} placeholder="Conditions (asthma, epilepsy…)" className={inputClass} />
        <input value={form.medications} onChange={(e) => set("medications")(e.target.value)} placeholder="Medication you take" className={inputClass} />

        {error && <p className="text-xs text-red-300">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-xl bg-club-primary px-3 py-2.5 text-sm font-medium text-navy-950 disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
          </button>
          <button
            onClick={() => { setForm(toEmergencySelf(profile)); setEditing(false); setError(""); }}
            className="flex touch-manipulation items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-neutral-300"
          >
            <X size={14} /> Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {!hasContact ? (
        <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-200">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>No emergency contact on file. Please add one — it takes a few seconds and matters if you get hurt.</span>
        </div>
      ) : (
        <div className="mb-3 space-y-2 text-sm">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-neutral-500">Emergency contact</p>
            <p className="font-medium">
              {profile?.emergency_contact_name}
              {profile?.emergency_contact_relationship ? (
                <span className="font-normal text-neutral-400"> · {profile.emergency_contact_relationship}</span>
              ) : null}
            </p>
          </div>
          {profile?.emergency_contact_phone && (
            <a href={`tel:${profile.emergency_contact_phone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-sm text-club-primary">
              <Phone size={13} /> {profile.emergency_contact_phone}
            </a>
          )}
          {(profile?.allergies || profile?.conditions || profile?.medications) && (
            <dl className="space-y-1 pt-1 text-xs">
              {profile?.allergies && <Row label="Allergies" value={profile.allergies} />}
              {profile?.conditions && <Row label="Conditions" value={profile.conditions} />}
              {profile?.medications && <Row label="Medication" value={profile.medications} />}
            </dl>
          )}
        </div>
      )}

      {error && <p className="mb-2 text-xs text-red-300">{error}</p>}
      {savedNote && <p className="mb-2 text-xs text-emerald-300">Saved — thank you.</p>}

      <button
        onClick={() => setEditing(true)}
        className="flex w-full touch-manipulation items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800"
      >
        <Pencil size={13} /> {hasContact ? "Update my details" : "Add my emergency contact"}
      </button>

      <p className="mt-2 text-xs text-neutral-500">
        Only the club&apos;s medical staff and management can see this.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-neutral-500">{label}</dt>
      <dd className="min-w-0 flex-1">{value}</dd>
    </div>
  );
}
