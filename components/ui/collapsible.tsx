"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

// A single accordion-style section — used to keep a data-dense page (like
// the player companion app) readable on a small screen without splitting
// it into a dozen separate pages: everything's on one screen, but only the
// section someone actually wants is expanded at a time.
//
// Works either uncontrolled (its own state, via defaultOpen) or controlled
// (pass `open` + `onOpenChange`) so something outside — e.g. a "see all"
// button on the dashboard above — can expand it.
export function Collapsible({
  title, icon, badge, defaultOpen = false, open, onOpenChange, id, children,
}: {
  title: string;
  icon?: ReactNode;
  badge?: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  id?: string;
  children: ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  function toggle() {
    const next = !isOpen;
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  }

  return (
    <div id={id} className="scroll-mt-20 overflow-hidden rounded-card border border-white/10 bg-navy-700 dark:bg-navy-900 shadow-softDark">
      <button
        onClick={toggle}
        className="touch-manipulation flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        {icon && <span className="shrink-0 text-club-primary">{icon}</span>}
        <span className="flex-1 min-w-0 truncate font-medium">{title}</span>
        {badge}
        <ChevronDown size={16} className={`shrink-0 text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && <div className="border-t border-white/10 px-4 py-4">{children}</div>}
    </div>
  );
}
