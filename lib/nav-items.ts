import type { AppModule, AppRole } from "./permissions";
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
  ShieldCheck,
  HeartPulse,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; module: AppModule };

export const navItems: NavItem[] = [
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

// "Book Treatment" only makes sense as its own nav entry for players —
// everyone else who can reach it (doctor/physio, owner, manager) already
// has the full Medical module for that. Shared by the desktop sidebar and
// the mobile menu so they can never drift out of sync with each other.
export function getNavItems(role: AppRole | null): NavItem[] {
  if (role === "player") {
    return [...navItems, { href: "/treatment", label: "Book Treatment", icon: HeartPulse, module: "treatment" as AppModule }];
  }
  return navItems;
}
