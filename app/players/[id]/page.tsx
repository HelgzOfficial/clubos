"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PitchPosition } from "@/components/pitch-position";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { PlayerMetricsCard } from "@/components/players/player-metrics-card";
import { PlayerGpsCard } from "@/components/players/gps-card";
import {
  fetchPlayer, updatePlayer, deletePlayer, updatePlayerStats, updatePlayerPositions, POSITION_OPTIONS,
  type DbPlayer, type Availability, type PitchPoint,
} from "@/lib/players-db";
import { syncPlayerStatsFromMatches } from "@/lib/player-stats-sync";
import { PITCH_ROLES, PITCH_ROLE_GROUPS, findPitchRole } from "@/lib/pitch-positions";
import { COUNTRIES, getCountryFlag, flagEmoji } from "@/lib/countries";
import Link from "next/link";
import { ArrowLeft, FileText, Film, Pencil, Trash2, Check, X, RefreshCw, Mail, Phone, Plus } from "lucide-react";
import { PlayerMedicalProfile } from "@/components/medical/player-medical-profile";
import { usePermissions } from "@/lib/permissions";

const statusVariant = { green: "green", amber: "amber", red: "red" } as const;
const AVAILABILITY_OPTIONS: Availability[] = ["green", "amber", "red"];

function formatDob(iso: string | null) {
  if (!iso) return "Not set";
  const dob = new Date(iso);
  const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
  return `${dob.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} (age ${age})`;
}

