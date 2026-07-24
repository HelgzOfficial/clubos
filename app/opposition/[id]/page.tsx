import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { opposition, matches } from "@/lib/sample-data";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, ShieldAlert, Target, Users } from "lucide-react";

const formColor: Record<string, string> = {
  W: "bg-emerald-500", D: "bg-amber-400", L: "bg-red-500",
};

const statusVariant = { "Not started": "neutral", "In progress": "amber", Ready: "green" } as const;

export function generateStaticParams() {
  return opposition.map((o) => ({ id: o.id }));
}

export default function OppositionDetailPage({ params }: { params: { id: string } }) {
  const team = opposition.find((o) => o.id === params.id);
  if (!team) notFound();
  const match = matches.find((m) => m.id === team.matchId);

  return (
    <AppShell>
      <Link href="/opposition" className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
        <ArrowLeft size={14} /> Back to Opposition
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-sm font-semibold shrink-0">
          {team.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold">{team.name}</h1>
          <p className="text-sm text-neutral-500">
            {team.formation} · {team.leaguePosition}
            {team.leaguePosition === 1 ? "st" : team.leaguePosition === 2 ? "nd" : team.leaguePosition === 3 ? "rd" : "th"} in league
            {match && <> · {match.status === "upcoming" ? "Next meeting" : "Last meeting"} {new Date(match.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ({match.venue})</>}
          </p>
        </div>
        <Badge variant={statusVariant[team.reportStatus]}>{team.reportStatus}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Recent Form</CardTitle></CardHeader>
          <div className="flex items-center gap-2">
            {team.form.map((r, i) => (
              <span key={i} className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white ${formColor[r]}`}>
                {r}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-neutral-400">Oldest → most recent</p>
        </Card>

        <Card>
          <CardHeader><CardTitle>Head-to-Head</CardTitle></CardHeader>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div><p className="text-lg font-semibold">{team.headToHead.played}</p><p className="text-xs text-neutral-400">Played</p></div>
            <div><p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{team.headToHead.won}</p><p className="text-xs text-neutral-400">Won</p></div>
            <div><p className="text-lg font-semibold text-amber-500">{team.headToHead.drawn}</p><p className="text-xs text-neutral-400">Drawn</p></div>
            <div><p className="text-lg font-semibold text-red-600 dark:text-red-400">{team.headToHead.lost}</p><p className="text-xs text-neutral-400">Lost</p></div>
          </div>
          <p className="mt-3 text-xs text-neutral-400">Last meeting: {team.lastMeeting.date} — {team.lastMeeting.result}</p>
        </Card>

        <Card>
          <CardHeader><CardTitle>Playing Style</CardTitle></CardHeader>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">{team.style}</p>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Strengths</CardTitle>
            <ShieldCheck size={18} className="text-emerald-500" />
          </CardHeader>
          <ul className="space-y-2 text-sm">
            {team.strengths.map((s) => (
              <li key={s} className="flex gap-2"><span className="text-emerald-500">•</span>{s}</li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weaknesses</CardTitle>
            <ShieldAlert size={18} className="text-red-500" />
          </CardHeader>
          <ul className="space-y-2 text-sm">
            {team.weaknesses.map((s) => (
              <li key={s} className="flex gap-2"><span className="text-red-500">•</span>{s}</li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Set Pieces</CardTitle>
            <Target size={18} className="text-neutral-400" />
          </CardHeader>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">{team.setPieces}</p>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Key Players</CardTitle>
            <Users size={18} className="text-neutral-400" />
          </CardHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {team.keyPlayers.map((p) => (
              <div key={p.name} className="flex items-start gap-3 rounded-xl border border-black/5 dark:border-white/10 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs font-semibold shrink-0">
                  {p.name.split(" ").map((w) => w[0]).join("")}
                </div>
                <div>
                  <p className="text-sm font-medium">{p.name} <span className="text-xs text-neutral-400 font-normal">· {p.position}</span></p>
                  <p className="text-xs text-neutral-500 mt-0.5">{p.note}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
