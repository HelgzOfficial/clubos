import { competitionKind } from "./competition-kind";
import type { DbMatch } from "./matches-db";

// The one place the season boundary is defined.
//
// The 2026/27 campaign starts with the first league game, at home to Carshalton
// Athletic on 8 August 2026. Everything before that — pre-season friendlies,
// last season's fixtures still sitting in the database — is excluded from the
// counting stats, so the Analyst Dashboard, player profiles, GPS averages and
// rankings all begin from zero on that date.
//
// Deliberately NOT applied to the form guide, which shows the last five
// results whatever they were, friendlies included. Form is "how are we playing
// right now"; season stats are "what has this campaign produced". They answer
// different questions and shouldn't share a filter.
export const SEASON_START = "2026-08-08";

// A readable version for the "stats from …" note shown on the dashboard.
export const SEASON_START_LABEL = new Date(`${SEASON_START}T00:00:00`).toLocaleDateString("en-GB", {
  day: "numeric", month: "long", year: "numeric",
});

export function isOnOrAfterSeasonStart(kickoff: string): boolean {
  return kickoff.slice(0, 10) >= SEASON_START;
}

// A fixture only feeds the season tallies if it's in this campaign AND
// competitive. Friendlies were already excluded across the app; the date test
// is the new half.
export function countsForSeasonStats(match: Pick<DbMatch, "kickoff" | "competition">): boolean {
  return isOnOrAfterSeasonStart(match.kickoff) && competitionKind(match.competition) !== "friendly";
}

export function seasonMatches(matches: DbMatch[]): DbMatch[] {
  return matches.filter(countsForSeasonStats);
}

// Handy for filtering rows that reference a match by id (stats, goals, GPS).
export function seasonMatchIdSet(matches: DbMatch[]): Set<string> {
  return new Set(seasonMatches(matches).map((m) => m.id));
}
