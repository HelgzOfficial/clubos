"use client";

import { useEffect } from "react";

// Registers the PWA service worker so ClubOS can be installed to a phone's
// home screen (both iOS Safari's "Add to Home Screen" and Android Chrome's
// install prompt look for this + the manifest link to offer the install).
// Silently does nothing on browsers without support — this is purely an
// enhancement, never required for the app to work.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Non-fatal — the app works fine without an active service worker,
      // it just won't be installable/offline-friendly on that browser.
    });
  }, []);

  return null;
}
