import { supabase } from "./supabase";

export type DashboardWidgetKey =
  | "next-match" | "weather" | "schedule" | "availability" | "league-position"
  | "form-guide" | "uploads" | "injuries" | "top-scorers" | "top-assists" | "clips";

export const WIDGET_LABELS: Record<DashboardWidgetKey, string> = {
  "next-match": "Next Match / Matchday",
  weather: "Weather",
  schedule: "Today's Schedule",
  availability: "Player Availability",
  "league-position": "League Position",
  "form-guide": "Form Guide",
  uploads: "Match Pack / Training Upload",
  injuries: "Injury List",
  "top-scorers": "Top Goalscorers",
  "top-assists": "Top Assist Makers",
  clips: "Latest Clips",
};

export const DEFAULT_WIDGET_ORDER: DashboardWidgetKey[] = [
  "next-match", "weather", "schedule", "availability", "league-position",
  "form-guide", "uploads", "injuries", "top-scorers", "top-assists", "clips",
];

export type DashboardSettings = {
  widgetOrder: DashboardWidgetKey[];
  hiddenWidgets: DashboardWidgetKey[];
};

const LOCAL_KEY = "clubos_dashboard_settings_v1";

function loadLocal(): DashboardSettings {
  if (typeof window === "undefined") return { widgetOrder: DEFAULT_WIDGET_ORDER, hiddenWidgets: [] };
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return { widgetOrder: DEFAULT_WIDGET_ORDER, hiddenWidgets: [] };
    const parsed = JSON.parse(raw);
    return { widgetOrder: parsed.widgetOrder ?? DEFAULT_WIDGET_ORDER, hiddenWidgets: parsed.hiddenWidgets ?? [] };
  } catch {
    return { widgetOrder: DEFAULT_WIDGET_ORDER, hiddenWidgets: [] };
  }
}

function saveLocal(settings: DashboardSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(settings));
}

// Falls back to this browser's localStorage when Supabase isn't configured,
// so the "show/hide widgets" option still works before the club connects a
// database — same graceful-degradation pattern used elsewhere in the app.
export async function fetchDashboardSettings(): Promise<DashboardSettings> {
  if (!supabase) return loadLocal();
  const { data, error } = await supabase.from("dashboard_settings").select("*").eq("id", "default").maybeSingle();
  if (error || !data) return loadLocal();
  return {
    widgetOrder: (data.widget_order?.length ? data.widget_order : DEFAULT_WIDGET_ORDER) as DashboardWidgetKey[],
    hiddenWidgets: (data.hidden_widgets ?? []) as DashboardWidgetKey[],
  };
}

export async function saveDashboardSettings(settings: DashboardSettings) {
  saveLocal(settings);
  if (!supabase) return;
  await supabase
    .from("dashboard_settings")
    .upsert({ id: "default", widget_order: settings.widgetOrder, hidden_widgets: settings.hiddenWidgets, updated_at: new Date().toISOString() });
}
