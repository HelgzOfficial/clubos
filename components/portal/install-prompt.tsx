"use client";

import { useEffect, useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";

// Chrome fires this instead of showing its own banner once you call
// preventDefault, which is what lets us put the install button somewhere a
// player will actually find it.
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "clubos-portal-install-dismissed";

// Adding the portal to a home screen is the difference between players opening
// it and forgetting it exists, but neither phone makes it obvious: iOS has no
// install prompt at all (it's buried in the Share sheet) and Android hides its
// one behind the browser menu. So the portal asks directly.
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [show, setShow] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already running from the home screen — nothing to offer.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const ua = window.navigator.userAgent;
    // iPadOS reports itself as a Mac, so the touch-point check catches iPads
    // that would otherwise look like desktop Safari.
    const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    setIsIOS(ios);
    if (ios) setShow(true);

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferred(e as InstallEvent);
      setShow(true);
    }
    function onInstalled() {
      setInstalled(true);
      setShow(false);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome === "accepted") setInstalled(true);
    setShow(false);
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  if (installed || !show) return null;

  return (
    <div className="relative mb-4 rounded-card border border-club-primary/30 bg-club-primary/10 p-4">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 flex h-7 w-7 touch-manipulation items-center justify-center rounded-full text-club-primary/70 hover:bg-club-primary/10 hover:text-club-primary"
      >
        <X size={14} />
      </button>

      <p className="pr-8 text-sm font-medium text-white">Add the portal to your home screen</p>

      {isIOS ? (
        <>
          <p className="mt-1 text-xs text-neutral-300">
            It then opens full screen like a normal app, and you can turn on notifications for team news.
          </p>
          <ol className="mt-3 space-y-1.5 text-xs text-neutral-200">
            <li className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-club-primary/25 text-[10px] font-semibold">1</span>
              Tap <Share size={12} className="inline align-[-1px]" /> at the bottom of Safari
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-club-primary/25 text-[10px] font-semibold">2</span>
              Scroll down and tap <Plus size={12} className="inline align-[-1px]" /> Add to Home Screen
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-club-primary/25 text-[10px] font-semibold">3</span>
              Tap Add
            </li>
          </ol>
          <p className="mt-2 text-[11px] text-neutral-400">
            It has to be Safari — Chrome on iPhone can&apos;t add to the home screen.
          </p>
        </>
      ) : (
        <>
          <p className="mt-1 text-xs text-neutral-300">
            It then opens full screen like a normal app, and you can turn on notifications for team news.
          </p>
          <button
            onClick={install}
            disabled={!deferred}
            className="mt-3 flex touch-manipulation items-center gap-2 rounded-xl bg-club-primary px-3.5 py-2 text-sm font-medium text-navy-950 disabled:opacity-60"
          >
            <Download size={15} /> Install
          </button>
        </>
      )}
    </div>
  );
}
