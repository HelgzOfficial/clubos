"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { club } from "@/lib/sample-data";
import {
  loadClubSettings, saveClubSettings, ClubSettings,
  loadStaff, saveStaff, StaffMember,
} from "@/lib/club-settings";
import { Trash2, Plus, Check, PlugZap } from "lucide-react";

const ROLES: StaffMember["role"][] = [
  "Owner", "Admin", "Head Coach", "Assistant Coach", "Analyst", "Medical", "Recruitment", "Player",
];

function StaffAvatar({ name }: { name: string }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-600 dark:bg-navy-800 text-xs font-semibold shrink-0">
      {initials}
    </div>
  );
}

export default function SettingsPage() {
  const [ready, setReady] = useState(false);
  const [branding, setBranding] = useState<ClubSettings>(club);
  const [saved, setSaved] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<StaffMember["role"]>("Assistant Coach");

  useEffect(() => {
    setBranding(loadClubSettings(club));
    setStaff(loadStaff());
    setReady(true);
  }, []);

  function saveBranding() {
    saveClubSettings(branding);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function addStaff() {
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    const next = [...staff, { id: `s-${Date.now()}`, name: inviteName.trim(), email: inviteEmail.trim(), role: inviteRole }];
    setStaff(next);
    saveStaff(next);
    setInviteName("");
    setInviteEmail("");
    setInviteRole("Assistant Coach");
    setShowInvite(false);
  }

  function removeStaff(id: string) {
    const next = staff.filter((s) => s.id !== id);
    setStaff(next);
    saveStaff(next);
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
        <p className="text-sm text-neutral-500">Club branding, staff access, and subscription.</p>
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
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Crest initials</label>
                <input
                  value={branding.crestInitials}
                  maxLength={4}
                  onChange={(e) => setBranding({ ...branding, crestInitials: e.target.value.toUpperCase() })}
                  className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Crest colour</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={branding.primaryColor}
                    onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                    className="h-9 w-11 cursor-pointer rounded-lg border border-white/10 bg-transparent"
                  />
                  <span className="text-sm text-neutral-400">{branding.primaryColor}</span>
                </div>
              </div>
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

            <button
              onClick={saveBranding}
              className="flex items-center gap-2 rounded-xl bg-club-primary text-navy-950 px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {saved ? <><Check size={15} /> Saved</> : "Save Branding"}
            </button>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Staff & Access</CardTitle>
            <button
              onClick={() => setShowInvite((v) => !v)}
              className="flex items-center gap-1.5 rounded-xl bg-club-primary text-navy-950 px-3 py-1.5 text-xs font-medium hover:opacity-90 transition-opacity"
            >
              <Plus size={13} /> Invite
            </button>
          </CardHeader>

          {showInvite && (
            <div className="mb-4 space-y-3 rounded-xl border border-white/10 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Full name"
                  className="rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                />
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Email address"
                  type="email"
                  className="rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
                />
              </div>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as StaffMember["role"])}
                className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
              >
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <button
                onClick={addStaff}
                className="w-full rounded-xl bg-club-primary text-navy-950 px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Add to Staff List
              </button>
              <p className="text-xs text-neutral-400">
                This adds them to your staff list here. It doesn't send a real invite email yet — that needs Supabase to be connected.
              </p>
            </div>
          )}

          <ul className="divide-y divide-white/10">
            {staff.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-3">
                <StaffAvatar name={s.name} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  <p className="text-xs text-neutral-400 truncate">{s.email}</p>
                </div>
                <Badge variant="neutral">{s.role}</Badge>
                <button
                  onClick={() => removeStaff(s.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10 shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Wyscout Integration</CardTitle>
            <Badge variant="amber">Not Connected</Badge>
          </CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy-600 dark:bg-navy-800">
              <PlugZap size={16} className="text-neutral-400" />
            </div>
            <div className="text-sm text-neutral-400 space-y-2">
              <p>
                The Analysis module currently works with clips you upload directly — that part is fully functional. A live Wyscout feed
                (match data, tagged clips, physical stats pulled in automatically) is not connected yet.
              </p>
              <p>
                A club login to the Wyscout platform isn't the same as API access. To turn this on for real, Wyscout would need to issue
                you separate API credentials for your club, and those credentials would need to be stored securely on a server — not typed
                into a page like this one, which only saves things in your browser. Once ClubOS is connected to a proper backend
                (Supabase), we can build this the right way.
              </p>
              <p>If you're able to get API access from your Wyscout account manager, let us know and we'll wire it up.</p>
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
