"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase, supabaseConfigured } from "./supabase";
import { useAuth } from "./auth";

export type AppRole = "owner" | "manager" | "head_coach" | "goalkeeper_coach" | "analyst" | "doctor_physio" | "player";

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: "Owner",
  manager: "Manager",
  head_coach: "Head Coach",
  goalkeeper_coach: "Goalkeeper Coach",
  analyst: "Analyst",
  doctor_physio: "Doctor / Physio",
  player: "Player",
};

export const ALL_ROLES: AppRole[] = ["owner", "manager", "head_coach", "goalkeeper_coach", "analyst", "doctor_physio", "player"];

export type AppModule =
  | "dashboard" | "matches" | "players" | "opposition" | "analysis" | "training"
  | "medical" | "recruitment" | "documents" | "calendar" | "settings" | "staff" | "treatment";

// Modules a "player" role can see at all — everything else (medical,
// recruitment, settings, staff) is hidden from their nav and blocked if
// they try to visit the URL directly. "treatment" is the player's own
// self-service booking page — a narrow slice of Medical, not the module itself.
const PLAYER_MODULES: AppModule[] = ["dashboard", "matches", "opposition", "analysis", "training", "players", "documents", "calendar", "treatment"];

// Modules restricted to owner/manager regardless of role, since they touch
// club administration rather than football operations.
const OWNER_MANAGER_ONLY: AppModule[] = ["settings", "staff"];

// "treatment" (the player self-booking page) is only meaningful for players
// themselves and the people who run Medical — coaching roles have no reason
// to see it, so it isn't opened up to "everyone" the way most modules are.
const TREATMENT_ROLES: AppRole[] = ["player", "doctor_physio", "owner", "manager"];

// Modules a coaching role (head coach / goalkeeper coach / analyst) can
// actually edit — everywhere else they see read-only.
const COACHING_WRITE_MODULES: AppModule[] = ["opposition", "analysis", "training", "documents"];

export type AppUserRecord = {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  player_id: string | null;
  invite_status: "pending" | "accepted";
  invited_at: string;
  accepted_at: string | null;
  created_at: string;
};

export function canAccessModule(role: AppRole | null, module: AppModule): boolean {
  if (!role) return false;
  if (module === "treatment") return TREATMENT_ROLES.includes(role);
  if (role === "player") return PLAYER_MODULES.includes(module);
  if (OWNER_MANAGER_ONLY.includes(module)) return role === "owner" || role === "manager";
  return true;
}

export function canWriteModule(role: AppRole | null, module: AppModule): boolean {
  if (!role) return false;
  if (module === "treatment") return TREATMENT_ROLES.includes(role); // booking your own slot counts as "writing" the treatment page
  if (role === "owner" || role === "manager") return true;
  if (role === "head_coach" || role === "goalkeeper_coach" || role === "analyst") return COACHING_WRITE_MODULES.includes(module);
  if (role === "doctor_physio") return module === "medical";
  return false; // player role — read-only everywhere else
}

type PermissionsContextValue = {
  loading: boolean;
  appUser: AppUserRecord | null;
  role: AppRole | null;
  can: (module: AppModule) => boolean;
  canWrite: (module: AppModule) => boolean;
};

const PermissionsContext = createContext<PermissionsContextValue>({
  loading: true,
  appUser: null,
  role: null,
  can: () => false,
  canWrite: () => false,
});

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const [appUser, setAppUser] = useState<AppUserRecord | null>(null);
  const [fallbackOwner, setFallbackOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabaseConfigured || !supabase || !session?.user?.email) {
        setAppUser(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      const email = session.user.email.toLowerCase();
      const { data } = await supabase.from("app_users").select("*").ilike("email", email).maybeSingle();
      if (cancelled) return;
      if (data) {
        setAppUser(data as AppUserRecord);
        setFallbackOwner(false);
        if ((data as AppUserRecord).invite_status === "pending") {
          await supabase.from("app_users").update({ invite_status: "accepted", accepted_at: new Date().toISOString() }).eq("id", data.id);
        }
      } else {
        // No app_users table populated yet (fresh install, migration not run) —
        // don't lock the only person who can log in out of their own app.
        const { count } = await supabase.from("app_users").select("id", { count: "exact", head: true });
        setFallbackOwner(!count);
        setAppUser(null);
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [session?.user?.email]);

  const role: AppRole | null = appUser?.role ?? (fallbackOwner ? "owner" : null);

  const value: PermissionsContextValue = {
    loading: authLoading || loading,
    appUser,
    role,
    can: (module) => canAccessModule(role, module),
    canWrite: (module) => canWriteModule(role, module),
  };

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions() {
  return useContext(PermissionsContext);
}
