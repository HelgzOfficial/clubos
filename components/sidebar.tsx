"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { club } from "@/lib/sample-data";
import { loadClubSettings } from "@/lib/club-settings";
import { usePermissions, type AppModule } from "@/lib/permissions";
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
  ShieldCheck,
  HeartPulse,
} from "lucide-react";

const navItems: { href: string; label: string; icon: typeof LayoutDashboard; module: AppModule }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" },
  { href: "/matches", label: "Matches", icon: Swords, module: "matches" },
  { href: "/opposition", label: "Opposition", icon: Shield, module: "opposition" },
  { href: "/analysis", label: "Analysis", icon: Film, module: "analysis" },
  { href: "/training", label: "Training", icon: Dumbbell, module: "training" },
  { href: "/players", label: "Players", icon: Users, module: "players" },
  { href: "/medical", label: "Medical", icon: Stethoscope, module: "medical" },
  { href: "/recruitment", label: "Recruitment", icon: UserSearch, module: "recruitment" },
  { href: "/documents", label: "Documents", icon: FolderOpen, module: "documents" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, module: "calendar" },
  { href: "/staff", label: "Staff", icon: ShieldCheck, module: "staff" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [branding, setBranding] = useState(club);
  const { can, role } = usePermissions();

  useEffect(() => {
    setBranding(loadClubSettings(club));
  }, []);

  // "Book Treatment" only makes sense as its own nav entry for players —
  // everyone else who can reach it (doctor/physio, owner, manager) already
  // has the full Medical module for that.
  const items = role === "player"
    ? [...navItems, { href: "/treatment", label: "Book Treatment", icon: HeartPulse, module: "treatment" as AppModule }]
    : navItems;
  const visibleItems = items.filter((item) => can(item.module));

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col border-r border-white/10 bg-navy-700 dark:bg-navy-950 shrink-0">
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-navy-800">
          <Image
            src="/club-badge.png"
            alt={`${branding.name} crest`}
            fill
            sizes="36px"
            className="object-cover"
            onError={(e) => {
              // Fall back to the initials chip if the crest image is ever missing.
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight text-white">{branding.name}</p>
          <p className="text-xs text-club-primary">ClubOS</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {visibleItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-navy-600 dark:bg-navy-800 text-club-primary"
                  : "text-navy-200 dark:text-navy-300 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white"
              )}
            >
              <Icon size={18} strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-6">
        {can("settings") && (
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            pathname === "/settings"
              ? "bg-navy-600 dark:bg-navy-800 text-white"
              : "text-navy-200 dark:text-navy-300 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white"
          )}
        >
          <Settings size={18} strokeWidth={1.75} />
          Settings
        </Link>
        )}
      </div>
    </aside>
  );
}
