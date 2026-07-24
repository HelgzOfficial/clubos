"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";

const PRESETS = [1, 2, 5, 10, 15];

export function SessionTimer() {
  const [totalSeconds, setTotalSeconds] = useState(5 * 60);
  const [remaining, setRemaining] = useState(5 * 60);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) {
            setRunning(false);
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  function setPreset(min: number) {
    setRunning(false);
    setTotalSeconds(min * 60);
    setRemaining(min * 60);
  }

  function reset() {
    setRunning(false);
    setRemaining(totalSeconds);
  }

  const mins = Math.floor(remaining / 60).toString().padStart(2, "0");
  const secs = (remaining % 60).toString().padStart(2, "0");
  const atZero = remaining === 0;

  return (
    <div>
      <div className={`mb-4 rounded-2xl py-6 text-center transition-colors ${atZero ? "bg-red-500 text-white" : "bg-neutral-100 dark:bg-neutral-800"}`}>
        <p className="text-4xl font-bold tabular-nums">{mins}:{secs}</p>
        <p className={`text-xs mt-1 ${atZero ? "text-white/80" : "text-neutral-400"}`}>{atZero ? "Time's up" : running ? "Running" : "Paused"}</p>
      </div>

      <div className="mb-4 flex items-center justify-center gap-2">
        <button
          onClick={() => setRunning((r) => !r)}
          disabled={atZero}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-club-primary text-white disabled:opacity-40"
        >
          {running ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button
          onClick={reset}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-black/5 dark:border-white/10 text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      <div className="flex flex-wrap justify-center gap-1.5">
        {PRESETS.map((m) => (
          <button
            key={m}
            onClick={() => setPreset(m)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              totalSeconds === m * 60
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            {m}m
          </button>
        ))}
      </div>
    </div>
  );
}
