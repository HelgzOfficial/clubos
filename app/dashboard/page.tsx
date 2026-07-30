"use client";

import { useEffect, useMemo, useState, useCallback, Fragment, type ReactNode } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { RecentUploadsFeed } from "@/components/recent-uploads-feed";
import { youTubeWatchUrl } from "@/lib/youtube";
import { useIsMobileOrTablet } from "@/lib/use-media-query";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DirectionsLinks } from "@/components/directions-links";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { fetchMatches, type DbMatch } from "@/lib/matches-db";
import { fetchPlayers, type DbPlayer } from "@/lib/players-db";
import { fetchActiveInjuries, type DbInjury } from "@/lib/injuries-db";
import { fetchPlayerAbsences, isAbsentOn, type DbPlayerAbsence } from "@/lib/player-absences-db";
import {
  fetchCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
  expandEvent, type DbCalendarEvent, type CalendarEventType,
} from "@/lib/calendar-events-db";
import {
  fetchLeagueTable, updateLeagueRow, addLeagueRow, deleteLeagueRow,
  type DbLeagueRow, type LeagueRowInput,
} from "@/lib/league-table-db";
import { fetchClips, uploadClip, deleteClip, getClipUrl, type DbClip } from "@/lib/clips-db";
import {
  fetchDashboardSettings, saveDashboardSettings, DEFAULT_WIDGET_ORDER, WIDGET_LABELS,
  type DashboardWidgetKey, type DashboardSettings,
} from "@/lib/dashboard-settings-db";
import { fetchLiveWeather, type LiveWeather } from "@/lib/weather";
import {
  fetchMatchDocuments, uploadMatchDocument, deleteMatchDocument, getMatchDocumentUrl, getMatchDocumentDownloadUrl, type DbMatchDocument,
} from "@/lib/match-documents-db";
import {
  fetchTrainingPlans, uploadTrainingPlan, deleteTrainingPlan, getTrainingPlanDownloadUrl, type DbTrainingPlan,
} from "@/lib/training-plans-db";
import { usePermissions } from "@/lib/permissions";
import { personalGreeting } from "@/lib/greeting";
import { TeamCrest, useCrestLookup } from "@/components/team-crest";
import { DocumentViewerModal } from "@/components/document-viewer-modal";
import {
  CloudSun, Clock, ShieldAlert, Trophy, TrendingUp, Upload, FileText, Download, Eye, Trash2, X,
  Pencil, Plus, Settings, Loader2, Film, Play, Target, Goal,
} from "lucide-react";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function useCountdown(iso: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!iso) return null;
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return "Kicked off";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${mins}m`;
}

type ScheduleItem = {
  key: string;
  time: string;
  title: string;
  location: string;
  group: string;
  href: string | null;
  eventId: string | null; // editable calendar_events only
};

const statusVariant: Record<string, "green" | "amber" | "red"> = { green: "green", amber: "amber", red: "red" };

// Shorter labels than WIDGET_LABELS for the mobile tab strip — the full
// labels (e.g. "Match Pack / Training Upload") are too long to fit as tabs.
//
// Deliberately Partial rather than an exhaustive Record: this map lives in a
// different file from the DashboardWidgetKey type, so an exhaustive Record
// meant adding a widget key broke the build here until this file was updated
// in lockstep. Anything not listed falls back to its full WIDGET_LABELS name.
const TAB_LABELS: Partial<Record<DashboardWidgetKey, string>> = {
  "next-match": "Next Match", weather: "Weather", schedule: "Schedule", availability: "Availability",
  "league-position": "League", "form-guide": "Form", uploads: "Uploads",
  "recent-uploads": "Recent", injuries: "Injuries",
  "top-scorers": "Scorers", "top-assists": "Assists", clips: "Clips",
};

function tabLabel(key: DashboardWidgetKey): string {
  return TAB_LABELS[key] ?? WIDGET_LABELS[key] ?? key;
}

const blankScheduleForm = {
  title: "", type: "training" as CalendarEventType, startTime: "18:30", endTime: "20:00", venue: "", notes: "",
};

export default function DashboardPage() {
  const today = todayStr();
  const { canWrite, appUser } = usePermissions();
  const canEditDashboard = canWrite("dashboard");
  const crestLookup = useCrestLookup();
  const canEditDocuments = canWrite("documents");
  const canEditTraining = canWrite("training");

  const [matches, setMatches] = useState<DbMatch[]>([]);
  const [events, setEvents] = useState<DbCalendarEvent[]>([]);
  const [league, setLeague] = useState<DbLeagueRow[]>([]);
  const [clips, setClips] = useState<DbClip[]>([]);
  const [players, setPlayers] = useState<DbPlayer[]>([]);
  const [injuries, setInjuries] = useState<DbInjury[]>([]);
  const [absences, setAbsences] = useState<DbPlayerAbsence[]>([]);
  const [settings, setSettings] = useState<DashboardSettings>({ widgetOrder: DEFAULT_WIDGET_ORDER, hiddenWidgets: [] });
  const [weather, setWeather] = useState<LiveWeather | null>(null);
  const [weatherError, setWeatherError] = useState("");
  const [loading, setLoading] = useState(true);

  const [showWidgetEditor, setShowWidgetEditor] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState(blankScheduleForm);
  const [showLeagueEditor, setShowLeagueEditor] = useState(false);

  // Below `lg` (phones/tablets), widgets switch from one long vertical stack
  // to a tab strip so the page doesn't turn into an endless scroll — this
  // mirrors the same `lg` cutoff the desktop grid already switches on.
  const isMobile = useIsMobileOrTablet();
  const [activeWidgetTab, setActiveWidgetTab] = useState<DashboardWidgetKey>(DEFAULT_WIDGET_ORDER[0]);

  async function loadAll() {
    setLoading(true);
    try {
      const [m, e, lt, c, s, p, inj, abs] = await Promise.all([
        fetchMatches(), fetchCalendarEvents(), fetchLeagueTable(), fetchClips(6), fetchDashboardSettings(),
        fetchPlayers(), fetchActiveInjuries(), fetchPlayerAbsences(),
      ]);
      setMatches(m);
      setEvents(e);
      setLeague(lt);
      setClips(c);
      setSettings(s);
      setPlayers(p);
      setInjuries(inj);
      setAbsences(abs);
    } finally {
      setLoading(false);
    }
    fetchLiveWeather()
      .then(setWeather)
      .catch((err) => setWeatherError(err instanceof Error ? err.message : "Couldn't load live weather."));
  }

  useEffect(() => {
    loadAll();
  }, []);

  const isVisible = useCallback((key: DashboardWidgetKey) => !settings.hiddenWidgets.includes(key), [settings]);

  // ---- Next match / matchday ----
  const nextMatch = useMemo(() => {
    const now = Date.now();
    return matches
      .filter((m) => m.status === "scheduled" && new Date(m.kickoff).getTime() > now - 3 * 3600_000)
      .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())[0] ?? null;
  }, [matches]);
  const isMatchday = nextMatch && nextMatch.kickoff.slice(0, 10) === today;
  const countdown = useCountdown(nextMatch?.kickoff ?? null);

  // ---- Today's schedule (matches + calendar events, merged) ----
  const scheduleItems: ScheduleItem[] = useMemo(() => {
    const matchItems: ScheduleItem[] = matches
      .filter((m) => m.kickoff.slice(0, 10) === today)
      .map((m) => ({
        key: `match-${m.id}`,
        time: new Date(m.kickoff).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        title: `${m.is_home ? "vs" : "@"} ${m.opponent}`,
        location: m.venue ?? "TBC",
        group: m.competition,
        href: `/matches/${m.id}`,
        eventId: null,
      }));
    const eventItems: ScheduleItem[] = events
      .flatMap((ev) => expandEvent(ev, today, today))
      .map((occ) => ({
        key: occ.key,
        time: occ.startTime ?? "--:--",
        title: occ.title,
        location: occ.venue ?? "TBC",
        group: occ.type === "training" ? "Training" : "Meeting",
        href: occ.type === "training" ? `/training?date=${occ.date}` : null,
        eventId: occ.eventId,
      }));
    return [...matchItems, ...eventItems].sort((a, b) => a.time.localeCompare(b.time));
  }, [matches, events, today]);

  const todaysTraining = useMemo(
    () => events.flatMap((ev) => expandEvent(ev, today, today)).find((occ) => occ.type === "training"),
    [events, today]
  );

  function openAddSchedule() {
    setEditingScheduleId(null);
    setScheduleForm(blankScheduleForm);
    setShowScheduleForm(true);
  }
  function openEditSchedule(item: ScheduleItem) {
    if (!item.eventId) return;
    const ev = events.find((e) => e.id === item.eventId);
    if (!ev) return;
    setEditingScheduleId(ev.id);
    setScheduleForm({
      title: ev.title, type: ev.type, startTime: ev.start_time ?? "", endTime: ev.end_time ?? "",
      venue: ev.venue ?? "", notes: ev.notes ?? "",
    });
    setShowScheduleForm(true);
  }
  async function handleScheduleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduleForm.title.trim()) return;
    const input = {
      title: scheduleForm.title, type: scheduleForm.type, eventDate: today,
      startTime: scheduleForm.startTime, endTime: scheduleForm.endTime, venue: scheduleForm.venue,
      notes: scheduleForm.notes, recurrence: "none" as const, recurrenceDays: [], recurrenceUntil: "",
    };
    if (editingScheduleId) await updateCalendarEvent(editingScheduleId, input);
    else await createCalendarEvent(input);
    setShowScheduleForm(false);
    await loadAll();
  }
  async function handleScheduleDelete() {
    if (!editingScheduleId) return;
    if (!window.confirm("Remove this from today's schedule?")) return;
    await deleteCalendarEvent(editingScheduleId);
    setShowScheduleForm(false);
    await loadAll();
  }

  // ---- League position + form guide ----
  // Real registered squad — replaces the old hard-coded sample counts.
  // A player on an approved absence today (holiday, international duty,
  // etc. — set from the Players module's Holiday tab) counts as
  // unavailable here even if their medical status is otherwise green,
  // since they're not actually available for selection.
  const playerAvailabilitySummary = useMemo(() => {
    const today = todayStr();
    const activeAbsencePlayerIds = new Set(
      absences.filter((a) => isAbsentOn(a, today)).map((a) => a.player_id)
    );
    let available = 0, doubtful = 0, unavailable = 0;
    for (const p of players) {
      if (activeAbsencePlayerIds.has(p.id)) { unavailable++; continue; }
      if (p.availability === "green") available++;
      else if (p.availability === "amber") doubtful++;
      else unavailable++;
    }
    return { available, doubtful, unavailable, total: players.length, onLeave: activeAbsencePlayerIds.size };
  }, [players, absences]);

  const ownRow = league.find((r) => r.is_own_club) ?? null;
  const miniTable = useMemo(() => {
    if (!ownRow) return league.slice(0, 5);
    const idx = league.findIndex((r) => r.id === ownRow.id);
    const start = Math.max(0, idx - 2);
    return league.slice(start, start + 5);
  }, [league, ownRow]);

  const formGuide = useMemo(() => {
    return matches
      .filter((m) => m.status === "completed" && m.home_score !== null && m.away_score !== null)
      .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())
      .slice(-5)
      .map((m) => {
        const gf = m.is_home ? m.home_score! : m.away_score!;
        const ga = m.is_home ? m.away_score! : m.home_score!;
        const result: "W" | "D" | "L" = gf > ga ? "W" : gf < ga ? "L" : "D";
        return { id: m.id, result, opponent: m.opponent, score: `${gf}-${ga}`, date: m.kickoff };
      });
  }, [matches]);

  const resultColor: Record<string, string> = {
    W: "bg-emerald-500 text-white", D: "bg-amber-400 text-navy-950", L: "bg-red-500 text-white",
  };

  // Same widgets, same content, as a flat list instead of inline JSX — this
  // lets the desktop grid and the mobile tab strip below both render off of
  // one source of truth instead of maintaining two separate copies of each
  // widget's markup.
  const widgetEntries: { key: DashboardWidgetKey; node: ReactNode }[] = [
    ...(isVisible("next-match")
      ? [{
          key: "next-match" as const,
          node: (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{isMatchday ? "Matchday" : "Next Match"}</CardTitle>
                {isMatchday && <Badge variant="red">TODAY</Badge>}
                {!isMatchday && nextMatch && <Badge variant="neutral">{nextMatch.is_home ? "Home" : "Away"}</Badge>}
              </CardHeader>
              {!nextMatch ? (
                <p className="text-sm text-neutral-400">No upcoming fixture on the calendar yet.</p>
              ) : (
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="flex items-center gap-2 text-xl font-semibold">
                      <TeamCrest name={nextMatch.opponent} size="md" lookup={crestLookup} />
                      {nextMatch.is_home ? "vs" : "@"} {nextMatch.opponent}
                    </p>
                    <p className="text-sm text-neutral-500">{nextMatch.competition}</p>
                    <p className="text-sm text-neutral-500">{formatDateTime(nextMatch.kickoff)}{nextMatch.venue ? ` — ${nextMatch.venue}` : ""}</p>
                    {isMatchday && nextMatch.venue && <DirectionsLinks venue={nextMatch.venue} className="mt-1.5" />}
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold tabular-nums text-club-primary">{countdown}</p>
                    <p className="text-xs text-neutral-400">until kickoff</p>
                  </div>
                </div>
              )}
            </Card>
          ),
        }]
      : []),
    ...(isVisible("weather")
      ? [{
          key: "weather" as const,
          node: (
            <Card>
              <CardHeader>
                <CardTitle>Weather</CardTitle>
                <CloudSun size={18} className="text-neutral-400" />
              </CardHeader>
              {weatherError ? (
                <p className="text-sm text-neutral-400">{weatherError}</p>
              ) : !weather ? (
                <p className="text-sm text-neutral-400">Loading…</p>
              ) : (
                <>
                  <p className="text-3xl font-bold">{weather.tempC}°C</p>
                  <p className="text-sm text-neutral-500">{weather.condition}</p>
                  <p className="text-xs text-neutral-400 mt-1">Wind {weather.windKph}km/h · Rain {weather.chanceOfRain}%</p>
                  <p className="mt-2 text-[11px] text-neutral-500">Live from Open-Meteo, for the ground</p>
                </>
              )}
            </Card>
          ),
        }]
      : []),
    ...(isVisible("schedule")
      ? [{
          key: "schedule" as const,
          node: (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Today's Schedule</CardTitle>
                <div className="flex items-center gap-2">
                  <Clock size={18} className="text-neutral-400" />
                  {canEditDashboard && (
                    <button onClick={openAddSchedule} className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white">
                      <Plus size={15} />
                    </button>
                  )}
                </div>
              </CardHeader>
              {scheduleItems.length === 0 ? (
                <p className="text-sm text-neutral-400">Nothing on the calendar for today.</p>
              ) : (
                <ul className="space-y-3">
                  {scheduleItems.map((item) => (
                    <li key={item.key} className="flex items-center gap-4 text-sm">
                      <span className="w-14 shrink-0 font-medium text-neutral-500">{item.time}</span>
                      <div className="flex-1">
                        <p className="font-medium">{item.title}</p>
                        <p className="text-xs text-neutral-400">{item.location} · {item.group}</p>
                      </div>
                      {item.eventId && canEditDashboard && (
                        <button onClick={() => openEditSchedule(item)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white">
                          <Pencil size={13} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ),
        }]
      : []),
    ...(isVisible("availability")
      ? [{
          key: "availability" as const,
          node: (
            <Link href="/players" className="block">
            <Card className="h-full transition-colors hover:border-club-primary/40">
              <CardHeader><CardTitle>Player Availability</CardTitle></CardHeader>
              {playerAvailabilitySummary.total === 0 ? (
                <p className="text-sm text-neutral-400">No players registered yet.</p>
              ) : (
              <>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold">{playerAvailabilitySummary.available}</p>
                <p className="text-sm text-neutral-400">/ {playerAvailabilitySummary.total} available</p>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-navy-600 dark:bg-navy-800 flex">
                <div className="bg-emerald-500 h-full" style={{ width: `${(playerAvailabilitySummary.available / playerAvailabilitySummary.total) * 100}%` }} />
                <div className="bg-amber-400 h-full" style={{ width: `${(playerAvailabilitySummary.doubtful / playerAvailabilitySummary.total) * 100}%` }} />
                <div className="bg-red-500 h-full" style={{ width: `${(playerAvailabilitySummary.unavailable / playerAvailabilitySummary.total) * 100}%` }} />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
                <span>🟢 {playerAvailabilitySummary.available} available</span>
                <span>🟡 {playerAvailabilitySummary.doubtful} doubtful</span>
                <span>🔴 {playerAvailabilitySummary.unavailable} out</span>
                {playerAvailabilitySummary.onLeave > 0 && <span>🏖️ {playerAvailabilitySummary.onLeave} on approved leave today</span>}
              </div>
              </>
              )}
            </Card>
            </Link>
          ),
        }]
      : []),
    ...(isVisible("league-position")
      ? [{
          key: "league-position" as const,
          node: (
            <Card>
              <CardHeader>
                <CardTitle>League Position</CardTitle>
                <div className="flex items-center gap-2">
                  <Trophy size={18} className="text-neutral-400" />
                  {canEditDashboard && (
                    <button onClick={() => setShowLeagueEditor(true)} className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white">
                      <Pencil size={13} />
                    </button>
                  )}
                </div>
              </CardHeader>
              {!ownRow ? (
                <p className="text-sm text-neutral-400">No league table set up yet.</p>
              ) : (
                <>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold">{ownRow.position}{ownRow.position === 1 ? "st" : ownRow.position === 2 ? "nd" : ownRow.position === 3 ? "rd" : "th"}</p>
                    <p className="text-sm text-neutral-400">Isthmian Premier Division</p>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">
                    P{ownRow.played} W{ownRow.won} D{ownRow.drawn} L{ownRow.lost} · {ownRow.points} pts
                  </p>
                  <table className="mt-3 w-full text-xs">
                    <tbody>
                      {miniTable.map((r) => (
                        <tr key={r.id} className={r.is_own_club ? "font-semibold text-club-primary" : "text-neutral-400"}>
                          <td className="py-0.5 pr-2">{r.position}</td>
                          <td className="py-0.5">
                            <span className="flex items-center gap-1.5">
                              <TeamCrest name={r.team} size="xs" lookup={crestLookup} />
                              <span className="truncate">{r.team}</span>
                            </span>
                          </td>
                          <td className="py-0.5 pl-2 text-right tabular-nums">{r.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </Card>
          ),
        }]
      : []),
    ...(isVisible("form-guide")
      ? [{
          key: "form-guide" as const,
          node: (
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Form Guide</CardTitle>
                <TrendingUp size={18} className="text-neutral-400" />
              </CardHeader>
              {formGuide.length === 0 ? (
                <p className="text-sm text-neutral-400">No completed fixtures recorded yet.</p>
              ) : (
                <>
                  <div className="flex gap-2">
                    {formGuide.map((f) => (
                      <Link
                        key={f.id}
                        href={`/matches/${f.id}`}
                        title={`${f.result} — vs ${f.opponent} (${f.score}) — view match`}
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-transform hover:scale-110 ${resultColor[f.result]}`}
                      >
                        {f.result}
                      </Link>
                    ))}
                  </div>
                  <ul className="mt-3 divide-y divide-white/10">
                    {[...formGuide].reverse().map((f) => (
                      <li key={`row-${f.id}`}>
                        <Link href={`/matches/${f.id}`} className="flex items-center justify-between py-1.5 text-xs hover:text-club-primary transition-colors">
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-bold ${resultColor[f.result]}`}>{f.result}</span>
                          <TeamCrest name={f.opponent} size="xs" lookup={crestLookup} className="ml-2" />
                          <span className="flex-1 truncate px-2 text-neutral-300">{f.opponent}</span>
                          <span className="tabular-nums text-neutral-400">{f.score}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] text-neutral-500">Last {formGuide.length} fixtures, all competitions — latest first · tap a result to open its match</p>
                </>
              )}
            </Card>
          ),
        }]
      : []),
    ...(isVisible("uploads")
      ? [{
          key: "uploads" as const,
          node: (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Uploads</CardTitle>
                <Upload size={18} className="text-neutral-400" />
              </CardHeader>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {nextMatch && <MatchPackUpload match={nextMatch} canEdit={canEditDocuments} />}
                {todaysTraining && <TrainingUpload date={today} canEdit={canEditTraining} />}
                {!nextMatch && !todaysTraining && (
                  <p className="text-sm text-neutral-400 sm:col-span-2">No upcoming fixture or training session to attach files to right now.</p>
                )}
              </div>
            </Card>
          ),
        }]
      : []),
    ...(isVisible("recent-uploads")
      ? [{
          key: "recent-uploads" as const,
          node: (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Recent Uploads</CardTitle>
                <Upload size={18} className="text-neutral-400" />
              </CardHeader>
              <RecentUploadsFeed limit={8} />
            </Card>
          ),
        }]
      : []),
    ...(isVisible("injuries")
      ? [{
          key: "injuries" as const,
          node: (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Injury List</CardTitle>
                <ShieldAlert size={18} className="text-neutral-400" />
              </CardHeader>
              {injuries.length === 0 ? (
                <p className="text-sm text-neutral-400">No active injuries recorded.</p>
              ) : (
                <ul className="divide-y divide-white/10">
                  {injuries.map((inj) => {
                    const player = players.find((p) => p.id === inj.player_id);
                    return (
                      <li key={inj.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                          {player && (
                            <PlayerAvatar playerId={player.id} initials={player.initials} photoUrl={player.photo_url} size="sm" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium">{player?.name ?? "Unknown player"}</p>
                            <p className="truncate text-xs text-neutral-400">{inj.injury}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={statusVariant[inj.severity]}>{inj.severity.toUpperCase()}</Badge>
                          <p className="text-xs text-neutral-400 mt-1">
                            {inj.expected_return ? `Back ${new Date(inj.expected_return).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "Return TBC"}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          ),
        }]
      : []),
    ...(isVisible("top-scorers")
      ? [{ key: "top-scorers" as const, node: <TopStatCard title="Top Goalscorers" icon={Goal} players={players} statKey="goals" /> }]
      : []),
    ...(isVisible("top-assists")
      ? [{ key: "top-assists" as const, node: <TopStatCard title="Top Assist Makers" icon={Target} players={players} statKey="assists" /> }]
      : []),
    ...(isVisible("clips") ? [{ key: "clips" as const, node: <ClipsCard clips={clips} onChange={loadAll} /> }] : []),
  ];

  // On mobile/tablet these four stay directly visible (stacked, like
  // desktop) instead of hiding behind the tab strip — they're the things
  // people check first thing, so they shouldn't need an extra tap. Every
  // other widget still lives under the tab strip below to keep the page
  // from turning into one long scroll.
  const ALWAYS_VISIBLE_MOBILE: DashboardWidgetKey[] = ["next-match", "schedule", "league-position", "form-guide"];
  const mobileAlwaysEntries = useMemo(
    () => widgetEntries.filter((w) => ALWAYS_VISIBLE_MOBILE.includes(w.key)),
    [widgetEntries]
  );
  const mobileTabEntries = useMemo(
    () => widgetEntries.filter((w) => !ALWAYS_VISIBLE_MOBILE.includes(w.key)),
    [widgetEntries]
  );

  // Keep the highlighted tab in sync if the current one gets hidden (e.g.
  // via Customise Dashboard) or promoted into the always-visible section
  // above — the content itself already falls back to the first entry, this
  // just keeps the pill highlight consistent with that.
  useEffect(() => {
    if (mobileTabEntries.length && !mobileTabEntries.some((w) => w.key === activeWidgetTab)) {
      setActiveWidgetTab(mobileTabEntries[0].key);
    }
  }, [mobileTabEntries, activeWidgetTab]);

  // A row of small "at a glance" stat tiles that sits above the mobile tab
  // strip, visible no matter which tab is open. The single-widget-per-tab
  // layout otherwise leaves a lot of blank space below a short card on a
  // tall phone screen — this fills that with live, tappable numbers instead
  // (tapping a tile jumps straight to its full widget below). Only built
  // from tab-hidden widgets that are actually visible/have data — next
  // match/league/form already show directly above, so they're left out
  // here to avoid showing the same number twice.
  const glanceTiles = useMemo(() => {
    const present = new Set(mobileTabEntries.map((w) => w.key));
    const tiles: { key: string; targetTab: DashboardWidgetKey; label: string; content: ReactNode }[] = [];

    if (present.has("availability") && playerAvailabilitySummary.total > 0) {
      const pct = Math.round((playerAvailabilitySummary.available / playerAvailabilitySummary.total) * 100);
      tiles.push({
        key: "glance-availability",
        targetTab: "availability",
        label: "Availability",
        content: (
          <div className="flex items-center gap-2.5">
            <RingStat percent={pct} color="#22C55E" active={activeWidgetTab === "availability"} />
            <p className="text-lg font-bold">
              {playerAvailabilitySummary.available}
              <span className="text-xs font-normal text-neutral-400">/{playerAvailabilitySummary.total}</span>
            </p>
          </div>
        ),
      });
    }
    if (present.has("weather") && weather) {
      tiles.push({
        key: "glance-weather",
        targetTab: "weather",
        label: "Weather",
        content: (
          <div className="flex items-center gap-2">
            <CloudSun size={22} className="shrink-0 text-club-primary" />
            <p className="text-2xl font-bold">{weather.tempC}°<span className="text-sm font-normal text-neutral-400">C</span></p>
          </div>
        ),
      });
    }
    if (present.has("injuries") && injuries.length > 0) {
      tiles.push({
        key: "glance-injuries",
        targetTab: "injuries",
        label: "Injury list",
        content: (
          <div className="flex items-center gap-2">
            <ShieldAlert size={20} className="shrink-0 text-red-400" />
            <p className="text-2xl font-bold">{injuries.length}</p>
          </div>
        ),
      });
    }
    return tiles;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileTabEntries, playerAvailabilitySummary, weather, injuries, activeWidgetTab]);

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{personalGreeting(appUser?.name)}</h1>
          <p className="text-sm text-neutral-500">Here's what's happening at the club today.</p>
        </div>
        {canEditDashboard && (
          <button
            onClick={() => setShowWidgetEditor(true)}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800"
          >
            <Settings size={14} /> Customise Dashboard
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : widgetEntries.length === 0 ? (
        <p className="text-sm text-neutral-400">No widgets to show — enable one from Customise Dashboard.</p>
      ) : isMobile ? (
        <div>
          {mobileAlwaysEntries.length > 0 && (
            <div className="mb-5 space-y-5">
              {mobileAlwaysEntries.map((w) => (
                <Fragment key={w.key}>{w.node}</Fragment>
              ))}
            </div>
          )}

          {mobileTabEntries.length > 0 && (
            <>
              {glanceTiles.length > 0 && (
                // touch-pan-x: on Android Chrome, a horizontally-scrolling
                // row without an explicit touch-action can have its taps
                // swallowed as "possible scroll" gestures, so a real tap on
                // a tile silently does nothing. Restricting the allowed
                // gesture to horizontal panning only lets Android resolve a
                // stationary tap as a click instead of a cancelled scroll.
                <div className="touch-pan-x mb-4 -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
                  {glanceTiles.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setActiveWidgetTab(t.targetTab)}
                      className={`touch-manipulation flex w-[136px] shrink-0 flex-col items-start gap-1.5 rounded-2xl border p-3 text-left transition-colors ${
                        activeWidgetTab === t.targetTab
                          ? "border-club-primary/50 bg-navy-600 dark:bg-navy-800"
                          : "border-white/10 bg-navy-700 dark:bg-navy-900 hover:bg-navy-600 dark:hover:bg-navy-800"
                      }`}
                    >
                      <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">{t.label}</span>
                      {t.content}
                    </button>
                  ))}
                </div>
              )}
              <div className="touch-pan-x mb-4 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
                {mobileTabEntries.map((w) => (
                  <button
                    key={w.key}
                    onClick={() => setActiveWidgetTab(w.key)}
                    className={`touch-manipulation shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      activeWidgetTab === w.key
                        ? "bg-club-primary text-navy-950"
                        : "bg-navy-600 dark:bg-navy-800 text-neutral-500 hover:text-white"
                    }`}
                  >
                    {tabLabel(w.key)}
                  </button>
                ))}
              </div>
              {(mobileTabEntries.find((w) => w.key === activeWidgetTab) ?? mobileTabEntries[0]).node}
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {widgetEntries.map((w) => (
            <Fragment key={w.key}>{w.node}</Fragment>
          ))}
        </div>
      )}

      {showWidgetEditor && (
        <WidgetEditorModal
          settings={settings}
          onClose={() => setShowWidgetEditor(false)}
          onSave={async (s) => {
            setSettings(s);
            await saveDashboardSettings(s);
            setShowWidgetEditor(false);
          }}
        />
      )}

      {showScheduleForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-medium">{editingScheduleId ? "Edit Schedule Item" : "Add to Today's Schedule"}</p>
              <button onClick={() => setShowScheduleForm(false)} className="text-neutral-400 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={handleScheduleSubmit} className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Title</label>
                <input
                  value={scheduleForm.title}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Video Review"
                  className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                />
              </div>
              <div className="flex gap-1 rounded-xl bg-navy-600 dark:bg-navy-800 p-1 text-sm w-fit">
                {[{ v: "training" as const, label: "Training" }, { v: "meeting" as const, label: "Meeting" }].map((o) => (
                  <button key={o.v} type="button" onClick={() => setScheduleForm((f) => ({ ...f, type: o.v }))}
                    className={`rounded-lg px-3 py-1 transition-colors ${scheduleForm.type === o.v ? "bg-club-primary text-navy-950" : "text-neutral-400"}`}>
                    {o.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-neutral-500">Start</label>
                  <input type="time" value={scheduleForm.startTime} onChange={(e) => setScheduleForm((f) => ({ ...f, startTime: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
                </div>
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-neutral-500">End</label>
                  <input type="time" value={scheduleForm.endTime} onChange={(e) => setScheduleForm((f) => ({ ...f, endTime: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Location</label>
                <input value={scheduleForm.venue} onChange={(e) => setScheduleForm((f) => ({ ...f, venue: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Notes</label>
                <textarea value={scheduleForm.notes} onChange={(e) => setScheduleForm((f) => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full resize-none rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
              </div>
              <div className="flex items-center gap-2 pt-1">
                {editingScheduleId && (
                  <button type="button" onClick={handleScheduleDelete} className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10">
                    <Trash2 size={14} /> Remove
                  </button>
                )}
                <button type="submit" className="ml-auto rounded-xl bg-club-primary text-navy-950 px-4 py-2 text-sm font-medium hover:opacity-90">
                  Save
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {showLeagueEditor && (
        <LeagueEditorModal league={league} onClose={() => setShowLeagueEditor(false)} onChange={loadAll} />
      )}
    </AppShell>
  );
}

// ---- Match pack upload (for the next fixture) ----
function MatchPackUpload({ match, canEdit }: { match: DbMatch; canEdit: boolean }) {
  const [docs, setDocs] = useState<DbMatchDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<DbMatchDocument | null>(null);

  const load = useCallback(async () => setDocs(await fetchMatchDocuments(match.id)), [match.id]);
  useEffect(() => { load(); }, [load]);

  async function handleFile(file: File) {
    setUploading(true);
    try { await uploadMatchDocument(match.id, file); await load(); } finally { setUploading(false); }
  }
  async function handleDownload(d: DbMatchDocument) { window.open(await getMatchDocumentDownloadUrl(d.file_path, d.file_name), "_blank"); }
  async function handleDelete(d: DbMatchDocument) {
    if (!window.confirm(`Remove "${d.file_name}"?`)) return;
    await deleteMatchDocument(d.id, d.file_path);
    await load();
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium">Match Pack — {match.is_home ? "vs" : "@"} {match.opponent}</p>
      {docs.length === 0 ? (
        <p className="mb-2 text-xs text-neutral-400">Nothing uploaded yet for this fixture.</p>
      ) : (
        <ul className="mb-2 divide-y divide-white/10">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-2 py-2 text-xs">
              <FileText size={13} className="shrink-0 text-neutral-400" />
              <span className="flex-1 truncate">{d.file_name}</span>
              <button onClick={() => setViewing(d)} title="View" className="flex h-6 w-6 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800"><Eye size={12} /></button>
              <button onClick={() => handleDownload(d)} title="Download" className="flex h-6 w-6 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800"><Download size={12} /></button>
              {canEdit && (
                <button onClick={() => handleDelete(d)} className="flex h-6 w-6 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10"><Trash2 size={12} /></button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800">
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          {uploading ? "Uploading…" : "Upload Match Pack"}
          <input type="file" accept=".pdf,.docx,.png,.jpg,.jpeg" className="hidden" disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
        </label>
      )}
      {viewing && (
        <DocumentViewerModal
          fileName={viewing.file_name}
          fileType={viewing.file_type}
          getViewUrl={() => getMatchDocumentUrl(viewing.file_path)}
          getDownloadUrl={() => getMatchDocumentDownloadUrl(viewing.file_path, viewing.file_name)}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

// ---- Training plan upload (for today, when today is a training day) ----
function TrainingUpload({ date, canEdit }: { date: string; canEdit: boolean }) {
  const [plans, setPlans] = useState<DbTrainingPlan[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => setPlans(await fetchTrainingPlans(date)), [date]);
  useEffect(() => { load(); }, [load]);

  async function handleFile(file: File) {
    setUploading(true);
    try { await uploadTrainingPlan(date, file); await load(); } finally { setUploading(false); }
  }
  async function handleDownload(p: DbTrainingPlan) { window.open(await getTrainingPlanDownloadUrl(p.file_path), "_blank"); }
  async function handleDelete(p: DbTrainingPlan) {
    if (!window.confirm(`Remove "${p.file_name}"?`)) return;
    await deleteTrainingPlan(p.id, p.file_path);
    await load();
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium">Today's Training Plan</p>
      {plans.length === 0 ? (
        <p className="mb-2 text-xs text-neutral-400">No session plan uploaded for today yet.</p>
      ) : (
        <ul className="mb-2 divide-y divide-white/10">
          {plans.map((p) => (
            <li key={p.id} className="flex items-center gap-2 py-2 text-xs">
              <FileText size={13} className="shrink-0 text-neutral-400" />
              <span className="flex-1 truncate">{p.file_name}</span>
              <button onClick={() => handleDownload(p)} className="flex h-6 w-6 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800"><Download size={12} /></button>
              {canEdit && (
                <button onClick={() => handleDelete(p)} className="flex h-6 w-6 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10"><Trash2 size={12} /></button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800">
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          {uploading ? "Uploading…" : "Upload Session Plan"}
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
        </label>
      )}
    </div>
  );
}

// ---- Small donut ring for the mobile "at a glance" tiles ----
function RingStat({ percent, color, active }: { percent: number; color: string; active: boolean }) {
  return (
    <div
      className="relative h-9 w-9 shrink-0 rounded-full"
      style={{ background: `conic-gradient(${color} ${Math.max(0, Math.min(100, percent)) * 3.6}deg, rgba(255,255,255,0.12) 0deg)` }}
    >
      <div className={`absolute inset-[3px] rounded-full ${active ? "bg-navy-600 dark:bg-navy-800" : "bg-navy-700 dark:bg-navy-900"}`} />
    </div>
  );
}

// ---- Top scorers / top assists ----
function TopStatCard({
  title, icon: Icon, players, statKey,
}: { title: string; icon: typeof Goal; players: DbPlayer[]; statKey: "goals" | "assists" }) {
  const top = [...players].filter((p) => (p[statKey] ?? 0) > 0).sort((a, b) => b[statKey] - a[statKey]).slice(0, 5);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <Icon size={18} className="text-neutral-400" />
      </CardHeader>
      {top.length === 0 ? (
        <p className="text-sm text-neutral-400">No {statKey} recorded yet this season.</p>
      ) : (
        <ul className="space-y-2.5">
          {top.map((p) => (
            <li key={p.id}>
              <Link href={`/players/${p.id}`} className="flex items-center gap-3 text-sm transition-colors hover:text-club-primary">
                <PlayerAvatar playerId={p.id} initials={p.initials} photoUrl={p.photo_url} size="sm" />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="shrink-0 text-[11px] text-neutral-500">#{p.squad_number}</span>
                <span className="shrink-0 tabular-nums font-semibold text-club-primary">{p[statKey]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---- Latest clips ----
function ClipsCard({ clips, onChange }: { clips: DbClip[]; onChange: () => Promise<void> }) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      await uploadClip(file.name.replace(/\.[^.]+$/, ""), file);
      await onChange();
    } finally {
      setUploading(false);
    }
  }
  async function handlePlay(c: DbClip) {
    if (c.source === "youtube" && c.youtube_id) {
      window.open(youTubeWatchUrl(c.youtube_id), "_blank");
      return;
    }
    window.open(await getClipUrl(c.file_path), "_blank");
  }
  async function handleDelete(c: DbClip) {
    if (!window.confirm(`Remove "${c.title}"?`)) return;
    await deleteClip(c.id, c.file_path);
    await onChange();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Latest Clips</CardTitle>
        <Film size={18} className="text-neutral-400" />
      </CardHeader>
      {clips.length === 0 ? (
        <p className="mb-2 text-sm text-neutral-400">No clips uploaded yet.</p>
      ) : (
        <ul className="mb-2 space-y-2.5">
          {clips.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
              <button onClick={() => handlePlay(c)} className="flex flex-1 items-center gap-2 truncate text-left hover:text-club-primary">
                <Play size={13} className="shrink-0 text-neutral-400" />
                <span className="truncate">{c.title}</span>
              </button>
              <button onClick={() => handleDelete(c)} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10">
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800">
        {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
        {uploading ? "Uploading…" : "Upload Clip"}
        <input type="file" accept="video/*" className="hidden" disabled={uploading}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
      </label>
    </Card>
  );
}

// ---- Add/remove widgets ----
function WidgetEditorModal({
  settings, onClose, onSave,
}: { settings: DashboardSettings; onClose: () => void; onSave: (s: DashboardSettings) => void }) {
  const [hidden, setHidden] = useState<Set<DashboardWidgetKey>>(new Set(settings.hiddenWidgets));

  function toggle(key: DashboardWidgetKey) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <Card className="w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-medium">Customise Dashboard</p>
          <button onClick={onClose} className="text-neutral-400 hover:text-white"><X size={18} /></button>
        </div>
        <p className="mb-3 text-xs text-neutral-500">Choose which cards show up on your dashboard.</p>
        <ul className="space-y-2">
          {DEFAULT_WIDGET_ORDER.map((key) => (
            <li key={key} className="flex items-center justify-between text-sm">
              <span>{WIDGET_LABELS[key]}</span>
              <input type="checkbox" checked={!hidden.has(key)} onChange={() => toggle(key)} className="h-4 w-4 rounded border-white/20" />
            </li>
          ))}
        </ul>
        <button
          onClick={() => onSave({ widgetOrder: DEFAULT_WIDGET_ORDER, hiddenWidgets: Array.from(hidden) })}
          className="mt-5 w-full rounded-xl bg-club-primary text-navy-950 px-4 py-2 text-sm font-medium hover:opacity-90"
        >
          Save
        </button>
      </Card>
    </div>
  );
}

// ---- League table editor ----
function LeagueEditorModal({ league, onClose, onChange }: { league: DbLeagueRow[]; onClose: () => void; onChange: () => Promise<void> }) {
  const [rows, setRows] = useState(league);
  const [saving, setSaving] = useState(false);

  function patchRow(id: string, patch: Partial<DbLeagueRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function handleSaveAll() {
    setSaving(true);
    try {
      for (const r of rows) {
        const input: LeagueRowInput = {
          position: r.position, team: r.team, played: r.played, won: r.won, drawn: r.drawn, lost: r.lost,
          goalsFor: r.goals_for, goalsAgainst: r.goals_against, points: r.points, isOwnClub: r.is_own_club,
        };
        await updateLeagueRow(r.id, input);
      }
      await onChange();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleAddRow() {
    const created = await addLeagueRow({
      position: rows.length + 1, team: "New Team", played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, points: 0, isOwnClub: false,
    });
    setRows((prev) => [...prev, created]);
  }
  async function handleRemoveRow(id: string) {
    if (!window.confirm("Remove this team from the table?")) return;
    await deleteLeagueRow(id);
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-medium">Edit League Table</p>
          <button onClick={onClose} className="text-neutral-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="text-left text-neutral-500">
                <th className="w-10 pb-2">Pos</th>
                <th className="pb-2">Team</th>
                <th className="w-12 pb-2">P</th>
                <th className="w-12 pb-2">W</th>
                <th className="w-12 pb-2">D</th>
                <th className="w-12 pb-2">L</th>
                <th className="w-14 pb-2">GF</th>
                <th className="w-14 pb-2">GA</th>
                <th className="w-14 pb-2">Pts</th>
                <th className="w-10 pb-2">Us</th>
                <th className="w-8 pb-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-white/10">
                  {([
                    ["position", "number"], ["team", "text"], ["played", "number"], ["won", "number"],
                    ["drawn", "number"], ["lost", "number"], ["goals_for", "number"], ["goals_against", "number"],
                    ["points", "number"],
                  ] as const).map(([field, type]) => (
                    <td key={field} className="py-1 pr-1">
                      <input
                        type={type}
                        value={r[field] as string | number}
                        onChange={(e) => patchRow(r.id, { [field]: type === "number" ? Number(e.target.value) : e.target.value } as Partial<DbLeagueRow>)}
                        className="w-full rounded-lg border border-white/10 bg-navy-600 dark:bg-navy-800 px-1.5 py-1 text-xs outline-none focus:ring-2 focus:ring-club-primary/30"
                      />
                    </td>
                  ))}
                  <td className="py-1 text-center">
                    <input type="checkbox" checked={r.is_own_club} onChange={(e) => patchRow(r.id, { is_own_club: e.target.checked })} className="h-4 w-4 rounded border-white/20" />
                  </td>
                  <td className="py-1">
                    <button onClick={() => handleRemoveRow(r.id)} className="flex h-6 w-6 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10"><Trash2 size={12} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button onClick={handleAddRow} className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800">
            <Plus size={14} /> Add Team
          </button>
          <button onClick={handleSaveAll} disabled={saving} className="ml-auto rounded-xl bg-club-primary text-navy-950 px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {saving ? "Saving…" : "Save Table"}
          </button>
        </div>
      </Card>
    </div>
  );
}
