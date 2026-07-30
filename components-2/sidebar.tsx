"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { club } from "@/lib/sample-data";
import { loadClubSettings, saveClubSettings } from "@/lib/club-settings";
import { fetchClubSettings } from "@/lib/club-settings-db";
import { usePermissions } from "@/lib/permissions";
import { getNavItems } from "@/lib/nav-items";
import { Settings } from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const [branding, setBranding] = useState(club);
  const { can, role } = usePermissions();

  useEffect(() => {
    setBranding(loadClubSettings(club));
    fetchClubSettings(club).then((settings) => {
      setBranding(settings);
      saveClubSettings(settings);
    });
  }, []);

  const visibleItems = getNavItems(role).filter((item) => can(item.module));

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
