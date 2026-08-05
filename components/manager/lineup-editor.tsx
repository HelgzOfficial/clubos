"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { FormationPitch, type PitchOccupant } from "@/components/manager/formation-pitch";
import { fetchPlayers, type DbPlayer } from "@/lib/players-db";
import type { DbMatch } from "@/lib/matches-db";
import { fetchActiveInjuries, type DbInjury } from "@/lib/injuries-db";
import { fetchPlayerAbsences, type DbPlayerAbsence } from "@/lib/player-absences-db";
import { fetchSuspensions, fetchRegistrations, type DbSuspension, type DbRegistration } from "@/lib/manager-db";
import { competitionKind } from "@/lib/competition-kind";
import {
  fetchAvailabilityForMatch, effectiveAvailability, AVAILABILITY_LABEL, AVAILABILITY_TONE, SOURCE_LABEL,
  type DbMatchAvailability,
} from "@/lib/match-availability-db";
import {
  fetchLineup, saveLineup, emptyLineup, FORMATION_NAMES, layoutFor,
  iFasList, teamSheetText, squadListText, slotName, isTrialistSlot, newTrialistId,
  syncLineupToMatchCentre, countMatchCentreLineup,
  type DbLineup, type LineupSlot,
} from "@/lib/lineups-db";
import {
  Check, X, Loader2, Copy, Printer, Mail, ChevronUp, ChevronDown, Star, Send, UserPlus, RefreshCw, Lock, AlertTriangle,
} from "lucide-react";

