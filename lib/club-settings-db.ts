import { supabase } from "./supabase";
import type { ClubSettings } from "./club-settings";

// The single shared row every device/user reads and writes — see
// supabase-club-settings-setup.sql. Falling back to the given defaults
// keeps every existing call site working even if Supabase isn't configured
// or the row/table doesn't exist yet (e.g. before the setup SQL has run).
export async function fetchClubSettings(fallback: ClubSettings): Promise<ClubSettings> {
  if (!supabase) return fallback;
  const { data, error } = await supabase.from("club_settings").select("*").eq("id", 1).maybeSingle();
  if (error || !data) return fallback;
  return {
    name: data.name ?? fallback.name,
    crestInitials: data.crest_initials ?? fallback.crestInitials,
    primaryColor: data.primary_color ?? fallback.primaryColor,
    secondaryColor: data.secondary_color ?? fallback.secondaryColor,
    accentColor: data.accent_color ?? fallback.accentColor,
  };
}

export async function saveClubSettingsRemote(settings: ClubSettings): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase
    .from("club_settings")
    .upsert({
      id: 1,
      name: settings.name,
      crest_initials: settings.crestInitials,
      primary_color: settings.primaryColor,
      secondary_color: settings.secondaryColor,
      accent_color: settings.accentColor,
      updated_at: new Date().toISOString(),
    });
  if (error) throw error;
}
