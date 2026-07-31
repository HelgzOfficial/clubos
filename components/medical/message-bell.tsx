"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { usePermissions } from "@/lib/permissions";
import { fetchPlayers, type DbPlayer } from "@/lib/players-db";
import {
  fetchUnreadCountsForDoctor, subscribeToAllMessages, type MedicalMessage,
} from "@/lib/medical-messages-db";
import { enablePush, disablePush, isPushEnabled, pushSupport } from "@/lib/push-client";

// Unread medical messages, visible from anywhere in the app.
//
// Before this, a message from a player only showed as a badge inside the
// Medical module — so a physio working in any other part of ClubOS had no way
// of knowing one had arrived. This subscribes to inserts across every thread,
// not just an open one.
//
// Two layers of alerting, because they cover different situations:
//   - while ClubOS is open, the badge and a same-tab Notification
//   - when it's closed entirely, Web Push through the service worker
// The second is opt-in per device, since a subscription is per browser-install
// rather than per person.
export function MessageBell() {
  const { can, role, appUser } = usePermissions();
  const isMedical = can("medical");

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [players, setPlayers] = useState<DbPlayer[]>([]);
  const [open, setOpen] = useState(false);
  const [latest, setLatest] = useState<MedicalMessage | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState("");
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ringing, setRinging] = useState(false);

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  const load = useCallback(async () => {
    if (!isMedical) return;
    try {
      const [c, p] = await Promise.all([fetchUnreadCountsForDoctor(), fetchPlayers()]);
      setCounts(c);
      setPlayers(p);
    } catch {
      // A failed count shouldn't break the topbar for everyone.
    }
  }, [isMedical]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPermission("Notification" in window ? Notification.permission : "unsupported");
    isPushEnabled().then(setPushOn).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isMedical) return;
    const unsubscribe = subscribeToAllMessages((msg) => {
      // Only messages from players need the physio's attention — their own
      // replies come back through the same channel.
      if (msg.sender_role !== "player") return;

      setCounts((prev) => ({ ...prev, [msg.player_id]: (prev[msg.player_id] ?? 0) + 1 }));
      setLatest(msg);
      setRinging(true);
      if (ringTimer.current) clearTimeout(ringTimer.current);
      ringTimer.current = setTimeout(() => setRinging(false), 6000);

      // Only interrupt with an OS notification when they're not already
      // looking at ClubOS — otherwise the badge is enough.
      if (typeof window !== "undefined" && "Notification" in window
        && Notification.permission === "granted" && document.hidden) {
        try {
          new Notification(`New message from ${msg.sender_name}`, {
            body: msg.body.slice(0, 120),
            tag: `medical-${msg.player_id}`,
            icon: "/icon-192.png",
          });
        } catch {
          // Some browsers throw on constructing notifications outside a
          // service worker; the in-app badge still works.
        }
      }
    });
    return () => {
      unsubscribe();
      if (ringTimer.current) clearTimeout(ringTimer.current);
    };
  }, [isMedical]);

  async function togglePush() {
    setPushBusy(true);
    setPushError("");
    try {
      if (pushOn) {
        await disablePush();
        setPushOn(false);
      } else {
        await enablePush({ role, email: appUser?.email ?? null });
        setPushOn(true);
        setPermission("granted");
      }
    } catch (e) {
      setPushError(e instanceof Error ? e.message : "Couldn't change notification settings.");
    } finally {
      setPushBusy(false);
    }
  }

  if (!isMedical || role === "player") return null;

  const support = pushSupport();
  const withUnread = Object.entries(counts).filter(([, n]) => n > 0);
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "A player";

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen((v) => !v); setRinging(false); }}
        aria-label={total > 0 ? `${total} unread medical messages` : "Notifications"}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-navy-700 transition-colors hover:bg-navy-600 dark:bg-navy-900 dark:hover:bg-navy-800"
      >
        {ringing ? <BellRing size={16} className="animate-pulse text-club-primary" /> : <Bell size={16} />}
        {total > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {total > 9 ? "9+" : total}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-20 w-72 rounded-xl border border-white/10 bg-navy-700 p-2 shadow-softDark dark:bg-navy-900">
            <p className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Medical messages
            </p>

            {withUnread.length === 0 ? (
              <p className="px-2 pb-2 text-sm text-neutral-400">
                {latest ? "All caught up." : "No unread messages."}
              </p>
            ) : (
              <ul className="pb-1">
                {withUnread.map(([playerId, n]) => (
                  <li key={playerId}>
                    <Link
                      href="/medical"
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-navy-600 dark:hover:bg-navy-800"
                    >
                      <span className="min-w-0 truncate">{nameOf(playerId)}</span>
                      <span className="shrink-0 rounded-full bg-red-500/15 px-1.5 text-[11px] font-semibold text-red-300">
                        {n}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-1 border-t border-white/10 pt-2">
              {support === "unsupported" ? (
                <p className="px-2 text-[11px] text-neutral-500">
                  This browser doesn&apos;t support notifications when ClubOS is closed.
                </p>
              ) : support === "needs-install" ? (
                <p className="px-2 text-[11px] text-neutral-500">
                  On iPhone, add ClubOS to your home screen to get alerts when it&apos;s closed.
                </p>
              ) : (
                <button
                  onClick={togglePush}
                  disabled={pushBusy}
                  className="flex w-full touch-manipulation items-center justify-between gap-2 rounded-lg border border-white/10 px-2 py-1.5 text-xs text-neutral-300 transition-colors hover:bg-navy-600 disabled:opacity-60 dark:hover:bg-navy-800"
                >
                  <span>Alert me when ClubOS is closed</span>
                  {pushBusy ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${pushOn ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-neutral-400"}`}>
                      {pushOn ? "ON" : "OFF"}
                    </span>
                  )}
                </button>
              )}
              {pushOn && (
                <p className="px-2 pt-1 text-[11px] text-neutral-500">
                  On for this device. Turn it on separately on your phone.
                </p>
              )}
              {pushError && <p className="px-2 pt-1 text-[11px] text-red-300">{pushError}</p>}
              {permission === "denied" && !pushError && (
                <p className="px-2 pt-1 text-[11px] text-neutral-500">
                  Notifications are blocked for this site in your browser settings.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
