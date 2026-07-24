"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { club } from "@/lib/sample-data";
import {
  LayoutDashboard,
  Swords,
  Shield,
  Film,
  Dumbbell,
  Users,
  Stethoscope,
  UserSearch,
  FolderOpen,
  CalendarDays,
  Settings,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/matches", label: "Matches", icon: Swords },
  { href: "/opposition", label: "Opposition", icon: Shield },
  { href: "/analysis", label: "Analysis", icon: Film },
  { href: "/training", label: "Training", icon: Dumbbell },
  { href: "/players", label: "Players", icon: Users },
  { href: "/medical", label: "Medical", icon: Stethoscope },
  { href: "/recruitment", label: "Recruitment", icon: UserSearch },
  { href: "/documents", label: "Documents", icon: FolderOpen },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col border-r border-black/5 dark:border-white/10 bg-white dark:bg-neutral-950 shrink-0">
      <div className="flex items-center gap-3 px-6 py-6">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl text-white text-xs font-bold"
          style={{ backgroundColor: club.primaryColor }}
        >
          {club.crestInitials}
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">{club.name}</p>
          <p className="text-xs text-neutral-400">ClubOS</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white"
                  : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900 hover:text-neutral-900 dark:hover:text-white"
              )}
            >
              <Icon size={18} strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-6">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            pathname === "/settings"
              ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white"
              : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900 hover:text-neutral-900 dark:hover:text-white"
          )}
        >
          <Settings size={18} strokeWidth={1.75} />
          Settings
        </Link>
      </div>
    </aside>
  );
}
