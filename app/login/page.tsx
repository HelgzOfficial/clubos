"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { club } from "@/lib/sample-data";
import { loadClubSettings, saveClubSettings } from "@/lib/club-settings";
import { fetchClubSettings } from "@/lib/club-settings-db";
import { LogIn, AlertCircle, KeyRound } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // The sign-in screen shows before anyone is authenticated, so it can't
  // rely on any per-device saved setting — it needs the real, shared club
  // name/crest from Supabase. Paint instantly from whatever this browser
  // cached last (avoids a flash of the "Riverside FC" sample default), then
  // replace with the live value.
  const [branding, setBranding] = useState(club);
  useEffect(() => {
    setBranding(loadClubSettings(club));
    fetchClubSettings(club).then((settings) => {
      setBranding(settings);
      saveClubSettings(settings);
    });
  }, []);

  // Someone who just clicked an invite/reset email lands here with Supabase
  // Auth's own recovery token in the URL — instead of asking for a password
  // they don't have yet, we let them set one.
  const [settingPassword, setSettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);

  // "Forgot password" — sends the same kind of recovery link Supabase uses
  // for invites, which is why the settingPassword screen above already
  // handles it once they click through from their email.
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !supabase) return;

    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);

    // Supabase's invite/reset link can arrive in two shapes depending on
    // project auth settings: the classic hash-fragment token
    // (#access_token=...&type=invite) or a PKCE "?code=..." link. Handling
    // both means an invite works regardless of that setting.
    if (hash.includes("type=invite") || hash.includes("type=recovery") || hash.includes("type=signup")) {
      setSettingPassword(true);
      return;
    }

    const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
    const hashError = hashParams.get("error_description") || params.get("error_description");
    if (hashError) {
      setError(decodeURIComponent(hashError.replace(/\+/g, " ")));
      return;
    }

    const code = params.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          setError(error.message);
        } else {
          setSettingPassword(true);
        }
      });
    }
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message === "Invalid login credentials" ? "Incorrect email or password." : error.message);
      return;
    }
    router.replace("/dashboard");
  }

  async function handleForgotPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    setForgotLoading(true);
    setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: `${window.location.origin}/login`,
    });
    setForgotLoading(false);
    // Always show the same "check your email" message whether or not the
    // address exists — Supabase itself doesn't reveal that either, so
    // showing a different message here would just leak whether someone has
    // a ClubOS account for a given email.
    if (error && !/rate limit/i.test(error.message)) {
      setForgotSent(true);
      return;
    }
    if (error) {
      setError(error.message);
      return;
    }
    setForgotSent(true);
  }

  async function handleSetPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setPasswordSaved(true);
    setTimeout(() => router.replace("/dashboard"), 1200);
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-navy-800 dark:bg-navy-950 px-4 text-white">
      <div className="w-full max-w-sm rounded-card border border-white/10 bg-navy-700 dark:bg-navy-900 p-6 shadow-softDark">
        <div className="mb-6 flex flex-col items-center text-center">
          <div
            className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl text-navy-950 text-sm font-bold"
            style={{ backgroundColor: branding.primaryColor }}
          >
            {branding.crestInitials}
          </div>
          <h1 className="text-xl font-semibold">
            {settingPassword ? "Welcome to ClubOS" : showForgot ? "Reset your password" : "Sign in to ClubOS"}
          </h1>
          <p className="mt-1 text-sm text-neutral-400">{branding.name}</p>
        </div>

        {!supabaseConfigured ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>Login isn&apos;t connected yet — the Supabase details are missing from this deployment.</p>
          </div>
        ) : settingPassword ? (
          <form onSubmit={handleSetPassword} className="space-y-4">
            <p className="text-sm text-neutral-400">You&apos;ve been invited — set a password to finish signing in.</p>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-400">New password</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                placeholder="At least 8 characters"
              />
            </div>
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <p>{error}</p>
              </div>
            )}
            {passwordSaved && (
              <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                <p>Password set — taking you in…</p>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-club-primary text-navy-950 px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              <KeyRound size={15} /> {loading ? "Saving…" : "Set Password & Continue"}
            </button>
          </form>
        ) : showForgot ? (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            {forgotSent ? (
              <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                <p>If an account exists for that email, a password reset link is on its way — check your inbox (and spam folder).</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-neutral-400">Enter your email and we&apos;ll send you a link to set a new password.</p>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-neutral-400">Email</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                    placeholder="you@club.com"
                  />
                </div>
                {error && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                    <AlertCircle size={15} className="mt-0.5 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-club-primary text-navy-950 px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  <KeyRound size={15} /> {forgotLoading ? "Sending…" : "Send Reset Link"}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => { setShowForgot(false); setForgotSent(false); setError(""); }}
              className="w-full text-center text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Back to sign in
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-400">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                placeholder="you@club.com"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-400">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => { setShowForgot(true); setForgotEmail(email); setError(""); }}
                className="mt-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
              >
                Forgot password?
              </button>
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
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-club-primary text-navy-950 px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              <LogIn size={15} /> {loading ? "Signing in…" : "Sign In"}
            </button>

            <p className="text-center text-xs text-neutral-400">
              Don&apos;t have an account? Ask an owner or manager to invite you from the Staff module.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
