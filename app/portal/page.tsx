"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { club as clubFallback } from "@/lib/sample-data";
import { loadClubSettings, saveClubSettings } from "@/lib/club-settings";
import { fetchClubSettings } from "@/lib/club-settings-db";
import { fetchMatches, type DbMatch } from "@/lib/matches-db";
import { fetchPlayerByEmail, type DbPlayer } from "@/lib/players-db";
import {
  fetchMatchDocuments, getMatchDocumentUrl, getMatchDocumentDownloadUrl, recordDocumentView, type DbMatchDocument,
} from "@/lib/match-documents-db";
import { fetchLeagueTable, type DbLeagueRow } from "@/lib/league-table-db";
import {
  fetchBookings, createBooking, deleteBooking, sendTreatmentInvite,
  TREATMENT_TYPE_OPTIONS, type DbTreatmentBooking, type BookingStatus,
} from "@/lib/treatment-bookings-db";
import { fetchOppositionReports, getOppositionReportDownloadUrl, type DbOppositionReport } from "@/lib/opposition-reports-db";
import { fetchHeadToHead, type DbHeadToHead } from "@/lib/opposition-head-to-head-db";
import { fetchCalendarEvents, expandEvent, type EventOccurrence } from "@/lib/calendar-events-db";
import { fetchClips, getClipUrl, type DbClip } from "@/lib/clips-db";
import { getCountryFlag } from "@/lib/countries";
import { DirectionsLinks } from "@/components/directions-links";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { RecentUploadsFeed } from "@/components/recent-uploads-feed";
import { DocumentViewerModal } from "@/components/document-viewer-modal";
import { MessageThread } from "@/components/medical/message-thread";
import { VideoPlayer } from "@/components/analysis/video-player";
import { YouTubePlayer } from "@/components/analysis/youtube-player";
import { Collapsible } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import type { Clip } from "@/lib/analysis-types";
import {
  LogOut, FileText, AlertCircle, Download, CalendarDays, Trophy, User, HeartPulse,
  MessageCircle, Dumbbell, Film, Plus, X, Trash2, Check, Play, Shield, Upload,
} from "lucide-react";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
const statusVariant: Record<BookingStatus, "green" | "amber" | "red" | "neutral"> = {
  scheduled: "amber", completed: "green", cancelled: "neutral", "no-show": "red",
};
const resultColor: Record<string, string> = {
  W: "bg-emerald-500 text-white", D: "bg-amber-400 text-navy-950", L: "bg-red-500 text-white",
};
// Same green/amber/red meaning as the Medical and Players modules.
const availabilityVariant: Record<string, "green" | "amber" | "red"> = {
  green: "green", amber: "amber", red: "red",
};

