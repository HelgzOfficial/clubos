// Shared definitions for the Match Centre stats dashboard: what categories
// exist, what each tile's headline stat is, and what breaks down inside it
// when you click through.
//
// This field list is tuned against a real Hudl/Wyscout single-fixture
// "Match Report" PDF export (the "TEAM STATS" page), not a hypothetical
// format — see lib/report-parser.ts for the extraction patterns. Values are
// always stored as "us" vs "opponent", not literal home/away, since the
// report itself always lists the subscribing club first regardless of
// which side of the scoreline they're on.

export type StatUnit = "%" | "";

export type StatFieldDef = {
  key: string;
  label: string;
  unit: StatUnit;
  category: string;
  isHeadline?: boolean; // shown as the big number on the category tile
};

export type CategoryDef = {
  key: string;
  label: string;
  description: string;
};

export const CATEGORY_DEFS: CategoryDef[] = [
  { key: "possession", label: "Possession & Passing", description: "Ball control and distribution" },
  { key: "shooting", label: "Shooting", description: "Attempts at goal" },
  { key: "defensive", label: "Defensive & Physical", description: "Duels, tackles, and pressing" },
  { key: "discipline", label: "Discipline", description: "Fouls and cards" },
  { key: "setPieces", label: "Set Pieces", description: "Corners and free kicks" },
  { key: "goalkeeping", label: "Goalkeeping", description: "Shot-stopping (manual entry only — not on the team stats page)" },
];

export const STAT_FIELDS: StatFieldDef[] = [
  // Possession & Passing
  { key: "possession", label: "Possession", unit: "%", category: "possession", isHeadline: true },
  { key: "passesAttempted", label: "Passes Attempted", unit: "", category: "possession" },
  { key: "passesCompleted", label: "Passes Completed", unit: "", category: "possession" },
  { key: "passAccuracy", label: "Pass Accuracy", unit: "%", category: "possession" },
  { key: "longBalls", label: "Long Balls (Accurate)", unit: "", category: "possession" },
  { key: "crosses", label: "Crosses (Accurate)", unit: "", category: "possession" },
  { key: "matchTempo", label: "Match Tempo", unit: "", category: "possession" },

  // Shooting
  { key: "shots", label: "Total Shots", unit: "", category: "shooting", isHeadline: true },
  { key: "shotsOnTarget", label: "Shots on Target", unit: "", category: "shooting" },

  // Defensive & Physical
  { key: "duelsWon", label: "Duels Won", unit: "", category: "defensive", isHeadline: true },
  { key: "offensiveDuelsWon", label: "Offensive Duels Won", unit: "", category: "defensive" },
  { key: "defensiveDuelsWon", label: "Defensive Duels Won", unit: "", category: "defensive" },
  { key: "aerialDuelsWon", label: "Aerial Duels Won", unit: "", category: "defensive" },
  { key: "interceptions", label: "Interceptions", unit: "", category: "defensive" },
  { key: "clearances", label: "Clearances", unit: "", category: "defensive" },
  { key: "slidingTackles", label: "Sliding Tackles", unit: "", category: "defensive" },
  { key: "dribblesSuccessful", label: "Successful Dribbles", unit: "", category: "defensive" },
  { key: "ppda", label: "PPDA (pressing intensity)", unit: "", category: "defensive" },

  // Discipline
  { key: "fouls", label: "Fouls Committed", unit: "", category: "discipline", isHeadline: true },
  { key: "foulsSuffered", label: "Fouls Suffered", unit: "", category: "discipline" },
  { key: "yellowCards", label: "Yellow Cards", unit: "", category: "discipline" },
  { key: "redCards", label: "Red Cards", unit: "", category: "discipline" },
  { key: "offsides", label: "Offsides", unit: "", category: "discipline" },

  // Set Pieces
  { key: "corners", label: "Corners", unit: "", category: "setPieces", isHeadline: true },
  { key: "freeKicks", label: "Free Kicks", unit: "", category: "setPieces" },

  // Goalkeeping — not present on the team stats page of this report format,
  // kept here so it's still available in the manual "Edit Stats" form.
  { key: "saves", label: "Saves", unit: "", category: "goalkeeping", isHeadline: true },
  { key: "goalsConceded", label: "Goals Conceded", unit: "", category: "goalkeeping" },
];

export type StatRow = { key: string; label: string; unit: StatUnit; us: number | null; opponent: number | null };
export type StatCategory = {
  key: string;
  label: string;
  description: string;
  unit: StatUnit;
  us: number | null;
  opponent: number | null;
  detail: StatRow[];
};

// Assembles category tiles (with their headline value) out of a flat set of
// field values — used both after parsing an upload and when rendering
// whatever's currently saved for a match.
export function buildCategories(values: Record<string, { us: number | null; opponent: number | null }>): StatCategory[] {
  return CATEGORY_DEFS.map((cat) => {
    const fields = STAT_FIELDS.filter((f) => f.category === cat.key);
    const headline = fields.find((f) => f.isHeadline);
    const detail: StatRow[] = fields
      .filter((f) => values[f.key] && (values[f.key].us !== null || values[f.key].opponent !== null))
      .map((f) => ({ key: f.key, label: f.label, unit: f.unit, us: values[f.key]?.us ?? null, opponent: values[f.key]?.opponent ?? null }));

    return {
      key: cat.key,
      label: cat.label,
      description: cat.description,
      unit: headline?.unit ?? "",
      us: headline ? values[headline.key]?.us ?? null : null,
      opponent: headline ? values[headline.key]?.opponent ?? null : null,
      detail,
    };
  }).filter((cat) => cat.detail.length > 0);
}
