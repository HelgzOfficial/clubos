"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BodyMap } from "@/components/body-map";
import { players, activeInjuries, rehabStages } from "@/lib/sample-data";
import { ChevronDown } from "lucide-react";

const statusVariant = { green: "green", amber: "amber", red: "red" } as const;
const statusLabel = { green: "Available", amber: "Doubtful", unavailable: "Unavailable" } as const;

export default function MedicalPage() {
  const [openId, setOpenId] = useState<string | null>("p3");

  const counts = {
    green: players.filter((p) => p.availability === "green").length,
    amber: players.filter((p) => p.availability === "amber").length,
    red: players.filter((p) => p.availability === "red").length,
  };

  // Players with an active injury first, then everyone else.
  const injuredIds = new Set(activeInjuries.map((i) => i.playerId));
  const ordered = [...players].sort((a, b) => {
    const aInjured = injuredIds.has(a.id) ? 0 : 1;
    const bInjured = injuredIds.has(b.id) ? 0 : 1;
    return aInjured - bInjured;
  });

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Medical Centre</h1>
        <p className="text-sm text-neutral-500">Squad availability, injury tracking, and rehab progress.</p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <Card className="text-center">
          <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">{counts.green}</p>
          <p className="text-xs text-neutral-400">Available</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-semibold text-amber-600 dark:text-amber-400">{counts.amber}</p>
          <p className="text-xs text-neutral-400">Doubtful</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-semibold text-red-600 dark:text-red-400">{counts.red}</p>
          <p className="text-xs text-neutral-400">Unavailable</p>
        </Card>
      </div>

      <div className="space-y-3">
        {ordered.map((p) => {
          const injury = activeInjuries.find((i) => i.playerId === p.id);
          const isOpen = openId === p.id;
          return (
            <Card key={p.id} className="p-0 overflow-hidden">
              <button
                onClick={() => setOpenId(isOpen ? null : p.id)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs font-semibold shrink-0">
                  {p.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{p.name}</p>
                  <p className="text-xs text-neutral-400">#{p.squadNumber} · {p.position}</p>
                </div>
                <Badge variant={statusVariant[p.availability]}>{p.availabilityNote}</Badge>
                {injury && (
                  <ChevronDown size={16} className={`text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                )}
              </button>

              {isOpen && injury && (
                <div className="border-t border-black/5 dark:border-white/10 px-5 py-5">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Injury Location</p>
                      <BodyMap markers={[{ bodyPart: injury.bodyPart, label: injury.injury, severity: injury.severity }]} />
                    </div>

                    <div className="md:col-span-2 space-y-5">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1">Diagnosis</p>
                        <p className="text-sm font-medium">{injury.injury}</p>
                        <p className="text-xs text-neutral-400">Occurred {injury.dateOccurred} · Expected return {injury.expectedReturn}</p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">Rehab Stage</p>
                        <div className="flex items-center gap-1">
                          {rehabStages.map((stage, i) => (
                            <div key={stage} className="flex-1">
                              <div
                                className={`h-1.5 rounded-full ${i <= injury.rehabStage ? "bg-emerald-500" : "bg-neutral-200 dark:bg-neutral-800"}`}
                              />
                            </div>
                          ))}
                        </div>
                        <p className="mt-1.5 text-xs text-neutral-500">
                          Stage {injury.rehabStage + 1} of {rehabStages.length}: <span className="font-medium">{rehabStages[injury.rehabStage]}</span>
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1">Medical Notes</p>
                        <p className="text-sm text-neutral-600 dark:text-neutral-300">{injury.notes}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
