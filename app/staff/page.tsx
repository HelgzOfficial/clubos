"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/lib/permissions";
import { ROLE_LABELS, ALL_ROLES, type AppRole } from "@/lib/permissions";
import { fetchAppUsers, updateAppUserRole, removeAppUser, inviteAppUser } from "@/lib/app-users-db";
import { fetchPlayers, type DbPlayer } from "@/lib/players-db";
import type { AppUserRecord } from "@/lib/permissions";
import { Plus, X, Trash2, Mail, AlertCircle, Check } from "lucide-react";

const roleBadgeVariant: Record<AppRole, "green" | "amber" | "red" | "neutral" | "blue" | "purple"> = {
  owner: "green",
  manager: "green",
  head_coach: "blue",
  goalkeeper_coach: "blue",
  analyst: "blue",
  doctor_physio: "amber",
  player: "neutral",
};

function StaffAvatar({ name }: { name: string }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-600 dark:bg-navy-800 text-xs font-semibold shrink-0">
      {initials}
    </div>
  );
}

export default function StaffPage() {
  const { appUser } = usePermissions();
  const [people, setPeople] = useState<AppUserRecord[]>([]);
  const [players, setPlayers] = useState<DbPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showInvite, setShowInvite] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("head_coach");
  const [playerId, setPlayerId] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [p, pl] = await Promise.all([fetchAppUsers(), fetchPlayers()]);
      setPeople(p);
      setPlayers(pl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the staff list.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    if (role === "player" && !playerId) {
      setFormError("Pick which player profile this invite links to.");
      return;
    }
    setSaving(true);
    setFormError("");
    const result = await inviteAppUser({
      requesterEmail: appUser?.email ?? "",
      name, email, role, playerId: role === "player" ? playerId : null,
    });
    setSaving(false);
    if (!result.ok) {
      setFormError(result.error ?? "Couldn't send the invite.");
      return;
    }
    setSuccess(`Invite sent to ${email}.`);
    setTimeout(() => setSuccess(""), 4000);
    setShowInvite(false);
    setName(""); setEmail(""); setRole("head_coach"); setPlayerId("");
    await load();
  }

  async function handleRoleChange(person: AppUserRecord, newRole: AppRole) {
    await updateAppUserRole(person.id, newRole, newRole === "player" ? person.player_id : null);
    await load();
  }

  async function handleRemove(person: AppUserRecord) {
    if (!window.confirm(`Remove ${person.name}'s access to ClubOS?`)) return;
    await removeAppUser(person.id);
    await load();
  }

  function playerName(id: string | null) {
    if (!id) return null;
    return players.find((p) => p.id === id)?.name ?? "Unknown player";
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Staff & Access</h1>
          <p className="text-sm text-neutral-500">Everyone with a ClubOS login, their role, and what it grants them.</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 rounded-xl bg-club-primary text-navy-950 px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={15} /> Invite Person
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-300">{error}</p>}
      {success && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          <Check size={15} /> {success}
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-sm text-neutral-400">Loading…</p>
        ) : people.length === 0 ? (
          <p className="p-8 text-center text-sm text-neutral-400">Nobody's been invited yet.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {people.map((person) => (
              <li key={person.id} className="flex items-center gap-3 px-5 py-3.5">
                <StaffAvatar name={person.name} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{person.name}</p>
                  <p className="text-xs text-neutral-400 truncate">
                    {person.email}
                    {person.role === "player" && playerName(person.player_id) ? ` · linked to ${playerName(person.player_id)}` : ""}
                  </p>
                </div>
                <Badge variant={person.invite_status === "pending" ? "amber" : "green"}>
                  {person.invite_status === "pending" ? "Invited" : "Active"}
                </Badge>
                <select
                  value={person.role}
                  onChange={(e) => handleRoleChange(person, e.target.value as AppRole)}
                  disabled={person.role === "owner" && person.email.toLowerCase() === (appUser?.email ?? "").toLowerCase()}
                  className="rounded-lg border border-white/10 bg-navy-600 dark:bg-navy-800 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-club-primary/30"
                >
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
                <button onClick={() => handleRemove(person)} className="flex h-8 w-8 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10">
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ALL_ROLES.map((r) => (
          <Card key={r} className="text-xs text-neutral-400">
            <p className="mb-1 font-medium text-white"><Badge variant={roleBadgeVariant[r]} className="mr-1.5">{ROLE_LABELS[r]}</Badge></p>
            {r === "owner" || r === "manager" ? "Full edit access to every module." :
             r === "head_coach" || r === "goalkeeper_coach" || r === "analyst" ? "Can edit Opposition, Analysis, Training and Documents. Read-only everywhere else." :
             r === "doctor_physio" ? "Can edit the Medical module only. Read-only everywhere else." :
             "Sees Dashboard, Opposition, Analysis, Training, their own Players profile, Documents and Calendar. Can download documents/match packs/clips and book their own treatment slots — read-only otherwise."}
          </Card>
        ))}
      </div>

      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-medium">Invite Person</p>
              <button onClick={() => setShowInvite(false)} className="text-neutral-400 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={handleInvite} className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value as AppRole)}
                  className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30">
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              {role === "player" && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-neutral-500">Linked player profile</label>
                  <select value={playerId} onChange={(e) => setPlayerId(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30">
                    <option value="">Select a player…</option>
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {formError && (
                <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" /><p>{formError}</p>
                </div>
              )}
              <button type="submit" disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-club-primary text-navy-950 px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60">
                <Mail size={15} /> {saving ? "Sending…" : "Send Invite"}
              </button>
            </form>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
