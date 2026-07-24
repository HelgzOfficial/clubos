import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PitchPosition } from "@/components/pitch-position";
import { players } from "@/lib/sample-data";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Film } from "lucide-react";

const statusVariant = { green: "green", amber: "amber", red: "red" } as const;

function formatDob(iso: string) {
  const dob = new Date(iso);
  const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
  return `${dob.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} (age ${age})`;
}

export function generateStaticParams() {
  return players.map((p) => ({ id: p.id }));
}

export default function PlayerProfilePage({ params }: { params: { id: string } }) {
  const player = players.find((p) => p.id === params.id);
  if (!player) notFound();

  return (
    <AppShell>
      <Link href="/players" className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-white">
        <ArrowLeft size={14} /> Back to Players
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-navy-600 dark:bg-navy-800 text-lg font-semibold shrink-0">
          {player.initials}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold">{player.name}</h1>
          <p className="text-sm text-neutral-500">#{player.squadNumber} · {player.position} · {player.nationality}</p>
        </div>
        <Badge variant={statusVariant[player.availability]}>{player.availabilityNote}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Position</CardTitle></CardHeader>
          <PitchPosition x={player.pitchX} y={player.pitchY} />
        </Card>

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
                <p className="font-medium">{player.nationality}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-400">Squad Number</p>
                <p className="font-medium">#{player.squadNumber}</p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader><CardTitle>Season Statistics</CardTitle></CardHeader>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-center">
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
            </div>
          </Card>

          <Card>
            <CardHeader><CardTitle>GPS Metrics (season avg. per match)</CardTitle></CardHeader>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xl font-semibold">{player.gps.distanceKm} km</p>
                <p className="text-xs text-neutral-400">Distance</p>
              </div>
              <div>
                <p className="text-xl font-semibold">{player.gps.topSpeedKph} km/h</p>
                <p className="text-xs text-neutral-400">Top Speed</p>
              </div>
              <div>
                <p className="text-xl font-semibold">{player.gps.sprints}</p>
                <p className="text-xs text-neutral-400">Sprints</p>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Injury History</CardTitle></CardHeader>
          {player.injuryHistory.length === 0 ? (
            <p className="text-sm text-neutral-400">No recorded injuries this season.</p>
          ) : (
            <ul className="space-y-2.5">
              {player.injuryHistory.map((inj, i) => (
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