export default function PlayerProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const { can, canWrite, appUser } = usePermissions();
  const canSeeMedical = can("medical");
  const [player, setPlayer] = useState<DbPlayer | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [squadNumber, setSquadNumber] = useState("");
  const [positionLabel, setPositionLabel] = useState(POSITION_OPTIONS[0].label);
  const [nationality, setNationality] = useState("");
  const [dob, setDob] = useState("");
  const [passportName, setPassportName] = useState("");
  const [availability, setAvailability] = useState<Availability>("green");
  const [availabilityNote, setAvailabilityNote] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  async function load() {
    const p = await fetchPlayer(params.id);
    setPlayer(p);
    if (p) {
      setName(p.name);
      setSquadNumber(String(p.squad_number));
      setPositionLabel(p.position);
      setNationality(p.nationality);
      setDob(p.dob ?? "");
      setPassportName(p.passport_name ?? "");
      setAvailability(p.availability);
      setAvailabilityNote(p.availability_note);
      setEmail(p.email ?? "");
      setPhone(p.phone ?? "");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!player) return;
    const option = POSITION_OPTIONS.find((o) => o.label === positionLabel) ?? POSITION_OPTIONS[0];
    setSaving(true);
    setError("");
    try {
      const updated = await updatePlayer(player.id, {
        name: name.trim(),
        squadNumber: Number(squadNumber),
        position: option.label,
        positionGroup: option.group,
        nationality: nationality.trim(),
        dob,
        passportName,
        availability,
        availabilityNote: availabilityNote.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });
      setPlayer(updated);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!player) return;
    if (!window.confirm(`Remove ${player.name} from the squad? This can't be undone.`)) return;
    await deletePlayer(player.id);
    router.push("/players");
  }

  if (player === undefined) {
    return (
      <AppShell>
        <p className="text-sm text-neutral-400">Loading…</p>
      </AppShell>
    );
  }

  if (player === null) {
    return (
      <AppShell>
        <Link href="/players" className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-white">
          <ArrowLeft size={14} /> Back to Players
        </Link>
        <Card>
          <p className="text-sm text-neutral-400">This player couldn&apos;t be found — they may have been removed.</p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link href="/players" className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-white">
        <ArrowLeft size={14} /> Back to Players
      </Link>

      {!editing ? (
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <PlayerAvatar
              playerId={player.id}
              initials={player.initials}
              photoUrl={player.photo_url}
              size="lg"
              editable
              onPhotoChanged={(url) => setPlayer((prev) => (prev ? { ...prev, photo_url: url } : prev))}
            />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-semibold">{player.name}</h1>
              <p className="truncate text-sm text-neutral-500">
                #{player.squad_number} · {player.position}
                {player.nationality ? ` · ${getCountryFlag(player.nationality)} ${player.nationality}` : ""}
              </p>
              <p className="mt-0.5 text-xs text-neutral-400">Click the photo to add or change a headshot</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
            {(player.email || player.phone) && (
              <div className="min-w-0 shrink-0 space-y-1 text-xs text-neutral-400">
                {player.email && (
                  <p className="flex items-center gap-1.5">
                    <Mail size={12} className="shrink-0" /> <span className="truncate">{player.email}</span>
                  </p>
                )}
                {player.phone && (
                  <p className="flex items-center gap-1.5">
                    <Phone size={12} className="shrink-0" /> {player.phone}
                  </p>
                )}
              </div>
            )}
            <Badge variant={statusVariant[player.availability]} className="shrink-0">{player.availability_note}</Badge>
            <button
              onClick={() => setEditing(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors"
            >
              <Pencil size={14} /> Edit
            </button>
            <button
              onClick={handleDelete}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-red-500/30 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>
      ) : (
        <Card className="mb-6">
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Full name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Squad number</label>
                <input type="number" value={squadNumber} onChange={(e) => setSquadNumber(e.target.value)} className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Position</label>
                <select value={positionLabel} onChange={(e) => setPositionLabel(e.target.value)} className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30">
                  {POSITION_OPTIONS.map((o) => <option key={o.label} value={o.label}>{o.label}</option>)}
                </select>
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
                <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Passport name</label>
                <input
                  value={passportName}
                  onChange={(e) => setPassportName(e.target.value)}
                  placeholder="Leave blank if it's the same as above"
                  className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                />
                <p className="mt-1 text-[11px] text-neutral-500">
                  The full name exactly as it appears on their passport — what registration and team sheets need.
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Availability</label>
                <select value={availability} onChange={(e) => setAvailability(e.target.value as Availability)} className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30">
                  {AVAILABILITY_OPTIONS.map((a) => (
                    <option key={a} value={a}>{a === "green" ? "Available" : a === "amber" ? "Doubtful" : "Unavailable"}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Availability note</label>
                <input value={availabilityNote} onChange={(e) => setAvailabilityNote(e.target.value)} className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="player@example.com" className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Phone</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xxx xxxxxx" className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
              </div>
            </div>
            <p className="text-xs text-neutral-400">
              Email is used to automatically send calendar invites when treatment is booked, and lets this player sign
              into the Player Portal (at /portal) with a one-tap login link — no password needed, and no extra setup
              once it&apos;s saved here.
            </p>

            {error && <p className="text-sm text-red-300">{error}</p>}

            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="flex items-center gap-1.5 rounded-xl bg-club-primary text-navy-950 px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60">
                <Check size={14} /> {saving ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2 text-sm text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors">
                <X size={14} /> Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <PositionCard player={player} onChanged={(p) => setPlayer(p)} />

        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Player Info</CardTitle></CardHeader>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 text-sm">
              <div>
                <p className="text-xs text-neutral-400">Date of Birth</p>
                <p className="font-medium">{formatDob(player.dob)}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-400">Nationality</p>
                <p className="font-medium truncate">
                  {player.nationality ? `${getCountryFlag(player.nationality)} ${player.nationality}` : "Not set"}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-400">Squad Number</p>
                <p className="font-medium">#{player.squad_number}</p>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <p className="text-xs text-neutral-400">Passport Name</p>
                <p className="font-medium">
                  {player.passport_name || <span className="text-neutral-500">Same as above</span>}
                </p>
              </div>
            </div>
          </Card>

          <SeasonStatsCard player={player} onChanged={(p) => setPlayer(p)} />

          <PlayerMetricsCard playerId={player.id} />

          {/* Renders nothing until a GPS report has been imported for them. */}
          <PlayerGpsCard playerId={player.id} />
        </div>

        <Card>
          <CardHeader><CardTitle>Injury History</CardTitle></CardHeader>
          {player.injury_history.length === 0 ? (
            <p className="text-sm text-neutral-400">No recorded injuries this season.</p>
          ) : (
            <ul className="space-y-2.5">
              {player.injury_history.map((inj, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{inj.injury}</p>
                    <p className="text-xs text-neutral-400">{inj.date}</p>
                  </div>
                  <span className="text-xs text-neutral-400">{inj.daysOut} days out</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
          {player.documents.length === 0 ? (
            <p className="text-sm text-neutral-400">No documents on file.</p>
          ) : (
            <ul className="space-y-2.5">
              {player.documents.map((doc) => (
                <li key={doc.name} className="flex items-center gap-2.5 text-sm">
                  <FileText size={15} className="text-neutral-400 shrink-0" />
                  <span className="truncate">{doc.name}</span>
                  <Badge variant="neutral" className="ml-auto shrink-0">{doc.type}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Only rendered for medical staff and senior management. The
            database won't return the row to anyone else either, so this isn't
            the only thing standing between a player's medical history and the
            rest of the squad — see supabase-player-medical-profiles.sql. */}
        {canSeeMedical && (
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Emergency &amp; Medical</CardTitle></CardHeader>
            <PlayerMedicalProfile
              player={player}
              canEdit={canWrite("medical")}
              editorName={appUser?.name ?? null}
              onPlayerChanged={load}
            />
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Clips</CardTitle></CardHeader>
          {player.clips.length === 0 ? (
            <p className="text-sm text-neutral-400">No clips tagged yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {player.clips.map((clip) => (
                <li key={clip.title} className="flex items-center gap-2.5 text-sm">
                  <Film size={15} className="text-neutral-400 shrink-0" />
                  <span className="truncate flex-1">{clip.title}</span>
                  <span className="text-xs text-neutral-400 shrink-0">{clip.duration}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

function PositionCard({ player, onChanged }: { player: DbPlayer; onChanged: (p: DbPlayer) => void }) {
  const savedPositions: PitchPoint[] =
    player.pitch_positions && player.pitch_positions.length > 0
      ? player.pitch_positions
      : [{ x: player.pitch_x, y: player.pitch_y }];

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PitchPoint[]>(savedPositions);
  const [roleToAdd, setRoleToAdd] = useState(PITCH_ROLES[0].code);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function startEdit() {
    setDraft(savedPositions);
    setError("");
    setEditing(true);
  }

  function handleAddRole() {
    const role = findPitchRole(roleToAdd);
    if (!role) return;
    if (draft.some((p) => p.code === role.code)) return; // already added
    setDraft([...draft, { code: role.code, x: role.x, y: role.y }]);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const updated = await updatePlayerPositions(player.id, draft);
      onChanged(updated);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save positions.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <CardTitle>Position{(editing ? draft : savedPositions).length > 1 ? "s" : ""}</CardTitle>
        {!editing && (
          <button
            onClick={startEdit}
            title="Edit positions"
            className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white"
          >
            <Pencil size={13} />
          </button>
        )}
      </div>

      <PitchPosition
        positions={editing ? draft : savedPositions}
        isGoalkeeper={player.position_group === "GK"}
        squadNumber={player.squad_number}
        editable={editing}
        onChange={setDraft}
      />

      {editing && (
        <>
          <div className="mt-3 flex gap-2">
            <select
              value={roleToAdd}
              onChange={(e) => setRoleToAdd(e.target.value)}
              className="flex-1 rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
            >
              {PITCH_ROLE_GROUPS.map((g) => (
                <optgroup key={g.group} label={g.label}>
                  {PITCH_ROLES.filter((r) => r.group === g.group).map((r) => (
                    <option key={r.code} value={r.code}>{r.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddRole}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors"
            >
              <Plus size={14} /> Add
            </button>
          </div>
          <p className="mt-1.5 text-xs text-neutral-400">
            Pick a role and click Add to place it accurately on the pitch (RB/RWB and LB/LWB share the same spot, as a
            full-back and wing-back play the same width). You can also click directly on the pitch for a custom spot,
            or click any shirt to remove it.
          </p>
          <div className="mt-3 flex gap-2">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 rounded-xl bg-club-primary text-navy-950 px-3 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60">
              <Check size={13} /> {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-sm text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors">
              <X size={13} /> Cancel
            </button>
          </div>
        </>
      )}
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </Card>
  );
}

function SeasonStatsCard({ player, onChanged }: { player: DbPlayer; onChanged: (p: DbPlayer) => void }) {
  const showCleanSheets = player.position_group === "GK" || player.position_group === "DEF";

  const [editing, setEditing] = useState(false);
  const [appearances, setAppearances] = useState(String(player.appearances));
  const [goals, setGoals] = useState(String(player.goals));
  const [assists, setAssists] = useState(String(player.assists));
  const [cleanSheets, setCleanSheets] = useState(String(player.clean_sheets));
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  function startEdit() {
    setAppearances(String(player.appearances));
    setGoals(String(player.goals));
    setAssists(String(player.assists));
    setCleanSheets(String(player.clean_sheets));
    setError("");
    setNote("");
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await updatePlayerStats(player.id, {
        appearances: Number(appearances) || 0,
        goals: Number(goals) || 0,
        assists: Number(assists) || 0,
        cleanSheets: Number(cleanSheets) || 0,
      });
      onChanged({
        ...player,
        appearances: Number(appearances) || 0,
        goals: Number(goals) || 0,
        assists: Number(assists) || 0,
        clean_sheets: Number(cleanSheets) || 0,
      });
      setEditing(false);
      setNote("Saved. Note: the next automatic sync (after a report import or result entry) recomputes these from match data and will overwrite a manual edit.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save stats.");
    } finally {
      setSaving(false);
    }
  }

  async function handleResync() {
    setSyncing(true);
    setError("");
    setNote("");
    try {
      await syncPlayerStatsFromMatches();
      const fresh = await fetchPlayer(player.id);
      if (fresh) onChanged(fresh);
      setNote("Resynced from completed league/cup fixtures.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't resync stats.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <CardTitle>Season Statistics</CardTitle>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleResync}
            disabled={syncing}
            title="Recompute from completed league/cup fixtures"
            className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white disabled:opacity-60"
          >
            <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
          </button>
          {!editing && (
            <button
              onClick={startEdit}
              title="Edit manually"
              className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white"
            >
              <Pencil size={13} />
            </button>
          )}
        </div>
      </div>

      <p className="mb-3 text-xs text-neutral-400">
        Appearances, goals and assists update automatically from league and cup match reports and results (friendlies never
        count). Clean sheets are tracked for goalkeepers and defenders. You can also enter figures manually below.
      </p>

      {!editing ? (
        <div className={`grid grid-cols-2 gap-4 text-center ${showCleanSheets ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
          <div>
            <p className="text-xl font-semibold">{player.appearances}</p>
            <p className="text-xs text-neutral-400">Appearances</p>
          </div>
          <div>
            <p className="text-xl font-semibold">{player.minutes.toLocaleString()}</p>
            <p className="text-xs text-neutral-400">Minutes</p>
          </div>
          <div>
            <p className="text-xl font-semibold">{player.goals}</p>
            <p className="text-xs text-neutral-400">Goals</p>
          </div>
          <div>
            <p className="text-xl font-semibold">{player.assists}</p>
            <p className="text-xs text-neutral-400">Assists</p>
          </div>
          {showCleanSheets && (
            <div>
              <p className="text-xl font-semibold">{player.clean_sheets}</p>
              <p className="text-xs text-neutral-400">Clean Sheets</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className={`grid grid-cols-2 gap-3 ${showCleanSheets ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-500">Appearances</label>
              <input type="number" min={0} value={appearances} onChange={(e) => setAppearances(e.target.value)} className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-500">Goals</label>
              <input type="number" min={0} value={goals} onChange={(e) => setGoals(e.target.value)} className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-500">Assists</label>
              <input type="number" min={0} value={assists} onChange={(e) => setAssists(e.target.value)} className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
            </div>
            {showCleanSheets && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Clean Sheets</label>
                <input type="number" min={0} value={cleanSheets} onChange={(e) => setCleanSheets(e.target.value)} className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 rounded-xl bg-club-primary text-navy-950 px-3 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60">
              <Check size={13} /> {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-sm text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors">
              <X size={13} /> Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      {note && !error && <p className="mt-2 text-xs text-neutral-400">{note}</p>}
    </Card>
  );
}
