"use client";

import { Search, Bell, Sparkles } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

export function Topbar() {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-black/5 dark:border-white/10 bg-white/80 dark:bg-neutral-950/80 backdrop-blur px-6 py-4 sticky top-0 z-10">
      <div className="relative w-full max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          type="text"
          placeholder="Search players, matches, documents..."
          className="w-full rounded-xl border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          className="flex h-9 w-9 items-center justify-center rounded-full border border-black/5 dark:border-white/10 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          aria-label="AI Assistant"
        >
          <Sparkles size={16} />
        </button>
        <button
          className="flex h-9 w-9 items-center justify-center rounded-full border border-black/5 dark:border-white/10 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          aria-label="Notifications"
        >
          <Bell size={16} />
        </button>
        <ThemeToggle />
        <div className="ml-1 h-9 w-9 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-xs font-semibold">
          HO
        </div>
      </div>
    </header>
  );
}
