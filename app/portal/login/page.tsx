"use client";

import { useEffect, useState, type FormEvent } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { club as clubFallback } from "@/lib/sample-data";
import { loadClubSettings, saveClubSettings } from "@/lib/club-settings";
import { fetchClubSettings } from "@/lib/club-settings-db";
import { InstallPrompt } from "@/components/portal/install-prompt";
import { Mail, AlertCircle, CheckCircle2, Users } from "lucide-react";

// Deliberately amber rather than the club green used on the staff sign-in.
// Both apps live on the same domain, and a player who lands on the wrong one
// just sees "sign in" and assumes their link is broken. The colour is the
// fastest possible way to say "this is the players' door", before anybody
// reads a word of it.
export default function PortalLoginPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [club, setClub] = useState(clubFallback);

  useEffect(() => {
    setClub(loadClubSettings(clubFallback));
    fetchClubSettings(clubFallback).then((settings) => { setClub(settings); saveClubSettings(settings); });
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/portal` },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-navy-800 px-4 text-white dark:bg-navy-950">
      <div className="w-full max-w-sm">
        {/* Also offered before sign-in — a player installing the app is more
            likely to do it while they're waiting for the magic link to arrive
            than after they've already got where they were going. */}
        <InstallPrompt />

      <div className="w-full overflow-hidden rounded-card border border-amber-500/40 bg-navy-700 shadow-softDark dark:bg-navy-900">
        {/* An amber band across the top, so it reads as the players' app even
            from a glance at a phone in someone else's hand. */}
        <div className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-navy-950">
          <Users size={14} />
          <span className="text-xs font-bold uppercase tracking-[0.14em]">Player Portal</span>
        </div>

        <div className="p-6">
          <div className="mb-6 flex flex-col items-center text-center">
            <div
              className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-navy-950 ring-2 ring-amber-500/60"
              style={{ backgroundColor: club.primaryColor }}
            >
              {club.crestInitials}
            </div>
            <h1 className="text-xl font-semibold">{club.name}</h1>
            <p className="mt-1 text-sm text-amber-200/70">Players only — staff sign in on the main app.</p>
          </div>

          {!supabaseConfigured ? (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <p>The portal isn&apos;t connected yet — ask your club admin to finish setting it up.</p>
            </div>
          ) : sent ? (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <p>Check your email — tap the link we just sent to {email} to sign in.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-400">Your email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-navy-600 px-3 py-2 text-sm outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/30 dark:bg-navy-800"
                  placeholder="the email on your player profile"
                />
                <p className="mt-1.5 text-[11px] text-neutral-500">
                  Use the same email your club has on file for you. No password needed — we&apos;ll send you a one-tap sign-in link.
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-navy-950 transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                <Mail size={15} /> {loading ? "Sending…" : "Send Login Link"}
              </button>
            </form>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
