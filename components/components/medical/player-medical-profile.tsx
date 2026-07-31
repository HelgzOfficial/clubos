"use client";

import { useCallback, useEffect, useState } from "react";
import { Phone, Pencil, Check, X, Loader2, ShieldAlert, MapPin, Cake } from "lucide-react";
import type { DbPlayer } from "@/lib/players-db";
import { updatePlayer } from "@/lib/players-db";
import {
  fetchMedicalProfile, saveMedicalProfile, toInput, hasAnyDetail,
  type DbPlayerMedicalProfile, type MedicalProfileInput,
} from "@/lib/player-medical-profiles-db";

function age(dob: string | null): string {
  if (!dob) return "";
  const born = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(born.getTime())) return "";
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  const monthDiff = now.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < born.getDate())) years--;
  return ` (${years})`;
}

function formatDob(dob: string | null): string {
  if (!dob) return "Not recorded";
  const d = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dob;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) + age(dob);
}

// The fields that matter in an emergency, grouped so the critical ones are
// readable at a glance rather than buried in a form. Emergency contact and
// allergies come first deliberately — if someone is scanning this on the
// touchline, that's what they need.
const CRITICAL: { key: keyof MedicalProfileInput; label: string }[] = [
  { key: "allergies", label: "Allergies" },
  { key: "conditions", label: "Medical conditions" },
  { key: "medications", label: "Current medication" },
  { key: "blood_type", label: "Blood type" },
];

const HISTORY: { key: keyof MedicalProfileInput; label: string }[] = [
  { key: "surgeries", label: "Surgeries" },
  { key: "previous_injuries", label: "Previous injuries" },
];

const GP: { key: keyof MedicalProfileInput; label: string }[] = [
  { key: "gp_name", label: "GP name" },
  { key: "gp_practice", label: "Practice" },
  { key: "gp_phone", label: "Practice phone" },
];

const inputClass =
  "w-full rounded-lg border border-white/10 bg-navy-600 px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800";

