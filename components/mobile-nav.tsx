"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { club } from "@/lib/sample-data";
import { loadClubSettings } from "@/lib/club-settings";
import { usePermissions } from "@/lib/permissions";
import { getNavItems } from "@/lib/nav-items";

// The desktop sidebar hides itself below the md breakpoint, which left
// phones and small tablets with zero way to navigate between modules. This
// is the mobile replacement: a hamburger trigger plus a full-height slide-out
// drawer, using the exact same nav list (and permission filtering) as the
// desktop sidebar so the two can never fall out of sync with each other.
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [branding, setBranding] = useState(club);
  const { can, role } = usePermissions();

  useEffect(() => {
    setBranding(loadClubSettings(club));
  }, []);

  // Close automatically if the user navigates (e.g. via browser back/forward).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const visibleItems = getNavItems(role).filter((item) => can(item.module));

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-navy-700 dark:bg-navy-900 hover:bg-navy-600 dark:hover:bg-navy-800 transition-colors md:hidden"
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col bg-navy-700 dark:bg-navy-950 shadow-softDark">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-navy-800">
                  <Image
                    src="/club-badge.png"
                    alt={`${branding.name} crest`}
                    fill
                    sizes="36px"
                    className="object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold leading-tight text-white">{branding.name}</p>
                  <p className="text-xs text-club-primary">ClubOS</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
              {visibleItems.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium transition-colors",
                      active
                        ? "bg-navy-600 dark:bg-navy-800 text-club-primary"
                        : "text-navy-200 dark:text-navy-300 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white"
                    )}
                  >
                    <Icon size={19} strokeWidth={1.75} />
                    {label}
                  </Link>
                );
              })}
            </nav>

            {can("settings") && (
              <div className="border-t border-white/10 px-3 py-3">
                <Link
                  href="/settings"
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium transition-colors",
                    pathname === "/settings"
                      ? "bg-navy-600 dark:bg-navy-800 text-white"
                      : "text-navy-200 dark:text-navy-300 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white"
                  )}
                >
                  <Settings size={19} strokeWidth={1.75} />
                  Settings
                </Link>
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
