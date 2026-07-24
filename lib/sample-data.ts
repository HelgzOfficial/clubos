// Sample data so the app looks and feels real from day one.
// Once Supabase is connected, these will be replaced with live data.

export const club = {
  name: "Riverside FC",
  crestInitials: "RFC",
  primaryColor: "#0A5C36",
};

export const nextMatch = {
  opponent: "Millbrook Town",
  competition: "League Cup — Round 3",
  date: "2026-07-28T19:45:00",
  venue: "Home",
  ground: "Riverside Park",
};

export const todaysSchedule = [
  { time: "09:00", title: "Gym Session", location: "Fitness Suite", group: "First Team" },
  { time: "11:00", title: "Video Review — Millbrook Town", location: "Analysis Room", group: "Coaching Staff" },
  { time: "18:00", title: "Training Session", location: "Riverside Park — Pitch 2", group: "First Team" },
];

export const playerAvailability = {
  available: 19,
  doubtful: 2,
  unavailable: 3,
  total: 24,
};

export const injuryList = [
  { name: "Jamie Cole", injury: "Hamstring strain", status: "amber", expectedReturn: "2 Aug 2026" },
  { name: "Marcus Ade", injury: "Ankle sprain", status: "red", expectedReturn: "18 Aug 2026" },
  { name: "Tyler Rees", injury: "Concussion protocol", status: "amber", expectedReturn: "30 Jul 2026" },
];

export const weather = {
  condition: "Partly Cloudy",
  tempC: 19,
  windKph: 14,
  chanceOfRain: 20,
};

export const kpis = [
  { label: "Points this season", value: "41", trend: "+3" },
  { label: "Clean sheets", value: "9", trend: "+1" },
  { label: "Avg. attendance", value: "1,240", trend: "+6%" },
  { label: "Squad availability", value: "79%", trend: "-4%" },
];

export const staffTasks = [
  { task: "Finalise Millbrook Town opposition report", owner: "Analysis", due: "Today" },
  { task: "Confirm match-day travel for U21s", owner: "Admin", due: "Tomorrow" },
  { task: "Renew Jamie Cole's medical insurance docs", owner: "Medical", due: "3 days" },
];

export const latestClips = [
  { title: "Build-up play vs Elm Rovers", duration: "3:12" },
  { title: "Set-piece routine — corners", duration: "1:48" },
  { title: "Defensive shape, second half", duration: "5:03" },
];

export type MatchStatus = "upcoming" | "completed";

export const matches: {
  id: string;
  opponent: string;
  competition: string;
  date: string;
  venue: "Home" | "Away";
  status: MatchStatus;
  scoreFor?: number;
  scoreAgainst?: number;
}[] = [
  { id: "m1", opponent: "Millbrook Town", competition: "League Cup — Round 3", date: "2026-07-28T19:45:00", venue: "Home", status: "upcoming" },
  { id: "m2", opponent: "Elm Rovers", competition: "League", date: "2026-08-02T15:00:00", venue: "Away", status: "upcoming" },
  { id: "m3", opponent: "Castlebridge United", competition: "League", date: "2026-08-09T15:00:00", venue: "Home", status: "upcoming" },
  { id: "m4", opponent: "Nettlefield Athletic", competition: "League", date: "2026-07-19T15:00:00", venue: "Away", status: "completed", scoreFor: 2, scoreAgainst: 1 },
  { id: "m5", opponent: "Portside Wanderers", competition: "League", date: "2026-07-12T15:00:00", venue: "Home", status: "completed", scoreFor: 1, scoreAgainst: 1 },
  { id: "m6", opponent: "Elm Rovers", competition: "League Cup — Round 2", date: "2026-07-05T19:45:00", venue: "Home", status: "completed", scoreFor: 3, scoreAgainst: 0 },
];

export const calendarEvents: { date: string; title: string; type: "match" | "training" | "meeting" }[] = [
  { date: "2026-07-24", title: "Training — Full Squad", type: "training" },
  { date: "2026-07-26", title: "Recovery Session", type: "training" },
  { date: "2026-07-28", title: "vs Millbrook Town (H)", type: "match" },
  { date: "2026-07-29", title: "Staff Meeting", type: "meeting" },
  { date: "2026-07-31", title: "Training — Full Squad", type: "training" },
  { date: "2026-08-02", title: "vs Elm Rovers (A)", type: "match" },
  { date: "2026-08-05", title: "Training — Full Squad", type: "training" },
  { date: "2026-08-09", title: "vs Castlebridge United (H)", type: "match" },
];