export function PlayerMedicalProfile({
  player, canEdit, editorName, onPlayerChanged,
}: {
  player: DbPlayer;
  canEdit: boolean;
  editorName: string | null;
  onPlayerChanged?: () => void;
}) {
  const [profile, setProfile] = useState<DbPlayerMedicalProfile | null>(null);
  const [form, setForm] = useState<MedicalProfileInput>(toInput(null));
  const [address, setAddress] = useState(player.address ?? "");
  const [dob, setDob] = useState(player.dob ?? "");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const row = await fetchMedicalProfile(player.id);
      setProfile(row);
      setForm(toInput(row));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load medical details.");
    } finally {
      setLoading(false);
    }
  }, [player.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    setAddress(player.address ?? "");
    setDob(player.dob ?? "");
  }, [player.address, player.dob]);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const saved = await saveMedicalProfile(player.id, form, editorName);
      setProfile(saved);
      // Address and date of birth live on the player record, not the medical
      // one — they're admin detail that other parts of the app already use.
      if (address !== (player.address ?? "") || dob !== (player.dob ?? "")) {
        await updatePlayer(player.id, { address: address.trim() || null, dob: dob || null });
        onPlayerChanged?.();
      }
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save those details.");
    } finally {
      setSaving(false);
    }
  }

  const set = (key: keyof MedicalProfileInput) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  if (loading) return <p className="py-3 text-sm text-neutral-400">Loading medical details…</p>;

  const contactPhone = profile?.emergency_contact_phone;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <ShieldAlert size={13} /> Emergency &amp; medical details
        </p>
        {canEdit && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex touch-manipulation items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800"
          >
            <Pencil size={12} /> {hasAnyDetail(profile) ? "Edit" : "Add details"}
          </button>
        )}
      </div>

      {error && <p className="mb-2 text-xs text-red-300">{error}</p>}

      {editing ? (
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500">Emergency contact</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input value={form.emergency_contact_name} onChange={(e) => set("emergency_contact_name")(e.target.value)} placeholder="Name" className={inputClass} />
              <input value={form.emergency_contact_relationship} onChange={(e) => set("emergency_contact_relationship")(e.target.value)} placeholder="Relationship (e.g. mother)" className={inputClass} />
              <input value={form.emergency_contact_phone} onChange={(e) => set("emergency_contact_phone")(e.target.value)} placeholder="Phone" inputMode="tel" className={inputClass} />
              <input value={form.emergency_contact_alt_phone} onChange={(e) => set("emergency_contact_alt_phone")(e.target.value)} placeholder="Second phone (optional)" inputMode="tel" className={inputClass} />
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500">In an emergency</p>
            <div className="space-y-2">
              <input value={form.allergies} onChange={(e) => set("allergies")(e.target.value)} placeholder="Allergies — including reaction and treatment" className={inputClass} />
              <input value={form.conditions} onChange={(e) => set("conditions")(e.target.value)} placeholder="Conditions (asthma, epilepsy, cardiac history…)" className={inputClass} />
              <input value={form.medications} onChange={(e) => set("medications")(e.target.value)} placeholder="Current medication" className={inputClass} />
              <input value={form.blood_type} onChange={(e) => set("blood_type")(e.target.value)} placeholder="Blood type (if known)" className={inputClass} />
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500">History</p>
            <div className="space-y-2">
              <textarea value={form.surgeries} onChange={(e) => set("surgeries")(e.target.value)} rows={2} placeholder="Surgeries — what and when" className={inputClass} />
              <textarea value={form.previous_injuries} onChange={(e) => set("previous_injuries")(e.target.value)} rows={2} placeholder="Previous injuries — recurring problems worth knowing about" className={inputClass} />
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500">Registered GP</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input value={form.gp_name} onChange={(e) => set("gp_name")(e.target.value)} placeholder="GP name" className={inputClass} />
              <input value={form.gp_practice} onChange={(e) => set("gp_practice")(e.target.value)} placeholder="Practice" className={inputClass} />
              <input value={form.gp_phone} onChange={(e) => set("gp_phone")(e.target.value)} placeholder="Phone" inputMode="tel" className={inputClass} />
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500">Personal</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="text-xs text-neutral-500">
                Date of birth
                <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={`${inputClass} mt-1`} />
              </label>
              <label className="text-xs text-neutral-500">
                Address
                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Home address" className={`${inputClass} mt-1`} />
              </label>
            </div>
          </div>

          <div>
            <textarea value={form.notes} onChange={(e) => set("notes")(e.target.value)} rows={2} placeholder="Anything else the medical team should know" className={inputClass} />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex touch-manipulation items-center gap-1.5 rounded-xl bg-club-primary px-4 py-2 text-sm font-medium text-navy-950 disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
            </button>
            <button
              onClick={() => { setForm(toInput(profile)); setAddress(player.address ?? ""); setDob(player.dob ?? ""); setEditing(false); }}
              className="flex touch-manipulation items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2 text-sm text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800"
            >
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Emergency contact gets its own tinted block with a tap-to-call
              link — on a touchline this is the one thing that has to be
              instantly findable and one tap away. */}
          <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-3">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-red-300">Emergency contact</p>
            {profile?.emergency_contact_name ? (
              <>
                <p className="text-sm font-medium">
                  {profile.emergency_contact_name}
                  {profile.emergency_contact_relationship ? (
                    <span className="font-normal text-neutral-400"> · {profile.emergency_contact_relationship}</span>
                  ) : null}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {contactPhone && (
                    <a href={`tel:${contactPhone.replace(/\s+/g, "")}`} className="flex items-center gap-1.5 rounded-lg bg-red-500/15 px-2.5 py-1.5 text-sm font-medium text-red-200 hover:bg-red-500/25">
                      <Phone size={13} /> {contactPhone}
                    </a>
                  )}
                  {profile.emergency_contact_alt_phone && (
                    <a href={`tel:${profile.emergency_contact_alt_phone.replace(/\s+/g, "")}`} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800">
                      <Phone size={13} /> {profile.emergency_contact_alt_phone}
                    </a>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-neutral-400">No emergency contact recorded.</p>
            )}
          </div>

          <Section title="In an emergency" fields={CRITICAL} profile={profile} />
          <Section title="History" fields={HISTORY} profile={profile} />
          <Section title="Registered GP" fields={GP} profile={profile} />

          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500">Personal</p>
            <dl className="space-y-1.5 text-sm">
              <div className="flex gap-2">
                <dt className="flex w-36 shrink-0 items-center gap-1.5 text-neutral-500"><Cake size={12} /> Date of birth</dt>
                <dd className="min-w-0 flex-1">{formatDob(player.dob)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="flex w-36 shrink-0 items-center gap-1.5 text-neutral-500"><MapPin size={12} /> Address</dt>
                <dd className="min-w-0 flex-1">{player.address || "Not recorded"}</dd>
              </div>
              {player.phone && (
                <div className="flex gap-2">
                  <dt className="flex w-36 shrink-0 items-center gap-1.5 text-neutral-500"><Phone size={12} /> Player phone</dt>
                  <dd className="min-w-0 flex-1">
                    <a href={`tel:${player.phone.replace(/\s+/g, "")}`} className="text-club-primary hover:underline">{player.phone}</a>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {profile?.notes && (
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-neutral-500">Other notes</p>
              <p className="whitespace-pre-wrap text-sm">{profile.notes}</p>
            </div>
          )}

          {profile?.updated_at && (
            <p className="text-[11px] text-neutral-500">
              Last updated {new Date(profile.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              {profile.updated_by ? ` by ${profile.updated_by}` : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title, fields, profile,
}: {
  title: string;
  fields: { key: keyof MedicalProfileInput; label: string }[];
  profile: DbPlayerMedicalProfile | null;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500">{title}</p>
      <dl className="space-y-1.5 text-sm">
        {fields.map(({ key, label }) => {
          const value = profile?.[key] as string | null | undefined;
          return (
            <div key={key} className="flex gap-2">
              <dt className="w-36 shrink-0 text-neutral-500">{label}</dt>
              <dd className={`min-w-0 flex-1 whitespace-pre-wrap ${value ? "" : "text-neutral-500"}`}>
                {value || "Not recorded"}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
