export type ClubSettings = {
  name: string;
  crestInitials: string;
  primaryColor: string;
};

export type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: "Owner" | "Admin" | "Head Coach" | "Assistant Coach" | "Analyst" | "Medical" | "Recruitment" | "Player";
};

const SETTINGS_KEY = "clubos_club_settings_v1";
const STAFF_KEY = "clubos_staff_v1";

export const defaultStaff: StaffMember[] = [
  { id: "s1", name: "Helge Orome", email: "helge.orome@wwfc.com", role: "Owner" },
  { id: "s2", name: "Dan Whitcombe", email: "dan.whitcombe@riversidefc.com", role: "Head Coach" },
  { id: "s3", name: "Priya Nandan", email: "priya.nandan@riversidefc.com", role: "Analyst" },
  { id: "s4", name: "Chris Ojo", email: "chris.ojo@riversidefc.com", role: "Medical" },
];

export function loadClubSettings(fallback: ClubSettings): ClubSettings {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function saveClubSettings(settings: ClubSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadStaff(): StaffMember[] {
  if (typeof window === "undefined") return defaultStaff;
  try {
    const raw = window.localStorage.getItem(STAFF_KEY);
    return raw ? JSON.parse(raw) : defaultStaff;
  } catch {
    return defaultStaff;
  }
}

export function saveStaff(staff: StaffMember[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STAFF_KEY, JSON.stringify(staff));
}
