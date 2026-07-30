// A curated country list for the nationality picker, with a helper to turn
// a two-letter code into its flag emoji. The three British home nations
// aren't real ISO countries but matter a lot for a football club, so they're
// included as special cases with their actual subdivision flag sequences
// (Northern Ireland has no widely-supported flag emoji, so it falls back to
// the Union flag).
export type Country = { code: string; name: string };

const SPECIAL_FLAGS: Record<string, string> = {
  ENG: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  SCT: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  WLS: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  NIR: "🇬🇧",
};

export function flagEmoji(code: string): string {
  if (SPECIAL_FLAGS[code]) return SPECIAL_FLAGS[code];
  if (code.length !== 2) return "";
  const base = 127397; // regional indicator offset from 'A'
  return String.fromCodePoint(...code.toUpperCase().split("").map((c) => c.charCodeAt(0) + base));
}

// Looks up a saved nationality string (a Country.name) and returns its flag,
// or "" if it doesn't match anything in the list (e.g. old free-text data
// entered before this picker existed) — callers should fall back to showing
// the plain text in that case.
export function getCountryFlag(nationality: string | null | undefined): string {
  if (!nationality) return "";
  const match = COUNTRIES.find((c) => c.name.toLowerCase() === nationality.trim().toLowerCase());
  return match ? flagEmoji(match.code) : "";
}

