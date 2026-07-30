"use client";

import { useState } from "react";
import { Search, Bell, Sparkles, LogOut } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { MobileNav } from "./mobile-nav";
import { useAuth } from "@/lib/auth";

function initialsFromEmail(email?: string | null) {
  if (!email) return "?";
  const name = email.split("@")[0];
  return name.slice(0, 2).toUpperCase();
}

export function Topbar() {
  const { session, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-navy-700/90 dark:bg-navy-950/90 backdrop-blur px-4 py-3 sm:gap-4 sm:px-6 sm:py-4 sticky top-0 z-10">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <MobileNav />
        <div className="relative w-full max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-navy-700 dark:bg-navy-900 hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors"
          aria-label="AI Assistant"
        >
          <Sparkles size={16} />
        </button>
        <button
          className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-navy-700 dark:bg-navy-900 hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors"
          aria-label="Notifications"
        >
          <Bell size={16} />
        </button>
        <ThemeToggle />
        <div className="relative ml-1">
          <button
            onClick={() => setOpen((v) => !v)}
            className="h-9 w-9 rounded-full bg-navy-500 dark:bg-navy-700 flex items-center justify-center text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            {initialsFromEmail(session?.user?.email)}
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-11 z-20 w-52 rounded-xl border border-white/10 bg-navy-700 dark:bg-navy-900 p-2 shadow-softDark">
                <p className="truncate px-2 py-1.5 text-xs text-neutral-400">{session?.user?.email ?? "Not signed in"}</p>
                <button
                  onClick={() => signOut()}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
