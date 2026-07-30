// Named pitch roles with fixed coordinates, matching the reference formation
// diagram supplied for this feature (x: 0-100 left→right, y: 0-100 own
// goal→opponent goal — same convention as the rest of the pitch graphic).
// Selecting a role from the dropdown places a marker at exactly this spot,
// instead of relying on an approximate manual click, so positions read as
// genuinely "out on the left/right" or "up front" rather than clustering
// centrally.
//
// Per explicit instruction: RB shares the same spot as RWB, and LB shares
// the same spot as LWB (rather than each having its own separate row).

import type { PositionGroup } from "./players-db";

export type PitchRole = {
  code: string;
  label: string;
  group: PositionGroup;
  x: number;
  y: number;
};

export const PITCH_ROLES: PitchRole[] = [
  { code: "GK", label: "Goalkeeper (GK)", group: "GK", x: 50, y: 5 },

  { code: "CB", label: "Centre Back (CB)", group: "DEF", x: 50, y: 15 },
  { code: "LB", label: "Left Back (LB)", group: "DEF", x: 15, y: 25 },
  { code: "RB", label: "Right Back (RB)", group: "DEF", x: 85, y: 25 },
  { code: "LWB", label: "Left Wing Back (LWB)", group: "DEF", x: 15, y: 25 },
  { code: "RWB", label: "Right Wing Back (RWB)", group: "DEF", x: 85, y: 25 },

  { code: "CDM", label: "Defensive Midfield (CDM)", group: "MID", x: 50, y: 38 },
  { code: "LM", label: "Left Midfield (LM)", group: "MID", x: 18, y: 50 },
  { code: "CM", label: "Central Midfield (CM)", group: "MID", x: 50, y: 50 },
  { code: "RM", label: "Right Midfield (RM)", group: "MID", x: 82, y: 50 },
  { code: "CAM", label: "Attacking Midfield (CAM)", group: "MID", x: 50, y: 65 },

  { code: "LW", label: "Left Wing (LW)", group: "FWD", x: 10, y: 80 },
  { code: "LF", label: "Left Forward (LF)", group: "FWD", x: 32, y: 80 },
  { code: "CF", label: "Centre Forward (CF)", group: "FWD", x: 50, y: 80 },
  { code: "RF", label: "Right Forward (RF)", group: "FWD", x: 68, y: 80 },
  { code: "RW", label: "Right Wing (RW)", group: "FWD", x: 90, y: 80 },
  { code: "ST", label: "Striker (ST)", group: "FWD", x: 50, y: 92 },
];

export const PITCH_ROLE_GROUPS: { group: PositionGroup; label: string }[] = [
  { group: "GK", label: "Goalkeeper" },
  { group: "DEF", label: "Defence" },
  { group: "MID", label: "Midfield" },
  { group: "FWD", label: "Forward" },
];

export function findPitchRole(code: string): PitchRole | undefined {
  return PITCH_ROLES.find((r) => r.code === code);
}
