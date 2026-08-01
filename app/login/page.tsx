"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { club } from "@/lib/sample-data";
import { loadClubSettings, saveClubSettings } from "@/lib/club-settings";
import { fetchClubSettings } from "@/lib/club-settings-db";
import { submitAccessRequest } from "@/lib/access-requests-db";
import { LogIn, AlertCircle, KeyRound, UserPlus, Mail, Loader2, ArrowLeft } from "lucide-react";

const RESEND_SECONDS = 60;

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

  // "Email me a code" — the same one-time code the players' portal uses.
  // Added because a password typed on a phone is a nuisance, and because
  // anyone who installs ClubOS to their home screen wants to sign in inside
  // the app rather than being bounced out to Safari by an emailed link.
  //
  // This never creates an account (shouldCreateUser is false below): staff
  // access still has to come through an invite or an approved request, and a
  // code shouldn't be a way around that.
  const [showOtp, setShowOtp] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpStep, setOtpStep] = useState<"email" | "code">("email");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const id = setInterval(() => setOtpCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(id);
  }, [otpCooldown]);

  useEffect(() => {
    if (showOtp && otpStep === "code") otpRef.current?.focus();
  }, [showOtp, otpStep]);

  // "Request an invite" — for someone without an account yet, instead of
  // needing an owner/manager to think to invite them first. They pick their
  // own password now; an owner/manager reviews and approves the request
  // from Staff & Access (or the email notification that goes out to them),
  // and once approved this password works immediately — no follow-up
  // "set your password" email needed.
  const [showRequest, setShowRequest] = useState(false);
  const [requestName, setRequestName] = useState("");
  const [requestEmail, setRequestEmail] = useState("");
  const [requestPassword, setRequestPassword] = useState("");
  const [requestConfirm, setRequestConfirm] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [requestSent, setRequestSent] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState("");

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

  async function sendOtp(e?: FormEvent) {
    e?.preventDefault();
    if (!supabase) return;
    const address = otpEmail.trim().toLowerCase();
    if (!address) return;
    setOtpSending(true);
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    setOtpSending(false);
    if (error) {
      setError(
        /signups not allowed|not found|user/i.test(error.message)
          ? "There's no ClubOS account for that email. Ask an owner or manager to invite you."
          : error.message
      );
      return;
    }
    setOtpEmail(address);
    setOtpStep("code");
    setOtpCooldown(RESEND_SECONDS);
  }

  async function verifyOtp(token: string) {
    if (!supabase) return;
    setOtpVerifying(true);
    setError("");
    const { error } = await supabase.auth.verifyOtp({
      email: otpEmail.trim().toLowerCase(),
      token,
      type: "email",
    });
    setOtpVerifying(false);
    if (error) {
      setError(
        /expired/i.test(error.message)
          ? "That code has expired — tap Resend for a new one."
          : "That code isn't right. Check the email and try again."
      );
      setOtpCode("");
      otpRef.current?.focus();
      return;
    }
    router.replace("/dashboard");
  }

  // Supabase's code length is a project setting (6 by default, up to 10), so
  // accept the range rather than assuming six.
  function handleOtpChange(value: string) {
    const digits = value.replace(/[^0-9]/g, "").slice(0, 10);
    setOtpCode(digits);
    setError("");
  }

  function closeOtp() {
    setShowOtp(false);
    setOtpStep("email");
    setOtpCode("");
    setError("");
  }

  async function handleRequestAccess(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setRequestError("");
    if (requestPassword.length < 8) {
      setRequestError("Password must be at least 8 characters.");
      return;
    }
    if (requestPassword !== requestConfirm) {
      setRequestError("Password and confirmation don't match.");
      return;
    }
    setRequestLoading(true);
    const result = await submitAccessRequest({
      name: requestName.trim(),
      email: requestEmail.trim(),
      password: requestPassword,
      message: requestMessage.trim(),
    });
    setRequestLoading(false);
    if (!result.ok) {
      setRequestError(result.error ?? "Couldn't send that request.");
      return;
    }
    setRequestSent(true);
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
            {settingPassword ? "Welcome to ClubOS" : showOtp ? "Sign in with a code" : showForgot ? "Reset your password" : showRequest ? "Request an Invite" : "Sign in to ClubOS"}
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
        ) : showOtp ? (
          otpStep === "email" ? (
            <form onSubmit={sendOtp} className="space-y-4">
              <p className="text-sm text-neutral-400">
                We&apos;ll email you a sign-in code. Type it here rather than tapping the link — that&apos;s what keeps
                you signed in if you&apos;ve added ClubOS to your home screen.
              </p>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-400">Email</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={otpEmail}
                  onChange={(e) => setOtpEmail(e.target.value)}
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
                disabled={otpSending || !otpEmail.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-club-primary text-navy-950 px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {otpSending ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
                {otpSending ? "Sending…" : "Send Code"}
              </button>
              <button
                type="button"
                onClick={closeOtp}
                className="w-full text-center text-xs text-neutral-400 hover:text-white transition-colors"
              >
                Use a password instead
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-neutral-400">Code sent to {otpEmail}.</p>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-400">Sign-in code</label>
                <input
                  ref={otpRef}
                  value={otpCode}
                  onChange={(e) => handleOtpChange(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  disabled={otpVerifying}
                  onKeyDown={(e) => { if (e.key === "Enter" && otpCode.length >= 6) verifyOtp(otpCode); }}
                  className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-3 text-center text-2xl font-semibold tracking-[0.4em] tabular-nums outline-none focus:ring-2 focus:ring-club-primary/30 disabled:opacity-60"
                />
              </div>
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}
              <button
                onClick={() => verifyOtp(otpCode)}
                disabled={otpVerifying || otpCode.length < 6}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-club-primary px-4 py-2.5 text-sm font-medium text-navy-950 transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {otpVerifying ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                {otpVerifying ? "Signing you in…" : "Sign In"}
              </button>
              <div className="flex items-center justify-between gap-2 text-xs">
                <button
                  onClick={() => { setOtpStep("email"); setOtpCode(""); setError(""); }}
                  className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors"
                >
                  <ArrowLeft size={13} /> Change email
                </button>
                <button
                  onClick={() => sendOtp()}
                  disabled={otpCooldown > 0 || otpSending}
                  className="flex items-center gap-1.5 text-club-primary hover:opacity-80 disabled:text-neutral-500 transition-opacity"
                >
                  <KeyRound size={13} /> {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : "Resend code"}
                </button>
              </div>
              <button
                type="button"
                onClick={closeOtp}
                className="w-full text-center text-xs text-neutral-400 hover:text-white transition-colors"
              >
                Use a password instead
              </button>
            </div>
          )
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
        ) : showRequest ? (
          <form onSubmit={handleRequestAccess} className="space-y-4">
            {requestSent ? (
              <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                <p>Request sent — an owner or manager will review it. Once approved, sign in here with the password you just chose.</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-neutral-400">Pick a password now — once an owner or manager approves your request, sign in straight away with it.</p>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-neutral-400">Full name</label>
                  <input
                    required
                    value={requestName}
                    onChange={(e) => setRequestName(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-neutral-400">Email</label>
                  <input
                    type="email"
                    required
                    value={requestEmail}
                    onChange={(e) => setRequestEmail(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                    placeholder="you@club.com"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-neutral-400">Choose a password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={requestPassword}
                    onChange={(e) => setRequestPassword(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                    placeholder="At least 8 characters"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-neutral-400">Confirm password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={requestConfirm}
                    onChange={(e) => setRequestConfirm(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-neutral-400">Message (optional)</label>
                  <textarea
                    rows={2}
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                    placeholder="e.g. who you are and what role you need"
                    className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                  />
                </div>
                {requestError && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                    <AlertCircle size={15} className="mt-0.5 shrink-0" />
                    <p>{requestError}</p>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={requestLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-club-primary text-navy-950 px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  <UserPlus size={15} /> {requestLoading ? "Sending…" : "Send Request"}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setShowRequest(false); setRequestSent(false); setRequestError("");
                setRequestName(""); setRequestEmail(""); setRequestPassword(""); setRequestConfirm(""); setRequestMessage("");
              }}
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
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => { setShowForgot(true); setForgotEmail(email); setError(""); }}
                  className="text-xs text-neutral-400 hover:text-white transition-colors"
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  onClick={() => { setShowOtp(true); setOtpEmail(email); setOtpStep("email"); setError(""); }}
                  className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
                >
                  <Mail size={12} /> Email me a code
                </button>
              </div>
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
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => { setShowRequest(true); setRequestEmail(email); setError(""); }}
                className="text-neutral-300 underline underline-offset-2 hover:text-white transition-colors"
              >
                Request an invite
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
