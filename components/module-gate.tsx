"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePermissions, type AppModule } from "@/lib/permissions";
import { supabaseConfigured } from "@/lib/supabase";

// Maps a URL prefix to the module it belongs to, for role-based access.
const ROUTE_MODULES: [string, AppModule][] = [
  ["/dashboard", "dashboard"],
  ["/matches", "matches"],
  ["/players", "players"],
  ["/opposition", "opposition"],
  ["/analysis", "analysis"],
  ["/training", "training"],
  ["/medical", "medical"],
  ["/recruitment", "recruitment"],
  ["/documents", "documents"],
  ["/calendar", "calendar"],
  ["/settings", "settings"],
  ["/staff", "staff"],
  ["/treatment", "treatment"],
];

// Routes with their own separate access model (magic-link player portal,
// the login screen itself) — not gated by module permissions.
const UNGATED_PREFIXES = ["/portal", "/login"];

function moduleForPath(pathname: string): AppModule | null {
  for (const [prefix, mod] of ROUTE_MODULES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return mod;
  }
  return null;
}

export function ModuleGate({ children }: { children: ReactNode }) {
  const { role, loading, can } = usePermissions();
  const pathname = usePathname();
  const router = useRouter();

  const ungated = UNGATED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const module = ungated ? null : moduleForPath(pathname);
  const blocked = !ungated && !loading && supabaseConfigured && module !== null && !can(module);

  useEffect(() => {
    if (blocked) router.replace("/dashboard");
  }, [blocked, router]);

  if (ungated || !supabaseConfigured) return <>{children}</>;

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-navy-900 text-sm text-neutral-400">
        Loading…
      </div>
    );
  }

  if (!role) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-navy-900 px-6 text-center text-white">
        <div>
          <p className="text-lg font-semibold">No access set up yet</p>
          <p className="mt-2 max-w-sm text-sm text-neutral-400">
            Your account isn&apos;t attached to a role in ClubOS yet. Ask an owner or manager to add you from the Staff module.
          </p>
        </div>
      </div>
    );
  }

  if (blocked) return null; // redirect in flight

  return <>{children}</>;
}