export const COUNTRIES: Country[] = [
  { code: "ENG", name: "England" },
  { code: "SCT", name: "Scotland" },
  { code: "WLS", name: "Wales" },
  { code: "NIR", name: "Northern Ireland" },
  { code: "IE", name: "Republic of Ireland" },
  { code: "AF", name: "Afghanistan" }, { code: "AL", name: "Albania" }, { code: "DZ", name: "Algeria" },
  { code: "AR", name: "Argentina" }, { code: "AM", name: "Armenia" }, { code: "AU", name: "Australia" },
  { code: "AT", name: "Austria" }, { code: "AZ", name: "Azerbaijan" }, { code: "BH", name: "Bahrain" },
  { code: "BD", name: "Bangladesh" }, { code: "BY", name: "Belarus" }, { code: "BE", name: "Belgium" },
  { code: "BZ", name: "Belize" }, { code: "BJ", name: "Benin" }, { code: "BO", name: "Bolivia" },
  { code: "BA", name: "Bosnia and Herzegovina" }, { code: "BW", name: "Botswana" }, { code: "BR", name: "Brazil" },
  { code: "BG", name: "Bulgaria" }, { code: "BF", name: "Burkina Faso" }, { code: "BI", name: "Burundi" },
  { code: "CM", name: "Cameroon" }, { code: "CA", name: "Canada" }, { code: "CV", name: "Cape Verde" },
  { code: "CF", name: "Central African Republic" }, { code: "TD", name: "Chad" }, { code: "CL", name: "Chile" },
  { code: "CN", name: "China" }, { code: "CO", name: "Colombia" }, { code: "CG", name: "Congo" },
  { code: "CD", name: "DR Congo" }, { code: "CR", name: "Costa Rica" }, { code: "HR", name: "Croatia" },
  { code: "CU", name: "Cuba" }, { code: "CY", name: "Cyprus" }, { code: "CZ", name: "Czechia" },
  { code: "DK", name: "Denmark" }, { code: "DJ", name: "Djibouti" }, { code: "DO", name: "Dominican Republic" },
  { code: "EC", name: "Ecuador" }, { code: "EG", name: "Egypt" }, { code: "SV", name: "El Salvador" },
  { code: "EE", name: "Estonia" }, { code: "ET", name: "Ethiopia" }, { code: "FJ", name: "Fiji" },
  { code: "FI", name: "Finland" }, { code: "FR", name: "France" }, { code: "GA", name: "Gabon" },
  { code: "GM", name: "Gambia" }, { code: "GE", name: "Georgia" }, { code: "DE", name: "Germany" },
  { code: "GH", name: "Ghana" }, { code: "GR", name: "Greece" }, { code: "GD", name: "Grenada" },
  { code: "GT", name: "Guatemala" }, { code: "GN", name: "Guinea" }, { code: "GW", name: "Guinea-Bissau" },
  { code: "GY", name: "Guyana" }, { code: "HT", name: "Haiti" }, { code: "HN", name: "Honduras" },
  { code: "HK", name: "Hong Kong" }, { code: "HU", name: "Hungary" }, { code: "IS", name: "Iceland" },
  { code: "IN", name: "India" }, { code: "ID", name: "Indonesia" }, { code: "IR", name: "Iran" },
  { code: "IQ", name: "Iraq" }, { code: "IL", name: "Israel" }, { code: "IT", name: "Italy" },
  { code: "CI", name: "Ivory Coast" }, { code: "JM", name: "Jamaica" }, { code: "JP", name: "Japan" },
  { code: "JO", name: "Jordan" }, { code: "KZ", name: "Kazakhstan" }, { code: "KE", name: "Kenya" },
  { code: "KR", name: "South Korea" }, { code: "KW", name: "Kuwait" }, { code: "KG", name: "Kyrgyzstan" },
  { code: "LV", name: "Latvia" }, { code: "LB", name: "Lebanon" }, { code: "LR", name: "Liberia" },
  { code: "LY", name: "Libya" }, { code: "LT", name: "Lithuania" }, { code: "LU", name: "Luxembourg" },
  { code: "MG", name: "Madagascar" }, { code: "MW", name: "Malawi" }, { code: "MY", name: "Malaysia" },
  { code: "ML", name: "Mali" }, { code: "MT", name: "Malta" }, { code: "MR", name: "Mauritania" },
  { code: "MU", name: "Mauritius" }, { code: "MX", name: "Mexico" }, { code: "MD", name: "Moldova" },
  { code: "MC", name: "Monaco" }, { code: "MN", name: "Mongolia" }, { code: "ME", name: "Montenegro" },
  { code: "MA", name: "Morocco" }, { code: "MZ", name: "Mozambique" }, { code: "MM", name: "Myanmar" },
  { code: "NA", name: "Namibia" }, { code: "NP", name: "Nepal" }, { code: "NL", name: "Netherlands" },
  { code: "NZ", name: "New Zealand" }, { code: "NI", name: "Nicaragua" }, { code: "NE", name: "Niger" },
  { code: "NG", name: "Nigeria" }, { code: "MK", name: "North Macedonia" }, { code: "NO", name: "Norway" },
  { code: "OM", name: "Oman" }, { code: "PK", name: "Pakistan" }, { code: "PA", name: "Panama" },
  { code: "PY", name: "Paraguay" }, { code: "PE", name: "Peru" }, { code: "PH", name: "Philippines" },
  { code: "PL", name: "Poland" }, { code: "PT", name: "Portugal" }, { code: "QA", name: "Qatar" },
  { code: "RO", name: "Romania" }, { code: "RU", name: "Russia" }, { code: "RW", name: "Rwanda" },
  { code: "SA", name: "Saudi Arabia" }, { code: "SN", name: "Senegal" }, { code: "RS", name: "Serbia" },
  { code: "SL", name: "Sierra Leone" }, { code: "SG", name: "Singapore" }, { code: "SK", name: "Slovakia" },
  { code: "SI", name: "Slovenia" }, { code: "SO", name: "Somalia" }, { code: "ZA", name: "South Africa" },
  { code: "SS", name: "South Sudan" }, { code: "ES", name: "Spain" }, { code: "LK", name: "Sri Lanka" },
  { code: "SD", name: "Sudan" }, { code: "SR", name: "Suriname" }, { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" }, { code: "SY", name: "Syria" }, { code: "TW", name: "Taiwan" },
  { code: "TJ", name: "Tajikistan" }, { code: "TZ", name: "Tanzania" }, { code: "TH", name: "Thailand" },
  { code: "TG", name: "Togo" }, { code: "TT", name: "Trinidad and Tobago" }, { code: "TN", name: "Tunisia" },
  { code: "TR", name: "Turkey" }, { code: "TM", name: "Turkmenistan" }, { code: "UG", name: "Uganda" },
  { code: "UA", name: "Ukraine" }, { code: "AE", name: "United Arab Emirates" }, { code: "US", name: "United States" },
  { code: "UY", name: "Uruguay" }, { code: "UZ", name: "Uzbekistan" }, { code: "VE", name: "Venezuela" },
  { code: "VN", name: "Vietnam" }, { code: "YE", name: "Yemen" }, { code: "ZM", name: "Zambia" },
  { code: "ZW", name: "Zimbabwe" },
];
