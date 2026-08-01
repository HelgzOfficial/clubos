import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// True once both environment variables are present at build/runtime.
// Until then we fall back to a friendly "not set up" screen instead of crashing.
export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        // These are Supabase's defaults, written out on purpose. Staying
        // signed in on a home-screen app depends entirely on them, and a
        // default is easy to change by accident later without realising what
        // it was holding up.
        //
        // persistSession keeps the session in this browser's storage rather
        // than only in memory, so closing the app doesn't sign you out.
        persistSession: true,
        // The access token is short-lived by design. This refreshes it
        // quietly in the background, which is what turns "signed in" into
        // "signed in for months" — as long as the app gets opened now and
        // again, the player never sees a sign-in screen twice.
        autoRefreshToken: true,
        // Still needed so an invite or reset link arriving in the URL is
        // picked up and turned into a session.
        detectSessionInUrl: true,
      },
    })
  : null;