// The whole team-selection experience — pitch, drag and drop, formation
// dropdown, bench, trialists, outputs — as one component.
//
// It lives here rather than inside the manager page so Match Centre can show
// exactly the same thing for the fixture you're looking at. Two copies of this
// would have drifted apart within a fortnight, and then the manager's team and
// the fixture's team would quietly stop matching.
export function LineupEditor({
  matchId,
  match,
  clubName,
  editorName,
  showOutputs = true,
}: {
  matchId: string;
  match: DbMatch | null;
  clubName: string;
  editorName: string | null;
  showOutputs?: boolean;
}) {
  const [players, setPlayers] = useState<DbPlayer[]>([]);
  const [injuries, setInjuries] = useState<DbInjury[]>([]);
  const [absences, setAbsences] = useState<DbPlayerAbsence[]>([]);
  const [suspensions, setSuspensions] = useState<DbSuspension[]>([]);
  const [registrations, setRegistrations] = useState<DbRegistration[]>([]);
  const [availability, setAvailability] = useState<DbMatchAvailability[]>([]);

  const [lineup, setLineup] = useState<DbLineup | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [syncNote, setSyncNote] = useState("");
  const [copied, setCopied] = useState("");
  const [output, setOutput] = useState<"ifas" | "sheet" | "social">("ifas");
  const [pending, setPending] = useState("");

  const [showTrialist, setShowTrialist] = useState(false);
  const [trialistName, setTrialistName] = useState("");
  const [trialistShirt, setTrialistShirt] = useState("");

  // Squad-wide context loads once; it doesn't change when the fixture does.
  useEffect(() => {
    Promise.allSettled([
      fetchPlayers(), fetchActiveInjuries(), fetchPlayerAbsences(), fetchSuspensions(), fetchRegistrations(),
    ]).then(([p, inj, abs, sus, reg]) => {
      if (p.status === "fulfilled") setPlayers(p.value);
      if (inj.status === "fulfilled") setInjuries(inj.value);
      if (abs.status === "fulfilled") setAbsences(abs.value);
      if (sus.status === "fulfilled") setSuspensions(sus.value);
      // Registrations are their own table and may not be set up yet. If the
      // fetch fails we deliberately end up with an empty list, which means
      // nobody is treated as unregistered — refusing to pick a whole squad
      // because a table is missing would be a far worse failure.
      if (reg.status === "fulfilled") setRegistrations(reg.value);
    });
  }, []);

  const loadLineup = useCallback(async (id: string) => {
    if (!id) return;
    setError("");
    setSyncNote("");
    try {
      setLineup((await fetchLineup(id)) ?? emptyLineup(id));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        /relation|does not exist|schema cache/i.test(msg)
          ? "Line-ups aren't set up yet — run supabase-match-lineups.sql in Supabase."
          : msg || "Couldn't load that line-up."
      );
      setLineup(emptyLineup(id));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLineup(matchId); }, [matchId, loadLineup]);

  useEffect(() => {
    if (!matchId) return;
    fetchAvailabilityForMatch(matchId).then(setAvailability).catch(() => setAvailability([]));
  }, [matchId]);

  const selectedIds = useMemo(() => {
    if (!lineup) return new Set<string>();
    return new Set([...lineup.starters, ...lineup.subs].map((s) => s.playerId));
  }, [lineup]);

  function update(patch: Partial<DbLineup>) {
    setLineup((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  // League rules cap the bench at five. Cups and friendlies vary by
  // competition, so those are left uncapped rather than guessed at.
  const isLeague = match ? competitionKind(match.competition) === "league" : false;
  const maxSubs = isLeague ? 5 : null;
  const benchFull = maxSubs !== null && lineup !== null && lineup.subs.length >= maxSubs;

  // Who can't be picked, and why. Suspensions, injuries and booked time off
  // all arrive through effectiveAvailability; registration is separate,
  // because an unregistered player is ineligible regardless of how fit and
  // willing he is.
  type Block = { blocked: boolean; reason: string };
  function eligibility(playerId: string): Block {
    const reg = registrations.find((r) => r.player_id === playerId);
    if (reg && reg.registered === false) {
      return { blocked: true, reason: "Not registered" };
    }
    if (!match) return { blocked: false, reason: "" };

    const eff = effectiveAvailability(playerId, match, {
      reply: availability.find((a) => a.player_id === playerId),
      injuries, suspensions, absences,
    });
    if (eff.status === "unavailable") {
      return { blocked: true, reason: eff.detail || SOURCE_LABEL[eff.source] || "Unavailable" };
    }
    return { blocked: false, reason: "" };
  }

  // Anyone already in the side who has since become ineligible. Selections are
  // saved days ahead of a fixture, and an injury or a suspension landing on
  // the Thursday shouldn't sit silently in a published team.
  const ineligibleSelected = useMemo(() => {
    if (!lineup) return [] as { playerId: string; reason: string }[];
    return [...lineup.starters, ...lineup.subs]
      .filter((s) => !isTrialistSlot(s))
      .map((s) => ({ playerId: s.playerId, ...eligibility(s.playerId) }))
      .filter((x) => x.blocked)
      .map((x) => ({ playerId: x.playerId, reason: x.reason }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineup, registrations, availability, injuries, suspensions, absences, match]);

  const layout = useMemo(() => layoutFor(lineup?.formation ?? "4-4-2"), [lineup?.formation]);

  // The pitch and the XI list are two views of the same array. A starter's
  // `position` is the slot code, so the mapping survives saving and reloading
  // and doesn't depend on array order.
  const occupants: (PitchOccupant | null)[] = useMemo(() => {
    if (!lineup) return layout.map(() => null);
    const taken = new Set<string>();
    return layout.map((slot) => {
      const s = lineup.starters.find((x) => x.position === slot.code && !taken.has(x.playerId));
      if (!s) return null;
      taken.add(s.playerId);
      const p = players.find((x) => x.id === s.playerId);
      return {
        playerId: s.playerId,
        name: slotName(players, s),
        squadNumber: s.shirt ?? p?.squad_number ?? null,
        isCaptain: lineup.captain_id === s.playerId,
        isTrialist: isTrialistSlot(s),
      };
    });
  }, [lineup, layout, players]);

  function firstFreeCode(l: DbLineup): string | null {
    const used = new Set(l.starters.map((s) => s.position));
    return layoutFor(l.formation).find((s) => !used.has(s.code))?.code ?? null;
  }

  function assignToSlot(code: string, playerId: string, fromCode?: string) {
    if (!lineup || !playerId) return;

    // Moving someone already in the side around the pitch is always allowed —
    // the check is on bringing a new player in.
    const alreadyIn = lineup.starters.some((s) => s.playerId === playerId) || lineup.subs.some((s) => s.playerId === playerId);
    if (!alreadyIn) {
      const check = eligibility(playerId);
      if (check.blocked) {
        const p = players.find((x) => x.id === playerId);
        setError(`${p?.name ?? "That player"} can't be selected — ${check.reason.toLowerCase()}.`);
        setPending("");
        return;
      }
    }

    const order = new Map(layout.map((s, i) => [s.code, i]));
    const player = players.find((p) => p.id === playerId);
    const occupant = lineup.starters.find((s) => s.position === code && s.playerId !== playerId);

    let next = lineup.starters.filter((s) => s.playerId !== playerId);
    if (occupant) {
      next = fromCode
        ? next.map((s) => (s.playerId === occupant.playerId ? { ...s, position: fromCode } : s))
        : next.filter((s) => s.playerId !== occupant.playerId);
    }
    const existing =
      lineup.starters.find((s) => s.playerId === playerId) ?? lineup.subs.find((s) => s.playerId === playerId);
    next = [...next, existing ? { ...existing, position: code } : { playerId, position: code, shirt: player?.squad_number ?? null }];
    next.sort((a, b) => (order.get(a.position) ?? 99) - (order.get(b.position) ?? 99));

    const evicted = occupant && !fromCode ? occupant.playerId : null;
    update({
      starters: next,
      subs: lineup.subs.filter((s) => s.playerId !== playerId),
      captain_id: lineup.captain_id === evicted ? null : lineup.captain_id,
    });
    setPending("");
  }

  function handleTapSlot(code: string) {
    if (!lineup) return;
    if (pending) {
      const fromCode = lineup.starters.find((s) => s.playerId === pending)?.position;
      assignToSlot(code, pending, fromCode);
      return;
    }
    const who = lineup.starters.find((s) => s.position === code);
    setPending(who ? who.playerId : "");
  }

  function changeFormation(formation: string) {
    if (!lineup) return;
    const nextLayout = layoutFor(formation);
    const ordered = [...lineup.starters].sort(
      (a, b) =>
        (layout.findIndex((s) => s.code === a.position) + 1 || 99) -
        (layout.findIndex((s) => s.code === b.position) + 1 || 99)
    );
    update({ formation, starters: ordered.map((s, i) => ({ ...s, position: nextLayout[i]?.code ?? s.position })) });
  }

  function addStarter(player: DbPlayer) {
    if (!lineup || lineup.starters.length >= 11) return;
    const code = firstFreeCode(lineup);
    if (!code) return;
    assignToSlot(code, player.id);
  }

  function addSub(player: DbPlayer) {
    if (!lineup) return;
    const check = eligibility(player.id);
    if (check.blocked) {
      setError(`${player.name} can't be selected — ${check.reason.toLowerCase()}.`);
      return;
    }
    if (maxSubs !== null && lineup.subs.length >= maxSubs) {
      setError(`League fixtures allow a maximum of ${maxSubs} substitutes — take one off the bench first.`);
      return;
    }
    setError("");
    setPending((prev) => (prev === player.id ? "" : prev));
    update({ subs: [...lineup.subs, { playerId: player.id, position: "SUB", shirt: player.squad_number }] });
  }

  // Someone on trial, with no player record. Nothing is written to the players
  // table — a lad on a week's look shouldn't turn up in registrations,
  // contracts or the season's appearance stats.
  function addTrialist(toXI: boolean) {
    if (!lineup) return;
    const name = trialistName.trim();
    if (!name) return;
    const shirt = trialistShirt.trim() === "" ? null : Number(trialistShirt);
    const slot: LineupSlot = {
      playerId: newTrialistId(),
      position: toXI ? "" : "SUB",
      shirt: shirt !== null && Number.isFinite(shirt) ? shirt : null,
      name,
      isTrialist: true,
    };
    if (toXI) {
      const code = firstFreeCode(lineup);
      if (!code) {
        setError("The XI is full — take someone out first, or add the trialist to the bench.");
        return;
      }
      const order = new Map(layout.map((sl, i) => [sl.code, i]));
      const next = [...lineup.starters, { ...slot, position: code }];
      next.sort((a, b) => (order.get(a.position) ?? 99) - (order.get(b.position) ?? 99));
      update({ starters: next });
    } else {
      if (maxSubs !== null && lineup.subs.length >= maxSubs) {
        setError(`League fixtures allow a maximum of ${maxSubs} substitutes — take one off the bench first.`);
        return;
      }
      update({ subs: [...lineup.subs, slot] });
    }
    setTrialistName("");
    setTrialistShirt("");
    setShowTrialist(false);
    setError("");
  }

  function removeSlot(playerId: string) {
    if (!lineup) return;
    setPending((prev) => (prev === playerId ? "" : prev));
    update({
      starters: lineup.starters.filter((s) => s.playerId !== playerId),
      subs: lineup.subs.filter((s) => s.playerId !== playerId),
      captain_id: lineup.captain_id === playerId ? null : lineup.captain_id,
    });
  }

  // Moving up or down the list swaps the two players' slots on the pitch too,
  // so the list and the diagram never disagree.
  function moveStarter(index: number, delta: -1 | 1) {
    if (!lineup) return;
    const next = [...lineup.starters];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const a = next[index];
    const b = next[target];
    next[index] = { ...b, position: a.position };
    next[target] = { ...a, position: b.position };
    update({ starters: next });
  }

  async function handleSave(publish: boolean) {
    if (!lineup) return;

    // Publishing overwrites whatever the fixture currently holds. Ask first,
    // but only when there's something there to lose.
    if (publish) {
      try {
        const existing = await countMatchCentreLineup(lineup.match_id);
        if (existing > 0) {
          const ok = window.confirm(
            `This fixture already lists ${existing} ${existing === 1 ? "player" : "players"}.\n\n` +
              "Publishing replaces that list with this selection. Continue?"
          );
          if (!ok) return;
        }
      } catch {
        /* a failed count shouldn't block a publish */
      }
    }

    setSaving(true);
    setError("");
    setSyncNote("");
    try {
      const saved = await saveLineup(
        { ...lineup, published_at: publish ? new Date().toISOString() : lineup.published_at },
        editorName
      );
      const next = { ...saved, starters: saved.starters ?? [], subs: saved.subs ?? [] };
      setLineup(next);
      if (publish) {
        const written = await syncLineupToMatchCentre(next, players);
        setSyncNote(
          `Published. ${written} ${written === 1 ? "name is" : "names are"} now on this fixture — Match Centre, the ` +
            "players' companion and the analysis pages all read the same list."
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the line-up.");
    } finally {
      setSaving(false);
    }
  }

  // Re-push without changing the published timestamp, for when the fixture has
  // been edited by hand and drifted.
  async function pushToFixture() {
    if (!lineup) return;
    setSaving(true);
    setError("");
    setSyncNote("");
    try {
      const written = await syncLineupToMatchCentre(lineup, players);
      setSyncNote(`${written} ${written === 1 ? "name" : "names"} pushed to the fixture.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't push this to the fixture.");
    } finally {
      setSaving(false);
    }
  }

  const outputText = useMemo(() => {
    if (!lineup || !match) return "";
    if (output === "ifas") return iFasList(lineup, players);
    if (output === "sheet") return teamSheetText(lineup, players, match, clubName);
    return squadListText(lineup, players, match, clubName);
  }, [lineup, match, players, clubName, output]);

  async function copyOutput() {
    try {
      await navigator.clipboard.writeText(outputText);
      setCopied(output);
      setTimeout(() => setCopied(""), 2500);
    } catch {
      setError("Couldn't copy — select the text and copy it manually.");
    }
  }

  if (loading || !lineup) return <p className="text-sm text-neutral-400">Loading…</p>;

  const available = players.filter((p) => !selectedIds.has(p.id));

  return (
    <div className="space-y-5">
      {error && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <p className="text-sm text-amber-200">{error}</p>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-medium text-neutral-400">Formation</label>
          <select
            value={lineup.formation}
            onChange={(e) => changeFormation(e.target.value)}
            className="rounded-lg border border-white/10 bg-navy-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
          >
            {FORMATION_NAMES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          {lineup.published_at && <Badge variant="green">Published to squad</Badge>}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Starting XI</CardTitle>
            <span className="text-sm tabular-nums text-neutral-400">{lineup.starters.length}/11</span>
          </CardHeader>

          {ineligibleSelected.length > 0 && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">
                  {ineligibleSelected.length === 1 ? "A selected player is" : `${ineligibleSelected.length} selected players are`} no longer eligible.
                </p>
                <ul className="mt-1 space-y-0.5">
                  {ineligibleSelected.map((x) => (
                    <li key={x.playerId}>
                      {players.find((p) => p.id === x.playerId)?.name ?? "Unknown player"} — {x.reason}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-red-300/70">
                  This happens when something changes after a side is picked. Take them out before publishing.
                </p>
              </div>
            </div>
          )}

          <div className="mb-4">
            <FormationPitch
              layout={layout}
              occupants={occupants}
              pendingName={pending ? players.find((p) => p.id === pending)?.name : undefined}
              onAssign={assignToSlot}
              onTapSlot={handleTapSlot}
              onClear={removeSlot}
            />
          </div>

          {lineup.starters.length === 0 ? (
            <p className="text-sm text-neutral-400">Drag players from the squad onto the pitch to build the XI.</p>
          ) : (
            <ul className="divide-y divide-white/10">
              {lineup.starters.map((s, i) => {
                const p = players.find((x) => x.id === s.playerId);
                return (
                  <li key={s.playerId} className="flex items-center gap-2 py-2">
                    <span className="w-5 shrink-0 text-xs tabular-nums text-neutral-500">{i + 1}</span>
                    {p && <PlayerAvatar playerId={p.id} initials={p.initials} photoUrl={p.photo_url} size="sm" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {slotName(players, s)}
                        {lineup.captain_id === s.playerId && <span className="text-club-primary"> (C)</span>}
                        {isTrialistSlot(s) && (
                          <span className="ml-1.5 rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-300">
                            Trialist
                          </span>
                        )}
                      </p>
                      <select
                        value={s.position}
                        onChange={(e) => assignToSlot(e.target.value, s.playerId, s.position)}
                        className="mt-0.5 w-20 rounded border border-white/10 bg-navy-600 px-1.5 py-0.5 text-[11px] outline-none dark:bg-navy-800"
                      >
                        {!layout.some((l) => l.code === s.position) && (
                          <option value={s.position}>{s.position || "—"}</option>
                        )}
                        {layout.map((l) => <option key={l.code} value={l.code}>{l.code}</option>)}
                      </select>
                    </div>
                    <button
                      onClick={() => update({ captain_id: lineup.captain_id === s.playerId ? null : s.playerId })}
                      title="Captain"
                      className={`flex h-7 w-7 shrink-0 touch-manipulation items-center justify-center rounded-full ${
                        lineup.captain_id === s.playerId ? "text-club-primary" : "text-neutral-500 hover:text-white"
                      }`}
                    >
                      <Star size={13} />
                    </button>
                    <span className="flex shrink-0 flex-col">
                      <button onClick={() => moveStarter(i, -1)} className="touch-manipulation text-neutral-500 hover:text-white"><ChevronUp size={13} /></button>
                      <button onClick={() => moveStarter(i, 1)} className="touch-manipulation text-neutral-500 hover:text-white"><ChevronDown size={13} /></button>
                    </span>
                    <button
                      onClick={() => removeSlot(s.playerId)}
                      className="flex h-7 w-7 shrink-0 touch-manipulation items-center justify-center rounded-full text-red-400 hover:bg-red-500/10"
                    >
                      <X size={13} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Substitutes ({lineup.subs.length}{maxSubs !== null ? `/${maxSubs}` : ""})
            {benchFull && <span className="ml-1.5 normal-case text-amber-300">bench full</span>}
          </p>
          {lineup.subs.length === 0 ? (
            <p className="text-sm text-neutral-400">No substitutes named.</p>
          ) : (
            <ul className="divide-y divide-white/10">
              {lineup.subs.map((s, i) => {
                const p = players.find((x) => x.id === s.playerId);
                return (
                  <li key={s.playerId} className="flex items-center gap-2 py-2">
                    <span className="w-5 shrink-0 text-xs tabular-nums text-neutral-500">{i + 1}</span>
                    {p && <PlayerAvatar playerId={p.id} initials={p.initials} photoUrl={p.photo_url} size="sm" />}
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {slotName(players, s)}
                      {isTrialistSlot(s) && (
                        <span className="ml-1.5 rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-300">
                          Trialist
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => removeSlot(s.playerId)}
                      className="flex h-7 w-7 shrink-0 touch-manipulation items-center justify-center rounded-full text-red-400 hover:bg-red-500/10"
                    >
                      <X size={13} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <textarea
            value={lineup.notes ?? ""}
            onChange={(e) => update({ notes: e.target.value })}
            rows={2}
            placeholder="Notes for the team sheet (optional)"
            className="mt-4 w-full rounded-lg border border-white/10 bg-navy-600 px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30 dark:bg-navy-800"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="flex touch-manipulation items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-200 hover:bg-navy-600 disabled:opacity-60 dark:hover:bg-navy-800"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save draft
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving || lineup.starters.length === 0}
              className="flex touch-manipulation items-center gap-1.5 rounded-xl bg-club-primary px-3 py-2 text-sm font-medium text-navy-950 disabled:opacity-60"
            >
              <Send size={14} /> Publish to squad
            </button>
            {lineup.published_at && (
              <button
                onClick={pushToFixture}
                disabled={saving || lineup.starters.length === 0}
                title="Write this selection to the fixture again"
                className="flex touch-manipulation items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-200 hover:bg-navy-600 disabled:opacity-60 dark:hover:bg-navy-800"
              >
                <RefreshCw size={14} /> Re-push to fixture
              </button>
            )}
          </div>

          {syncNote && (
            <div className="mt-2 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-300">
              <Check size={13} className="mt-0.5 shrink-0" />
              <p>{syncNote}</p>
            </div>
          )}

          <p className="mt-2 text-xs text-neutral-500">
            A draft is yours alone. Publishing makes it visible to players and writes the XI and bench onto the fixture
            itself, so Match Centre, the companion and the analysis pages all show the same team.
          </p>
        </Card>

        {/* Squad */}
        <Card>
          <CardHeader>
            <CardTitle>Squad</CardTitle>
            <button
              onClick={() => { setShowTrialist((v) => !v); setError(""); }}
              className="flex touch-manipulation items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800"
            >
              <UserPlus size={13} /> {showTrialist ? "Cancel" : "Add trialist"}
            </button>
          </CardHeader>

          {showTrialist && (
            <div className="mb-3 space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-xs text-amber-100">
                Someone on trial who isn&apos;t in the squad. They&apos;ll appear on this team sheet only — no player
                record is created, so they stay out of registrations, contracts and season stats.
              </p>
              <div className="flex gap-2">
                <input
                  value={trialistName}
                  onChange={(e) => setTrialistName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addTrialist(true); }}
                  placeholder="Name"
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-navy-600 px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500/30 dark:bg-navy-800"
                />
                <input
                  value={trialistShirt}
                  onChange={(e) => setTrialistShirt(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
                  inputMode="numeric"
                  placeholder="No."
                  className="w-16 shrink-0 rounded-lg border border-white/10 bg-navy-600 px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500/30 dark:bg-navy-800"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => addTrialist(true)}
                  disabled={!trialistName.trim() || lineup.starters.length >= 11}
                  className="flex touch-manipulation items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-semibold text-navy-950 disabled:opacity-50"
                >
                  <UserPlus size={13} /> Into the XI
                </button>
                <button
                  onClick={() => addTrialist(false)}
                  disabled={!trialistName.trim()}
                  className="flex touch-manipulation items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-navy-600 disabled:opacity-50 dark:hover:bg-navy-800"
                >
                  On the bench
                </button>
              </div>
            </div>
          )}

          <p className="mb-2 text-xs text-neutral-400">
            Combines each player&apos;s own reply with medical, suspensions, booked time off and registration. Anyone
            suspended, injured, away or unregistered is locked and can&apos;t be picked. Doubtful players stay
            selectable — a doubtful player often plays, and that&apos;s your call, not the app&apos;s.
          </p>

          <ul className="divide-y divide-white/10">
            {available.map((p) => {
              const eff = match
                ? effectiveAvailability(p.id, match, {
                    reply: availability.find((a) => a.player_id === p.id),
                    injuries, suspensions, absences,
                  })
                : null;
              const block = eligibility(p.id);
              return (
                <li
                  key={p.id}
                  draggable={!block.blocked}
                  onDragStart={(e) => {
                    // An ineligible player can't be dragged either, or the
                    // rule would only hold for the buttons.
                    if (block.blocked) { e.preventDefault(); return; }
                    e.dataTransfer.setData("text/plain", `${p.id}|`);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => {
                    if (block.blocked) {
                      setError(`${p.name} can't be selected — ${block.reason.toLowerCase()}.`);
                      return;
                    }
                    setPending((prev) => (prev === p.id ? "" : p.id));
                  }}
                  title={block.blocked ? `Can't be selected — ${block.reason}` : undefined}
                  className={`flex items-center gap-2.5 rounded-lg py-2 ${
                    block.blocked
                      ? "cursor-not-allowed opacity-50"
                      : pending === p.id
                        ? "cursor-grab bg-club-primary/15 ring-1 ring-club-primary/40"
                        : "cursor-grab"
                  }`}
                >
                  <PlayerAvatar playerId={p.id} initials={p.initials} photoUrl={p.photo_url} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                      {block.blocked && <Lock size={11} className="shrink-0 text-neutral-500" />}
                      {p.name}
                    </p>
                    <p className="truncate text-[11px] text-neutral-500">
                      #{p.squad_number} · {p.position}
                      {block.blocked ? ` · ${block.reason}` : eff && eff.detail ? ` · ${eff.detail}` : ""}
                    </p>
                  </div>
                  {block.blocked ? (
                    <span className="shrink-0 rounded-lg bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-300">
                      Ineligible
                    </span>
                  ) : (
                    eff && eff.status !== "unknown" && (
                      <span
                        title={`${SOURCE_LABEL[eff.source]}${eff.detail ? ` · ${eff.detail}` : ""}`}
                        className={`shrink-0 rounded-lg px-1.5 py-0.5 text-[10px] font-medium ${AVAILABILITY_TONE[eff.status]}`}
                      >
                        {AVAILABILITY_LABEL[eff.status]}
                      </span>
                    )
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); addStarter(p); }}
                    disabled={block.blocked || lineup.starters.length >= 11}
                    className="shrink-0 touch-manipulation rounded-lg border border-white/10 px-2 py-1 text-[11px] hover:bg-navy-600 disabled:opacity-40 dark:hover:bg-navy-800"
                  >
                    XI
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); addSub(p); }}
                    disabled={block.blocked || benchFull}
                    title={benchFull ? `Bench is full (${maxSubs} maximum)` : undefined}
                    className="shrink-0 touch-manipulation rounded-lg border border-white/10 px-2 py-1 text-[11px] hover:bg-navy-600 disabled:opacity-40 dark:hover:bg-navy-800"
                  >
                    Sub
                  </button>
                </li>
              );
            })}
          </ul>
          {available.length === 0 && <p className="text-sm text-neutral-400">Everyone is selected.</p>}
        </Card>
      </div>

      {showOutputs && (
        <Card>
          <CardHeader><CardTitle>Team Sheet</CardTitle></CardHeader>
          <div className="mb-3 flex flex-wrap gap-2">
            {([
              { key: "ifas" as const, label: "For iFAS" },
              { key: "sheet" as const, label: "Team sheet" },
              { key: "social" as const, label: "Social media" },
            ]).map((o) => (
              <button
                key={o.key}
                onClick={() => setOutput(o.key)}
                className={`touch-manipulation rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  output === o.key ? "bg-club-primary text-navy-950" : "border border-white/10 text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          <p className="mb-2 text-xs text-neutral-400">
            {output === "ifas"
              ? "Numbered in team-sheet order so you can keep your place while clicking each player in iFAS."
              : output === "sheet"
                ? "Full sheet with positions and captain, for printing or the dressing room."
                : "Names only, ready to paste into a post or email."}
          </p>

          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-navy-600 p-3 font-mono text-xs leading-relaxed dark:bg-navy-800">
{outputText || "Nothing selected yet."}
          </pre>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={copyOutput}
              disabled={!outputText}
              className="flex touch-manipulation items-center gap-1.5 rounded-xl bg-club-primary px-3 py-2 text-sm font-medium text-navy-950 disabled:opacity-60"
            >
              <Copy size={14} /> {copied === output ? "Copied" : "Copy"}
            </button>
            <button
              onClick={() => window.print()}
              className="flex touch-manipulation items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800"
            >
              <Printer size={14} /> Print
            </button>
            {match && (
              <a
                href={`mailto:?subject=${encodeURIComponent(`Team news — ${clubName} ${match.is_home ? "vs" : "@"} ${match.opponent}`)}&body=${encodeURIComponent(outputText)}`}
                className="flex touch-manipulation items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800"
              >
                <Mail size={14} /> Email
              </a>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
