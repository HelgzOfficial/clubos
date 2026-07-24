import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  nextMatch,
  todaysSchedule,
  playerAvailability,
  injuryList,
  weather,
  kpis,
  staffTasks,
  latestClips,
} from "@/lib/sample-data";
import { CloudSun, Clock, ShieldAlert } from "lucide-react";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function countdown(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Kicked off";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  return `${days}d ${hours}h`;
}

const statusVariant: Record<string, "green" | "amber" | "red"> = {
  green: "green",
  amber: "amber",
  red: "red",
};

export default function DashboardPage() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Good afternoon, Helge</h1>
        <p className="text-sm text-neutral-500">Here's what's happening at the club today.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Next match countdown */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Next Match</CardTitle>
            <Badge variant="neutral">{nextMatch.venue}</Badge>
          </CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xl font-semibold">vs {nextMatch.opponent}</p>
              <p className="text-sm text-neutral-500">{nextMatch.competition}</p>
              <p className="text-sm text-neutral-500">{formatDateTime(nextMatch.date)} — {nextMatch.ground}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold tabular-nums" style={{ color: "#0A5C36" }}>
                {countdown(nextMatch.date)}
              </p>
              <p className="text-xs text-neutral-400">until kickoff</p>
            </div>
          </div>
        </Card>

        {/* Weather */}
        <Card>
          <CardHeader>
            <CardTitle>Weather</CardTitle>
            <CloudSun size={18} className="text-neutral-400" />
          </CardHeader>
          <p className="text-3xl font-bold">{weather.tempC}°C</p>
          <p className="text-sm text-neutral-500">{weather.condition}</p>
          <p className="text-xs text-neutral-400 mt-1">
            Wind {weather.windKph}km/h · Rain {weather.chanceOfRain}%
          </p>
        </Card>

        {/* Today's schedule */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Today's Schedule</CardTitle>
            <Clock size={18} className="text-neutral-400" />
          </CardHeader>
          <ul className="space-y-3">
            {todaysSchedule.map((item) => (
              <li key={item.title} className="flex items-center gap-4 text-sm">
                <span className="w-14 shrink-0 font-medium text-neutral-500">{item.time}</span>
                <div className="flex-1">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-neutral-400">{item.location} · {item.group}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        {/* Player availability */}
        <Card>
          <CardHeader>
            <CardTitle>Player Availability</CardTitle>
          </CardHeader>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold">{playerAvailability.available}</p>
            <p className="text-sm text-neutral-400">/ {playerAvailability.total} available</p>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800 flex">
            <div className="bg-emerald-500 h-full" style={{ width: `${(playerAvailability.available / playerAvailability.total) * 100}%` }} />
            <div className="bg-amber-400 h-full" style={{ width: `${(playerAvailability.doubtful / playerAvailability.total) * 100}%` }} />
            <div className="bg-red-500 h-full" style={{ width: `${(playerAvailability.unavailable / playerAvailability.total) * 100}%` }} />
          </div>
          <div className="mt-3 flex gap-4 text-xs text-neutral-500">
            <span>🟢 {playerAvailability.available} available</span>
            <span>🟡 {playerAvailability.doubtful} doubtful</span>
            <span>🔴 {playerAvailability.unavailable} out</span>
          </div>
        </Card>

        {/* Injury list */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Injury List</CardTitle>
            <ShieldAlert size={18} className="text-neutral-400" />
          </CardHeader>
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {injuryList.map((p) => (
              <li key={p.name} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-neutral-400">{p.injury}</p>
                </div>
                <div className="text-right">
                  <Badge variant={statusVariant[p.status]}>{p.status.toUpperCase()}</Badge>
                  <p className="text-xs text-neutral-400 mt-1">Back {p.expectedReturn}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        {/* KPI widgets */}
        <Card>
          <CardHeader>
            <CardTitle>Club KPIs</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-2 gap-4">
            {kpis.map((kpi) => (
              <div key={kpi.label}>
                <p className="text-lg font-semibold">{kpi.value}</p>
                <p className="text-xs text-neutral-400 leading-tight">{kpi.label}</p>
                <p className={`text-xs mt-0.5 ${kpi.trend.startsWith("-") ? "text-red-500" : "text-emerald-500"}`}>{kpi.trend}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Staff tasks */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Staff Tasks</CardTitle>
          </CardHeader>
          <ul className="space-y-2.5">
            {staffTasks.map((t) => (
              <li key={t.task} className="flex items-center justify-between text-sm">
                <span>{t.task}</span>
                <span className="text-xs text-neutral-400 shrink-0 ml-3">{t.owner} · {t.due}</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Latest clips */}
        <Card>
          <CardHeader>
            <CardTitle>Latest Clips</CardTitle>
          </CardHeader>
          <ul className="space-y-2.5">
            {latestClips.map((c) => (
              <li key={c.title} className="flex items-center justify-between text-sm">
                <span>{c.title}</span>
                <span className="text-xs text-neutral-400">{c.duration}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}
