"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

// A single accordion-style section — used to keep a data-dense page (like
// the player companion app) readable on a small screen without splitting
// it into a dozen separate pages: everything's on one screen, but only the
// section someone actually wants is expanded at a time.
export function Collapsible({
  title, icon, badge, defaultOpen = false, children,
}: {
  title: string;
  icon?: ReactNode;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-card border border-white/10 bg-navy-700 dark:bg-navy-900 shadow-softDark">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        {icon && <span className="shrink-0 text-club-primary">{icon}</span>}
        <span className="flex-1 min-w-0 truncate font-medium">{title}</span>
        {badge}
        <ChevronDown size={16} className={`shrink-0 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-white/10 px-4 py-4">{children}</div>}
    </div>
  );
}