export default function PortalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState(clubFallback);
  const [player, setPlayer] = useState<DbPlayer | null>(null);
  const [notLinked, setNotLinked] = useState(false);
  const [error, setError] = useState("");

  const [matches, setMatches] = useState<DbMatch[]>([]);
  const [recentResults, setRecentResults] = useState<DbMatch[]>([]);
  const [scheduleTab, setScheduleTab] = useState<"upcoming" | "results">("upcoming");
  const [docsByMatch, setDocsByMatch] = useState<Record<string, DbMatchDocument[]>>({});
  const [openedIds, setOpenedIds] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<DbMatchDocument | null>(null);

  const [league, setLeague] = useState<DbLeagueRow[]>([]);

  const [bookings, setBookings] = useState<DbTreatmentBooking[]>([]);
  const [showBook, setShowBook] = useState(false);
  const [treatmentType, setTreatmentType] = useState(TREATMENT_TYPE_OPTIONS[0]);
  const [bookDate, setBookDate] = useState(todayIso());
  const [bookTime, setBookTime] = useState("09:00");
  const [bookDuration, setBookDuration] = useState("30");
  const [bookNotes, setBookNotes] = useState("");
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState("");
  const [bookConfirmed, setBookConfirmed] = useState(false);

  const [oppReports, setOppReports] = useState<DbOppositionReport[]>([]);
  const [h2h, setH2h] = useState<DbHeadToHead | null>(null);

  const [weekEvents, setWeekEvents] = useState<EventOccurrence[]>([]);
  // A wider window than weekEvents, for the always-visible dashboard calendar.
  const [agendaEvents, setAgendaEvents] = useState<EventOccurrence[]>([]);
  const [dashTab, setDashTab] = useState<"league" | "form">("league");

  const [clips, setClips] = useState<DbClip[]>([]);
  const [playingClip, setPlayingClip] = useState<Clip | null>(null);
  const [playingYouTube, setPlayingYouTube] = useState<{ title: string; videoId: string } | null>(null);

  useEffect(() => {
    async function init() {
      if (!supabase) { setLoading(false); return; }
      setBranding(loadClubSettings(clubFallback));
      fetchClubSettings(clubFallback).then((settings) => { setBranding(settings); saveClubSettings(settings); });

      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;
      if (!email) { router.replace("/portal/login"); return; }

      try {
        const p = await fetchPlayerByEmail(email);
        if (!p) { setNotLinked(true); setLoading(false); return; }
        setPlayer(p);

        const now = Date.now();
        const [allMatches, lt, allBookings, events, recentClips] = await Promise.all([
          fetchMatches(), fetchLeagueTable(), fetchBookings(), fetchCalendarEvents(), fetchClips(6),
        ]);

        const upcoming = allMatches
          .filter((m) => new Date(m.kickoff).getTime() >= now && m.status !== "cancelled")
          .slice(0, 8);
        setMatches(upcoming);

        // "Played" here means the kickoff has passed — deliberately NOT
        // "status === completed with both scores filled in". Fixtures are
        // often left as 'scheduled' and simply drift into the past, or get a
        // score without anyone flipping the status, so the stricter check
        // left this list looking empty even though games had been played.
        // Anything without a score just shows its status instead.
        setRecentResults(
          allMatches
            .filter((m) => new Date(m.kickoff).getTime() < now && m.status !== "cancelled" && m.status !== "postponed")
            .sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime())
            .slice(0, 15)
        );
        const docLists = await Promise.all(upcoming.map((m) => fetchMatchDocuments(m.id)));
        const map: Record<string, DbMatchDocument[]> = {};
        upcoming.forEach((m, i) => { map[m.id] = docLists[i]; });
        setDocsByMatch(map);

        setLeague(lt);
        setBookings(allBookings.filter((b) => b.player_id === p.id).sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()));
        setClips(recentClips);

        const todayStr = new Date().toISOString().slice(0, 10);
        const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const monthEnd = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const byDateThenTime = (a: EventOccurrence, b: EventOccurrence) =>
          a.date.localeCompare(b.date) || (a.startTime ?? "").localeCompare(b.startTime ?? "");
        setWeekEvents(events.flatMap((e) => expandEvent(e, todayStr, weekEnd)).sort(byDateThenTime));
        setAgendaEvents(events.flatMap((e) => expandEvent(e, todayStr, monthEnd)).sort(byDateThenTime));

        if (upcoming[0]) {
          const [reports, headToHead] = await Promise.all([
            fetchOppositionReports(upcoming[0].opponent),
            fetchHeadToHead(upcoming[0].opponent),
          ]);
          setOppReports(reports);
          setH2h(headToHead);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load your data.");
      } finally {
        setLoading(false);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nextMatch = matches[0] ?? null;

  const formGuide = useMemo(() => {
    // recentResults is newest-first and may include played games that have no
    // score recorded yet — those can't be a W/D/L, so they're skipped here
    // (they still appear in the Results tab). The strip wants the most recent
    // 5 *scored* games, shown oldest-to-newest.
    return recentResults
      .filter((m) => m.home_score !== null && m.away_score !== null)
      .slice(0, 5)
      .reverse()
      .map((m) => {
        const gf = m.is_home ? m.home_score! : m.away_score!;
        const ga = m.is_home ? m.away_score! : m.home_score!;
        const result: "W" | "D" | "L" = gf > ga ? "W" : gf < ga ? "L" : "D";
        return { id: m.id, result, opponent: m.opponent, score: `${gf}-${ga}` };
      });
  }, [recentResults]);

  const ownRow = league.find((r) => r.is_own_club) ?? null;
  const miniTable = useMemo(() => {
    if (!ownRow) return league.slice(0, 5);
    const idx = league.findIndex((r) => r.id === ownRow.id);
    const start = Math.max(0, idx - 2);
    return league.slice(start, start + 5);
  }, [league, ownRow]);

  // Fixtures and training/meetings merged into one chronological agenda for
  // the dashboard calendar, grouped by day so a date heading isn't repeated
  // for every item on it.
  const calendarDays = useMemo(() => {
    type AgendaItem = { key: string; time: string | null; title: string; kind: "match" | "training" | "meeting"; venue: string | null; href?: string };
    const byDate = new Map<string, AgendaItem[]>();

    const push = (date: string, item: AgendaItem) => {
      const list = byDate.get(date);
      if (list) list.push(item);
      else byDate.set(date, [item]);
    };

    for (const m of matches) {
      const d = new Date(m.kickoff);
      push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, {
        key: `match-${m.id}`,
        time: formatTime(m.kickoff),
        title: `${m.is_home ? "vs" : "@"} ${m.opponent}`,
        kind: "match",
        venue: m.venue,
        href: `/portal/matches/${m.id}`,
      });
    }
    for (const e of agendaEvents) {
      push(e.date, { key: e.key, time: e.startTime, title: e.title, kind: e.type, venue: e.venue });
    }

    return [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, items]) => ({
        date,
        items: items.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "")),
      }));
  }, [matches, agendaEvents]);

  const playerStats = useMemo(() => {
    if (!player) return [];
    const base = [
      { label: "Apps", value: player.appearances },
      { label: "Goals", value: player.goals },
      { label: "Assists", value: player.assists },
      { label: "Minutes", value: player.minutes },
    ];
    // Clean sheets only mean something for keepers and defenders.
    if (player.position_group === "GK" || player.position_group === "DEF") {
      base.push({ label: "Clean sheets", value: player.clean_sheets ?? 0 });
    }
    return base;
  }, [player]);

  async function markOpened(doc: DbMatchDocument) {
    if (!player) return;
    await recordDocumentView(doc.id, player.id);
    setOpenedIds((prev) => new Set(prev).add(doc.id));
  }
  function handleOpenDoc(doc: DbMatchDocument) { setViewing(doc); markOpened(doc); }
  async function handleDownloadDoc(doc: DbMatchDocument) {
    const url = await getMatchDocumentDownloadUrl(doc.file_path, doc.file_name);
    window.open(url, "_blank");
    markOpened(doc);
  }

  async function handleBook(e: FormEvent) {
    e.preventDefault();
    if (!player || !bookDate || !bookTime) return;
    setBooking(true);
    setBookError("");
    try {
      const start = new Date(`${bookDate}T${bookTime}:00`);
      const end = new Date(start.getTime() + Number(bookDuration) * 60 * 1000);
      const b = await createBooking({
        playerId: player.id, injuryId: null, startTime: start.toISOString(), endTime: end.toISOString(),
        treatmentType, notes: bookNotes.trim(), doctorName: "", doctorEmail: "",
      });
      if (player.email) await sendTreatmentInvite(b, { name: player.name, email: player.email });
      setShowBook(false);
      setTreatmentType(TREATMENT_TYPE_OPTIONS[0]); setBookDate(todayIso()); setBookTime("09:00"); setBookDuration("30"); setBookNotes("");
      setBookConfirmed(true);
      setTimeout(() => setBookConfirmed(false), 4000);
      const all = await fetchBookings();
      setBookings(all.filter((bk) => bk.player_id === player.id).sort((a, b2) => new Date(b2.start_time).getTime() - new Date(a.start_time).getTime()));
    } catch (e) {
      setBookError(e instanceof Error ? e.message : "Couldn't book that slot.");
    } finally {
      setBooking(false);
    }
  }
  async function handleCancelBooking(b: DbTreatmentBooking) {
    if (!window.confirm("Cancel this treatment booking?")) return;
    await deleteBooking(b.id);
    setBookings((prev) => prev.filter((x) => x.id !== b.id));
  }

  async function handlePlayClip(c: DbClip) {
    // YouTube-linked clips play in the embed modal; uploaded files stream from
    // storage via a signed URL.
    if (c.source === "youtube" && c.youtube_id) {
      setPlayingYouTube({ title: c.title, videoId: c.youtube_id });
      return;
    }
    if (!c.file_path) return;
    const url = await getClipUrl(c.file_path);
    setPlayingClip({ id: c.id, title: c.title, url, tags: c.category ? [c.category] : [], addedAt: c.uploaded_at });
  }

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/portal/login");
  }

  if (!supabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-800 dark:bg-navy-950 px-4 text-white">
        <p className="text-sm text-neutral-400">The companion app isn&apos;t connected yet.</p>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-800 dark:bg-navy-950 px-4 text-white">
        <p className="text-sm text-neutral-400">Loading…</p>
      </div>
    );
  }
  if (notLinked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-800 dark:bg-navy-950 px-4 text-white">
        <div className="w-full max-w-sm rounded-card border border-white/10 bg-navy-700 dark:bg-navy-900 p-6 shadow-softDark text-center">
          <AlertCircle size={20} className="mx-auto mb-2 text-amber-300" />
          <p className="font-medium">We couldn&apos;t find a player profile with that email</p>
          <p className="mt-1.5 text-sm text-neutral-400">Ask your club to add your email to your player profile, then try again.</p>
          <button onClick={handleSignOut} className="mt-4 text-sm text-neutral-400 hover:text-white underline underline-offset-2">Sign out</button>
        </div>
      </div>
    );
  }

  const upcomingBookings = bookings.filter((b) => b.status === "scheduled");
  const pastBookings = bookings.filter((b) => b.status !== "scheduled");

  return (
    <div className="min-h-screen bg-navy-800 dark:bg-navy-950 pb-10 text-white">
      {/* Sticky condensed header — same navy/gold theme as the desktop app */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-navy-700/90 dark:bg-navy-950/90 backdrop-blur px-4 py-3.5">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-navy-950 text-xs font-bold"
              style={{ backgroundColor: branding.primaryColor }}
            >
              {branding.crestInitials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">{branding.name}</p>
              <p className="text-[11px] text-club-primary">Hi {player?.name?.split(" ")[0]}</p>
            </div>
          </div>
          <button onClick={handleSignOut} className="flex shrink-0 items-center gap-1.5 text-xs text-neutral-400 hover:text-white">
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-4 px-4 pt-4">
        {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

        {/* ---- Dashboard: always visible, no dropdown. The player's own card,
             their next fixture, a League/Form switcher and the calendar. All
             the deeper detail stays in the collapsible sections below. ---- */}

        {player && (
          <div className="rounded-card border border-white/10 bg-navy-700 dark:bg-navy-900 p-4 shadow-softDark">
            <div className="flex gap-3.5">
              <div className="relative w-[84px] shrink-0 overflow-hidden rounded-xl">
                <div className="aspect-[3/4] w-full">
                  <PlayerAvatar playerId={player.id} initials={player.initials} photoUrl={player.photo_url} size="card" />
                </div>
                <span className="absolute right-1 top-1 flex h-6 min-w-6 items-center justify-center rounded-lg bg-black/55 px-1.5 text-xs font-bold text-white backdrop-blur-sm">
                  {player.squad_number}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                <p className="truncate text-lg font-semibold leading-tight">{player.name}</p>
                <p className="truncate text-sm text-neutral-400">{player.position}</p>
                {player.nationality && (
                  <p className="truncate text-xs text-neutral-500">
                    {getCountryFlag(player.nationality)} {player.nationality}
                  </p>
                )}
                <div className="mt-1">
                  <Badge variant={availabilityVariant[player.availability] ?? "neutral"}>{player.availability_note}</Badge>
                </div>
              </div>
            </div>

            {playerStats.length > 0 && (
              <div className={`mt-3.5 grid gap-2 border-t border-white/10 pt-3.5 text-center ${playerStats.length === 5 ? "grid-cols-5" : "grid-cols-4"}`}>
                {playerStats.map((s) => (
                  <div key={s.label}>
                    <p className="text-lg font-semibold tabular-nums leading-tight">{s.value}</p>
                    <p className="text-[10px] text-neutral-500">{s.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="rounded-card border border-white/10 bg-navy-700 dark:bg-navy-900 p-4 shadow-softDark">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-neutral-500">Next Match</p>
          {!nextMatch ? (
            <p className="text-sm text-neutral-400">No upcoming fixture scheduled yet.</p>
          ) : (
            <>
              <p className="text-lg font-semibold">{nextMatch.is_home ? "vs" : "@"} {nextMatch.opponent}</p>
              <p className="mt-0.5 text-sm text-neutral-400">{formatDate(nextMatch.kickoff)} · {formatTime(nextMatch.kickoff)}{nextMatch.venue ? ` · ${nextMatch.venue}` : ""}</p>
              <DirectionsLinks venue={nextMatch.venue} className="mt-2" />
            </>
          )}
        </div>

        {/* League / Form switcher */}
        <div className="rounded-card border border-white/10 bg-navy-700 dark:bg-navy-900 p-4 shadow-softDark">
          <div className="mb-3 flex gap-1.5">
            {(["league", "form"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setDashTab(t)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  dashTab === t ? "bg-club-primary text-navy-950" : "bg-navy-600 dark:bg-navy-800 text-neutral-400 hover:text-white"
                }`}
              >
                {t === "league" ? "League Table" : "Form Guide"}
              </button>
            ))}
          </div>

          {dashTab === "league" ? (
            league.length === 0 ? (
              <p className="text-sm text-neutral-400">League table hasn&apos;t been set up yet.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-neutral-500">
                    <th className="pb-1.5 pr-2 font-medium">#</th>
                    <th className="pb-1.5 pr-2 font-medium">Team</th>
                    <th className="pb-1.5 pr-2 text-center font-medium">P</th>
                    <th className="pb-1.5 pr-2 text-center font-medium">GD</th>
                    <th className="pb-1.5 text-center font-medium">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {miniTable.map((r) => (
                    <tr key={r.id} className={r.is_own_club ? "font-semibold text-club-primary" : ""}>
                      <td className="py-1 pr-2">{r.position}</td>
                      <td className="max-w-0 truncate py-1 pr-2">{r.team}</td>
                      <td className="py-1 pr-2 text-center tabular-nums">{r.played}</td>
                      <td className="py-1 pr-2 text-center tabular-nums">{r.goals_for - r.goals_against}</td>
                      <td className="py-1 text-center font-semibold tabular-nums">{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : formGuide.length === 0 ? (
            <p className="text-sm text-neutral-400">No scored results yet.</p>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-1.5">
                {formGuide.map((f) => (
                  <Link
                    key={f.id}
                    href={`/portal/matches/${f.id}`}
                    title={`${f.opponent} ${f.score} — view match`}
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-transform hover:scale-110 ${resultColor[f.result]}`}
                  >
                    {f.result}
                  </Link>
                ))}
                <span className="ml-1 text-[10px] text-neutral-500">oldest → newest</span>
              </div>
              <ul className="divide-y divide-white/10">
                {[...formGuide].reverse().map((f) => (
                  <li key={`fg-${f.id}`}>
                    <Link href={`/portal/matches/${f.id}`} className="flex items-center gap-2.5 py-1.5 text-xs hover:text-club-primary transition-colors">
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-bold ${resultColor[f.result]}`}>{f.result}</span>
                      <span className="min-w-0 flex-1 truncate text-neutral-300">{f.opponent}</span>
                      <span className="shrink-0 tabular-nums text-neutral-400">{f.score}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Calendar — always visible, next 4 weeks of fixtures and sessions */}
        <div className="rounded-card border border-white/10 bg-navy-700 dark:bg-navy-900 p-4 shadow-softDark">
          <p className="mb-3 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
            <CalendarDays size={13} /> Calendar · next 4 weeks
          </p>
          {calendarDays.length === 0 ? (
            <p className="text-sm text-neutral-400">Nothing scheduled in the next four weeks.</p>
          ) : (
            <div className="space-y-3">
              {calendarDays.map((day) => (
                <div key={day.date} className="flex gap-3">
                  <div className="w-11 shrink-0 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-neutral-500">
                      {new Date(`${day.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short" })}
                    </p>
                    <p className="text-lg font-semibold leading-tight tabular-nums">
                      {new Date(`${day.date}T00:00:00`).getDate()}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {day.items.map((item) => {
                      const body = (
                        <div className={`rounded-lg border px-2.5 py-1.5 ${item.kind === "match" ? "border-club-primary/40 bg-club-primary/10" : "border-white/10"}`}>
                          <div className="flex items-center gap-2">
                            <p className="min-w-0 flex-1 truncate text-sm font-medium">{item.title}</p>
                            {item.time && <span className="shrink-0 text-[11px] tabular-nums text-neutral-400">{item.time}</span>}
                          </div>
                          {item.venue && <p className="truncate text-[11px] text-neutral-500">{item.venue}</p>}
                        </div>
                      );
                      return item.href ? (
                        <Link key={item.key} href={item.href} className="block transition-colors hover:brightness-125">{body}</Link>
                      ) : (
                        <div key={item.key}>{body}</div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent uploads — the same merged feed the desktop dashboard shows,
            so anything new (clip, YouTube link, image, document) surfaces here
            for players too. */}
        <div className="rounded-card border border-white/10 bg-navy-700 dark:bg-navy-900 p-4 shadow-softDark">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
            <Upload size={13} /> Recent Uploads
          </p>
          <RecentUploadsFeed limit={6} compact />
        </div>

        <Collapsible title="Matches" icon={<CalendarDays size={16} />} defaultOpen>
          <div className="mb-3 flex gap-1.5">
            {(["upcoming", "results"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setScheduleTab(t)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  scheduleTab === t ? "bg-club-primary text-navy-950" : "bg-navy-600 dark:bg-navy-800 text-neutral-400 hover:text-white"
                }`}
              >
                {t === "upcoming" ? "Upcoming" : "Recent Results"}
              </button>
            ))}
          </div>

          {scheduleTab === "upcoming" ? (
            matches.length === 0 ? (
              <p className="text-sm text-neutral-400">No upcoming fixtures scheduled yet.</p>
            ) : (
              <div className="space-y-3">
                {matches.map((m) => {
                  const docs = docsByMatch[m.id] ?? [];
                  return (
                    <div key={m.id} className="rounded-xl border border-white/10 p-3">
                      <p className="text-sm font-medium">{m.is_home ? "vs" : "@"} {m.opponent}</p>
                      <p className="mt-0.5 text-xs text-neutral-400">{formatDate(m.kickoff)} · {formatTime(m.kickoff)}{m.venue ? ` · ${m.venue}` : ""}</p>
                      {docs.length > 0 && (
                        <div className="mt-2.5 space-y-1.5 border-t border-white/10 pt-2.5">
                          {docs.map((d) => (
                            <div key={d.id} className="flex w-full items-center gap-2 rounded-lg border border-white/10 px-2.5 py-1.5 text-left text-xs">
                              <button onClick={() => handleOpenDoc(d)} className="flex min-w-0 flex-1 items-center gap-1.5 hover:text-white transition-colors">
                                <FileText size={12} className="shrink-0 text-neutral-400" />
                                <span className="flex-1 truncate">{d.file_name}</span>
                              </button>
                              {openedIds.has(d.id) && <span className="shrink-0 text-[10px] text-emerald-400">Opened</span>}
                              <button onClick={() => handleDownloadDoc(d)} title="Download" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white">
                                <Download size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : recentResults.length === 0 ? (
            <p className="text-sm text-neutral-400">No games have been played yet.</p>
          ) : (
            <ul className="divide-y divide-white/10">
              {recentResults.map((m) => {
                const scored = m.home_score !== null && m.away_score !== null;
                const gf = m.is_home ? m.home_score : m.away_score;
                const ga = m.is_home ? m.away_score : m.home_score;
                const result = scored ? (gf! > ga! ? "W" : gf! < ga! ? "L" : "D") : null;
                return (
                  <Link key={m.id} href={`/portal/matches/${m.id}`} className="flex items-center gap-3 py-2.5 text-sm hover:text-club-primary transition-colors">
                    {result ? (
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${resultColor[result]}`}>{result}</span>
                    ) : (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-neutral-400">–</span>
                    )}
                    <span className="min-w-0 flex-1 truncate">{m.is_home ? "vs" : "@"} {m.opponent}</span>
                    {scored ? (
                      <span className="shrink-0 tabular-nums text-neutral-400">{gf}-{ga}</span>
                    ) : (
                      <span className="shrink-0 text-[11px] text-neutral-500">no score</span>
                    )}
                    <span className="shrink-0 text-xs text-neutral-500">{formatDate(m.kickoff)}</span>
                  </Link>
                );
              })}
            </ul>
          )}
        </Collapsible>

        <Collapsible title="League Table & Form" icon={<Trophy size={16} />}>
          {formGuide.length > 0 && (
            <div className="mb-3 flex items-center gap-1.5">
              {formGuide.map((f) => (
                <Link
                  key={f.id}
                  href={`/portal/matches/${f.id}`}
                  title={`${f.opponent} ${f.score} — view match`}
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-transform hover:scale-110 ${resultColor[f.result]}`}
                >
                  {f.result}
                </Link>
              ))}
            </div>
          )}
          {league.length === 0 ? (
            <p className="text-sm text-neutral-400">League table hasn&apos;t been set up yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[280px] text-xs">
                <thead>
                  <tr className="text-left text-neutral-500">
                    <th className="pb-1.5 pr-2 font-medium">#</th>
                    <th className="pb-1.5 pr-2 font-medium">Team</th>
                    <th className="pb-1.5 pr-2 text-center font-medium">P</th>
                    <th className="pb-1.5 text-center font-medium">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {miniTable.map((r) => (
                    <tr key={r.id} className={r.is_own_club ? "font-semibold text-club-primary" : ""}>
                      <td className="py-1 pr-2">{r.position}</td>
                      <td className="py-1 pr-2 truncate">{r.team}</td>
                      <td className="py-1 pr-2 text-center">{r.played}</td>
                      <td className="py-1 text-center">{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Collapsible>

        <Collapsible title="My Profile" icon={<User size={16} />}>
          {player && (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between"><span className="text-neutral-500">Squad number</span><span>#{player.squad_number}</span></div>
              <div className="flex items-center justify-between"><span className="text-neutral-500">Position</span><span>{player.position}</span></div>
              <div className="flex items-center justify-between"><span className="text-neutral-500">Nationality</span><span>{getCountryFlag(player.nationality)} {player.nationality}</span></div>
              {player.dob && <div className="flex items-center justify-between"><span className="text-neutral-500">Date of birth</span><span>{player.dob}</span></div>}
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3 text-center">
                <div><p className="text-lg font-semibold">{player.appearances}</p><p className="text-[10px] text-neutral-500">Appearances</p></div>
                <div><p className="text-lg font-semibold">{player.goals}</p><p className="text-[10px] text-neutral-500">Goals</p></div>
                <div><p className="text-lg font-semibold">{player.assists}</p><p className="text-[10px] text-neutral-500">Assists</p></div>
                <div><p className="text-lg font-semibold">{player.minutes}</p><p className="text-[10px] text-neutral-500">Minutes</p></div>
              </div>
            </div>
          )}
        </Collapsible>

        {nextMatch && (
          <Collapsible title={`Opposition: ${nextMatch.opponent}`} icon={<Shield size={16} />}>
            {h2h && (
              <div className="mb-3 grid grid-cols-4 gap-2 text-center text-xs">
                <div><p className="font-semibold">{h2h.played ?? "–"}</p><p className="text-neutral-500">Played</p></div>
                <div><p className="font-semibold text-emerald-400">{h2h.won ?? "–"}</p><p className="text-neutral-500">Won</p></div>
                <div><p className="font-semibold text-amber-400">{h2h.drawn ?? "–"}</p><p className="text-neutral-500">Drawn</p></div>
                <div><p className="font-semibold text-red-400">{h2h.lost ?? "–"}</p><p className="text-neutral-500">Lost</p></div>
              </div>
            )}
            {oppReports.length === 0 ? (
              <p className="text-sm text-neutral-400">No scouting reports uploaded for this opponent yet.</p>
            ) : (
              <div className="space-y-2">
                {oppReports.map((r) => (
                  <div key={r.id}>
                    <button
                      onClick={async () => window.open(await getOppositionReportDownloadUrl(r.file_path), "_blank")}
                      className="flex w-full items-center gap-2 rounded-lg border border-white/10 px-2.5 py-2 text-left text-xs hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors"
                    >
                      <FileText size={12} className="shrink-0 text-neutral-400" />
                      <span className="flex-1 truncate">{r.file_name}</span>
                      <Download size={12} className="shrink-0 text-neutral-400" />
                    </button>
                    {r.ai_summary && <p className="mt-1 px-1 text-xs text-neutral-400">{r.ai_summary}</p>}
                  </div>
                ))}
              </div>
            )}
          </Collapsible>
        )}

        <Collapsible title="This Week: Training & Meetings" icon={<Dumbbell size={16} />}>
          {weekEvents.length === 0 ? (
            <p className="text-sm text-neutral-400">Nothing on the calendar this week.</p>
          ) : (
            <ul className="space-y-2">
              {weekEvents.map((e) => (
                <li key={e.key} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-2.5 py-2 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.title}</p>
                    <p className="text-neutral-400">{new Date(`${e.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}{e.startTime ? ` · ${e.startTime}` : ""}{e.venue ? ` · ${e.venue}` : ""}</p>
                  </div>
                  <Badge variant={e.type === "training" ? "green" : "blue"} className="shrink-0">{e.type}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Collapsible>

        <Collapsible title="Recent Clips" icon={<Film size={16} />}>
          {clips.length === 0 ? (
            <p className="text-sm text-neutral-400">No clips in the library yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {clips.map((c) => (
                <button key={c.id} onClick={() => handlePlayClip(c)} className="group relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-navy-800">
                  <Play size={20} className="text-neutral-400 group-hover:text-white transition-colors" />
                  <p className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-2 py-1 text-left text-[10px]">{c.title}</p>
                </button>
              ))}
            </div>
          )}
        </Collapsible>

        <Collapsible
          title="Book Treatment"
          icon={<HeartPulse size={16} />}
          badge={upcomingBookings.length > 0 ? <Badge variant="amber">{upcomingBookings.length}</Badge> : undefined}
        >
          {bookConfirmed && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-300">
              <Check size={13} /> Slot requested — the medical team will confirm it.
            </div>
          )}
          <button
            onClick={() => setShowBook(true)}
            className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-club-primary text-navy-950 px-3 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={14} /> Request Slot
          </button>
          {upcomingBookings.length === 0 ? (
            <p className="text-sm text-neutral-400">No upcoming treatment slots.</p>
          ) : (
            <ul className="space-y-2">
              {upcomingBookings.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-2.5 py-2 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{b.treatment_type}</p>
                    <p className="text-neutral-400">{formatDate(b.start_time)} · {formatTime(b.start_time)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge variant={statusVariant[b.status]}>{b.status}</Badge>
                    <button onClick={() => handleCancelBooking(b)} className="flex h-6 w-6 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10"><Trash2 size={12} /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {pastBookings.length > 0 && (
            <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">History</p>
              {pastBookings.slice(0, 5).map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-2 text-xs">
                  <p className="truncate text-neutral-300">{b.treatment_type} · {formatDate(b.start_time)}</p>
                  <Badge variant={statusVariant[b.status]}>{b.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Collapsible>

        {player && (
          <Collapsible title="Message the Medical Team" icon={<MessageCircle size={16} />}>
            <MessageThread playerId={player.id} viewerRole="player" viewerName={player.name} viewerEmail={player.email} />
          </Collapsible>
        )}
      </div>

      {viewing && (
        <DocumentViewerModal
          fileName={viewing.file_name}
          fileType={viewing.file_type}
          getViewUrl={() => getMatchDocumentUrl(viewing.file_path)}
          getDownloadUrl={() => getMatchDocumentDownloadUrl(viewing.file_path, viewing.file_name)}
          onClose={() => setViewing(null)}
        />
      )}

      {playingClip && <VideoPlayer clip={playingClip} onClose={() => setPlayingClip(null)} sourceClipId={playingClip.id} />}
      {playingYouTube && (
        <YouTubePlayer title={playingYouTube.title} videoId={playingYouTube.videoId} onClose={() => setPlayingYouTube(null)} />
      )}

      {showBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-card border border-white/10 bg-navy-700 dark:bg-navy-900 p-4 shadow-softDark">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-medium">Request Treatment Slot</p>
              <button onClick={() => setShowBook(false)} className="text-neutral-400 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={handleBook} className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Treatment type</label>
                <select value={treatmentType} onChange={(e) => setTreatmentType(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30">
                  {TREATMENT_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-neutral-500">Date</label>
                  <input type="date" value={bookDate} min={todayIso()} onChange={(e) => setBookDate(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
                </div>
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-neutral-500">Start time</label>
                  <input type="time" value={bookTime} onChange={(e) => setBookTime(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Duration</label>
                <select value={bookDuration} onChange={(e) => setBookDuration(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30">
                  {["15", "30", "45", "60"].map((m) => <option key={m} value={m}>{m} minutes</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Notes (optional)</label>
                <textarea value={bookNotes} onChange={(e) => setBookNotes(e.target.value)} rows={2}
                  className="w-full resize-none rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30" />
              </div>
              {bookError && (
                <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" /><p>{bookError}</p>
                </div>
              )}
              <button type="submit" disabled={booking}
                className="w-full rounded-xl bg-club-primary text-navy-950 px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60">
                {booking ? "Requesting…" : "Request Slot"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
