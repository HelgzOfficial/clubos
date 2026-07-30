// Shared "is this fixture a friendly, league game, or cup game" classifier,
// used for the Match Centre badge colours and to decide which matches count
// toward player season stats (friendlies are excluded from stats by design).

export type CompetitionKind = "friendly" | "cup" | "league";

export function competitionKind(competition: string): CompetitionKind {
  const c = (competition || "").toLowerCase();
  if (c.includes("friendly") || c.includes("pre-season") || c.includes("preseason")) return "friendly";
  if (c.includes("cup") || c.includes("trophy") || c.includes("shield")) return "cup";
  return "league";
}

export const competitionVariant: Record<CompetitionKind, "neutral" | "purple" | "blue"> = {
  friendly: "neutral",
  cup: "purple",
  league: "blue",
};
