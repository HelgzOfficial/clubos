"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellRing } from "lucide-react";
import { usePermissions } from "@/lib/permissions";
import { fetchPlayers, type DbPlayer } from "@/lib/players-db";
import {
  fetchUnreadCountsForDoctor, subscribeToAllMessages, type MedicalMessage,
} from "@/lib/medical-messages-db";

// Unread medical messages, visible from anywhere in the app.
//
// Before this, a message from a player only showed as a badge inside the
// Medical module — so a physio working in any other part of ClubOS had no way
// of knowing one had arrived. This subscribes to inserts across every thread,
// not just an open one.
//
// Scope note: a browser notification only fires while ClubOS is open in a tab.
// Notifying a closed app needs Web Push (VAPID keys and a push service), which
// is a bigger piece of work — this covers "at their desk with the app open",
// which is the realistic case for a club physio.
export function MessageBell() {
  const { can, role } = usePermissions();
  const isMedical = can("medical");

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [players, setPlayers] = useState<DbPlayer[]>([]);
  const [open, setOpen] = useState(false);
  const [latest, setLatest] = useState<MedicalMessage | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
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

  async function enableAlerts() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }

  if (!isMedical || role === "player") return null;

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

            {permission === "default" && (
              <button
                onClick={enableAlerts}
                className="w-full rounded-lg border border-white/10 px-2 py-1.5 text-xs text-neutral-300 transition-colors hover:bg-navy-600 dark:hover:bg-navy-800"
              >
                Also alert me on this device
              </button>
            )}
            {permission === "denied" && (
              <p className="px-2 pt-1 text-[11px] text-neutral-500">
                Device alerts are blocked in your browser settings.
              </p>
            )}
            {permission === "granted" && (
              <p className="px-2 pt-1 text-[11px] text-neutral-500">
                Device alerts on — you&apos;ll be notified while ClubOS is open.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
