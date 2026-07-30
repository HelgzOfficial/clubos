"use client";

import { useState, type FormEvent } from "react";
import { X, Check, AlertCircle } from "lucide-react";
import { updatePlayer, type DbPlayer } from "@/lib/players-db";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { COUNTRIES, flagEmoji } from "@/lib/countries";

// Lets a player maintain their own contact details and photo from the
// companion app.
//
// Deliberately limited: name, squad number, position and availability stay
// club-controlled (they affect selection and the medical record), and email is
// left out because it's the address the magic-link sign-in matches on — a
// player changing it here would lock themselves out of the app.
export function EditDetailsModal({
  player, onClose, onSaved,
}: {
  player: DbPlayer;
  onClose: () => void;
  onSaved: (updated: Partial<DbPlayer>) => void;
}) {
  const [phone, setPhone] = useState(player.phone ?? "");
  const [nationality, setNationality] = useState(player.nationality ?? "");
  const [dob, setDob] = useState(player.dob ?? "");
  const [photoUrl, setPhotoUrl] = useState(player.photo_url);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await updatePlayer(player.id, { phone, nationality, dob });
      onSaved({ phone: phone.trim() || null, nationality, dob: dob || null, photo_url: photoUrl });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-card border border-white/10 bg-navy-700 dark:bg-navy-900 p-4 shadow-softDark">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-medium">My Details</p>
          <button onClick={onClose} className="text-neutral-400 hover:text-white"><X size={18} /></button>
        </div>

        <div className="mb-4 flex flex-col items-center gap-2">
          <div className="h-24 w-24">
            <PlayerAvatar
              playerId={player.id}
              initials={player.initials}
              photoUrl={photoUrl}
              size="lg"
              editable
              onPhotoChanged={(url) => setPhotoUrl(url)}
            />
          </div>
          <p className="text-[11px] text-neutral-500">Tap the photo to change it</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-500">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07…"
              className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-500">Nationality</label>
            <select
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
            >
              <option value="">Not set</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.name}>{flagEmoji(c.code)} {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-500">Date of birth</label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
            />
          </div>

          <p className="rounded-xl border border-white/10 bg-navy-600/50 dark:bg-navy-800/50 p-2.5 text-[11px] text-neutral-400">
            Your name, squad number, position and availability are managed by the club. Ask a coach if any of those need changing.
          </p>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              <AlertCircle size={15} className="mt-0.5 shrink-0" /><p>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-club-primary text-navy-950 px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            <Check size={15} /> {saving ? "Saving…" : "Save Details"}
          </button>
        </form>
      </div>
    </div>
  );
}
