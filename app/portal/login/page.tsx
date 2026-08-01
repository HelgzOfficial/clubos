"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { club as clubFallback } from "@/lib/sample-data";
import { loadClubSettings, saveClubSettings } from "@/lib/club-settings";
import { fetchClubSettings } from "@/lib/club-settings-db";
import { InstallPrompt } from "@/components/portal/install-prompt";
import { isPlayerHost, portalHome } from "@/lib/portal-host";
import { Mail, AlertCircle, CheckCircle2, Users, ArrowLeft, Loader2, KeyRound } from "lucide-react";

// Deliberately amber rather than the club green used on the staff sign-in.
// Both apps live on the same domain family, and a player who lands on the
// wrong one just sees "sign in" and assumes their link is broken.
//
// The sign-in is a typed code rather than a tapped link, and that is not a
// style choice. Tapping a link in the Mail app opens Safari — so the session
// is created in Safari's storage, while the installed home-screen app has its
// own separate storage and stays signed out. The player then opens the app,
// finds themselves signed out again, and concludes it's broken. Typing a code
// *inside* the app creates the session where the app can actually see it, and
// Supabase refreshes it from then on, so they stay signed in.
const RESEND_SECONDS = 60;

export default function PortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [club, setClub] = useState(clubFallback);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setClub(loadClubSettings(clubFallback));
    fetchClubSettings(clubFallback).then((settings) => { setClub(settings); saveClubSettings(settings); });
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    if (!supabase) return;
    const address = email.trim().toLowerCase();
    if (!address) return;
    setSending(true);
    setError("");
    setNotice("");
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: {
        // The email carries both a code and a link. The link still works if a
        // player prefers it (or is on a laptop) — it just isn't the path we
        // steer them down on a phone.
        emailRedirectTo: `${window.location.origin}${portalHome(isPlayerHost())}`,
      },
    });
    setSending(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEmail(address);
    setStep("code");
    setCooldown(RESEND_SECONDS);
    setNotice(`We've sent a 6-digit code to ${address}.`);
  }

  async function verify(token: string) {
    if (!supabase) return;
    setVerifying(true);
    setError("");
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: "email",
    });
    setVerifying(false);
    if (error) {
      setError(
        /expired/i.test(error.message)
          ? "That code has expired — tap Resend for a new one."
          : /invalid|token/i.test(error.message)
            ? "That code isn't right. Check the email and try again."
            : error.message
      );
      setCode("");
      codeRef.current?.focus();
      return;
    }
    router.replace(portalHome(isPlayerHost()));
  }

  function handleCodeChange(value: string) {
    const digits = value.replace(/[^0-9]/g, "").slice(0, 6);
    setCode(digits);
    setError("");
    // Six digits is the whole code, so there's no reason to make someone
    // reach for a button as well.
    if (digits.length === 6) verify(digits);
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-navy-800 px-4 text-white dark:bg-navy-950">
      <div className="w-full max-w-sm">
        <InstallPrompt />

        <div className="w-full overflow-hidden rounded-card border border-amber-500/40 bg-navy-700 shadow-softDark dark:bg-navy-900">
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
            ) : step === "email" ? (
              <form onSubmit={sendCode} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-neutral-400">Your email</label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-navy-600 px-3 py-2 text-sm outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/30 dark:bg-navy-800"
                    placeholder="the email on your player profile"
                  />
                  <p className="mt-1.5 text-[11px] text-neutral-500">
                    Use the same email your club has on file for you. No password — we&apos;ll email you a 6-digit code.
                  </p>
                </div>

                {error && <ErrorBox message={error} />}

                <button
                  type="submit"
                  disabled={sending || !email.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-navy-950 transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {sending ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
                  {sending ? "Sending…" : "Send Code"}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                {notice && (
                  <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                    <p>{notice}</p>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-neutral-400">6-digit code</label>
                  <input
                    ref={codeRef}
                    value={code}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    disabled={verifying}
                    className="w-full rounded-xl border border-white/10 bg-navy-600 px-3 py-3 text-center text-2xl font-semibold tracking-[0.4em] tabular-nums outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/30 disabled:opacity-60 dark:bg-navy-800"
                  />
                  <p className="mt-1.5 text-[11px] text-neutral-500">
                    Type the code here rather than tapping the link in the email — that&apos;s what keeps you signed in
                    on this app.
                  </p>
                </div>

                {error && <ErrorBox message={error} />}

                {verifying && (
                  <p className="flex items-center justify-center gap-2 text-sm text-neutral-400">
                    <Loader2 size={15} className="animate-spin" /> Signing you in…
                  </p>
                )}

                <div className="flex items-center justify-between gap-2 text-xs">
                  <button
                    onClick={() => { setStep("email"); setCode(""); setError(""); setNotice(""); }}
                    className="flex items-center gap-1.5 text-neutral-400 hover:text-white"
                  >
                    <ArrowLeft size={13} /> Change email
                  </button>
                  <button
                    onClick={() => sendCode()}
                    disabled={cooldown > 0 || sending}
                    className="flex items-center gap-1.5 text-amber-300 hover:text-amber-200 disabled:text-neutral-500"
                  >
                    <KeyRound size={13} /> {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
      <AlertCircle size={15} className="mt-0.5 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
