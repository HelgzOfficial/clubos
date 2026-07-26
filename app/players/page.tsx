"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { fetchPlayers, createPlayer, POSITION_OPTIONS, type DbPlayer, type PositionGroup } from "@/lib/players-db";
import { supabaseConfigured } from "@/lib/supabase";
import { usePermissions } from "@/lib/permissions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, X, AlertCircle } from "lucide-react";

const statusVariant = { green: "green", amber: "amber", red: "red" } as const;
const groupOrder: PositionGroup[] = ["GK", "DEF", "MID", "FWD"];
const groupLabel: Record<PositionGroup, string> = { GK: "Goalkeepers", DEF: "Defenders", MID: "Midfielders", FWD: "Forwards" };

export default function PlayersPage() {
  const { role, appUser, canWrite } = usePermissions();
  const canEdit = canWrite("players");
  const router = useRouter();
  // A player's own login only ever needs their own profile — send them
  // straight there instead of the full squad list.
  useEffect(() => {
    if (role === "player" && appUser?.player_id) {
      router.replace(`/players/${appUser.player_id}`);
    }
  }, [role, appUser?.player_id, router]);

  const [players, setPlayers] = useState<DbPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const [name, setName] = useState("");
  const [squadNumber, setSquadNumber] = useState("");
  const [positionLabel, setPositionLabel] = useState(POSITION_OPTIONS[0].label);
  const [nationality, setNationality] = useState("");
  const [dob, setDob] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchPlayers();
      setPlayers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load players.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || !squadNumber) {
      setFormError("Name and squad number are required.");
      return;
    }
    const option = POSITION_OPTIONS.find((o) => o.label === positionLabel) ?? POSITION_OPTIONS[0];
    setSaving(true);
    setFormError("");
    try {
      await createPlayer({
        name: name.trim(),
        squadNumber: Number(squadNumber),
        position: option.label,
        positionGroup: option.group,
        nationality: nationality.trim(),
        dob,
        pitchX: 50,
        pitchY: 50,
        email: email.trim(),
        phone: phone.trim(),
      });
      setShowAdd(false);
      setName("");
      setSquadNumber("");
      setNationality("");
      setDob("");
      setEmail("");
      setPhone("");
      setPositionLabel(POSITION_OPTIONS[0].label);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Couldn't add player.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Players</h1>
          <p className="text-sm text-neutral-500">{players.length} players in the first-team squad.</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-xl bg-club-primary text-navy-950 px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={15} /> Add Player
          </button>
        )}
      </div>

      {!supabaseConfigured && (
        <Card className="mb-6 flex items-start gap-3 border-amber-500/30 bg-amber-500/10">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-300" />
          <p className="text-sm text-amber-200">
            Supabase isn&apos;t connected on this deployment yet, so players can&apos;t be loaded or saved here.
          </p>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-neutral-400">Loading players…</p>
      ) : error ? (
        <Card className="border-red-500/30 bg-red-500/10">
          <p className="text-sm text-red-300">{error}</p>
        </Card>
      ) : players.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <p className="font-medium">No players yet</p>
          <p className="mt-1 max-w-sm text-sm text-neutral-400">Add your first player to start building the squad.</p>
        </Card>
      ) : (
        <div className="space-y-8">
          {groupOrder.map((group) => {
            const groupPlayers = players.filter((p) => p.position_group === group);
            if (groupPlayers.length === 0) return null;
            return (
              <div key={group}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                  {groupLabel[group]}
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {groupPlayers.map((p) => (
                    <Link key={p.id} href={`/players/${p.id}`}>
                      <Card className="h-full overflow-hidden p-0 hover:shadow-lg transition-shadow cursor-pointer">
                        <div className="relative aspect-[3/4] w-full">
                          <PlayerAvatar playerId={p.id} initials={p.initials} photoUrl={p.photo_url} size="card" />
                          <span className="absolute right-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-lg bg-black/50 px-1.5 text-sm font-bold text-white backdrop-blur-sm">
                            {p.squad_number}
                          </span>
                        </div>
                        <div className="p-3.5">
                          <p className="font-medium truncate">{p.name}</p>
                          <p className="text-xs text-neutral-400">{p.position}</p>
                          <div className="mt-3 flex items-center justify-between">
                            <Badge variant={statusVariant[p.availability]}>
                              {p.availability === "green" ? "Available" : p.availability === "amber" ? "Doubtful" : "Unavailable"}
                            </Badge>
                            <span className="text-xs text-neutral-400">{p.appearances} apps</span>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-sm">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-medium">Add Player</p>
              <button onClick={() => setShowAdd(false)} className="text-neutral-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Full name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-neutral-500">Squad number</label>
                  <input
                    type="number"
                    value={squadNumber}
                    onChange={(e) => setSquadNumber(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-neutral-500">Date of birth</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Position</label>
                <select
                  value={positionLabel}
                  onChange={(e) => setPositionLabel(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                >
                  {POSITION_OPTIONS.map((o) => (
                    <option key={o.label} value={o.label}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Nationality</label>
                <input
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-neutral-500">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="player@example.com"
                    className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-neutral-500">Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="07xxx xxxxxx"
                    className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                  />
                </div>
              </div>
              <p className="text-xs text-neutral-400">Email is used to automatically send calendar invites when treatment is booked.</p>

              {formError && <p className="text-sm text-red-300">{formError}</p>}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-club-primary text-navy-950 px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {saving ? "Adding…" : "Add Player"}
              </button>
            </form>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
