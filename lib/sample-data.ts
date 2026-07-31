// Sample data so the app looks and feels real from day one.
// Once Supabase is connected, these will be replaced with live data.

export const club = {
  name: "Riverside FC",
  crestInitials: "RFC",
  primaryColor: "#D4AF37",
  secondaryColor: "#E6C766",
  accentColor: "#D4AF37",
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

export type AvailabilityStatus = "green" | "amber" | "red";

export type Player = {
  id: string;
  name: string;
  initials: string;
  squadNumber: number;
  position: string;
  positionGroup: "GK" | "DEF" | "MID" | "FWD";
  pitchX: number; // 0-100, left to right
  pitchY: number; // 0-100, own goal (0) to opponent goal (100)
  dob: string;
  nationality: string;
  availability: AvailabilityStatus;
  availabilityNote: string;
  appearances: number;
  minutes: number;
  goals: number;
  assists: number;
  gps: { distanceKm: number; topSpeedKph: number; sprints: number };
  injuryHistory: { injury: string; date: string; daysOut: number }[];
  documents: { name: string; type: string }[];
  clips: { title: string; duration: string }[];
};

export const players: Player[] = [
  {
    id: "p1", name: "Sam Whitfield", initials: "SW", squadNumber: 1, position: "Goalkeeper", positionGroup: "GK",
    pitchX: 50, pitchY: 6, dob: "1996-03-14", nationality: "England",
    availability: "green", availabilityNote: "Available",
    appearances: 27, minutes: 2430, goals: 0, assists: 0,
    gps: { distanceKm: 5.1, topSpeedKph: 22.4, sprints: 3 },
    injuryHistory: [{ injury: "Finger fracture", date: "Nov 2025", daysOut: 21 }],
    documents: [{ name: "Contract 2025-27.pdf", type: "Contract" }, { name: "Medical Clearance.pdf", type: "Medical" }],
    clips: [{ title: "Penalty save vs Elm Rovers", duration: "0:22" }],
  },
  {
    id: "p2", name: "Jamie Cole", initials: "JC", squadNumber: 4, position: "Centre Back", positionGroup: "DEF",
    pitchX: 35, pitchY: 20, dob: "1998-07-02", nationality: "England",
    availability: "amber", availabilityNote: "Hamstring strain — back 2 Aug 2026",
    appearances: 24, minutes: 2160, goals: 2, assists: 1,
    gps: { distanceKm: 9.8, topSpeedKph: 27.9, sprints: 11 },
    injuryHistory: [{ injury: "Hamstring strain", date: "Jul 2026", daysOut: 14 }, { injury: "Knock — knee", date: "Feb 2026", daysOut: 5 }],
    documents: [{ name: "Contract 2024-26.pdf", type: "Contract" }],
    clips: [{ title: "Last-ditch tackle vs Portside", duration: "0:15" }],
  },
  {
    id: "p3", name: "Marcus Ade", initials: "MA", squadNumber: 5, position: "Centre Back", positionGroup: "DEF",
    pitchX: 65, pitchY: 20, dob: "1995-11-23", nationality: "Nigeria",
    availability: "red", availabilityNote: "Ankle sprain — back 18 Aug 2026",
    appearances: 22, minutes: 1980, goals: 1, assists: 0,
    gps: { distanceKm: 9.6, topSpeedKph: 26.5, sprints: 9 },
    injuryHistory: [{ injury: "Ankle sprain", date: "Jul 2026", daysOut: 28 }],
    documents: [{ name: "Contract 2023-26.pdf", type: "Contract" }, { name: "Injury Report.pdf", type: "Medical" }],
    clips: [],
  },
  {
    id: "p4", name: "Ollie Ferns", initials: "OF", squadNumber: 3, position: "Left Back", positionGroup: "DEF",
    pitchX: 12, pitchY: 22, dob: "2001-01-30", nationality: "Wales",
    availability: "green", availabilityNote: "Available",
    appearances: 26, minutes: 2280, goals: 0, assists: 5,
    gps: { distanceKm: 10.9, topSpeedKph: 30.1, sprints: 18 },
    injuryHistory: [],
    documents: [{ name: "Contract 2025-28.pdf", type: "Contract" }],
    clips: [{ title: "Assist vs Nettlefield Athletic", duration: "0:18" }],
  },
  {
    id: "p5", name: "Deshawn Brooks", initials: "DB", squadNumber: 2, position: "Right Back", positionGroup: "DEF",
    pitchX: 88, pitchY: 22, dob: "1999-05-19", nationality: "England",
    availability: "green", availabilityNote: "Available",
    appearances: 25, minutes: 2205, goals: 1, assists: 4,
    gps: { distanceKm: 10.5, topSpeedKph: 29.8, sprints: 16 },
    injuryHistory: [{ injury: "Groin strain", date: "Sep 2025", daysOut: 10 }],
    documents: [{ name: "Contract 2024-27.pdf", type: "Contract" }],
    clips: [],
  },
  {
    id: "p6", name: "Ryan Cassidy", initials: "RC", squadNumber: 6, position: "Defensive Midfield", positionGroup: "MID",
    pitchX: 50, pitchY: 38, dob: "1997-09-08", nationality: "Ireland",
    availability: "green", availabilityNote: "Available",
    appearances: 28, minutes: 2520, goals: 2, assists: 3,
    gps: { distanceKm: 11.4, topSpeedKph: 28.2, sprints: 14 },
    injuryHistory: [],
    documents: [{ name: "Contract 2025-27.pdf", type: "Contract" }],
    clips: [{ title: "Interception & counter vs Elm Rovers", duration: "0:31" }],
  },
  {
    id: "p7", name: "Tyler Rees", initials: "TR", squadNumber: 8, position: "Central Midfield", positionGroup: "MID",
    pitchX: 32, pitchY: 48, dob: "2000-02-11", nationality: "Wales",
    availability: "amber", availabilityNote: "Concussion protocol — back 30 Jul 2026",
    appearances: 23, minutes: 1890, goals: 4, assists: 6,
    gps: { distanceKm: 11.1, topSpeedKph: 29.0, sprints: 13 },
    injuryHistory: [{ injury: "Concussion", date: "Jul 2026", daysOut: 12 }],
    documents: [{ name: "Contract 2025-27.pdf", type: "Contract" }, { name: "Concussion Protocol.pdf", type: "Medical" }],
    clips: [{ title: "Long-range strike vs Castlebridge", duration: "0:12" }],
  },
  {
    id: "p8", name: "Femi Okonkwo", initials: "FO", squadNumber: 10, position: "Attacking Midfield", positionGroup: "MID",
    pitchX: 68, pitchY: 55, dob: "1999-12-04", nationality: "England",
    availability: "green", availabilityNote: "Available",
    appearances: 27, minutes: 2340, goals: 9, assists: 8,
    gps: { distanceKm: 10.2, topSpeedKph: 31.4, sprints: 21 },
    injuryHistory: [],
    documents: [{ name: "Contract 2024-27.pdf", type: "Contract" }],
    clips: [{ title: "Assist for opener vs Millbrook", duration: "0:20" }, { title: "Skill highlight reel", duration: "1:05" }],
  },
  {
    id: "p9", name: "Callum Iyer", initials: "CI", squadNumber: 7, position: "Right Wing", positionGroup: "FWD",
    pitchX: 85, pitchY: 68, dob: "2002-06-27", nationality: "England",
    availability: "green", availabilityNote: "Available",
    appearances: 24, minutes: 1980, goals: 7, assists: 5,
    gps: { distanceKm: 9.9, topSpeedKph: 33.6, sprints: 24 },
    injuryHistory: [{ injury: "Hip flexor tightness", date: "Apr 2026", daysOut: 3 }],
    documents: [{ name: "Contract 2025-28.pdf", type: "Contract" }],
    clips: [{ title: "Solo goal vs Portside Wanderers", duration: "0:27" }],
  },
  {
    id: "p10", name: "Elias Novak", initials: "EN", squadNumber: 11, position: "Left Wing", positionGroup: "FWD",
    pitchX: 15, pitchY: 68, dob: "1998-08-16", nationality: "Poland",
    availability: "green", availabilityNote: "Available",
    appearances: 26, minutes: 2160, goals: 8, assists: 6,
    gps: { distanceKm: 10.0, topSpeedKph: 32.9, sprints: 22 },
    injuryHistory: [],
    documents: [{ name: "Contract 2024-26.pdf", type: "Contract" }],
    clips: [{ title: "Free kick goal vs Elm Rovers", duration: "0:14" }],
  },
  {
    id: "p11", name: "Danny Okafor", initials: "DO", squadNumber: 9, position: "Striker", positionGroup: "FWD",
    pitchX: 50, pitchY: 80, dob: "1997-04-05", nationality: "England",
    availability: "green", availabilityNote: "Available",
    appearances: 28, minutes: 2430, goals: 16, assists: 4,
    gps: { distanceKm: 9.4, topSpeedKph: 33.1, sprints: 26 },
    injuryHistory: [{ injury: "Calf strain", date: "Jan 2026", daysOut: 9 }],
    documents: [{ name: "Contract 2023-26.pdf", type: "Contract" }, { name: "Performance Review H1.pdf", type: "Performance" }],
    clips: [{ title: "Hat-trick vs Nettlefield Athletic", duration: "2:03" }, { title: "Header goal vs Castlebridge", duration: "0:16" }],
  },
];

export type BodyPart =
  | "head" | "shoulder-l" | "shoulder-r" | "chest" | "abdomen"
  | "hip-l" | "hip-r" | "thigh-l" | "thigh-r" | "knee-l" | "knee-r"
  | "calf-l" | "calf-r" | "ankle-l" | "ankle-r" | "foot-l" | "foot-r";

// x/y are both plain percentages (0-100) positioned against the cropped
// /public/body-front.png and /public/body-back.png images.
export const bodyCoords: Record<BodyPart, { x: number; y: number }> = {
  head: { x: 50, y: 7 },
  "shoulder-l": { x: 30, y: 17 }, "shoulder-r": { x: 70, y: 17 },
  chest: { x: 50, y: 26 }, abdomen: { x: 50, y: 45 },
  "hip-l": { x: 37, y: 56 }, "hip-r": { x: 63, y: 56 },
  "thigh-l": { x: 35, y: 64 }, "thigh-r": { x: 63, y: 64 },
  "knee-l": { x: 34, y: 75 }, "knee-r": { x: 66, y: 75 },
  "calf-l": { x: 34, y: 83 }, "calf-r": { x: 66, y: 83 },
  "ankle-l": { x: 36, y: 90 }, "ankle-r": { x: 64, y: 90 },
  "foot-l": { x: 35, y: 97 }, "foot-r": { x: 67, y: 97 },
};

export const rehabStages = [
  "Assessment", "Rest & Recovery", "Gym Rehab", "Pitch Rehab", "Return to Training", "Match Fit",
];

export type ActiveInjury = {
  playerId: string;
  bodyPart: BodyPart;
  injury: string;
  severity: "mild" | "moderate" | "severe";
  dateOccurred: string;
  expectedReturn: string;
  rehabStage: number;
  notes: string;
};

export const activeInjuries: ActiveInjury[] = [
  {
    playerId: "p2", bodyPart: "thigh-l", injury: "Hamstring strain", severity: "moderate",
    dateOccurred: "14 Jul 2026", expectedReturn: "2 Aug 2026", rehabStage: 2,
    notes: "Grade 1 strain, responding well to gym-based rehab. Reassess Friday before progressing to pitch work.",
  },
  {
    playerId: "p3", bodyPart: "ankle-r", injury: "Ankle sprain", severity: "severe",
    dateOccurred: "20 Jul 2026", expectedReturn: "18 Aug 2026", rehabStage: 1,
    notes: "Grade 2 lateral ligament sprain. In a protective boot, non-weight-bearing this week. Physio 3x/week.",
  },
  {
    playerId: "p7", bodyPart: "head", injury: "Concussion protocol", severity: "moderate",
    dateOccurred: "18 Jul 2026", expectedReturn: "30 Jul 2026", rehabStage: 3,
    notes: "Graduated return-to-play protocol, stage 3 of 6. No symptoms at rest or on light exertion.",
  },
];

export type FormResult = "W" | "D" | "L";

export type Opposition = {
  id: string;
  name: string;
  matchId?: string;
  leaguePosition: number;
  form: FormResult[];
  formation: string;
  style: string;
  strengths: string[];
  weaknesses: string[];
  keyPlayers: { name: string; position: string; note: string }[];
  setPieces: string;
  headToHead: { played: number; won: number; drawn: number; lost: number };
  lastMeeting: { date: string; result: string };
  reportStatus: "Not started" | "In progress" | "Ready";
};

export const opposition: Opposition[] = [
  {
    id: "o1", name: "Millbrook Town", matchId: "m1",
    leaguePosition: 4, form: ["W", "W", "D", "L", "W"],
    formation: "4-3-3", style: "High press, quick transitions through wide forwards.",
    strengths: ["Pace in wide areas", "Set-piece delivery from corners", "Aggressive counter-press after losing the ball"],
    weaknesses: ["Vulnerable to balls in behind the full-backs", "Concede from second-ball situations in midfield", "Goalkeeper weak with crosses"],
    keyPlayers: [
      { name: "Josh Barrett", position: "Right Wing", note: "12 goals this season, cuts inside onto left foot." },
      { name: "Callum Reid", position: "CDM", note: "Controls tempo, dictates build-up from deep." },
    ],
    setPieces: "Near-post flick routine from corners; short corners on the left when trailing.",
    headToHead: { played: 6, won: 3, drawn: 2, lost: 1 },
    lastMeeting: { date: "12 Mar 2026", result: "Won 2-1 (H)" },
    reportStatus: "In progress",
  },
  {
    id: "o2", name: "Elm Rovers", matchId: "m2",
    leaguePosition: 8, form: ["L", "D", "W", "W", "D"],
    formation: "4-4-2", style: "Direct, physical, targets aerial duels with the strikers.",
    strengths: ["Dominant in the air from set pieces", "Strong defensive shape, hard to break down centrally", "Experienced back four"],
    weaknesses: ["Lacks pace at centre-back", "Struggle against high tempo passing", "Wide midfielders don't track back consistently"],
    keyPlayers: [
      { name: "Aaron Dunmore", position: "Striker", note: "Target man, wins the majority of aerial duels." },
      { name: "Liam Foster", position: "Left Back", note: "Overlaps constantly — space in behind on transition." },
    ],
    setPieces: "Zonal marking at corners; direct long throws into the box from the left touchline.",
    headToHead: { played: 5, won: 2, drawn: 1, lost: 2 },
    lastMeeting: { date: "5 Jul 2026", result: "Won 3-0 (H)" },
    reportStatus: "Ready",
  },
  {
    id: "o3", name: "Castlebridge United", matchId: "m3",
    leaguePosition: 2, form: ["W", "W", "W", "D", "W"],
    formation: "3-5-2", style: "Possession-based, patient build-up through a back three.",
    strengths: ["Retain the ball well under pressure", "Strong central midfield trio", "Two mobile strikers who interchange"],
    weaknesses: ["Wing-backs leave space behind them", "Can be rushed into errors under an aggressive press", "Third-choice keeper is error-prone with feet"],
    keyPlayers: [
      { name: "Marco Ellison", position: "CAM", note: "Top scorer and creator — 14 goals, 9 assists." },
      { name: "Sam Whitcombe", position: "Centre Back", note: "Brings the ball out from the back, can be pressed." },
    ],
    setPieces: "Short corner routines to overload the near side; low driven free kicks around the box.",
    headToHead: { played: 4, won: 1, drawn: 1, lost: 2 },
    lastMeeting: { date: "20 Feb 2026", result: "Lost 0-1 (A)" },
    reportStatus: "Not started",
  },
];

export type ClubDocument = {
  id: string;
  name: string;
  category: "Match Packs" | "Match Reports" | "Policies" | "Clips";
  linkedTo?: string;
  uploadedBy: string;
  date: string;
  fileType: "pdf" | "docx" | "xlsx" | "mp4";
  sizeKb: number;
};

export const documents: ClubDocument[] = [
  { id: "d1", name: "Millbrook Town — Match Pack.pdf", category: "Match Packs", linkedTo: "Millbrook Town", uploadedBy: "Analysis", date: "23 Jul 2026", fileType: "pdf", sizeKb: 2340 },
  { id: "d2", name: "Elm Rovers — Match Pack.pdf", category: "Match Packs", linkedTo: "Elm Rovers", uploadedBy: "Analysis", date: "16 Jul 2026", fileType: "pdf", sizeKb: 1980 },
  { id: "d3", name: "Club Code of Conduct 2026.docx", category: "Policies", uploadedBy: "Admin", date: "2 Jan 2026", fileType: "docx", sizeKb: 88 },
  { id: "d4", name: "Safeguarding Policy.pdf", category: "Policies", uploadedBy: "Admin", date: "2 Jan 2026", fileType: "pdf", sizeKb: 320 },
  { id: "d5", name: "Medical & Concussion Protocol.pdf", category: "Policies", uploadedBy: "Medical", date: "14 Feb 2026", fileType: "pdf", sizeKb: 275 },
  { id: "d6", name: "Millbrook Town — Opposition Report.docx", category: "Match Reports", linkedTo: "Millbrook Town", uploadedBy: "Analysis", date: "23 Jul 2026", fileType: "docx", sizeKb: 640 },
  { id: "d7", name: "vs Nettlefield Athletic — Match Report.pdf", category: "Match Reports", uploadedBy: "Analysis", date: "19 Jul 2026", fileType: "pdf", sizeKb: 512 },
  { id: "d8", name: "vs Portside Wanderers — Match Report.pdf", category: "Match Reports", uploadedBy: "Analysis", date: "12 Jul 2026", fileType: "pdf", sizeKb: 498 },
  { id: "d9", name: "Build-up play vs Elm Rovers.mp4", category: "Clips", uploadedBy: "Analysis", date: "6 Jul 2026", fileType: "mp4", sizeKb: 48200 },
  { id: "d10", name: "Set-piece routine — corners.mp4", category: "Clips", uploadedBy: "Analysis", date: "8 Jul 2026", fileType: "mp4", sizeKb: 21400 },
  { id: "d11", name: "Hat-trick vs Nettlefield Athletic.mp4", category: "Clips", linkedTo: "Danny Okafor", uploadedBy: "Analysis", date: "19 Jul 2026", fileType: "mp4", sizeKb: 63500 },
  { id: "d12", name: "Defensive shape, second half.mp4", category: "Clips", uploadedBy: "Analysis", date: "13 Jul 2026", fileType: "mp4", sizeKb: 55700 },
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
