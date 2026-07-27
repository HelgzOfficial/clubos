"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { club } from "@/lib/sample-data";
import { loadClubSettings, saveClubSettings, type ClubSettings } from "@/lib/club-settings";
import { applyClubColors } from "@/components/club-color-provider";
import { extractCrestColors } from "@/lib/extract-crest-colors";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Check, PlugZap, ArrowRight, Upload, Loader2, KeyRound, AlertCircle } from "lucide-react";

const COLOR_FIELDS: { key: keyof ClubSettings; label: string; hint: string }[] = [
  { key: "primaryColor", label: "Primary", hint: "Buttons, highlights, active nav" },
  { key: "secondaryColor", label: "Secondary", hint: "Lighter accents" },
  { key: "accentColor", label: "Accent", hint: "Badges and callouts" },
];

export default function SettingsPage() {
  const { session } = useAuth();
  const [ready, setReady] = useState(false);
  const [branding, setBranding] = useState<ClubSettings>(club);
  const [saved, setSaved] = useState(false);
  const [crestSwatches, setCrestSwatches] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const crestInputRef = useRef<HTMLInputElement>(null);

  // Change-password form — for a user who's already signed in and just
  // wants to update their password, as opposed to the "forgot password"
  // email-link flow on the sign-in page for people who are locked out.
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !session?.user?.email) return;
    setPasswordError("");
    setPasswordSaved(false);

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation don't match.");
      return;
    }

    setPasswordSaving(true);
    // Re-verify the current password first, rather than trusting that
    // whoever is sitting at an already-unlocked session is really the
    // account owner — this re-authenticates against Supabase before we'll
    // let the password be changed.
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword,
    });
    if (verifyError) {
      setPasswordSaving(false);
      setPasswordError("Current password is incorrect.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (error) {
      setPasswordError(error.message);
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordSaved(true);
    setTimeout(() => setPasswordSaved(false), 2500);
  }

  useEffect(() => {
    setBranding(loadClubSettings(club));
    setReady(true);
  }, []);

  function saveBranding() {
    saveClubSettings(branding);
    applyClubColors(branding);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // Live-preview colour changes immediately, so the picker feels instant —
  // "Save Branding" is what persists it for next visit/other devices.
  function updateColor(key: keyof ClubSettings, value: string) {
    const next = { ...branding, [key]: value };
    setBranding(next);
    applyClubColors(next);
  }

  async function handleCrestFile(file: File) {
    setExtracting(true);
    try {
      const colors = await extractCrestColors(file);
      setCrestSwatches(colors);
    } finally {
      setExtracting(false);
    }
  }

  if (!ready) {
    return (
      <AppShell>
        <p className="text-sm text-neutral-400">Loading…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-neutral-500">Club branding, appearance, and subscription.</p>
      </div>

      <div className="space-y-5 max-w-2xl">
        <Card>
          <CardHeader><CardTitle>Club Branding</CardTitle></CardHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-500">Club name</label>
              <input
                value={branding.name}
                onChange={(e) => setBranding({ ...branding, name: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-500">Crest initials</label>
              <input
                value={branding.crestInitials}
                maxLength={4}
                onChange={(e) => setBranding({ ...branding, crestInitials: e.target.value.toUpperCase() })}
                className="w-full max-w-[160px] rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
              />
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-white/10 p-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl text-navy-950 text-xs font-bold shrink-0"
                style={{ backgroundColor: branding.primaryColor }}
              >
                {branding.crestInitials || "?"}
              </div>
              <div>
                <p className="text-sm font-semibold">{branding.name || "Your Club"}</p>
                <p className="text-xs text-neutral-400">Preview — this is how it appears in the sidebar</p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
          <p className="mb-4 text-xs text-neutral-400">
            Set the app's colour scheme to match your club colours — every button, badge and highlight across ClubOS uses these.
          </p>

          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {COLOR_FIELDS.map(({ key, label, hint }) => (
              <div key={key}>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">{label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={branding[key]}
                    onChange={(e) => updateColor(key, e.target.value)}
                    className="h-9 w-11 cursor-pointer rounded-lg border border-white/10 bg-transparent"
                  />
                  <span className="text-xs text-neutral-400">{branding[key]}</span>
                </div>
                <p className="mt-1 text-[11px] text-neutral-500">{hint}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-white/10 p-3">
            <p className="mb-2 text-xs font-medium text-neutral-500">Or pick colours from your crest</p>
            <button
              onClick={() => crestInputRef.current?.click()}
              className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-navy-600 dark:hover:bg-navy-800"
            >
              {extracting ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              {extracting ? "Reading crest…" : "Upload Crest Image"}
            </button>
            <input
              ref={crestInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCrestFile(f); e.target.value = ""; }}
            />
            {crestSwatches.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {crestSwatches.map((hex) => (
                  <button
                    key={hex}
                    title={`Use ${hex} as primary — shift-click for secondary, alt-click for accent`}
                    onClick={(e) => updateColor(e.shiftKey ? "secondaryColor" : e.altKey ? "accentColor" : "primaryColor", hex)}
                    className="h-8 w-8 rounded-lg border border-white/20"
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            )}
            {crestSwatches.length > 0 && (
              <p className="mt-2 text-[11px] text-neutral-500">Click a swatch for Primary, Shift-click for Secondary, Alt-click for Accent.</p>
            )}
          </div>

          <button
            onClick={saveBranding}
            className="mt-4 flex items-center gap-2 rounded-xl bg-club-primary text-navy-950 px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {saved ? <><Check size={15} /> Saved</> : "Save Branding & Appearance"}
          </button>
        </Card>

        <Card>
          <CardHeader><CardTitle>Account & Security</CardTitle></CardHeader>
          <p className="mb-4 text-sm text-neutral-400">
            Signed in as <span className="text-neutral-200">{session?.user?.email ?? "—"}</span>
          </p>
          <form onSubmit={handleChangePassword} className="space-y-3 max-w-sm">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-500">Current password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-500">New password</label>
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
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-500">Confirm new password</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                placeholder="Repeat new password"
              />
            </div>
            {passwordError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <p>{passwordError}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={passwordSaving}
              className="flex items-center gap-2 rounded-xl bg-club-primary text-navy-950 px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <KeyRound size={15} />
              {passwordSaving ? "Updating…" : passwordSaved ? "Password Updated" : "Change Password"}
            </button>
          </form>
        </Card>

        <Card>
          <CardHeader><CardTitle>Staff & Access</CardTitle></CardHeader>
          <p className="mb-3 text-sm text-neutral-400">
            Invite people, assign roles, and manage who can edit what — that's all moved to its own module now.
          </p>
          <Link
            href="/staff"
            className="inline-flex items-center gap-1.5 rounded-xl bg-club-primary text-navy-950 px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Open Staff Module <ArrowRight size={14} />
          </Link>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Video & Data Integrations</CardTitle>
            <Badge variant="amber">Not Connected</Badge>
          </CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy-600 dark:bg-navy-800">
              <PlugZap size={16} className="text-neutral-400" />
            </div>
            <div className="text-sm text-neutral-400 space-y-2">
              <p>
                The Analysis module works with clips you upload directly, and Match Centre now has manual lineup, goals, and substitution
                tracking — both of those are fully functional today. Live feeds from Wyscout or Hudl (match data, tagged clips, physical
                stats, lineups pulled in automatically) are not connected.
              </p>
              <p>
                A login to either platform&apos;s dashboard isn&apos;t the same as API access. Wyscout and Hudl both require them to
                issue your club separate API credentials, and those credentials would need to be stored securely on a server — never
                typed into a page like this one, which only saves things in your browser. This is the same reasoning that kept ClubOS
                from accepting real Wyscout keys earlier, and it applies equally to Hudl.
              </p>
              <p>
                If you&apos;re able to get API access from either provider&apos;s account manager, let us know and we&apos;ll build a
                proper server-side connection for it — likely alongside further Supabase work, since credentials like that need to live
                on a server, not in the browser.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>Subscription</CardTitle></CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">ClubOS — Beta</p>
              <p className="text-xs text-neutral-400 mt-1">You're building on the free beta while the app is in development.</p>
            </div>
            <Badge variant="green">Active</Badge>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
