"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
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

const blankScheduleForm = {
  title: "", type: "training" as CalendarEventType, startTime: "18:30", endTime: "20:00", venue: "", notes: "",
};

export default function DashboardPage() {
  const today = todayStr();
  const { canWrite } = usePermissions();
  const canEditDashboard = canWrite("dashboard");
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
  // unavailable here even if their medical status is otherwise
