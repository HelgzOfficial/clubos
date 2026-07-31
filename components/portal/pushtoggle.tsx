"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { enablePush, disablePush, isPushEnabled, pushSupport } from "@/lib/push-client";

// Notification opt-in for a player, on this device.
//
// A push subscription belongs to a browser install rather than a person, so a
// player with the app on their phone and a tablet has to switch it on in both
// — the copy says so rather than leaving them wondering why one is silent.
export function PortalPushToggle({ playerId, email }: { playerId: string; email: string | null }) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [support, setSupport] = useState<ReturnType<typeof pushSupport>>("unsupported");

  useEffect(() => {
    setSupport(pushSupport());
    isPushEnabled().then(setEnabled).catch(() => {});
  }, []);

  async function toggle() {
    setBusy(true);
    setError("");
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
      } else {
        await enablePush({ role: "player", email, playerId });
        setEnabled(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't change your notification settings.");
    } finally {
      setBusy(false);
    }
  }

  if (support === "unsupported") {
    return (
      <p className="text-xs text-neutral-500">
        This browser can&apos;t send notifications when the app is closed.
      </p>
    );
  }

  if (support === "needs-install") {
    return (
      <p className="text-xs text-neutral-400">
        To get alerts when the app is closed, add ClubOS to your home screen first — tap the share button in
        Safari, then <span className="text-neutral-200">Add to Home Screen</span>.
      </p>
    );
  }

  return (
    <div>
      <button
        onClick={toggle}
        disabled={busy}
        className={`flex w-full touch-manipulation items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors disabled:opacity-60 ${
          enabled
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
            : "border-white/10 text-neutral-300 hover:bg-navy-600 dark:hover:bg-navy-800"
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {enabled ? <Bell size={15} className="shrink-0" /> : <BellOff size={15} className="shrink-0" />}
          <span className="min-w-0 truncate">{enabled ? "Notifications on" : "Turn on notifications"}</span>
        </span>
        {busy ? (
          <Loader2 size={14} className="shrink-0 animate-spin" />
        ) : (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${enabled ? "bg-emerald-500/20" : "bg-white/10 text-neutral-400"}`}>
            {enabled ? "ON" : "OFF"}
          </span>
        )}
      </button>

      <p className="mt-1.5 text-xs text-neutral-500">
        {enabled
          ? "You'll be told when the medical team replies or confirms a treatment slot — even with the app closed. Turn it on separately on each device."
          : "Get told when the medical team replies or confirms a treatment slot, without having to keep checking."}
      </p>
      {error && <p className="mt-1.5 text-xs text-red-300">{error}</p>}
    </div>
  );
}
